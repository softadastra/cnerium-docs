# Realtime Events

Cnerium can emit realtime application events from durable routes.

The purpose is not to replace Vix WebSocket. Vix already owns the WebSocket runtime, the server, sessions, rooms, message delivery, and connection lifecycle. Cnerium only adds a small event API that is useful when a durable operation completes and the application wants to notify connected clients.

A typical example is order creation:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)},
        {"product_id", cnerium::Json(product_id)},
        {"quantity", cnerium::Json(quantity)}
    }));
```

This event says that an application operation happened. The transport remains Vix.

## Why realtime events exist in Cnerium

Durable routes often represent important business operations.

For example:

```txt
POST /orders
POST /payments
POST /invoices
POST /users/register
POST /workflows/start
```

After one of these operations completes, the backend may need to notify another part of the application. A dashboard may need to update. A browser client may need to show a new order. An admin panel may need to display a payment status. A worker may need to know that a workflow started.

Cnerium provides an event API close to the durable operation because the event belongs to the result of that operation.

The important detail is retry behavior.

If the same durable request is retried and Cnerium replays the stored response, the durable handler is not executed again. That means the event emitted inside the handler is not emitted again by that handler.

This prevents a common duplicate-notification problem.

## The boundary with Vix WebSocket

Cnerium does not implement its own WebSocket system.

It does not own:

```txt
WebSocket server
WebSocket sessions
frame parsing
connection lifecycle
rooms
heartbeat
low-level message transport
```

Those are Vix responsibilities.

Cnerium owns only the application-level event abstraction used by durable operations:

```txt
event type
event payload
emit
emit_to
```

The boundary is simple:

```txt
Cnerium says what happened.
Vix delivers it.
```

This keeps the design consistent with the rest of Cnerium. Cnerium attaches to a Vix backend instead of creating another backend universe.

## Enable realtime support

Realtime support is configured through the attached Cnerium layer.

```cpp
vix::App app;

cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
config.enable_realtime("/ws", "0.0.0.0", 9090);

auto cnerium = cnerium::attach(app, std::move(config));
```

The parameters are:

```txt
/ws
  public WebSocket endpoint

0.0.0.0
  host used by the WebSocket listener

9090
  port used by the WebSocket listener
```

The HTTP application is still started by Vix:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

`cnerium.start()` starts Cnerium runtime resources, including realtime support when enabled. `app.run()` starts the Vix HTTP application.

## Emit an event

The simplest event emission uses an event type and a JSON payload:

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

The event type should be stable and explicit.

Good event names:

```txt
order.created
payment.created
invoice.created
user.registered
workflow.started
```

Avoid vague names:

```txt
created
done
event
notify
update
```

The event name is part of the application contract. Clients may depend on it.

## Emit to a room

Cnerium can also emit to a room:

```cpp
cnerium.emit_to(
    "orders",
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

Use room emission when the application wants to notify a subset of connected clients.

For example:

```txt
orders
  clients watching order activity

admin
  admin dashboard clients

shop:42
  clients watching one shop

user:123
  clients associated with one user
```

The room model is delivered through the underlying Vix WebSocket runtime. Cnerium only exposes the event-level API.

## Durable route example

A durable order route can emit an event after validation and order creation:

```cpp
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
```

The event is emitted only when the handler runs.

If the same request is retried with the same `Idempotency-Key` and the same body, Cnerium returns the stored response. The handler is not called again, so this event is not emitted again by the handler.

That is the behavior you usually want for durable operations.

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

This example has one normal Vix route and one Cnerium durable route.

`GET /health` is ordinary HTTP behavior. `POST /orders` is durable and can emit a realtime event when a new order is created.

## Event payloads

Cnerium event payloads use the Cnerium JSON type, backed by Vix JSON.

A payload is usually a JSON object:

```cpp
cnerium::support::object({
    {"order_id", cnerium::Json(order_id)},
    {"status", cnerium::Json("created")}
});
```

Keep payloads practical and stable.

A useful event payload contains the identifiers and state needed by the receiver:

```json
{
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

Avoid making event payloads too large. Events should notify clients about something that happened. They should not replace the application’s data API.

A client can receive `order.created`, then fetch the full order through a normal Vix route if it needs more details.

## Event naming

Use names that describe completed facts.

Good:

```txt
order.created
payment.created
invoice.created
user.registered
workflow.started
```

Less clear:

```txt
create_order
new
success
update
message
```

A good event name should be readable from the client side without opening the server code.

Prefer past-tense or state-based names for emitted events. The operation has already happened by the time the event is emitted.

## Events and stored responses

Realtime events and stored responses solve different parts of the same durable operation.

The durable response is the result returned to the caller.

The realtime event is a notification sent to connected clients.

For example:

```txt
POST /orders response
  tells the caller that the order was created and returns the order id

order.created event
  tells connected clients that a new order exists
```

The response is the source of truth for the request. The event is a notification.

When the request is replayed from a stored response, the response is returned again, but the event is not emitted again by the durable handler.

## Events are not persistence

Emitting an event is not the same thing as storing domain state.

For an order system, the application should still store the order in its database or domain storage. The realtime event is only a message to connected clients.

Do not use events as the only record that something happened.

A serious backend should treat events as delivery signals, not as the primary data model.

## Events are not a queue

Cnerium realtime events are not a general-purpose durable job queue.

They are application-level notifications delivered through Vix WebSocket. They are useful for live updates, dashboards, client notifications, and realtime UI behavior.

If the application needs guaranteed asynchronous processing, background jobs, retries, dead-letter queues, or worker orchestration, that belongs to a dedicated job or workflow system.

Cnerium’s event API should stay focused on notifying connected clients about durable application operations.

## Failure considerations

If no WebSocket clients are connected, emitting an event may not deliver anything. The durable response still remains the result of the operation.

If the WebSocket runtime is not enabled, `emit` may fail or return false depending on the runtime state. Application code should not make the correctness of the durable operation depend only on event delivery.

A good durable route should complete its core operation and return the durable response. The realtime event should be a notification layer.

For high-value operations, store the domain state first, return a durable response, and use realtime events only to notify clients that state has changed.

## Testing event behavior

Start the durable orders realtime example:

```bash
./build-ninja/cnerium_durable_orders_realtime
```

Send a request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected HTTP response:

```txt
HTTP/1.1 201 Created
```

Retry the same request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

The same response should be returned. The durable handler should not run again, so the event should not be emitted again by that handler.

Then reuse the same key with a different body:

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

The handler does not run in the conflict case, so no success event should be emitted by the handler.

## Summary

Realtime events in Cnerium are application-level notifications tied to durable backend operations.

Cnerium exposes `emit` and `emit_to` so a durable route can notify clients when a new operation succeeds. Vix remains responsible for the WebSocket runtime and message delivery. Safe retries replay stored responses instead of re-executing handlers, so events emitted inside durable handlers are not emitted twice for the same completed request.

Use Cnerium realtime events to notify clients. Use durable responses as the request result. Use your application storage as the source of truth.
