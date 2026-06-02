# Store

`cnerium::store::Store` is the storage facade used by Cnerium’s reliability layer.

Most application code does not use `Store` directly. A normal application configures Cnerium storage through `AppConfig`, attaches Cnerium to `vix::App`, then lets durable routes use the store internally.

The store exists because durable routes need persistent metadata. When a request completes, Cnerium must remember the request body hash and the response returned by the handler. If the same request is retried later, Cnerium can return the stored response instead of running the handler again.

The public application model remains:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Storage belongs behind that attached Cnerium layer.

## Header

```cpp
#include <cnerium/cnerium.hpp>
```

or directly:

```cpp
#include <cnerium/store/Store.hpp>
```

Most applications should include:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Namespace

```cpp
namespace cnerium::store
```

The type is:

```cpp
cnerium::store::Store
```

## Purpose

`Store` is responsible for Cnerium framework metadata.

It stores data needed by durable routes, including:

```txt
request hashes
stored responses
operation keys
runtime metadata used by the reliability layer
```

It is not the application database.

For example, when an order route succeeds, the application should store the order in its own domain storage. Cnerium stores the response metadata needed to replay the HTTP result if the client retries the same operation.

The distinction is important:

```txt
application database
  owns orders, users, payments, invoices, domain records

Cnerium store
  owns retry metadata and stored responses for durable routes
```

Do not use Cnerium’s store as the source of truth for business data.

## Storage backend

Cnerium’s store is backed by the Softadastra SDK.

Application code should not normally depend on the low-level storage backend. The application configures the Cnerium data directory and runtime identity through `AppConfig`, then Cnerium prepares the store when `cnerium.start()` is called.

Example:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");

auto cnerium = cnerium::attach(app, std::move(config));
```

The durable route API then uses the store internally:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

The handler does not need to manually store idempotency records.

## Relationship with AppConfig

`AppConfig` is the normal way to configure Cnerium storage.

The most important storage-related setting is the data directory:

```cpp
config.set_data_dir("data/cnerium");
```

For local development, a relative path is acceptable:

```cpp
config.set_data_dir("data/cnerium");
```

For production, use a stable writable path:

```cpp
config.set_data_dir("/var/lib/orders-service/cnerium");
```

The process must be able to create and write to this directory.

If the directory is temporary or deleted during deployment, Cnerium may lose the stored responses needed for safe replay.

## Relationship with DurableRoute

`DurableRoute` uses `Store` to read and write reliability metadata.

The route uses the store to answer questions like:

```txt
Has this Idempotency-Key already been used for this operation?
Was it used with the same request body?
Is there a stored response that can be replayed?
Should the request execute, replay, conflict, or fail as invalid?
```

The application-level API hides this logic:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

Internally, the durable route uses the store before deciding whether the handler should run.

## Relationship with Idempotency

`Idempotency` uses `Store` to persist and read the state required for durable retry behavior.

The simplified relationship is:

```txt
DurableRoute
  calls Idempotency

Idempotency
  checks operation, key, and request body hash

Store
  persists request hashes and stored responses
```

Application code usually stays above this level.

A normal handler should focus on the operation itself:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body = request.json();

      return cnerium::created({
          {"ok", true}
      });
    });
```

Cnerium handles the store operations around the handler.

## Stored data

For a request like this:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Cnerium needs to store metadata conceptually similar to:

```txt
operation: orders.create
key:       order-123
hash:      stable hash of the request body
response:  stored HTTP response
```

The response includes:

```txt
status code
body
content type
```

This stored response is what allows Cnerium to return the same result on a safe retry.

## Store keys

Cnerium builds internal keys from the durable operation name and idempotency key.

Conceptually, keys may look like:

```txt
cnerium:hash:<operation>:<key>
cnerium:response:<operation>:<key>
```

For example:

```txt
cnerium:hash:orders.create:order-123
cnerium:response:orders.create:order-123
```

Application code should not depend on the exact key format unless it is working on Cnerium internals. Key formats are internal implementation details and may evolve.

For normal application code, use durable routes and let Cnerium manage keys.

## Request hash storage

The request hash lets Cnerium distinguish a safe retry from unsafe key reuse.

Safe retry:

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

The stored hash matches. Cnerium can return the stored response.

Unsafe reuse:

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

The body hash does not match. Cnerium returns `409 Conflict`.

The store is what makes this comparison possible across requests.

## Stored response storage

The stored response lets Cnerium return the original result after a retry.

For example, a first request may return:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

If the client retries the same request with the same key and same body, Cnerium returns that stored response.

The handler is not executed again.

This prevents duplicate side effects such as creating a second order, emitting the same event twice, sending duplicate notifications, or starting the same workflow twice.

## Store and safe retries

A safe retry depends on the store.

The flow is:

