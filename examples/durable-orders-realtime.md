# Durable Orders with Realtime

This example extends the durable orders example with realtime event emission.

The backend still follows the same Cnerium model:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Vix owns the application. Cnerium attaches to it. The order creation route is durable, and when a new order is created, the handler emits an `order.created` event through the attached realtime layer.

The important behavior is that the event is emitted only when the durable handler runs. If the same request is retried with the same `Idempotency-Key` and the same body, Cnerium returns the stored response and does not execute the handler again. That means the event is not emitted twice by the handler.

## What this example shows

This example demonstrates four things:

```txt
A Vix backend can attach Cnerium without changing the Vix application model.
A critical POST route can be protected with cnerium.durable_post.
A durable handler can emit a realtime event after a successful operation.
A safe retry replays the stored response and does not emit the event again.
```

The route structure is:

```txt
GET /health
POST /orders
```

`GET /health` is a normal Vix route.

`POST /orders` is a Cnerium durable route. It requires an `Idempotency-Key`, stores the response, rejects unsafe key reuse, and emits `order.created` when a new order is created.

## Complete example

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>
#include <utility>

int main()
{
  vix::App app;

  cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

  config.set_name("durable-orders-realtime");
  config.set_data_dir("data/cnerium");
  config.set_node_id("durable-orders-realtime-node");
  config.enable_realtime("/ws", "0.0.0.0", 9090);

  auto cnerium = cnerium::attach(app, std::move(config));

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true},
        {"service", "durable-orders-realtime"}
    });
  });

  cnerium.durable_post(
      "/orders",
      "orders.create",
      [&cnerium](cnerium::DurableRequest &request)
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

This is still a Vix backend. Cnerium is not running a second backend application. It attaches to `vix::App`, registers the durable route, and uses Vix for HTTP and realtime transport.

## Configuration

Realtime support is enabled through `AppConfig`:

```cpp
config.enable_realtime("/ws", "0.0.0.0", 9090);
```

The values mean:

```txt
/ws
  public WebSocket endpoint

0.0.0.0
  WebSocket bind host

9090
  WebSocket bind port
```

The rest of the configuration identifies the Cnerium runtime:

```cpp
config.set_name("durable-orders-realtime");
config.set_data_dir("data/cnerium");
config.set_node_id("durable-orders-realtime-node");
```

The data directory is used by Cnerium’s storage layer for durable route metadata, including request hashes and stored responses.

The node id identifies the local Cnerium runtime instance. For local examples, a readable name is enough.

## Normal Vix route

The health route remains normal Vix code:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true},
      {"service", "durable-orders-realtime"}
  });
});
```

Cnerium is not involved in this route. It does not create critical state, so it does not need durable retry behavior.

This is the expected model: normal routes stay in Vix, critical write routes use Cnerium.

## Durable order route

The order route is registered with `durable_post`:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

The path is:

```txt
/orders
```

The operation name is:

```txt
orders.create
```

The operation name is part of Cnerium’s idempotency scope. It separates order creation from other durable operations such as `payments.create`, `invoices.create`, or `users.register`.

## Request body

The route expects JSON:

```json
{
  "product_id": "p1",
  "quantity": 2
}
```

The handler reads and validates the body:

```cpp
const auto body = request.json();
const std::string product_id = cnerium::support::string_or(body, "product_id", "");
const int quantity = cnerium::support::int_or(body, "quantity", 0);
```

If the input is invalid, the handler returns a durable error response:

```cpp
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
```

Cnerium handles retry safety. The application still handles normal validation.

## Emit the event

After the order is accepted, the handler emits an event:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)},
        {"product_id", cnerium::Json(product_id)},
        {"quantity", cnerium::Json(quantity)}
    }));
```

The event name is:

```txt
order.created
```

The payload contains the order data that connected clients may need for a live update:

```json
{
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

This event is a notification. It should not be treated as the application’s source of truth. A client that needs full order data should still be able to fetch it through a normal Vix route.

## Return the durable response

The handler returns a durable response:

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id},
    {"product_id", product_id},
    {"quantity", quantity}
});
```

Cnerium stores this response.

If the client retries the same request with the same `Idempotency-Key` and the same body, Cnerium returns the stored response instead of running the handler again.

That prevents duplicate order creation and duplicate handler-side event emission.

## Run the example

Inside the Cnerium repository, build the example:

```bash
vix build --build-target all -v -- -DCNERIUM_BUILD_EXAMPLES=ON
```

Run it:

```bash
./build-ninja/cnerium_durable_orders_realtime
```

The HTTP server should start on the configured Vix HTTP port. In local examples, this is usually `8080`.

The realtime WebSocket server is configured with:

```txt
endpoint: /ws
host:     0.0.0.0
port:     9090
```

## Send the first order request

Send a valid durable request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected status:

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

For this first request, Cnerium executes the handler. The handler validates the body, creates the example order id, emits `order.created`, returns the durable response, and Cnerium stores that response.

## Retry the same request

Send the same request again:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected status:

```txt
HTTP/1.1 201 Created
```

The response body should match the first response.

The important behavior is that the handler should not run again. Cnerium should replay the stored response. Since the handler does not run again, the `order.created` event is not emitted again by that handler.

