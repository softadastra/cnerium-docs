# Idempotency

`cnerium::reliability::Idempotency` is the service used by Cnerium to coordinate durable route idempotency.

Application code usually does not create this type directly. Most applications use idempotency through `cnerium.durable_post(...)`. The durable route creates the request wrapper, reads the `Idempotency-Key`, computes the request body hash, asks the idempotency layer what to do, then either executes the handler, replays a stored response, or rejects the request.

This page documents the lower-level API because it explains the behavior behind durable routes.

## Header

```cpp
#include <cnerium/cnerium.hpp>
```

or directly:

```cpp
#include <cnerium/reliability/Idempotency.hpp>
```

Most applications should include:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Namespace

```cpp
namespace cnerium::reliability
```

The type is:

```cpp
cnerium::reliability::Idempotency
```

## Purpose

`Idempotency` coordinates the retry decision for a durable operation.

It uses:

```txt
operation name
Idempotency-Key
request body hash
stored request metadata
stored response metadata
```

to decide whether the current request should execute, replay, conflict, or be rejected as invalid.

The normal public route API hides this detail:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

Internally, that durable route uses the idempotency layer to decide whether `handler` should run.

## Construction

`Idempotency` is constructed with a Cnerium store:

```cpp
explicit Idempotency(cnerium::store::Store &store) noexcept;
```

Example:

```cpp
cnerium::reliability::Idempotency idempotency{store};
```

The store is used to read and write the reliability metadata needed by durable routes.

Application code normally does not create the store or idempotency service manually. The attached Cnerium runtime owns those resources.

## check

Checks whether a durable request should execute, replay, conflict, or fail as invalid.

```cpp
cnerium::reliability::DurableResult check(
    std::string_view operation,
    const cnerium::reliability::IdempotencyKey &key,
    std::string_view body);
```

This overload receives the raw request body and computes the hash internally.

Example:

```cpp
const auto result = idempotency.check(
        "orders.create",
        key,
        request_body);
```

The result tells the caller what action should happen next.

## check_hash

Checks whether a durable request should execute, replay, conflict, or fail as invalid using a precomputed request hash.

```cpp
cnerium::reliability::DurableResult check_hash(
    std::string_view operation,
    const cnerium::reliability::IdempotencyKey &key,
    const cnerium::reliability::RequestHash &hash);
```

Example:

```cpp
const auto hash = cnerium::reliability::RequestHash::from_body(request_body);

const auto result = idempotency.check_hash(
        "orders.create",
        key,
        hash);
```

Use this overload when the request hash has already been computed.

Most application code does not need this. Durable routes compute and use the hash internally.

## commit

Commits the completed durable response for a request body.

```cpp
bool commit(
    std::string_view operation,
    const cnerium::reliability::IdempotencyKey &key,
    std::string_view body,
    const cnerium::store::StoredResponse &response);
```

This overload computes the request hash from the body, then stores the hash and response metadata.

Example:

```cpp
const bool committed = idempotency.commit(
        "orders.create",
        key,
        request_body,
        stored_response);
```

A successful commit means future retries with the same operation, same key, and same body can replay the stored response.

## commit_hash

Commits the completed durable response using a precomputed request hash.

```cpp
bool commit_hash(
    std::string_view operation,
    const cnerium::reliability::IdempotencyKey &key,
    const cnerium::reliability::RequestHash &hash,
    const cnerium::store::StoredResponse &response);
```

Example:

```cpp
const bool committed = idempotency.commit_hash(
        "orders.create",
        key,
        hash,
        stored_response);
```

This is useful when the caller already has the request hash from the earlier check step.

## hash_body

Computes the stable request body hash used by Cnerium.

```cpp
static cnerium::reliability::RequestHash
hash_body(std::string_view body);
```

Example:

```cpp
const auto hash = cnerium::reliability::Idempotency::hash_body(
        R"({"product_id":"p1","quantity":2})");
```

Cnerium uses a stable hashing strategy so the retry decision does not depend on implementation-defined `std::hash` behavior.

Application code usually does not need to call this directly.

## DurableResult

The check methods return `cnerium::reliability::DurableResult`.

The result contains an action:

```txt
Execute
Replay
Conflict
Invalid
```

The durable route maps those actions to HTTP behavior:

```txt
Execute
  run the user handler

Replay
  return the stored response

Conflict
  return 409 Conflict

Invalid
  return 400 Bad Request
```

This is the core decision model behind Cnerium durable routes.

## Execute result

`Execute` means the key is new for the operation.

Example:

```txt
operation: orders.create
key:       order-123
body:      {"product_id":"p1","quantity":2}
```

If Cnerium has no stored metadata for that operation and key, the request is considered new.

The durable route should execute the handler, then commit the response.

Conceptually:

```cpp
const auto result = idempotency.check("orders.create", key, body);

if (result.should_execute())
{
  const auto durable_response = handler(request);
  const auto stored_response = to_stored_response(durable_response);

  idempotency.commit(
      "orders.create",
      key,
      body,
      stored_response);

  return durable_response;
}
```

Application code normally does not write this logic directly. `DurableRoute` owns it.

## Replay result

`Replay` means the same key was already used with the same request body hash.

Example:

```txt
stored:
  operation: orders.create
  key: order-123
  body hash: abc

incoming:
  operation: orders.create
  key: order-123
  body hash: abc
```

The request is a safe retry. The durable route should return the stored response without executing the handler again.

This protects side effects inside the handler from running twice.

## Conflict result

`Conflict` means the same key was already used with a different request body hash.

Example:

```txt
stored:
  operation: orders.create
  key: order-123
  body hash: abc

incoming:
  operation: orders.create
  key: order-123
  body hash: def
```

The request is not a safe retry. The key now refers to a different payload.

