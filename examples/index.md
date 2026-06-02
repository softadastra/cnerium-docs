# Examples

The examples show how Cnerium is used inside real Vix backends.

They are intentionally focused on durable operations. Cnerium is not trying to document the whole Vix backend model again. Vix already owns the application runtime, HTTP server, routing, middleware, WebSocket runtime, build workflow, and normal backend structure.

The examples here answer a narrower question:

```txt
How do I protect a critical Vix backend operation with Cnerium?
```

A Cnerium example should always make the boundary clear:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Vix owns the application. Cnerium attaches to it.

## What the examples focus on

The examples focus on operations where retry behavior matters.

A durable route is useful when a client may retry a request after a timeout, dropped connection, unstable network, or lost response. If the backend blindly runs the handler again, the application may create duplicate state.

That is the problem Cnerium is designed to solve.

The examples cover patterns such as:

```txt
creating an order
creating a payment
registering a user
emitting a realtime event after a durable operation
testing safe and unsafe retries
```

They do not try to replace the Vix documentation for ordinary backend topics.

For normal Vix routes, middleware, request handling, response helpers, static files, WebSocket server behavior, templates, database usage, and build workflow, use the Vix documentation.

## Basic model

Every example follows the same model:

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
        (void)request;

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

The health route is a normal Vix route. It does not need durable behavior.

The order route is a Cnerium durable route. It requires an `Idempotency-Key`, stores the response on first execution, replays the response on safe retries, and rejects unsafe key reuse.

## Available examples

### Durable Orders

The durable orders example shows the smallest useful Cnerium pattern.

It creates an order with:

```txt
POST /orders
```

The route validates a JSON body, creates a deterministic order id for the example, and returns a durable response.

Use this example when you want to understand the core behavior of:

```txt
new request
safe retry
unsafe key reuse
missing Idempotency-Key
```

Read: [Durable Orders](/examples/durable-orders)

### Durable Orders with Realtime

The realtime version extends the durable orders example by emitting an application event after the order is created.

The event is emitted from inside the durable handler:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

If the same request is retried and Cnerium returns the stored response, the handler does not run again. That means the event is not emitted twice by the handler.

Use this example when you want to connect durable operations with live updates.

Read: [Durable Orders with Realtime](/examples/durable-orders-realtime)

### Payments

The payments example shows why durable routes matter for high-value operations.

Payment routes are a natural fit for idempotency because a timeout does not necessarily mean the payment operation failed. The server or external provider may have already accepted the request.

Use this example when you want to model a route such as:

```txt
POST /payments
```

The example should be read as a backend reliability pattern, not as a complete payment provider integration.

Read: [Payments](/examples/payments)

### Registration

The registration example shows how Cnerium can protect account creation or signup flows.

Registration can be retried because of network issues, browser behavior, mobile connectivity, or frontend retry logic. Without idempotency, a backend may create inconsistent user state or duplicate pending records.

Use this example when you want to protect a route such as:

```txt
POST /users/register
```

Read: [Registration](/examples/registration)

## Testing pattern

Most examples can be tested with the same four-request pattern.

First request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected behavior:

```txt
handler executes
response is stored
HTTP 201 is returned
```

Safe retry:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected behavior:

```txt
stored response is returned
handler does not execute again
```

Unsafe key reuse:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Expected behavior:

```txt
HTTP 409 Conflict
handler does not execute
```

Missing key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected behavior:

```txt
HTTP 400 Bad Request
handler does not execute
```

This test pattern is more important than the specific domain used by the example. Whether the route creates an order, a payment, an invoice, or a registration, the durable behavior should remain clear.

## How to choose an example

Start with [Durable Orders](/examples/durable-orders) if you want the smallest example.

Use [Durable Orders with Realtime](/examples/durable-orders-realtime) if you want to see `cnerium.emit(...)` used after a durable operation.

Use [Payments](/examples/payments) if you want a high-value operation where duplicate execution is especially dangerous.

Use [Registration](/examples/registration) if you want a common application workflow where retries can create confusing user state.

## What the examples deliberately avoid

The examples do not try to teach every Vix feature.

They do not introduce a custom router abstraction, a separate server object, a custom middleware layer, a new WebSocket system, or a full application framework around Cnerium.

That is deliberate.

Cnerium should stay small and clear:

```txt
Vix builds and runs the backend.
Cnerium protects selected write operations.
Softadastra SDK provides the durable foundation behind Cnerium.
```

The examples are written to reinforce that boundary.

## Next step

Start with [Durable Orders](/examples/durable-orders), then test the same request multiple times with the same `Idempotency-Key`.

The first test should prove that the route works. The second test should prove that retry behavior works. The conflict test should prove that unsafe key reuse is rejected.
