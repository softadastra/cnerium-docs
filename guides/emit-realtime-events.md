# Emit Realtime Events

This guide shows how to emit realtime events from a Cnerium durable route.

Cnerium does not replace Vix WebSocket. Vix remains responsible for the realtime transport, WebSocket server, sessions, rooms, and message delivery. Cnerium only exposes an application-level event API that is useful when a durable operation completes.

The common case is simple: a durable route creates something important, then emits an event to notify connected clients.

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

The event is emitted only when the durable handler runs. If the same request is retried and Cnerium returns a stored response, the handler is not executed again, so the event is not emitted again by that handler.

That behavior is important for avoiding duplicate realtime notifications.

## Starting point

Start with a normal Vix application and attach Cnerium with realtime enabled.

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>
#include <utility>

int main()
{
  vix::App app;

  cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

  config.set_name("orders-service");
  config.set_data_dir("data/cnerium");
  config.set_node_id("orders-node");
  config.enable_realtime("/ws", "0.0.0.0", 9090);

  auto cnerium = cnerium::attach(app, std::move(config));

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

The HTTP application still belongs to Vix. The realtime event support is attached through Cnerium and delivered through Vix WebSocket.

## Enable realtime

Realtime support is enabled through `AppConfig`.

```cpp
config.enable_realtime("/ws", "0.0.0.0", 9090);
```

The values are:

```txt
/ws
  public WebSocket endpoint

0.0.0.0
  WebSocket bind host

9090
  WebSocket bind port
```

This configures the realtime side of the attached Cnerium layer. It does not replace the Vix HTTP app and it does not create a separate backend model.

After attaching Cnerium, start its runtime resources before running the Vix app:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

`cnerium.start()` prepares Cnerium storage and realtime resources. `app.run()` starts the Vix HTTP application.

## Add a durable route

Realtime events are most useful when they are tied to durable operations.

Add a durable order route:

```cpp
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

      const std::string order_id = "ord_" + request.idempotency_key_value();

      return cnerium::created({
          {"ok", true},
          {"order_id", order_id},
          {"product_id", product_id},
          {"quantity", quantity}
      });
    });
```

This route creates the durable operation but does not emit an event yet.

## Emit an event from the handler

To emit an event from inside the durable handler, capture the attached Cnerium layer by reference:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [&cnerium](cnerium::DurableRequest &request)
    {
      // handler body
    });
```

Then emit the event after the operation has succeeded:

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

A complete handler can look like this:

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
          })
      );

      return cnerium::created({
          {"ok", true},
          {"order_id", order_id},
          {"product_id", product_id},
          {"quantity", quantity}
      });
    });
```

The event is part of the successful handler execution. If the handler is skipped because Cnerium replays a stored response, the event is not emitted again by this handler.

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
            })
        );

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

This is still a Vix backend. Cnerium is attached to the app and provides durable routes plus application-level realtime events.

## Event naming

Use stable event names that describe completed facts.

Good names:

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
success
event
update
```

A realtime event is part of the application contract. Frontend clients and other realtime consumers may depend on the event name, so choose names that will remain meaningful as the application grows.

## Event payloads

The payload should contain useful identifiers and minimal state needed by the receiver.

For an order event:

```cpp
cnerium::support::object({
    {"order_id", cnerium::Json(order_id)},
    {"product_id", cnerium::Json(product_id)},
    {"quantity", cnerium::Json(quantity)}
});
```

This produces a payload shaped like:

```json
{
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

Keep payloads stable and practical. Do not use events as a replacement for the full application data model. If a client needs more details, it can receive the event and then call a normal Vix route to fetch the complete resource.

## Emit to all clients

Use `emit` when the event should be broadcast to all connected clients:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

This is useful for dashboards, demos, local development, and broad notifications where every connected client may care about the event.

## Emit to a room

Use `emit_to` when only a subset of clients should receive the event:

```cpp
cnerium.emit_to(
    "orders",
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

Room names should be stable and understandable:

```txt
orders
admin
shop:42
user:123
```

The room transport is handled by the underlying Vix WebSocket runtime. Cnerium only exposes the application-level event API.

## Test the HTTP behavior

Start the application and send a valid durable request:

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

Send the same request again:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

The response should be the same. Cnerium should return the stored response instead of executing the handler again.

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

The conflict request does not run the success handler, so it should not emit the success event from that handler.

## Test duplicate event behavior

The easiest way to reason about duplicate event behavior is to add a log or visible side effect inside the handler near the `emit` call.

Conceptually:

```cpp
cnerium.emit("order.created", payload);
```

This line runs only when the durable handler runs.

The expected behavior is:

```txt
first request with new key
  -> handler runs
  -> event is emitted
  -> response is stored

same key with same body
  -> stored response is returned
  -> handler does not run
  -> event is not emitted again by the handler

same key with different body
  -> 409 Conflict
  -> handler does not run
  -> event is not emitted by the handler
```

This is the reason realtime emission belongs naturally inside durable handlers. A successful operation emits once. A retry receives the stored response without repeating the handler-side notification.

## Event delivery is not the source of truth

The durable response is the result of the request. The application database or domain store is the source of truth for the created state. The realtime event is a notification.

Do not design the application so correctness depends only on a realtime event being delivered.

A client that misses `order.created` should still be able to fetch the order from a normal Vix route. A dashboard can use realtime events for fast updates, but it should still be able to reload state from the backend.

## Event failure handling

`emit` returns a boolean.

```cpp
const bool emitted = cnerium.emit("order.created", payload);
```

In many applications, a failed realtime emission should not undo the durable operation. The order may still be created even if no WebSocket client is connected or if realtime delivery is unavailable.

A practical pattern is to treat event delivery as a notification layer:

```cpp
const bool emitted = cnerium.emit("order.created", payload);

(void)emitted;

return cnerium::created({
    {"ok", true},
    {"order_id", order_id}
});
```

If the event is business-critical, the application should use a dedicated durable event log or job system in addition to realtime notification. Cnerium realtime events are not a replacement for a durable queue.

## Common mistakes

Do not use Cnerium realtime events as the only record that an operation happened. Store domain state in your application storage.

Do not emit success events before validation passes. Emit after the operation has actually succeeded.

Do not expect the event to emit again when a request is replayed from a stored response. That is intentionally avoided.

Do not build a second WebSocket architecture in Cnerium. Vix owns the WebSocket runtime.

Do not make the durable response depend on event delivery unless your application has a deliberate reason and a fallback strategy.

## Summary

Cnerium realtime events are notifications emitted from durable backend operations.

Enable realtime through `AppConfig`, attach Cnerium to `vix::App`, emit events from durable handlers, and let Vix handle the WebSocket transport. When a safe retry is replayed from storage, the handler does not run again, so the event is not emitted twice by that handler.

Use realtime events for live updates. Use durable responses for request results. Use application storage as the source of truth.
