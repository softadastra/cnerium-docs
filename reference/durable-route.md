# DurableRoute

`cnerium::http::DurableRoute` is the execution object behind a Cnerium durable route.

Most application code does not create `DurableRoute` directly. It is usually created internally when you call:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

The public application API is `durable_post`. `DurableRoute` is documented because it defines the execution contract behind durable routes: idempotency, request hashing, replay protection, stored responses, and handler execution.

A durable route is still registered into a `vix::App`. Vix owns the HTTP application. Cnerium owns the reliability decision around the selected route.

## Header

```cpp
#include <cnerium/cnerium.hpp>
```

or directly:

```cpp
#include <cnerium/http/DurableRoute.hpp>
```

Most applications should include:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Namespace

The concrete type is:

```cpp
cnerium::http::DurableRoute
```

Depending on the current public aliases, application code may interact with durable routes only through `cnerium::AttachedApp`.

The recommended public usage is:

```cpp
auto cnerium = cnerium::attach(app);

cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

## Purpose

`DurableRoute` applies Cnerium’s reliability rules around a user handler.

A normal Vix route calls the handler when the route matches.

A durable route first checks whether the request is safe to execute.

The route can decide to:

```txt
execute the handler
return a stored response
reject the request as invalid
reject the request as a conflict
```

The user handler only runs when Cnerium decides that the request is a new safe operation.

## Construction

A `DurableRoute` is created from three values:

```cpp
DurableRoute(std::string operation,
             cnerium::store::Store &store,
             cnerium::http::DurableHandler handler);
```

The values are:

```txt
operation
  Stable operation name used by the reliability layer.

store
  Cnerium store used to read and write request hashes and stored responses.

handler
  User-defined durable handler executed only for new safe requests.
```

Application code normally does not write this constructor directly. `AttachedApp::durable_post` creates the durable route and stores it for the lifetime of the attached Cnerium layer.

## Operation name

The operation name identifies the logical backend operation.

Example:

```txt
orders.create
```

It should be stable, explicit, and specific.

Good names:

```txt
orders.create
payments.create
invoices.create
users.register
workflows.start
```

Avoid generic names:

```txt
create
post
submit
handler
action
```

The operation name is part of the idempotency scope. Changing it changes where Cnerium looks for stored request hashes and stored responses.

## Store

`DurableRoute` uses `cnerium::store::Store` to access Cnerium reliability metadata.

The store is used to persist:

```txt
request body hashes
stored responses
operation-related metadata
```

For example, when a request succeeds, the durable route stores enough information to later answer:

```txt
Has this operation already completed?
Was the same Idempotency-Key used with the same body?
What response should be replayed?
```

Application code should usually configure storage through `AppConfig` and let Cnerium manage store access internally.

## Handler

The handler is the application logic for a new safe request.

The handler type is:

```cpp
using DurableHandler = std::function<cnerium::http::DurableResponse(cnerium::http::DurableRequest &)>;
```

A typical handler looks like this:

```cpp
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
}
```

The handler should focus on application logic. It should not manually implement idempotency. Cnerium performs the replay-protection decision before calling it.

## execute

Executes the durable route logic for a Vix HTTP request.

```cpp
cnerium::http::DurableResponse execute(const vix::http::Request &request);
```

This method is called by the Vix adapter when the matching Vix route receives a request.

Application code normally does not call `execute` directly.

Conceptually, `execute` performs this flow:

```txt
wrap Vix request as DurableRequest
read Idempotency-Key
compute request body hash
check replay protection
execute handler for new request
store response after handler execution
return stored response for safe retry
return conflict for unsafe key reuse
return bad request for missing key
```

## Execution flow

The durable route execution flow is:

```txt
Vix receives the HTTP request
Vix matches the route
Cnerium adapter calls DurableRoute::execute
DurableRoute creates DurableRequest
DurableRoute reads the Idempotency-Key
DurableRoute computes the request body hash
DurableRoute checks Cnerium stored metadata

if the key is missing:
  return 400 Bad Request

if the key is new:
  execute the user handler
  store the request hash
  store the durable response
  return the durable response

if the key exists and the body hash matches:
  return the stored response

if the key exists and the body hash differs:
  return 409 Conflict
```

Only the new request case executes the user handler.

## Safe retry

A safe retry uses the same operation, same `Idempotency-Key`, and same request body.

Example:

```txt
operation: orders.create
key:       order-123
body:      {"product_id":"p1","quantity":2}
```

If the client sends the same request again, `DurableRoute` returns the stored response.

The handler does not run again.

This prevents duplicate side effects such as:

```txt
creating a second order
emitting the same event twice
sending duplicate notifications
starting the same workflow twice
```

## Unsafe retry

An unsafe retry reuses the same key with a different body.

Example:

```txt
first request:
  operation: orders.create
  key: order-123
  body: {"product_id":"p1","quantity":2}

second request:
  operation: orders.create
  key: order-123
  body: {"product_id":"p2","quantity":1}
