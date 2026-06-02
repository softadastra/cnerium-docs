# Attach Model

Cnerium uses an attach model.

That means Cnerium does not create the backend application. It attaches to an existing `vix::App` and adds reliability features to that application.

The intended shape is:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

This is not only a syntax choice. It defines the architecture boundary between Vix and Cnerium.

Vix owns the application. Cnerium extends it.

## Why attach instead of owning the app

A backend framework usually has one main application object. In Vix, that object is `vix::App`.

It owns the HTTP application model: routes, middleware, request and response handling, server startup, shutdown, configuration, runtime executor, static files, templates, and other application-level behavior.

If Cnerium exposed its own main object like this:

```cpp
cnerium::App app;
```

the public API would suggest that Cnerium is a separate backend framework. Even if that object internally wrapped a `vix::App`, the mental model would still be wrong. A developer would have to ask whether they are building a Vix backend or a Cnerium backend.

The attach model avoids that confusion.

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

The backend is still a Vix backend. Cnerium is the reliability layer attached to it.

## Basic usage

A small application can mix normal Vix routes and Cnerium durable routes:

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

There are two different kinds of routes here.

`GET /health` is a normal Vix route. It does not need Cnerium because it does not create or mutate critical state.

`POST /orders` is a durable Cnerium route. It is registered into the same Vix application, but its handler is protected by Cnerium’s reliability rules.

## What attach returns

`cnerium::attach(app)` returns an attached Cnerium layer.

The exact public type is `cnerium::AttachedApp`, but most examples use `auto` because the important concept is the attachment, not the class name.

```cpp
auto cnerium = cnerium::attach(app);
```

The returned object owns the Cnerium runtime resources needed by durable routes. It keeps a reference to the Vix application, registers durable routes into that application, and manages Cnerium-level resources such as storage and optional realtime event support.

The Vix application itself is not moved into Cnerium. It remains owned by the caller.

## Lifetime

The attached Cnerium object must live at least as long as the durable routes it registers.

This is important because the attached layer owns the durable route objects used by the Vix route callbacks.

Recommended:

```cpp
int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  cnerium.durable_post(
      "/orders",
      "orders.create",
      handler);

  if (!cnerium.start())
  {
    return 1;
  }

  app.run();

  return 0;
}
```

Do not create the attached layer as a temporary:

```cpp
cnerium::attach(app).durable_post("/orders", "orders.create", handler);
```

That shape is unsafe because the attached object may be destroyed before the server starts handling requests.

Store the attached layer in a variable.

## Lifecycle

The attach model separates the Cnerium lifecycle from the Vix lifecycle.

Cnerium starts its own reliability resources:

```cpp
if (!cnerium.start())
{
  return 1;
}
```

Vix starts the HTTP application:

```cpp
app.run();
```

This makes the ownership explicit.

Cnerium does not call `app.run()` for the user. It does not hide the Vix runtime lifecycle. It only prepares the reliability layer so durable routes can use the store and optional realtime infrastructure.

A typical lifecycle is:

```txt
create vix::App
attach Cnerium
register normal Vix routes
register durable Cnerium routes
start Cnerium resources
run the Vix app
shutdown
```

In code:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);

app.get("/health", health_handler);

cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);

if (!cnerium.start())
{
  return 1;
}

app.run();
```

## Configuration

The simplest attachment uses the default development configuration:

```cpp
auto cnerium = cnerium::attach(app);
```

For explicit configuration, create an `AppConfig` and pass it to `attach`:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
config.enable_realtime("/ws", "0.0.0.0", 9090);

auto cnerium = cnerium::attach(app, std::move(config));
```

The configuration belongs to the attached Cnerium layer. It does not replace Vix configuration.

Use Vix configuration for Vix behavior such as HTTP server settings and runtime behavior. Use Cnerium configuration for Cnerium-level behavior such as durable storage paths, local node identity, and realtime event attachment options.

## Route registration

A durable route is registered through the attached Cnerium layer:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

Internally, Cnerium registers a `POST` route into the attached `vix::App`. When a request reaches that route, Vix handles the HTTP part and Cnerium handles the durability decision.

The simplified flow is:

```txt
cnerium.durable_post(...)
  -> create Cnerium durable route
  -> store durable route in the attached layer
  -> register a Vix POST route
  -> Vix invokes the Cnerium route adapter when a request arrives
```

This keeps Vix responsible for routing and Cnerium responsible for the reliability semantics.

## Normal routes stay normal

The attach model does not require every route to go through Cnerium.

This is valid:

```cpp
app.get("/products", list_products);
app.get("/orders/{id}", get_order);

cnerium.durable_post("/orders", "orders.create", create_order);
```

Only the critical write route is durable.

This is usually the best structure for real services. Most routes do not need idempotency, request body hashing, stored response replay, or conflict detection. For those routes, normal Vix routing is clearer.

## Durable routes are still Vix routes

A Cnerium durable route is registered into Vix.

That means it participates in the same application-level structure as other Vix routes. It uses the Vix HTTP server, Vix router, Vix request object internally, and Vix response writer.

The handler receives `cnerium::DurableRequest` because durable handlers need reliability-specific helpers:

```cpp
request.idempotency_key_value();
request.request_hash();
request.json();
```

The handler returns `cnerium::DurableResponse` because Cnerium must be able to store and replay the response later.

This is the reason durable route handlers look slightly different from ordinary Vix handlers. The route is still hosted by Vix, but the execution contract is stronger.

## Realtime in the attach model

Cnerium can emit application-level events through the attached runtime:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

The event API belongs to Cnerium because it is tied to durable application operations. The transport belongs to Vix because Vix owns the WebSocket runtime.

This keeps the boundary clear.

Cnerium says what happened. Vix handles the realtime delivery.

## Avoid global attachment

The recommended model is explicit attachment:

```cpp
auto cnerium = cnerium::attach(app);
```

Avoid designs that hide the Cnerium layer behind global state. A global attachment makes the application harder to test, harder to reason about, and less explicit about lifecycle.

A backend should show its structure directly:

```cpp
vix::App app;
auto cnerium = cnerium::attach(app);
```

That makes it clear which object owns the backend and which object adds reliability.

## Avoid multiple attachments to the same app

A typical application should attach Cnerium once.

Recommended:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);

cnerium.durable_post("/orders", "orders.create", create_order);
cnerium.durable_post("/payments", "payments.create", create_payment);
```

Avoid attaching Cnerium repeatedly to the same `vix::App` unless the application has a specific advanced reason to isolate runtime resources.

Repeated attachments can make storage, route ownership, event emission, and shutdown behavior harder to reason about. For most services, one attached Cnerium layer per Vix app is the correct model.

## Why this model scales

The attach model works for small examples and larger applications.

A small service can keep everything in `main.cpp` while learning the API. A larger service can move route registration into controllers or modules while still passing the same attached Cnerium layer where durable routes are needed.

For example:

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

This keeps the architecture honest. Vix remains the application object. Cnerium remains the reliability layer.

## Summary

The attach model is the core integration pattern of Cnerium.

It keeps Cnerium inside the Vix ecosystem without turning it into a separate backend framework. A developer creates a normal `vix::App`, attaches Cnerium, registers normal routes with Vix, and registers critical durable routes with Cnerium.

The result is a backend that still feels like Vix, but selected write operations gain durable, idempotent, retry-safe behavior.
