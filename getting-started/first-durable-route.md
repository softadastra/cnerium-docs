# Your First Durable Route

This guide builds a small Vix backend and attaches Cnerium to protect one critical `POST` route.

The goal is not to learn Vix routing from the beginning. Vix already owns the application model. The goal here is to show how Cnerium fits into that model and what changes when a normal write route becomes durable.

You will create:

```txt
GET /health
POST /orders
```

`GET /health` remains a normal Vix route. `POST /orders` becomes a Cnerium durable route, protected by an `Idempotency-Key`.

## Create the application

Start with a normal Vix application.

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
        {"ok", true},
        {"service", "orders"}
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

The important part is this line:

```cpp
auto cnerium = cnerium::attach(app);
```

Cnerium is attached to the existing `vix::App`. It does not replace it. The HTTP server, routing, middleware, request parsing, response writing, and server lifecycle still belong to Vix.

At this point, the application has no durable route yet. It only proves the attachment model.

## Add a durable POST route

Now add `POST /orders`.

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

The first argument is the HTTP path:

```txt
/orders
```

The second argument is the stable operation name:

```txt
orders.create
```

The operation name is part of Cnerium’s reliability model. It separates this durable operation from other durable operations in the same application. A future `payments.create` route should not share the same idempotency namespace as `orders.create`.

The third argument is the durable handler. It receives a `cnerium::DurableRequest` and returns a `cnerium::DurableResponse`.

## Complete example

This is the complete minimal example:

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
        {"ok", true},
        {"service", "orders"}
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

This application can now accept a durable `POST /orders` request.

## Add request parsing

A useful order route should read the JSON body and validate the required fields.

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

The handler is only responsible for processing a request that Cnerium has decided is safe to execute.

Cnerium handles the reliability decision before the handler runs. If the request is a safe retry, the stored response is returned and this handler is not executed again. If the request reuses the same idempotency key with a different body, Cnerium returns `409 Conflict`.

## Full durable orders example

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

This is still a Vix backend. Cnerium is only attached to protect the `POST /orders` operation.

## Run the application

Build and run the project with the normal Vix workflow:

```bash
vix build
vix run
```

Or, if you are working inside the Cnerium repository and building the example target directly:

```bash
vix build --build-target all -v -- -DCNERIUM_BUILD_EXAMPLES=ON
./build-ninja/cnerium_durable_orders_realtime
```

When the server starts, Vix owns the HTTP runtime and prints the server information.

## Send the first request

Send a durable request with an `Idempotency-Key` header:

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

Example body:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

This is the first time Cnerium sees `order-123` for the `orders.create` operation. It executes the handler, stores the request hash, stores the response, and returns the result.

## Retry the same request

Send the same request again with the same key and the same body:

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

The response body should match the first response.

This time, Cnerium does not need to execute the handler again. It finds the stored request hash, sees that the body matches, loads the stored response, and returns it.

That is what makes the route retry-safe.

## Reuse the key with a different body

Now reuse the same key with a different payload:

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

Example body:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This is not a safe retry. The same idempotency key now refers to a different request body. Cnerium rejects it instead of allowing the application to execute an ambiguous operation.

## Omit the Idempotency-Key

A durable route requires an idempotency key.

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected result:

```txt
HTTP/1.1 400 Bad Request
```

The exact body may depend on the current Cnerium response implementation, but the rule is stable: a durable route cannot process a write operation without an idempotency key.

## Add realtime notification

A durable route can emit an application-level event after the operation succeeds.

First enable realtime through the Cnerium configuration:

```cpp
cnerium.config().enable_realtime("/ws", "0.0.0.0", 9090);
```

Then emit an event from the handler:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)},
        {"product_id", cnerium::Json(product_id)},
        {"quantity", cnerium::Json(quantity)}
    }));
```

The event is sent through Vix WebSocket. Cnerium does not implement a second WebSocket server. It exposes an application-level event API for durable operations and delegates the realtime transport to Vix.

The retry behavior matters here. When the same durable request is replayed from storage, the handler does not run again, so the event is not emitted again by the handler. This avoids duplicate realtime notifications for the same completed operation.

## Complete example with realtime

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>

int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  cnerium.config().enable_realtime("/ws", "0.0.0.0", 9090);

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
      [&cnerium](cnerium::DurableRequest &request)
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

        cnerium.emit(
            "order.created",
            cnerium::support::object({
                {"order_id", cnerium::Json(order_id)},
                {"product_id", cnerium::Json(product_id)},
                {"quantity", cnerium::Json(quantity)}
            }));

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

Use realtime only when the operation has something meaningful to announce. The durable response remains the source of truth. The event is a notification.

## What this example proves

This example proves the core Cnerium behavior:

```txt
A normal Vix route remains a normal Vix route.
A critical POST route can be made durable with Cnerium.
A retry with the same key and body receives the stored response.
A retry with the same key and a different body is rejected.
The durable handler is not executed twice for the same completed request.
Realtime events are emitted only when the handler runs.
```

The important lesson is not that Cnerium changes how Vix backends are built. It does not. The important lesson is that Cnerium gives selected Vix routes a stronger execution contract.

## Next step

Continue with [Cnerium and Vix](/concepts/cnerium-and-vix) to understand the boundary between the Vix application model and the Cnerium reliability layer.
