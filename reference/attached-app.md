# AttachedApp

`cnerium::AttachedApp` is the Cnerium layer attached to an existing `vix::App`.

Application code usually receives it from `cnerium::attach`:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

The attached object is not the backend application. The backend application is still `vix::App`. `AttachedApp` keeps a reference to that app and adds Cnerium-specific behavior: durable route registration, Cnerium runtime startup, storage access, and realtime event emission.

Most examples use `auto` instead of naming the type directly because the important idea is the attachment model, not the class name.

## Header

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Namespace

```cpp
namespace cnerium
```

The concrete type is available as:

```cpp
cnerium::AttachedApp
```

It maps to the implementation type:

```cpp
cnerium::app::AttachedApp
```

## Purpose

`AttachedApp` exists to keep the relationship between Vix and Cnerium explicit.

Vix owns the application:

```cpp
vix::App app;
```

Cnerium attaches to it:

```cpp
auto cnerium = cnerium::attach(app);
```

The attached layer can then register durable routes into the Vix app:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);
```

This prevents Cnerium from becoming a second backend framework. The route is still hosted by Vix. Cnerium only wraps the selected handler with durability, idempotency, replay protection, and stored response behavior.

## Construction

Most code should create an attached layer with `cnerium::attach`.

```cpp
auto cnerium = cnerium::attach(app);
```

With explicit configuration:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");

auto cnerium = cnerium::attach(app, std::move(config));
```

Direct construction is possible if exposed by the current headers, but `attach` is the recommended public entry point because it communicates the intent clearly.

## Ownership

`AttachedApp` does not own the `vix::App`.

It stores a reference or pointer to the Vix application that was passed to `cnerium::attach`. The caller remains responsible for keeping the Vix app alive and running it.

Correct:

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

Incorrect:

```cpp
auto make_cnerium()
{
  vix::App app;

  return cnerium::attach(app);
}
```

The attached object would refer to an app that no longer exists.

The `vix::App` must outlive the attached Cnerium layer.

## Lifetime

The attached object must stay alive while its durable routes can receive requests.

This matters because `AttachedApp` owns the durable route objects registered into the Vix app. Vix invokes callbacks that rely on those route objects.

Recommended:

```cpp
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
```

Avoid this:

```cpp
cnerium::attach(app).durable_post("/orders", "orders.create", create_order);
```

The temporary attached object may be destroyed too early. Store the result of `attach` in a variable.

## Main methods

`AttachedApp` provides the public methods used by application code:

```txt
durable_post
realtime
emit
emit_to
start
stop
is_running
runtime
vix_app
config
```

These methods belong to Cnerium’s reliability layer. They do not replace the Vix application API.

## durable_post

Registers a durable `POST` route into the attached Vix app.

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

Signature:

```cpp
AttachedApp &durable_post(
    std::string path,
    std::string operation,
    cnerium::http::DurableHandler handler);
```

Parameters:

```txt
path
  HTTP path registered into the Vix app.

operation
  stable Cnerium operation name used for idempotency scope.

handler
  durable route handler executed only for a new safe request.
```

The route handler receives `cnerium::DurableRequest` and returns `cnerium::DurableResponse`.

The handler is not called when Cnerium replays a stored response or rejects unsafe key reuse.

## durable_post example

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

This registers a Vix `POST /orders` route whose execution is controlled by Cnerium.

## realtime

Enables realtime event support through the Cnerium configuration.

```cpp
cnerium.realtime("/ws", "0.0.0.0", 9090);
```

Signature:

```cpp
AttachedApp &realtime(
    std::string endpoint = "/ws",
    std::string host = "0.0.0.0",
    std::uint16_t port = 9090);
```

This is a convenience method for enabling realtime behavior on the attached Cnerium layer.

The WebSocket transport still belongs to Vix. Cnerium only emits application-level events.

## emit

Emits a realtime event to all connected clients.

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

Common overloads:

```cpp
bool emit(const cnerium::realtime::Event &event);
```

