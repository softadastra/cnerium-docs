# Request Lifecycle

This page explains the lifecycle of a request that passes through Cnerium.

Cnerium does not receive requests by running its own HTTP server. Vix receives the HTTP request, matches the route, and writes the response. Cnerium is inserted only for routes that were registered as durable routes.

The public model is:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);

app.get("/health", health_handler);

cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);

if (!cnerium.start())
{
  return 1;
}

app.run();
```

The lifecycle depends on which route is matched.

A normal Vix route follows the normal Vix lifecycle.

A durable Cnerium route follows the Vix lifecycle plus a Cnerium reliability decision before the handler is executed.

## Normal Vix route lifecycle

A normal route does not involve Cnerium.

Example:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true}
  });
});
```

The lifecycle is:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Vix handler
  -> Vix response writer
  -> client
```

Cnerium should not intercept this route.

This is important because not every backend route needs durable behavior. Health checks, read-only endpoints, status routes, and ordinary fetch routes should remain normal Vix routes.

## Durable route lifecycle

A durable route is registered through the attached Cnerium layer:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

The route is still hosted by Vix. Internally, Cnerium registers a Vix `POST` route whose callback goes through the Cnerium adapter and durable route executor.

The lifecycle is:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Cnerium VixHttp adapter
  -> DurableRoute
  -> DurableRequest
  -> Idempotency
  -> ReplayProtection
  -> Store
  -> DurableHandler, only for a new safe request
  -> DurableResponse
  -> StoredResponse commit
  -> Vix response writer
  -> client
```

The main difference is the reliability decision before the handler runs.

## Route registration phase

Before any request is received, the application registers routes.

Normal Vix route:

```cpp
app.get("/health", health_handler);
```

Durable Cnerium route:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);
```

When `durable_post` is called, Cnerium conceptually does this:

```txt
create DurableRoute
store DurableRoute inside AttachedApp
register a POST callback into vix::App
make the callback call the Cnerium VixHttp adapter
```

This is why the attached Cnerium object must stay alive while the Vix application is running. It owns the durable route objects used by the callbacks.

## Startup phase

The application starts Cnerium resources before running the Vix app:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

`cnerium.start()` prepares Cnerium resources:

```txt
validate Cnerium configuration
prepare the Cnerium store
initialize Softadastra SDK-backed storage access
start optional realtime support
mark the Cnerium runtime as running
```

`app.run()` starts the Vix HTTP application.

The order matters. A backend should not start serving durable routes before Cnerium storage and runtime resources are ready.

## Incoming request

When a client sends a request, Vix receives it first.

Example:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Vix accepts the connection, parses the HTTP request, and matches the route.

If the route is normal, Vix calls the normal Vix handler.

If the route was registered by Cnerium, Vix calls the callback registered by Cnerium.

## VixHttp adapter

The Vix callback enters the Cnerium `VixHttp` adapter.

The adapter is intentionally thin.

Its job is:

```txt
receive the Vix request
call DurableRoute::execute
receive a DurableResponse
write the response through Vix
```

It does not implement a server, router, middleware system, or response system. Vix already owns those responsibilities.

The adapter exists only to translate between Vix HTTP types and Cnerium durable route types.

## DurableRequest creation

Inside durable route execution, the Vix request is wrapped as a `cnerium::DurableRequest`.

Conceptually:

```cpp
cnerium::DurableRequest durable_request{vix_request};
```

The durable request exposes:

```txt
method
target
path
body
headers
Idempotency-Key
request body hash
JSON parsing
query parameters
route parameters
native Vix request
```

The wrapper does not mean Cnerium owns HTTP. It only gives the durable handler and reliability layer the request view they need.

## Idempotency key extraction

For a durable route, Cnerium reads the `Idempotency-Key` header.

Example:

```txt
Idempotency-Key: order-123
```

The key identifies one logical operation attempt from the client’s point of view.

If the key is missing or invalid, the request cannot be processed as a durable operation.

Cnerium returns a bad request response before the user handler runs.

```txt
HTTP 400 Bad Request
```

The handler is not called.

## Request body hashing

Cnerium computes a stable hash of the request body.

Example body:

```json
{
  "product_id": "p1",
  "quantity": 2
}
```

The body hash is used to detect whether a repeated idempotency key still refers to the same request body.

The idempotency key alone is not enough. A client could accidentally reuse the same key with a different body. The request hash lets Cnerium reject that case.

## Replay protection check

Cnerium checks the durable state for:

```txt
operation name
Idempotency-Key
request body hash
```

For example:

```txt
operation: orders.create
key:       order-123
hash:      hash of {"product_id":"p1","quantity":2}
```

The result can be:

```txt
Execute
Replay
Conflict
Invalid
```

Each result maps to a different request lifecycle.

## Execute lifecycle

`Execute` means this is a new durable operation.

The flow is:

```txt
key is new
handler executes
handler returns DurableResponse
Cnerium stores request hash
Cnerium stores response
Vix writes response to client
```

Example handler:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body = request.json();

      const std::string product_id =
          cnerium::support::string_or(body, "product_id", "");

      const int quantity =
          cnerium::support::int_or(body, "quantity", 0);

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

      const std::string order_id =
          "ord_" + request.idempotency_key_value();

      return cnerium::created({
          {"ok", true},
          {"order_id", order_id},
          {"product_id", product_id},
          {"quantity", quantity}
      });
    });
```