```txt
client retries the same durable request
Cnerium reads the stored request hash
Cnerium compares it with the incoming request body hash
Cnerium loads the stored response
Vix writes the stored response to the client
handler does not run
```

If the store is unavailable or the stored response is missing, Cnerium cannot replay the response correctly.

That is why storage should be treated as part of the durable route correctness model, not as a simple cache.

## Store and process restarts

A durable route is most useful when stored metadata survives process restarts.

If the process restarts after a successful request, a later retry should still be able to receive the stored response, assuming the storage backend preserved the data.

For that to work, the data directory must be stable.

Development path:

```cpp
config.set_data_dir("data/cnerium");
```

Production path:

```cpp
config.set_data_dir("/var/lib/orders-service/cnerium");
```

Avoid temporary paths for production durable metadata.

## Store and domain transactions

Cnerium storage does not replace application transactions.

A durable handler may do domain work such as:

```txt
create order in database
reserve stock
create payment intent
send notification
return durable response
```

Cnerium stores the durable response after the handler returns.

For high-value operations, think carefully about the relationship between the application commit and the stored response commit.

For example, if the domain write succeeds but the process crashes before the stored response is committed, a later retry may not have a response to replay even though the domain state exists.

Cnerium improves retry behavior, but the application still needs domain-level correctness mechanisms such as:

```txt
database transactions
unique constraints
audit logs
provider-level idempotency
clear status transitions
```

## Store and external providers

When a durable handler calls an external provider, use the provider’s idempotency mechanism when available.

For example, a payment operation can keep the same logical key across layers:

```txt
client Idempotency-Key
  -> Cnerium durable route
  -> application payment service
  -> payment provider idempotency key
```

Cnerium’s store protects the backend route. Provider-level idempotency protects the external operation.

The two should work together.

## Direct usage

Most application code should not use `Store` directly.

The preferred API is:

```cpp
auto cnerium = cnerium::attach(app);

cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

Direct store usage is mainly useful for:

```txt
Cnerium internals
integration tests
custom adapters
advanced diagnostics
```

If application code needs to inspect durable behavior, prefer testing the route through HTTP first. Direct store access can couple application code to Cnerium internals.

## Startup

Cnerium storage is prepared when the attached layer starts:

```cpp
if (!cnerium.start())
{
  return 1;
}
```

Then the Vix app is started:

```cpp
app.run();
```

The normal order is:

```txt
create vix::App
configure Cnerium
attach Cnerium
register routes
start Cnerium
run Vix app
```

If Cnerium cannot open or prepare storage, `cnerium.start()` should fail.

## Inspecting storage during development

After sending durable requests, you can inspect the configured data directory:

```bash
find data/cnerium -maxdepth 3 -type f 2>/dev/null
```

The exact file layout is internal and may change. Do not write application logic that depends on those files.

This check is only useful to confirm that Cnerium is writing metadata.

## Clearing development storage

During local development, you can reset durable route state by deleting the data directory:

```bash
rm -rf data/cnerium
```

Only do this in development.

Deleting Cnerium storage removes request hashes and stored responses. After deletion, a retry with an old idempotency key may be treated as a new request because Cnerium no longer has the previous metadata.

Do not delete production storage unless you understand the consequences.

## Production considerations

For production, use a stable storage path:

```cpp
config.set_data_dir("/var/lib/orders-service/cnerium");
```

Make sure the service user can write to it:

```bash
sudo mkdir -p /var/lib/orders-service/cnerium
sudo chown -R orders:orders /var/lib/orders-service/cnerium
```

The exact user and group depend on your deployment.

Avoid:

```txt
/tmp/cnerium
source-controlled directories
build directories deleted on redeploy
paths owned by another service
```

A durable route depends on storage to preserve retry behavior.

## Testing store behavior

A good store behavior test checks that replay works.

First request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: store-test-1" \
  -d '{"product_id":"p1","quantity":2}'
```

Safe retry:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: store-test-1" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected behavior:

```txt
same response is returned
handler does not execute again
```

Then restart the process and retry the same request again. If storage persists across restart, the same response should still be replayed.

## Common mistakes

Do not treat Cnerium storage as a cache that can be freely deleted in production.

Do not store domain data only in Cnerium stored responses.

Do not rely on internal store key formats from application code.

Do not use temporary directories for production durable metadata.

Do not assume Cnerium storage replaces database constraints, transactions, or audit logs.

Do not bypass `cnerium.durable_post` and manually write partial retry metadata unless you are working on Cnerium internals.

## Summary

`cnerium::store::Store` is the storage facade behind Cnerium durable route behavior.

It stores request hashes and stored responses so Cnerium can replay safe retries and reject unsafe key reuse. Application code usually configures storage through `AppConfig` and uses it indirectly through `cnerium.durable_post`.

Treat Cnerium storage as reliability metadata for selected Vix backend operations, not as your application database and not as a generic cache.
