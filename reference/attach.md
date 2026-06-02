# attach

`cnerium::attach` attaches Cnerium to an existing `vix::App`.

This is the main entry point for using Cnerium in a Vix backend. It keeps Vix as the owner of the backend application and returns an attached Cnerium layer that can register durable routes, start Cnerium runtime resources, and emit realtime events.

The intended usage is:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

A Cnerium backend should start from `vix::App`, not from a separate Cnerium application object.

## Header

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Namespace

```cpp
namespace cnerium
```

The implementation also exists under:

```cpp
namespace cnerium::app
```

Most application code should use the public `cnerium::attach` overloads.

## Signatures

```cpp
[[nodiscard]] cnerium::app::AttachedApp
attach(vix::App &app);
```

```cpp
[[nodiscard]] cnerium::app::AttachedApp
attach(
    vix::App &app,
    cnerium::app::AppConfig config);
```

Equivalent namespaced overloads are available in `cnerium::app`:

```cpp
[[nodiscard]] cnerium::app::AttachedApp
cnerium::app::attach(vix::App &app);
```

```cpp
[[nodiscard]] cnerium::app::AttachedApp
cnerium::app::attach(
    vix::App &app,
    cnerium::app::AppConfig config);
```

## Parameters

### app

```cpp
vix::App &app
```

The Vix application to attach Cnerium to.

Cnerium does not take ownership of this object. The caller remains responsible for keeping the `vix::App` alive and for running it with `app.run()`.

### config

```cpp
cnerium::app::AppConfig config
```

Optional Cnerium configuration.

Use this overload when the attached Cnerium layer needs explicit configuration such as service name, data directory, node id, Vix config path, or realtime support.

Example:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");

auto cnerium = cnerium::attach(app, std::move(config));
```

## Return value

`attach` returns a `cnerium::AttachedApp`.

Most examples use `auto`:

```cpp
auto cnerium = cnerium::attach(app);
```

The returned object owns Cnerium runtime resources and stores the durable route objects registered through it. It also keeps a reference to the attached `vix::App`.

The returned object must stay alive while the Vix app is running.

## Basic example

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

This example has one normal Vix route and one Cnerium durable route.

The health route belongs directly to Vix. The order route is registered through Cnerium because it needs durable retry behavior.

## Example with explicit configuration

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

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

  cnerium.durable_post(
      "/orders",
      "orders.create",
      [&cnerium](cnerium::DurableRequest &request)
      {
        const std::string order_id = "ord_" + request.idempotency_key_value();

        cnerium.emit(
            "order.created",
            cnerium::support::object({
                {"order_id", cnerium::Json(order_id)}
            }));

        return cnerium::created({
            {"ok", true},
            {"order_id", order_id}
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

The configuration belongs to Cnerium. The application still belongs to Vix.

## Lifecycle

The normal lifecycle is:

```txt
create vix::App
attach Cnerium
register normal Vix routes
register durable Cnerium routes
start Cnerium resources
run Vix app
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

`cnerium.start()` starts Cnerium runtime resources such as the store and optional realtime support.

`app.run()` starts the Vix HTTP application.

Cnerium does not run the Vix app for you.

## Ownership

`attach` does not transfer ownership of `vix::App`.

This is important:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

The `app` variable remains the real application object. The attached Cnerium layer stores a reference to it and uses it to register durable routes.

Cnerium should not close, destroy, or own the `vix::App`.

## Lifetime requirement

The attached Cnerium object must live as long as the routes it registers may be used.

Recommended:

```cpp
int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  cnerium.durable_post(
      "/orders",
      "orders.create",
      create_order);

  if (!cnerium.start())
  {
    return 1;
  }

  app.run();

  return 0;
}
```

Avoid creating the attached layer as a temporary:

```cpp
cnerium::attach(app).durable_post("/orders", "orders.create", create_order);
```

That style can destroy the attached object before the server handles requests. Store the result of `attach` in a variable.

## Registering durable routes

After attachment, register durable routes with the returned object:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);
```

This registers a Vix `POST` route internally, but the handler is wrapped by Cnerium’s durable route logic.

The durable route receives a `cnerium::DurableRequest` and returns a `cnerium::DurableResponse`.

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body = request.json();

      return cnerium::created({
          {"ok", true}
      });
    });
```

## Normal routes remain Vix routes

`attach` does not change how ordinary Vix routes are registered.

This remains normal Vix code:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true}
  });
});
```

Use Vix routes for ordinary reads, health checks, status pages, static files, and endpoints that do not need durable retry behavior.

Use Cnerium routes for critical writes.

## Realtime after attach

If realtime support is enabled in the Cnerium configuration, the attached object can emit events:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

The event API belongs to Cnerium. The WebSocket transport belongs to Vix.

A safe replay of a durable request does not execute the handler again, so events emitted inside the handler are not emitted again by that handler.

## Common mistakes

Do not replace the Vix application object with a Cnerium application object.

```cpp
cnerium::App app;
```

The public model should be:

```cpp
vix::App app;
auto cnerium = cnerium::attach(app);
```

Do not create the attached layer as a temporary. Keep it alive.

Do not call `app.run()` before `cnerium.start()` if durable routes require Cnerium resources.

Do not move the `vix::App` after attaching Cnerium to it. The attached layer stores a reference to the app.

Do not use `cnerium.durable_post` for every route. Normal Vix routes should remain normal Vix routes.

## Summary

`cnerium::attach` is the bridge between Vix and Cnerium.

It attaches Cnerium to an existing `vix::App`, keeps Vix as the backend owner, and returns an attached layer used to register durable routes and emit application events.

Use it once near application startup, keep the returned object alive, start Cnerium resources, then run the Vix application.