## Reuse the key with a different body

Now change the body while keeping the same key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Expected status:

```txt
HTTP/1.1 409 Conflict
```

Example body:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This request is not a safe retry. Cnerium rejects it before the handler runs. No order is created by the handler, and no success event is emitted by the handler.

## Missing Idempotency-Key

Send the request without the idempotency key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected status:

```txt
HTTP/1.1 400 Bad Request
```

A durable route requires an idempotency key because Cnerium must be able to identify one logical operation across retries.

## Event behavior

The event behavior should be understood in relation to handler execution.

```txt
first request with a new key
  handler runs
  order.created is emitted
  response is stored

same key with same body
  stored response is returned
  handler does not run
  order.created is not emitted again by the handler

same key with different body
  409 Conflict
  handler does not run
  order.created is not emitted by the handler

missing key
  400 Bad Request
  handler does not run
  order.created is not emitted by the handler
```

This is the main reason realtime events fit naturally inside durable handlers. The event follows the successful execution of the operation, not every HTTP retry.

## Test with a WebSocket client

If you have a WebSocket client connected to the configured endpoint, it should receive the `order.created` event when the first request succeeds.

The WebSocket connection uses the Vix WebSocket runtime. Cnerium only emits the application event.

Example conceptual event:

```json
{
  "type": "order.created",
  "payload": {
    "order_id": "ord_order-123",
    "product_id": "p1",
    "quantity": 2
  }
}
```

The exact wire shape depends on the Vix WebSocket event encoding used by the current runtime. The application-level contract is the event type and payload.

## Why realtime is not the source of truth

The durable HTTP response is the result of the request.

The realtime event is a notification for connected clients.

The application’s domain storage should be the source of truth for the created order. This example uses a deterministic id for simplicity, but a real service would usually write the order to a database or domain store.

A client should not rely only on receiving the realtime event. It should be able to fetch state from the backend if needed.

## Add a service function

For a more realistic shape, move order creation into a function:

```cpp
struct Order
{
  std::string id;
  std::string product_id;
  int quantity{};
};

Order create_order(
    const std::string &idempotency_key,
    const std::string &product_id,
    int quantity)
{
  return Order{
      "ord_" + idempotency_key,
      product_id,
      quantity};
}
```

Then the durable handler can call the service and emit the event after the service returns:

```cpp
const Order order =
    create_order(
        request.idempotency_key_value(),
        product_id,
        quantity);

cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order.id)},
        {"product_id", cnerium::Json(order.product_id)},
        {"quantity", cnerium::Json(order.quantity)}
    }));

return cnerium::created({
    {"ok", true},
    {"order_id", order.id},
    {"product_id", order.product_id},
    {"quantity", order.quantity}
});
```

The same retry behavior remains. The service and event emission run only when Cnerium allows the handler to execute.

## Complete example with service function

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>
#include <utility>

struct Order
{
  std::string id;
  std::string product_id;
  int quantity{};
};

Order create_order(
    const std::string &idempotency_key,
    const std::string &product_id,
    int quantity)
{
  return Order{
      "ord_" + idempotency_key,
      product_id,
      quantity};
}

int main()
{
  vix::App app;

  cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

  config.set_name("durable-orders-realtime");
  config.set_data_dir("data/cnerium");
  config.set_node_id("durable-orders-realtime-node");
  config.enable_realtime("/ws", "0.0.0.0", 9090);

  auto cnerium = cnerium::attach(app, std::move(config));

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true},
        {"service", "durable-orders-realtime"}
    });
  });

  cnerium.durable_post(
      "/orders",
      "orders.create",
      [&cnerium](cnerium::DurableRequest &request)
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

        const Order order =
            create_order(
                request.idempotency_key_value(),
                product_id,
                quantity);

        cnerium.emit(
            "order.created",
            cnerium::support::object({
                {"order_id", cnerium::Json(order.id)},
                {"product_id", cnerium::Json(order.product_id)},
                {"quantity", cnerium::Json(order.quantity)}
            }));

        return cnerium::created({
            {"ok", true},
            {"order_id", order.id},
            {"product_id", order.product_id},
            {"quantity", order.quantity}
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

This version is closer to how a real backend would be organized. The route handles request parsing and response creation. The service function represents the domain operation. Cnerium controls whether the handler executes.

## What to verify

When the example is working correctly, these behaviors should hold:

```txt
POST /orders with a new key and valid body
  returns 201 Created
  emits order.created

POST /orders with the same key and same body
  returns the stored 201 response
  does not emit order.created again from the handler

POST /orders with the same key and different body
  returns 409 Conflict
  does not emit order.created

POST /orders without Idempotency-Key
  returns 400 Bad Request
  does not emit order.created
```

If the safe retry emits the event again, check whether the handler is actually being replayed from storage. Also verify that the second request uses the exact same key and exact same body.

## Summary

The durable orders realtime example shows how to combine Cnerium durable routes with application-level realtime notifications.

Vix still owns the backend and WebSocket transport. Cnerium attaches to `vix::App`, protects `POST /orders`, stores the durable response, and emits `order.created` only when the handler executes for a new safe request.

Safe retries receive the stored response. Unsafe retries are rejected. Duplicate handler-side realtime notifications are avoided.
