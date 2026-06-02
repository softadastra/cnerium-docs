# What is Cnerium?

Cnerium is a reliability layer for Vix backends.

It attaches to an existing `vix::App` and adds durable, idempotent, retry-safe route handling for backend operations that must not be executed twice by accident. It is designed to work inside the Vix ecosystem, not beside it as a separate framework.

A developer who already knows Vix should not need to rethink how a backend is built. Vix remains the application model. Cnerium adds a focused reliability layer on top of selected routes.

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true}
    });
  });

  cnerium.durable_post(
      "/orders",
      "orders.create",
      [](cnerium::DurableRequest &request)
      {
        return cnerium::created({
            {"ok", true}
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

The application is still a Vix application. The HTTP server, router, middleware, request parsing, response writing, runtime lifecycle, and developer workflow remain owned by Vix. Cnerium attaches to that application and adds reliability semantics where they are needed.

## The problem Cnerium solves

Many backend routes are safe to call multiple times. A health check can run every second. A product listing can be fetched repeatedly. A status endpoint can be refreshed without changing the system.

Write operations are different.

Consider this route:

```txt
POST /orders
```

A client sends the request. The server receives it and creates the order. Then the network connection is interrupted before the client receives the response. From the client’s point of view, the request failed. The natural behavior is to retry.

Without a reliability rule, the retry may create a second order.

This problem appears in many real systems:

```txt
POST /orders
POST /payments
POST /invoices
POST /users/register
POST /subscriptions
POST /workflows/start
```

The server may have completed the operation, but the client may not know it. That gap between “the server processed the request” and “the client received the response” is where duplicate writes happen.

Cnerium exists to close that gap.

## Durable routes

The main feature of Cnerium is the durable route.

A durable route is a normal backend route registered into a Vix application, but wrapped with Cnerium’s reliability rules. The handler only runs when Cnerium decides that the request is safe to execute.

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      return cnerium::created({
          {"ok", true}
      });
    });
```

The second argument, `"orders.create"`, is the stable operation name. It tells Cnerium which logical backend operation this route represents. Cnerium uses that operation name together with the `Idempotency-Key` header and the request body hash to decide whether a request should execute, replay, or fail.

A durable route follows these rules:

```txt
missing Idempotency-Key
  -> reject the request with 400 Bad Request

new Idempotency-Key
  -> execute the handler and store the response

same Idempotency-Key with the same request body
  -> return the stored response without executing the handler again

same Idempotency-Key with a different request body
  -> reject the request with 409 Conflict
```

That behavior makes retries safe for critical operations.

## Idempotency-Key

Cnerium uses the `Idempotency-Key` header to identify one logical operation from the client.

Example:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

The key must be generated once for the logical operation and reused if the client retries the same request. It should not be regenerated on every retry.

Good client behavior:

```txt
generate one Idempotency-Key
send the request
if a timeout happens, retry with the same key and the same body
accept the response returned by the server
```

Bad client behavior:

```txt
generate a new key for every retry
reuse the same key with a different body
omit the key on a durable route
```

The key alone is not enough. Cnerium also hashes the request body. This is what lets it distinguish a safe retry from an unsafe reuse of the same key for a different operation.

## Stored responses

When a durable route succeeds, Cnerium stores the response that was returned by the handler.

The stored response contains the data needed to replay the same HTTP result later:

```txt
status code
response body
content type
```

When the same request is retried with the same `Idempotency-Key` and the same body, Cnerium returns that stored response. The handler is not called again.

That point is important. Cnerium is not only checking duplicates. It is preserving the result of the completed operation so a retry can receive a consistent response.

For example, the first request may return:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

A retry with the same key and body returns the same response. The order creation logic is not executed again.

## How Cnerium uses Softadastra

Cnerium stores its reliability metadata through the Softadastra SDK.

It does not expose Softadastra internals to normal application code. The application works with Cnerium concepts such as durable routes, idempotency, stored responses, and realtime events. Behind the scenes, Cnerium uses the SDK to store request hashes, stored responses, and framework metadata.

The relationship is:

```txt
Vix
  owns the backend runtime and HTTP application model

Cnerium
  owns reliability semantics for selected routes

Softadastra SDK
  provides durable storage and local-first foundations behind Cnerium
```

This keeps the public API focused. A developer should not have to work with low-level storage or sync internals just to make a `POST` route retry-safe.

## How Cnerium uses Vix

Cnerium does not replace Vix routing.

A durable route is still registered into a `vix::App`. Vix receives the HTTP request, parses it, matches the route, and sends the response. Cnerium only runs around the handler to decide whether the operation should execute, replay, or fail.

The flow is:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Cnerium durable route
  -> Cnerium reliability check
  -> user handler, stored response, or conflict
  -> Vix response writer
```

This means normal Vix code remains normal Vix code:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true}
  });
});
```

Only routes that need stronger retry semantics use Cnerium:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

This is the intended boundary.

## Realtime events

Cnerium can emit application-level realtime events after durable operations.

For example, an order creation route can emit `order.created` after the handler has produced a valid result:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)},
        {"product_id", cnerium::Json(product_id)},
        {"quantity", cnerium::Json(quantity)}
    }));
```

The event is sent through Vix WebSocket. Cnerium does not implement a second WebSocket server. It provides an application-level event API and delegates the realtime transport to Vix.

This also interacts cleanly with durable route behavior. If a retry is replayed from storage, the handler does not run again, so the event is not emitted again by the handler. That prevents duplicate realtime notifications for a completed operation.

## What Cnerium is not

Cnerium is not a replacement for `vix::App`.

It is not a new HTTP server, router, middleware system, WebSocket engine, template engine, database layer, ORM, CLI, or deployment tool.

Those areas belong to Vix and its documentation.

Cnerium’s documentation should therefore stay focused on reliability topics: durable routes, idempotency, replay protection, stored responses, realtime events triggered by durable operations, and Softadastra SDK-backed persistence.

If you need to learn how to build a Vix backend, use the Vix documentation. If you need to make selected Vix backend operations durable and retry-safe, use Cnerium.

## When Cnerium is useful

Cnerium is useful when the cost of duplicate execution is high.

Examples include:

```txt
creating an order
creating a payment intent
creating an invoice
registering a user
reserving stock
starting a workflow
submitting a critical form
sending an important notification
```

In these cases, retry safety is not optional. A backend that accepts retries must know whether it is executing a new operation or replaying the result of a completed one.

Cnerium provides that behavior without forcing every route in the application to become durable.

## When not to use Cnerium

Do not use durable routes for simple reads.

These are better as normal Vix routes:

```txt
GET /health
GET /products
GET /orders/{id}
GET /status
GET /assets/app.css
```

A read-only endpoint does not need an idempotency key or a stored response replay model. Adding durable semantics to those routes would make the application harder to use without adding real value.

Use Vix for the general backend. Use Cnerium for critical write operations.

## The short version

Cnerium is the reliability layer for Vix backends.

It attaches to `vix::App`, keeps Vix as the application owner, and adds durable `POST` routes for operations that must be safe under retries.

The main idea is not to create a new backend framework. The main idea is to make the dangerous part of backend development safer: critical write operations that may be retried after timeouts, lost responses, or unstable network conditions.
