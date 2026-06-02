# Introduction

Cnerium is the reliability layer for Vix backends.

It is not a replacement for Vix, and it is not a second backend framework with its own way of building HTTP applications. A Cnerium application is still a Vix application. You create a `vix::App`, register normal Vix routes as usual, keep the Vix runtime and developer workflow, then attach Cnerium when some backend operations need stronger reliability guarantees.

The reason Cnerium exists is simple: some backend routes cannot safely behave like ordinary request handlers.

A route such as `GET /health` can be executed many times without changing application state. A route such as `POST /orders`, `POST /payments`, `POST /invoices`, or `POST /users/register` is different. It creates or changes something important. If the client sends the request, the server processes it, but the network connection fails before the response is received, the client may retry. In a normal backend, that retry can accidentally execute the same operation twice.

Cnerium focuses on that class of problem.

It attaches to an existing `vix::App` and adds durable, idempotent, retry-safe route handling for critical operations. Vix remains responsible for HTTP, routing, middleware, request parsing, response writing, WebSocket runtime, build workflow, development workflow, and production workflow. Cnerium only adds the reliability layer around selected backend operations.

## The role of Cnerium

Cnerium is designed for backend operations where correctness matters under retries, timeouts, process restarts, unstable networks, or lost responses.

A normal Vix route is still the right tool for most backend endpoints:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true}
  });
});
```

A Cnerium durable route is used when the operation must not be executed twice by accident:

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

The important difference is not the syntax. The important difference is the behavior.

A durable route requires an `Idempotency-Key` header. Cnerium combines that key with the request body hash and the operation name. If the same request is retried with the same key and the same body, Cnerium returns the previously stored response instead of executing the handler again. If the same key is reused with a different body, Cnerium rejects the request with `409 Conflict`.

That gives critical `POST` operations a safer execution model without forcing the whole backend to become a different framework.

## How Cnerium fits with Vix

Cnerium should be understood as an extension of the Vix backend model.

A typical Cnerium application starts like a normal Vix application:

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

  if (!cnerium.start())
  {
    return 1;
  }

  app.run();

  return 0;
}
```

This is the intended mental model:

```txt
vix::App app;
auto cnerium = cnerium::attach(app);
```

Vix owns the application. Cnerium attaches reliability features to it.

This keeps the ecosystem coherent. A developer who already knows Vix should not have to learn a different backend architecture just to use Cnerium. They continue to use Vix for normal backend development, and they use Cnerium only where retry-safe semantics are required.

## What Cnerium does not do

Cnerium does not implement a new HTTP server. It does not replace the Vix router. It does not provide an alternative middleware system. It does not create a new WebSocket protocol. It does not duplicate the Vix runtime or developer tools.

Those concerns already belong to Vix.

Cnerium also does not expose Softadastra internals directly to application code. Durable storage, WAL-backed persistence, and local-first foundations are provided through the Softadastra SDK. Cnerium uses that SDK behind its own store layer to persist request hashes, stored responses, and framework metadata.

The boundary is intentional:

```txt
Vix
  owns the backend runtime and HTTP application model.

Softadastra SDK
  owns durable storage and local-first foundations.

Cnerium
  adds reliability semantics for critical backend operations.
```

This separation keeps Cnerium focused. It exists to make selected backend routes safer, not to become a general-purpose replacement for the rest of the stack.

## Durable route behavior

A durable route is built around the `Idempotency-Key` header.

A client creates a logical operation and sends an idempotency key with the request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

On the first request, Cnerium executes the handler, stores the request hash, stores the response, and returns the result.

If the client retries the same request with the same key and the same body, Cnerium returns the stored response. The handler is not executed again.

If the client reuses the same key with a different body, Cnerium rejects the request because the key now refers to a different logical operation.

The behavior is:

```txt
missing Idempotency-Key
  -> 400 Bad Request

new Idempotency-Key
  -> execute the handler and store the response

same Idempotency-Key with the same body
  -> replay the stored response

same Idempotency-Key with a different body
  -> 409 Conflict
```

This is the core of Cnerium.

## When to use Cnerium

Use Cnerium for operations where an accidental duplicate would be harmful or expensive.

Good candidates include order creation, payment intent creation, invoice creation, account registration, stock reservation, workflow start commands, critical notifications, and form submissions that should not be processed twice.

Do not use Cnerium for simple read-only routes. A normal Vix route is better for `GET /health`, `GET /products`, `GET /orders/{id}`, static files, status pages, public assets, and other endpoints that do not need durable retry semantics.

The goal is not to make every route durable. The goal is to make the right routes durable.

## Realtime events

Cnerium can also emit application-level realtime events after a durable operation succeeds.

For example, after creating an order, the handler can emit `order.created`:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)},
        {"product_id", cnerium::Json(product_id)},
        {"quantity", cnerium::Json(quantity)}
    }));
```

The event is sent through Vix WebSocket. Cnerium does not implement its own WebSocket server or protocol. It provides the application-level event model and delegates the transport to Vix.

This matters for retry behavior. If a durable request is replayed from storage, the handler is not executed again, so the realtime event is not emitted twice by the handler. That avoids duplicate notifications for the same completed operation.

## What you should read next

Start with [What is Cnerium?](/getting-started/what-is-cnerium) if you want the high-level model.

Read [Why Cnerium Exists](/getting-started/why-cnerium-exists) if you want to understand the reliability problem behind retries and lost responses.

Then continue with [Your First Durable Route](/getting-started/first-durable-route) to build a small Vix backend with one Cnerium durable route.