For a valid new request, the expected response is:

```txt
HTTP 201 Created
```

The important point is that the handler runs only after Cnerium has decided that execution is safe.

## Replay lifecycle

`Replay` means this operation already completed with the same key and same body.

The flow is:

```txt
key exists
stored hash matches incoming hash
Cnerium loads stored response
handler is not executed
Vix writes stored response to client
```

This is the safe retry case.

The client sends the same request again:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Cnerium returns the stored response.

The handler does not run again. That prevents duplicate side effects such as creating another order, sending another notification, or emitting the same realtime event again.

## Conflict lifecycle

`Conflict` means the same idempotency key was reused with a different body.

The first request may have been:

```txt
Idempotency-Key: order-123
body: {"product_id":"p1","quantity":2}
```

Then the client sends:

```txt
Idempotency-Key: order-123
body: {"product_id":"p2","quantity":1}
```

The key is the same, but the body hash is different.

The flow is:

```txt
key exists
stored hash differs from incoming hash
handler is not executed
stored response is not replayed
Cnerium returns 409 Conflict
Vix writes response to client
```

Expected response:

```txt
HTTP 409 Conflict
```

This protects the meaning of the idempotency key. A key must not change meaning after it has been used.

## Invalid lifecycle

`Invalid` means the durable request cannot be evaluated.

The common case is a missing `Idempotency-Key`.

The flow is:

```txt
Idempotency-Key is missing or invalid
handler is not executed
Cnerium returns 400 Bad Request
Vix writes response to client
```

A durable route requires the client to participate in the durable protocol. Without a key, Cnerium cannot know whether the request is new or a retry.

## Stored response commit

When the handler returns a `DurableResponse`, Cnerium converts it into a stored response.

A stored response contains:

```txt
status code
body
content type
```

For example:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

Cnerium stores this response through the store layer so it can be returned later if the same request is retried safely.

The stored response is not a generic HTTP cache. It is part of the correctness model for the durable operation.

## Response writing

After Cnerium produces a response, Vix writes it to the client.

The response may come from:

```txt
fresh DurableResponse from the handler
StoredResponse loaded from storage
bad request response for missing key
conflict response for unsafe key reuse
```

The adapter writes the response through Vix while preserving:

```txt
status code
body
content type
```

This keeps Vix responsible for final HTTP output.

## Realtime event lifecycle

If the durable handler emits a realtime event, the event happens only when the handler executes.

Example:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

Lifecycle:

```txt
new request
  handler runs
  event is emitted
  response is stored

safe retry
  stored response is returned
  handler does not run
  event is not emitted again by the handler

unsafe retry
  409 Conflict
  handler does not run
  event is not emitted
```

The realtime transport belongs to Vix WebSocket. Cnerium only emits the application-level event.

## Full lifecycle example

For a first valid request:

```txt
client sends POST /orders
Vix receives request
Vix matches route
Cnerium adapter receives Vix request
DurableRoute wraps request as DurableRequest
Cnerium reads Idempotency-Key
Cnerium computes request body hash
ReplayProtection returns Execute
DurableHandler runs
handler creates response
Cnerium stores request hash
Cnerium stores response
Vix writes 201 response
client receives result
```