The durable route should return:

```txt
HTTP 409 Conflict
```

The handler should not run, and the previous response should not be replayed for the changed body.

## Invalid result

`Invalid` means the request cannot be evaluated as a durable operation.

The common case is a missing or empty idempotency key.

A durable route should reject this request before the handler runs:

```txt
HTTP 400 Bad Request
```

A critical write route cannot safely process a request without a stable operation key.

## Relationship with IdempotencyKey

`Idempotency` uses `cnerium::reliability::IdempotencyKey` to represent the `Idempotency-Key` header.

Example:

```cpp
cnerium::reliability::IdempotencyKey key{"order-123"};
```

The key identifies one logical client operation attempt.

The same key should be reused only for retries of the same request body.

## Relationship with RequestHash

`Idempotency` uses `cnerium::reliability::RequestHash` to detect whether a repeated key still refers to the same body.

Example:

```cpp
const auto hash = cnerium::reliability::RequestHash::from_body(R"({"product_id":"p1","quantity":2})");
```

The key alone is not enough. A client could accidentally reuse the same key with a different body. The request hash lets Cnerium detect that and return a conflict.

## Relationship with ReplayProtection

`Idempotency` is a higher-level service built around replay protection.

Replay protection owns the low-level decision about whether a request is new, replayable, conflicting, or invalid. `Idempotency` exposes convenient methods that work with either raw request bodies or precomputed request hashes.

The relationship is:

```txt
Idempotency
  coordinates body hashing and commit flow

ReplayProtection
  checks stored metadata and returns a durable decision

Store
  persists request hashes and stored responses
```

## Relationship with Store

`Idempotency` depends on `cnerium::store::Store`.

The store is where Cnerium persists the data needed for future retry decisions.

That data includes:

```txt
request hash for an operation and key
stored response for an operation and key
```

Application code should usually configure the store indirectly through `AppConfig`:

```cpp
config.set_data_dir("data/cnerium");
```

Then the attached Cnerium runtime prepares the store when `cnerium.start()` is called.

## Relationship with DurableRoute

`DurableRoute` is the normal caller of `Idempotency`.

The route does the following:

```txt
wrap Vix request as DurableRequest
extract Idempotency-Key
compute request hash
ask Idempotency what to do
execute handler if the result is Execute
store response after successful execution
replay response if the result is Replay
return conflict if the result is Conflict
return bad request if the result is Invalid
```

Application code should usually stay at the route level:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

and not manually coordinate idempotency in every handler.

## Example flow

This is a simplified internal flow:

```cpp
cnerium::reliability::IdempotencyKey key{request.idempotency_key_value()};

const auto result =idempotency.check(
        "orders.create",
        key,
        request.body());

if (result.should_replay())
{
  return response_from(result.response());
}

if (result.is_conflict())
{
  return cnerium::DurableResponse::conflict(
      "Idempotency-Key was reused with a different request body");
}

if (result.is_invalid())
{
  return cnerium::DurableResponse::bad_request(
      "Missing or invalid Idempotency-Key");
}

auto response = handler(request);

idempotency.commit(
    "orders.create",
    key,
    request.body(),
    response.to_stored_response());

return response;
```

The exact implementation may differ, but the contract is the same.

## Public usage through durable_post

Most applications should use this public API:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body = request.json();
      const std::string product_id = cnerium::support::string_or(body, "product_id", "");

      if (product_id.empty())
      {
        return cnerium::DurableResponse::bad_request(
            "Missing required field: product_id");
      }

      return cnerium::created({
          {"ok", true}
      });
    });
```

This keeps the handler focused on application logic. The idempotency service remains inside the durable route layer.

## Testing idempotency behavior

A durable route using `Idempotency` should be tested with these cases:

```txt
new key and valid body
  returns Execute internally
  handler runs
  response is stored

same key and same body
  returns Replay internally
  stored response is returned
  handler does not run

same key and different body
  returns Conflict internally
  HTTP 409 is returned
  handler does not run

missing key
  returns Invalid internally
  HTTP 400 is returned
  handler does not run
```

The public HTTP tests should look like this:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'

curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'

curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Expected behavior:

```txt
first request
  201 Created

safe retry
  same stored response

unsafe reuse
  409 Conflict
```

## Commit timing

The idempotency layer stores the response after the handler produces it.

For high-value operations, think carefully about the relationship between application state and stored response commit.

For example, a handler may:

```txt
create order in database
return DurableResponse
Cnerium stores response
```

If the process crashes after the database write but before the stored response is committed, the domain state may exist without a replayable response.

Cnerium improves retry behavior, but it does not remove the need for database transactions, unique constraints, audit logs, and domain-level consistency design.

## External systems

When a durable handler calls an external provider, use the provider’s idempotency mechanism when available.

For example, a payment route may use the same client operation key across layers:

```txt
client Idempotency-Key
  -> Cnerium durable route
  -> application payment service
  -> payment provider idempotency key
```

Cnerium protects the route. Provider-level idempotency protects the provider-side operation.

## Common mistakes

Do not manually create a new idempotency key inside the server handler. The key must come from the client and remain stable across retries.

Do not reuse the same key with different request bodies.

Do not bypass `durable_post` and then try to implement partial idempotency manually in each route.

Do not treat stored responses as a generic cache. They are part of the durable operation contract.

Do not assume idempotency replaces domain-level constraints, transactions, or authorization.

## Summary

`cnerium::reliability::Idempotency` coordinates the durable route retry decision.

It checks the operation name, idempotency key, and request body hash. A new request executes the handler and commits a stored response. A safe retry replays that stored response. A reused key with a different body returns a conflict. A missing key is invalid.

Most applications use this behavior through `cnerium.durable_post`, not by calling `Idempotency` directly.
