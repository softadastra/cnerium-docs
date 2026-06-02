# Realtime

Cnerium realtime is the application-level event API exposed by the attached Cnerium layer.

It is used to emit events after durable operations succeed. The WebSocket transport itself belongs to Vix. Cnerium does not implement a separate WebSocket server, session model, room system, frame parser, heartbeat, or low-level connection lifecycle.

A typical event emission looks like this:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

The event says what happened at the application level. Vix handles the realtime transport.

## Header

```cpp
#include <cnerium/cnerium.hpp>
```

or directly:

```cpp
#include <cnerium/realtime/Realtime.hpp>
#include <cnerium/realtime/Event.hpp>
#include <cnerium/realtime/EventPayload.hpp>
#include <cnerium/realtime/RealtimeConfig.hpp>
```

Most applications should include:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Namespace

Realtime types live under:

```cpp
namespace cnerium::realtime
```

Common public aliases are also available in:

```cpp
namespace cnerium
```

Common types include:

```cpp
cnerium::Event
cnerium::EventPayload
cnerium::realtime::RealtimeConfig
```

Most application code emits events through `cnerium::AttachedApp`:

```cpp
auto cnerium = cnerium::attach(app);

cnerium.emit("order.created", payload);
```

## Purpose

Realtime support exists so durable operations can notify connected clients when something important happens.

For example, after a durable order route creates an order, it can emit:

```txt
order.created
```

That event can update a dashboard, notify a browser client, or inform a live UI that new state exists.

The event is tied to the durable handler execution. If the same request is safely retried and Cnerium returns the stored response, the handler does not run again. That means the event is not emitted again by that handler.

This behavior is important because it avoids duplicate realtime notifications caused by HTTP retries.

## Boundary with Vix

Cnerium does not own WebSocket infrastructure.

Vix owns:

```txt
WebSocket server
connection lifecycle
sessions
rooms
message transport
runtime executor
low-level protocol behavior
```

Cnerium owns:

```txt
application event type
application event payload
emit
emit_to
durable-operation event timing
```

The boundary is:

```txt
Cnerium says what happened.
Vix delivers it.
```

This keeps Cnerium inside the Vix ecosystem instead of creating a second realtime framework.

## Enable realtime

Realtime is enabled through `AppConfig` before attaching Cnerium:

```cpp
vix::App app;

cnerium::app::AppConfig config =
    cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
config.enable_realtime("/ws", "0.0.0.0", 9090);

auto cnerium =
    cnerium::attach(app, std::move(config));
```

The call:

```cpp
config.enable_realtime("/ws", "0.0.0.0", 9090);
```

sets the public endpoint, bind host, and port used by the realtime layer.

## Configure realtime after attach

If the current API exposes the convenience method on `AttachedApp`, realtime can also be configured through the attached object:

```cpp
auto cnerium = cnerium::attach(app);

cnerium.realtime("/ws", "0.0.0.0", 9090);
```

This is equivalent in intent to enabling realtime through `AppConfig`.

Use the explicit `AppConfig` form when you want all Cnerium runtime settings in one place.

## Start realtime resources

Realtime resources are started with the Cnerium layer:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

`cnerium.start()` prepares Cnerium resources such as storage and optional realtime support.

`app.run()` starts the Vix HTTP application.

Cnerium does not run the Vix application for you.

## RealtimeConfig

`cnerium::realtime::RealtimeConfig` stores the realtime settings used by Cnerium.

Common values are:

```txt
enabled
endpoint
host
port
```

A typical enabled configuration is:

```cpp
auto realtime =
    cnerium::realtime::RealtimeConfig::enabled(
        "/ws",
        "0.0.0.0",
        9090);
```

A disabled configuration is:

```cpp
auto realtime =
    cnerium::realtime::RealtimeConfig::disabled();
```

Most application code should use `AppConfig::enable_realtime(...)` rather than constructing `RealtimeConfig` manually.

## Event

`cnerium::realtime::Event` represents one application-level realtime event.

An event has:

```txt
type
payload
```

Example:

```cpp
cnerium::Event event{
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })};
```

The event type should describe a completed fact:

```txt
order.created
payment.created
invoice.created
user.registered
workflow.started
```

Avoid vague event names:

```txt
created
done
success
update
event
```

Event names become part of the application contract, so they should remain stable.

## EventPayload

`cnerium::EventPayload` is the payload carried by a realtime event.

It uses Cnerium JSON, backed by Vix JSON:

```cpp
cnerium::EventPayload payload =
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)},
        {"status", cnerium::Json("created")}
    });
```

A good payload contains enough information for the receiver to understand what changed:

```json
{
  "order_id": "ord_order-123",
  "status": "created"
}
```

Keep event payloads focused. Realtime events should notify clients that something happened. They should not replace the application’s data API.

## emit

`emit` sends an event to connected clients.

Common usage:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

Common signatures on the attached app are:

```cpp
bool emit(const cnerium::realtime::Event &event);
```

```cpp
bool emit(
    std::string type,
    cnerium::realtime::EventPayload payload = cnerium::support::object());
```

`emit` returns `true` if the event was emitted by the current runtime state.