For a safe retry:

```txt
client retries same POST /orders
Vix receives request
Vix matches route
Cnerium adapter receives Vix request
DurableRoute wraps request as DurableRequest
Cnerium reads Idempotency-Key
Cnerium computes request body hash
ReplayProtection returns Replay
Cnerium loads stored response
handler does not run
Vix writes stored response
client receives same result
```

For unsafe key reuse:

```txt
client sends POST /orders with same key and different body
Vix receives request
Vix matches route
Cnerium adapter receives Vix request
DurableRoute wraps request as DurableRequest
Cnerium reads Idempotency-Key
Cnerium computes request body hash
ReplayProtection returns Conflict
handler does not run
Vix writes 409 response
client receives conflict error
```

For missing key:

```txt
client sends POST /orders without Idempotency-Key
Vix receives request
Vix matches route
Cnerium adapter receives Vix request
DurableRoute wraps request as DurableRequest
ReplayProtection returns Invalid
handler does not run
Vix writes 400 response
client receives bad request error
```

## Lifecycle and side effects

The durable handler is the boundary for protected side effects.

Protected side effects are operations that happen inside the handler after Cnerium has decided to execute the request.

Examples:

```txt
create order
reserve inventory
create payment intent
send notification
emit realtime event
write audit record
start workflow
```

For a safe retry, the handler does not run again, so those side effects are not repeated.

Side effects that happen before the durable route lifecycle begins are not protected by Cnerium.

Keep critical side effects inside the durable handler or inside services called by that handler.

## Lifecycle and application storage

Cnerium stores retry metadata and stored responses.

The application still owns domain state.

For an order route, the handler may write an order into the application database, then return a durable response. Cnerium stores the response after the handler returns.

For high-value operations, the application must still think carefully about:

```txt
database transactions
unique constraints
audit logs
provider-level idempotency
domain status transitions
commit order
failure recovery
```

Cnerium improves the HTTP retry lifecycle. It does not replace the application’s domain correctness model.

## Lifecycle and process restart

If Cnerium storage persists across restarts, a retry can still be replayed after the process restarts.

Test flow:

```txt
start server
send first durable request
stop server
start server again
retry same request with same key and body
expect stored response
```

If the handler runs again after restart, check the configured data directory and SDK-backed storage integration.

A durable route is only useful across restarts when its metadata survives restarts.

## Lifecycle and route modules

In larger projects, routes may be registered from modules.

A good shape is:

```cpp
void register_order_routes(
    vix::App &app,
    cnerium::AttachedApp &cnerium)
{
  app.get("/orders/{id}", get_order);

  cnerium.durable_post(
      "/orders",
      "orders.create",
      create_order);
}
```

This keeps the lifecycle clear.

Normal routes go through Vix only. Durable routes go through Cnerium’s reliability lifecycle.

## Lifecycle test checklist

A durable route lifecycle should be tested with:

```txt
new request
  handler executes
  response is stored

safe retry
  stored response is returned
  handler does not execute

unsafe key reuse
  409 Conflict
  handler does not execute

missing Idempotency-Key
  400 Bad Request
  handler does not execute

restart replay, when persistent storage is expected
  same response after process restart
```

Testing only the first successful request is not enough. The value of Cnerium is in the retry lifecycle.

## Common mistakes

Do not assume Cnerium receives all requests. Vix receives all HTTP requests.

Do not assume every route should enter the durable lifecycle. Only selected critical write routes should use it.

Do not call `app.run()` before `cnerium.start()` when durable routes need Cnerium resources.

Do not destroy the attached Cnerium object while the Vix app is still running.

Do not write directly to `vix::Response` inside a durable handler.

Do not perform critical side effects before the durable route lifecycle begins.

Do not expect realtime events to emit again during safe replay.

## Summary

A Cnerium durable request starts in Vix, passes through a thin Cnerium adapter, enters the durable route executor, goes through idempotency and replay protection, and only then reaches the user handler if the request is new and safe.

Safe retries return stored responses. Unsafe retries return conflicts. Missing keys return bad requests. Vix remains responsible for receiving the request and writing the final response.

That lifecycle is the core of Cnerium’s role in the Vix ecosystem.
