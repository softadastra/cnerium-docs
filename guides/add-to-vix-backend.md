# Add Cnerium to a Vix Backend

This guide shows how to add Cnerium to an existing Vix backend.

The important idea is that Cnerium does not replace your Vix application. You keep your `vix::App`, your routes, your middleware, your server lifecycle, and your normal Vix workflow. Cnerium attaches to that application and adds durable route behavior only where the backend needs retry-safe write operations.

If your backend already works with Vix, adding Cnerium should feel like adding a focused reliability layer, not migrating to another framework.

## Starting point

Assume you already have a Vix backend like this:

```cpp
#include <vix.hpp>

int main()
{
  vix::App app;

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true}
    });
  });

  app.post("/orders", [](vix::Request &req, vix::Response &res)
  {
    const auto body = req.json();

    const std::string product_id = body.value("product_id", "");
    const int quantity = body.value("quantity", 0);

    if (product_id.empty())
    {
      res.status(400).json({
          {"error", "Missing required field: product_id"}
      });
      return;
    }

    if (quantity <= 0)
    {
      res.status(400).json({
          {"error", "Field quantity must be greater than zero"}
      });
      return;
    }

    res.status(201).json({
        {"ok", true},
        {"product_id", product_id},
        {"quantity", quantity}
    });
  });

  app.run();

  return 0;
}
```

This is a normal Vix backend. It has a health route and an order creation route.

The problem is not the Vix structure. The problem is that `POST /orders` creates state. If the client retries after a timeout, the same handler may run twice.

Cnerium is added only around that kind of operation.

## Add the Cnerium header

Add the Cnerium umbrella header next to the Vix header:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

Vix remains the main application API. Cnerium adds the reliability API.

## Attach Cnerium to the Vix app

After creating the Vix app, attach Cnerium:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

This line is the main integration point.

Cnerium keeps a reference to the Vix application and registers durable routes into it. The `vix::App` remains owned by your application code. Cnerium does not move it, replace it, or run it for you.

## Keep normal routes in Vix

Routes that do not need retry-safe write behavior should remain normal Vix routes.

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true}
  });
});
```

This is the correct place for health checks, status endpoints, read-only APIs, static files, and other routes that do not need durable execution.

Do not make every route durable. Cnerium is for selected critical operations.

## Convert a critical POST route

A normal `POST /orders` route usually looks like this:

```cpp
app.post("/orders", [](vix::Request &req, vix::Response &res)
{
  // create order
});
```

With Cnerium, convert it to a durable route:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      // create order
    });
```

The path remains the same:

```txt
/orders
```

The new part is the operation name:

```txt
orders.create
```

The operation name is used by Cnerium’s reliability layer. It scopes the idempotency key and stored response for this route.

Use a stable, explicit operation name. In production, changing it changes the idempotency namespace for that route.

## Return a DurableResponse

A durable handler does not write directly to `vix::Response`.

Instead, it returns a `cnerium::DurableResponse`:

```cpp
return cnerium::created({
    {"ok", true}
});
```

Cnerium needs this response object because it must be able to store it and replay it later if the client retries the same request.

A normal Vix route writes a response once. A Cnerium durable route may need to return the same response again after a timeout, without re-running the handler.

## Complete converted example

Here is a simple Vix backend with Cnerium attached and one durable route:

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

The backend is still a Vix backend.

The health route is still a normal Vix route. The order route is registered through Cnerium because it represents a write operation that should be safe under retries.

## Start order

The lifecycle should remain explicit:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

`cnerium.start()` starts Cnerium resources such as the store and optional realtime support. `app.run()` starts the Vix HTTP application.

Do not invert the ownership model. Vix still runs the backend.

## Test the durable route

Start the application, then send a request with an `Idempotency-Key`:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected result:

```txt
HTTP/1.1 201 Created
```

Example response:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

Send the same request again:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

The response should be the same. Cnerium should replay the stored response instead of running the handler again.

Now reuse the same key with a different body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Expected result:

```txt
HTTP/1.1 409 Conflict
```

This confirms that Cnerium can distinguish a safe retry from unsafe key reuse.

## Add explicit configuration

The default attachment is enough for small examples:

```cpp
auto cnerium = cnerium::attach(app);
```

For a real service, use an explicit configuration:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");

auto cnerium = cnerium::attach(app, std::move(config));
```

This configures the Cnerium layer, not the Vix application. Use Vix configuration for Vix server behavior. Use Cnerium configuration for Cnerium reliability resources.

## Add realtime support

If the durable route should emit application events, enable realtime support:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
config.enable_realtime("/ws", "0.0.0.0", 9090);

auto cnerium = cnerium::attach(app, std::move(config));
```

Then emit an event inside the durable handler:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)},
        {"product_id", cnerium::Json(product_id)},
        {"quantity", cnerium::Json(quantity)}
    })
);
```

If a safe retry is replayed from storage, the handler does not run again, so the event is not emitted again by the handler.

## Integrate with existing route modules

In a larger backend, route registration is often split across files.

A clean pattern is to pass both the Vix app and the attached Cnerium layer to the module that needs durable routes:

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

This keeps the boundary clear. Vix is used for normal routes. Cnerium is used for critical write routes.

Avoid hiding Cnerium behind global state. The explicit attachment makes the backend easier to understand and easier to test.

## What not to change

When adding Cnerium to a Vix backend, do not rewrite the whole application.

You do not need to replace `vix::App`. You do not need to move normal routes into Cnerium. You do not need to create a second server. You do not need to duplicate middleware. You do not need to change the Vix build and run workflow.

The integration should stay small:

```txt
include Cnerium
attach Cnerium to vix::App
convert selected critical POST routes to durable routes
start Cnerium resources before app.run()
```

That is the intended model.

## When to convert a route

Convert a route when retrying it can produce duplicate or inconsistent state.

Good candidates:

```txt
POST /orders
POST /payments
POST /invoices
POST /users/register
POST /subscriptions
POST /workflows/start
```

Leave normal Vix routes alone when they are read-only or do not need durable retry semantics:

```txt
GET /health
GET /status
GET /products
GET /orders/{id}
```

Cnerium is useful because it is selective. It protects the dangerous part of the backend without changing the rest of the application.

## Summary

Adding Cnerium to a Vix backend should be a small architectural change.

You keep `vix::App`. You attach Cnerium. You leave normal routes in Vix. You move selected critical `POST` routes to `cnerium.durable_post`. Then you start Cnerium resources before running the Vix app.

The backend remains a Vix backend, but its critical write operations gain durable, idempotent, retry-safe behavior.