```

This is not a safe retry. The key already belongs to a different request body.

`DurableRoute` returns:

```txt
HTTP 409 Conflict
```

The handler is not executed, and the previous response is not replayed for the changed body.

## Missing key

A durable route requires an `Idempotency-Key`.

If the key is missing, `DurableRoute` returns a bad request response before the user handler runs.

This is expected behavior. A durable route cannot safely process a critical write without a stable client-provided operation key.

## operation

Returns the stable operation name.

```cpp
const std::string &operation() const noexcept;
```

Example:

```cpp
const std::string &name = route.operation();
```

This is useful for diagnostics, logging, tests, or internal integration.

For application-level route registration, prefer giving clear operation names directly in `durable_post`.

## is_valid

Returns whether the durable route has the data required to execute.

```cpp
bool is_valid() const noexcept;
```

A valid durable route should have:

```txt
a non-empty operation name
a store reference
a handler
```

If the route is not valid, it cannot safely process requests.

## valid

Backward-compatible alias for `is_valid`.

```cpp
bool valid() const noexcept;
```

Use `is_valid()` in new code when possible because it is clearer.

## Move behavior

`DurableRoute` is movable but not copyable.

That matches its ownership model. A durable route contains a handler and a store reference. Copying route execution objects could make ownership and registration unclear.

The attached Cnerium layer stores durable routes and keeps them alive for the Vix callbacks that use them.

Application code usually does not need to move `DurableRoute` manually.

## Relationship with AttachedApp

`AttachedApp::durable_post` creates and stores a `DurableRoute`.

Conceptually:

```txt
cnerium.durable_post(...)
  creates DurableRoute
  stores DurableRoute inside AttachedApp
  registers a Vix POST callback
  callback calls DurableRoute::execute
```

This is why the attached Cnerium object must stay alive while the Vix app is running. It owns the durable route objects that the registered Vix callbacks depend on.

## Relationship with VixHttp adapter

`DurableRoute` returns a `DurableResponse`.

The adapter layer converts that response into the Vix response writer.

Conceptually:

```txt
Vix route callback
  -> Cnerium VixHttp adapter
  -> DurableRoute::execute
  -> DurableResponse
  -> Vix response writer
```

This keeps the HTTP server and response writing in Vix while keeping the durability decision in Cnerium.

## Relationship with Idempotency

`DurableRoute` uses Cnerium’s idempotency and replay-protection logic to decide what to do with a request.

The core inputs are:

```txt
operation name
Idempotency-Key
request body hash
```

The core outputs are:

```txt
execute
replay
conflict
invalid
```

The durable route translates those decisions into HTTP behavior.

## Relationship with StoredResponse

When the handler returns a `DurableResponse`, Cnerium stores a replayable form of that response.

The stored response is used when a safe retry arrives.

The relationship is:

```txt
DurableResponse
  returned by the user handler

StoredResponse
  persisted by Cnerium

safe retry
  returns StoredResponse through Vix response writer
```

The application does not normally create `StoredResponse` manually.

## Complete public usage example

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>

int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true},
        {"service", "orders"}
    });
  });

  cnerium.durable_post(
      "/orders",
      "orders.create",
      [](cnerium::DurableRequest &request)
      {
        const auto body = request.json();
        const std::string product_id = cnerium::support::string_or(body, "product_id", "");
        const int quantity = cnerium::support::int_or(body, "quantity", 0);

        if (product_id.empty())
        {
          return cnerium::DurableResponse::bad_request(
              "Missing required field: product_id");
        }

        if (quantity <= 0)
        {
          return cnerium::DurableResponse::bad_request(
              "Field quantity must be greater than zero");
        }

        const std::string order_id = "ord_" + request.idempotency_key_value();

        return cnerium::created({
            {"ok", true},
            {"order_id", order_id},
            {"product_id", product_id},
            {"quantity", quantity}
        });
      });

  if (!cnerium.start())
  {
    return 1;
  }

  app.run();

  return 0;
}
```

This is the recommended public API. It uses `durable_post`, not direct `DurableRoute` construction.

## Direct construction example

Direct construction is mainly useful for tests or internals.

```cpp
cnerium::http::DurableRoute route{
    "orders.create",
    store,
    [](cnerium::DurableRequest &request)
    {
      (void)request;

      return cnerium::created({
          {"ok", true}
      });
    }};
```

Then an internal test may call:

```cpp
auto response =
    route.execute(vix_request);
```

For normal application code, use the attached API instead.

## Testing behavior

A durable route should be tested with at least four cases:

```txt
new key and valid body
  handler executes and response is stored

same key and same body
  stored response is replayed

same key and different body
  409 Conflict

missing key
  400 Bad Request
```

The second case is the most important proof that durable replay is working. The handler should not execute again.

## Common mistakes

Do not create `DurableRoute` directly in normal application code when `cnerium.durable_post` is available.

Do not give the route a vague operation name.

Do not let the attached Cnerium object be destroyed while the Vix app is still serving requests.

Do not expect the handler to run on a safe retry. A safe retry should return the stored response.

Do not write directly to `vix::Response` from a durable handler. Return `DurableResponse`.

Do not use durable routes for read-only endpoints that do not need retry-safe write behavior.

## Summary

`cnerium::http::DurableRoute` is the execution object behind Cnerium durable routes.

It receives a Vix request, wraps it as a durable request, applies idempotency and replay protection, executes the handler only for new safe operations, stores the response, replays stored responses for safe retries, and rejects invalid or unsafe requests.

Application code should usually use `cnerium.durable_post`. `DurableRoute` defines the behavior behind that API.