```cpp
bool emit(std::string type,
    cnerium::realtime::EventPayload payload = cnerium::support::object());
```

`emit` returns `true` if the event was emitted by the current Cnerium runtime state.

An event emitted inside a durable handler is emitted only when the handler runs. If the same request is replayed from storage, the handler does not run again, so the event is not emitted again by that handler.

## emit_to

Emits a realtime event to a room.

```cpp
cnerium.emit_to(
    "orders",
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

Common overloads:

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

Room delivery is handled by the Vix WebSocket runtime. Cnerium only provides the application-level event API.

## start

Starts Cnerium runtime resources.

```cpp
if (!cnerium.start())
{
  return 1;
}
```

Signature:

```cpp
bool start();
```

`start` prepares Cnerium resources such as the store and optional realtime support.

It does not start the Vix HTTP server. The Vix app is still started with:

```cpp
app.run();
```

The normal order is:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

## stop

Stops Cnerium runtime resources.

```cpp
cnerium.stop();
```

Signature:

```cpp
void stop() noexcept;
```

`stop` should only stop resources owned by Cnerium. It should not close the `vix::App`, because Cnerium does not own the Vix application.

In most simple applications, shutdown is handled naturally when `main` exits and the attached object is destroyed.

## is_running

Returns whether Cnerium runtime resources are running.

```cpp
if (cnerium.is_running())
{
  // Cnerium runtime resources are active.
}
```

Signature:

```cpp
bool is_running() const noexcept;
```

This describes the Cnerium runtime state, not the Vix HTTP server state.

## config

Returns the Cnerium configuration.

```cpp
auto &config = cnerium.config();
```

Common usage:

```cpp
cnerium.config().enable_realtime("/ws", "0.0.0.0", 9090);
```

Signatures:

```cpp
const cnerium::app::AppConfig &config() const noexcept;
```

```cpp
cnerium::app::AppConfig &config() noexcept;
```

Use `config()` for Cnerium-level settings. Use Vix APIs for Vix-level configuration.

## runtime

Returns the Cnerium runtime object.

```cpp
auto &runtime = cnerium.runtime();
```

Signatures:

```cpp
cnerium::app::AppRuntime &runtime() noexcept;
```

```cpp
const cnerium::app::AppRuntime &runtime() const noexcept;
```

Most application code should not need direct runtime access. It is available for advanced usage and internal integration.

For normal applications, prefer:

```cpp
cnerium.durable_post(...);
cnerium.emit(...);
cnerium.start();
```

## vix_app

Returns the attached Vix application.

```cpp
vix::App &app_ref = cnerium.vix_app();
```

Signatures:

```cpp
vix::App &vix_app() noexcept;
```

```cpp
const vix::App &vix_app() const noexcept;
```

Most code already has the original `vix::App` variable and should use it directly.

`vix_app()` is useful for integration code that receives an `AttachedApp` and needs access to the underlying Vix app.

## Complete example

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

This example uses one normal Vix route and one Cnerium durable route. It also emits an application-level realtime event from the durable handler.

## Route modules

In larger applications, pass `AttachedApp` to route modules that need durable routes.

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

This keeps the architecture clear. Vix remains the application object. Cnerium is passed only where durable behavior is needed.

## Common mistakes

Do not treat `AttachedApp` as the backend application object. It is the attached reliability layer.

Do not destroy the attached object before `app.run()` finishes.

Do not move or destroy the `vix::App` after attaching Cnerium.

Do not call `app.run()` before `cnerium.start()` when durable routes require storage or realtime resources.

Do not use `cnerium.durable_post` for read-only routes that do not need retry safety.

Do not make event delivery the source of truth for a durable operation. Use durable responses and application storage for correctness.

## Summary

`cnerium::AttachedApp` is the object returned by `cnerium::attach`.

It keeps Cnerium attached to an existing `vix::App`, registers durable routes into that app, starts Cnerium runtime resources, and emits application-level realtime events. It does not own or replace the Vix application.

Keep it alive, use it for critical write operations, and let Vix remain the backend owner.
