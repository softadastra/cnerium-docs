# Cnerium and Vix

Cnerium is designed to live inside the Vix backend model.

It does not introduce a second application runtime, a second router, or a second way to structure HTTP backends. A Cnerium application starts as a normal Vix application. The developer creates a `vix::App`, registers ordinary routes with Vix, then attaches Cnerium to add reliability semantics to selected write operations.

This is the central relationship:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

The order matters conceptually. Vix is the application owner. Cnerium is attached to it.

## Vix remains the application layer

Vix owns the backend application model.

That includes the HTTP server, routing, middleware, request and response types, runtime lifecycle, static files, templates, WebSocket runtime, configuration, build workflow, development workflow, and production workflow.

A normal route remains a normal Vix route:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true}
  });
});
```

Cnerium does not need to wrap this route. There is no reliability problem to solve here. A health check can be repeated many times without creating duplicate application state.

The same applies to most read-only endpoints:

```txt
GET /health
GET /status
GET /products
GET /orders/{id}
GET /assets/app.css
```

Those endpoints belong directly to Vix.

## Cnerium adds reliability to selected routes

Cnerium is used when a route represents a critical write operation.

For example:

```txt
POST /orders
POST /payments
POST /invoices
POST /users/register
POST /subscriptions
POST /workflows/start
```

Those endpoints are different from ordinary reads because executing them twice can create duplicated state. A retry after a timeout may be legitimate from the client’s perspective, but unsafe if the server treats it as a new operation.

Cnerium adds a durable route:

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

This route is still registered into the Vix application. Vix receives the request, parses it, matches the route, and writes the response. Cnerium runs around the handler to decide whether the operation should execute, replay a stored response, or fail with a conflict.

## Why Cnerium does not own vix::App

Earlier Cnerium designs can be tempting to write like this:

```cpp
cnerium::App app;
```

That shape is misleading.

Even if `cnerium::App` internally wraps a Vix app, it gives the developer the impression that Cnerium is a second backend framework. It suggests that using Cnerium means leaving the Vix application model and entering a new one.

The current direction avoids that confusion.

The application should be written as:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

This makes the ownership explicit. Vix owns the backend. Cnerium attaches to it.

The result is easier to understand for a developer who already knows Vix. They do not need to learn a new application object. They only need to learn when and how to make a route durable.

## Ownership boundary

The ownership boundary is simple.

```txt
Vix owns:
  application startup
  HTTP server
  routing
  middleware
  request parsing
  response writing
  static files
  templates
  WebSocket transport
  runtime lifecycle
  build workflow
  development workflow
  production workflow

Cnerium owns:
  durable route registration helpers
  durable request wrapper
  durable response type
  idempotency checks
  request body hashing
  replay protection
  stored responses
  Cnerium store keys
  application-level realtime events for durable operations

Softadastra SDK owns:
  durable storage foundation
  local persistence
  sync-related foundations
  SDK client API used by Cnerium
```

The point is not to split the ecosystem into separate worlds. The point is to keep each layer responsible for the work it is designed to do.

Vix is the runtime and backend framework layer. Cnerium is the reliability layer. The Softadastra SDK is the durable storage foundation behind Cnerium.

## Request flow

A normal Vix route follows the standard Vix request flow:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Vix route handler
  -> Vix response writer
```

A Cnerium durable route adds a reliability decision before the user handler:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Cnerium durable route
  -> idempotency check
      -> execute handler
      -> replay stored response
      -> reject unsafe retry
  -> Vix response writer
```

The HTTP transport does not change. The Vix router does not change. The response is still written through Vix. Cnerium only controls whether the durable handler should run.

## DurableRequest and Vix Request

Cnerium handlers receive `cnerium::DurableRequest`, not `vix::Request`.

That does not mean Cnerium owns HTTP. `DurableRequest` is a wrapper around the Vix request. It exposes the request data needed by durable handlers and adds reliability-specific helpers such as the idempotency key and request hash.

Example:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body = request.json();
      const std::string key = request.idempotency_key_value();

      return cnerium::created({
          {"ok", true},
          {"key", key}
      });
    });
```

For ordinary routes, use `vix::Request` and `vix::Response`. For durable routes, use `cnerium::DurableRequest` and return a `cnerium::DurableResponse`.

That distinction is intentional. Durable routes have a different execution contract.

## DurableResponse and Vix Response

A durable handler returns a `cnerium::DurableResponse`.

Cnerium needs this response to be storable. A normal `vix::Response` is written directly to the client. A durable response must also be convertible into a stored response so Cnerium can replay it later if the same request is retried.

Example:

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id}
});
```

Internally, Cnerium converts that durable response into the Vix response writer. The application developer should not need to manually write to `vix::Response` inside a durable handler.

The durable response is part of the reliability model. It gives Cnerium a response it can persist and replay.

## Why normal Vix routes still matter

Cnerium should not be used for every route.

A backend usually contains many endpoints that do not need durable write semantics. For those endpoints, using normal Vix routes keeps the code clearer and avoids unnecessary idempotency requirements.

A good backend can mix both styles:

```cpp
app.get("/health", health_handler);
app.get("/products", list_products);
app.get("/orders/{id}", get_order);

cnerium.durable_post("/orders", "orders.create", create_order);
cnerium.durable_post("/payments", "payments.create", create_payment);
```

This is the intended model. Vix handles the general backend. Cnerium protects the critical operations.

## WebSocket relationship

Vix provides the WebSocket runtime.

Cnerium does not implement its own WebSocket server, session model, frame parser, rooms, or connection lifecycle. When Cnerium emits an application event, that event is delivered through Vix WebSocket.

Example:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

This is an application-level event. Cnerium describes what happened. Vix handles the realtime transport.

The same boundary applies here: Cnerium should not become the place where the full WebSocket system is documented. That belongs to Vix. Cnerium only documents how durable operations can emit events through the attached Vix runtime.

## Configuration relationship

Vix configuration remains responsible for Vix behavior.

Cnerium configuration is only for Cnerium-level behavior: application name, Cnerium data directory, node id, Softadastra-related local persistence, and realtime event attachment options.

A typical explicit setup looks like this:

```cpp
vix::App app;

cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
config.enable_realtime("/ws", "0.0.0.0", 9090);

auto cnerium = cnerium::attach(app, std::move(config));
```

This configuration does not make Cnerium the application owner. It only configures the attached reliability layer.

## Lifecycle relationship

The lifecycle should remain explicit:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

`cnerium.start()` starts the Cnerium runtime resources such as the store and optional realtime support. `app.run()` starts the Vix HTTP application and blocks until shutdown.

Cnerium should not call `app.run()` for the user. That would blur the ownership boundary.

Likewise, Cnerium should not close an app it does not own. The `vix::App` lifecycle remains controlled by the application.

## Practical rule

Use this rule when deciding where code belongs:

If the code is about HTTP application structure, it belongs to Vix.

If the code is about making a critical operation safe under retries, it belongs to Cnerium.

If the code is about durable local storage and sync foundations used behind the reliability layer, it belongs behind the Softadastra SDK.

That rule keeps the system understandable.

## Summary

Cnerium and Vix are not competing layers.

Vix is the backend application foundation. Cnerium attaches to Vix and adds reliability semantics for selected write operations. The Softadastra SDK provides the durable foundation behind Cnerium.

A developer should be able to start from a normal Vix backend, add Cnerium with one attachment call, and protect critical routes without changing the rest of the application architecture.