If realtime is disabled or not running, emission may fail. Application code should decide whether that failure matters for the operation.

For most durable HTTP operations, realtime delivery should be treated as a notification layer, not as the source of truth.

## emit_to

`emit_to` sends an event to a room.

Example:

```cpp
cnerium.emit_to(
    "orders",
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

Common signatures are:

```cpp
bool emit_to(
    const std::string &room,
    const cnerium::realtime::Event &event);
```

```cpp
bool emit_to(
    const std::string &room,
    std::string type,
    cnerium::realtime::EventPayload payload = cnerium::support::object());
```

Use `emit_to` when only a subset of connected clients should receive the event.

Room names should be stable and meaningful:

```txt
orders
admin
shop:42
user:123
```

The underlying room delivery belongs to the Vix WebSocket runtime.

## Emit from a durable route

The most common use is to emit after a durable operation succeeds:

```cpp
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
```

The event is emitted only when the handler executes.

If Cnerium replays a stored response, the handler is not called again, so the event is not emitted again by that handler.

## Complete example

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>
#include <utility>

int main()
{
  vix::App app;

  cnerium::app::AppConfig config =
      cnerium::app::AppConfig::development();

  config.set_name("orders-service");
  config.set_data_dir("data/cnerium");
  config.set_node_id("orders-node");
  config.enable_realtime("/ws", "0.0.0.0", 9090);

  auto cnerium =
      cnerium::attach(app, std::move(config));

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true},
        {"service", "orders-service"}
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

        const bool emitted =
            cnerium.emit(
                "order.created",
                cnerium::support::object({
                    {"order_id", cnerium::Json(order_id)},
                    {"product_id", cnerium::Json(product_id)},
                    {"quantity", cnerium::Json(quantity)}
                }));

        (void)emitted;

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

This example keeps Vix as the application owner, attaches Cnerium, enables realtime, and emits an event after a durable order operation.

## Event timing

An event should usually be emitted after the operation has succeeded.

Recommended flow:

```txt
validate request
perform the operation
emit event
return DurableResponse
```

For example:

```cpp
const Order order =
    create_order(...);

cnerium.emit(
    "order.created",
    payload);

return cnerium::created({
    {"ok", true},
    {"order_id", order.id}
});
```

Do not emit success events before validation passes or before the operation has actually completed.

## Retry behavior

Realtime events are tied to handler execution.

The expected behavior is:

```txt
new request
  handler executes
  event is emitted
  response is stored

same key with same body
  stored response is returned
  handler does not execute
  event is not emitted again by the handler

same key with different body
  409 Conflict
  handler does not execute
  event is not emitted by the handler

missing Idempotency-Key
  400 Bad Request
  handler does not execute
  event is not emitted by the handler
```

This is one of the main reasons to emit events from inside durable handlers.

## Response versus event

The durable response is the result of the HTTP request.

The realtime event is a notification.

For example:

```txt
POST /orders response
  tells the caller that the order was created

order.created event
  tells connected clients that an order was created
```

The response should contain the data the caller needs. The event should contain enough data for clients to update or fetch the changed state.

Do not make event delivery the only proof that the operation happened.

## Event delivery failure

`emit` returns a boolean.

```cpp
const bool emitted =
    cnerium.emit("order.created", payload);
```

For most applications, a failed realtime emission should not undo the durable operation.

A practical pattern is:

```cpp
const bool emitted =
    cnerium.emit("order.created", payload);

(void)emitted;

return cnerium::created({
    {"ok", true},
    {"order_id", order_id}
});
```

If event delivery is business-critical, use a durable event log or job system in addition to realtime notification.

Cnerium realtime events are not a durable queue.

## Realtime is not persistence

Realtime events should not be used as the only place where application state exists.

For an order route, store the order in the application database or domain store. Emit the event as a notification.

A client that misses the event should still be able to fetch state through a normal Vix route.

## Realtime is not a job system

Cnerium realtime events are not a background job queue, worker system, or guaranteed delivery mechanism.

Use them for live notifications and UI updates.

For background processing, retries, dead-letter behavior, or guaranteed asynchronous execution, use a dedicated job or workflow system.

## Testing

Start the application, then send a new durable request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected behavior:

```txt
HTTP 201 Created
handler runs
order.created is emitted
response is stored
```

Retry the same request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected behavior:

```txt
same stored response
handler does not run
order.created is not emitted again by the handler
```

Reuse the key with a different body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Expected behavior:

```txt
HTTP 409 Conflict
handler does not run
order.created is not emitted
```

## Common mistakes

Do not treat Cnerium realtime as a replacement for Vix WebSocket. Vix owns the transport.

Do not emit success events before the operation has succeeded.

Do not expect an event to emit again when a safe retry is replayed from storage.

Do not make event delivery the source of truth for the operation.

Do not use realtime events as a durable job queue.

Do not emit large payloads when a small event plus a normal fetch route would be cleaner.

## Summary

Cnerium realtime is the event API for durable application operations.

Enable it through `AppConfig`, start Cnerium resources, emit events from durable handlers, and let Vix handle the WebSocket transport. Safe retries replay stored responses instead of executing handlers again, so events emitted inside handlers are not duplicated by HTTP retries.
