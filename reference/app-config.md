# AppConfig

`cnerium::app::AppConfig` configures the Cnerium layer attached to a Vix backend.

It does not configure the Vix application itself. Vix remains responsible for the HTTP application, routing, middleware, runtime lifecycle, WebSocket transport, and backend workflow. `AppConfig` only describes the Cnerium-specific runtime settings used by durable routes, storage, node identity, and optional realtime event support.

A typical configuration looks like this:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
config.enable_realtime("/ws", "0.0.0.0", 9090);

auto cnerium = cnerium::attach(app, std::move(config));
```

The important point is that the configuration is passed to the attached Cnerium layer. The backend application is still `vix::App`.

## Header

```cpp
#include <cnerium/cnerium.hpp>
```

or directly:

```cpp
#include <cnerium/app/AppConfig.hpp>
```

Most applications should include the umbrella header:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Namespace

```cpp
namespace cnerium::app
```

The type is:

```cpp
cnerium::app::AppConfig
```

## Purpose

`AppConfig` exists to configure the Cnerium reliability layer.

It controls values such as:

```txt
service name
data directory
node id
Vix configuration path
realtime endpoint
realtime host
realtime port
```

These values are used by Cnerium runtime resources, not by the general Vix backend model.

Use Vix configuration for Vix-level behavior. Use Cnerium configuration for Cnerium-level behavior.

## Basic usage

The simplest configuration uses the development defaults:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();
```

Then attach Cnerium to the Vix application:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app, std::move(config));
```

For very small examples, you can also use the default attachment:

```cpp
auto cnerium = cnerium::attach(app);
```

That creates the attached Cnerium layer with default development-style configuration.

## development

Creates a development configuration.

```cpp
static AppConfig development();
```

Example:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();
```

Use this for local development, examples, tests, and early application setup.

After creating the development config, override the values that matter for your service:

```cpp
config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
```

The development configuration should not be treated as a full production policy. For production, set explicit paths and identities.

## name

The application or service name.

Typical setter:

```cpp
config.set_name("orders-service");
```

Typical getter:

```cpp
const std::string &name = config.name();
```

The name should describe the service that owns the durable operations.

Good names:

```txt
orders-service
payments-service
registration-api
shop-api
invoice-worker-api
```

Avoid vague names:

```txt
app
server
backend
test
main
```

A clear name helps with logs, storage organization, debugging, and future tooling.

## data_dir

The Cnerium data directory.

Typical setter:

```cpp
config.set_data_dir("data/cnerium");
```

Typical getter:

```cpp
const std::string &dir = config.data_dir();
```

Cnerium uses the data directory through its store layer to persist reliability metadata for durable routes.

That metadata includes request hashes, stored responses, and Cnerium runtime data.

For local development, a relative path is acceptable:

```cpp
config.set_data_dir("data/cnerium");
```

For production, use an explicit persistent path:

```cpp
config.set_data_dir("/var/lib/orders-service/cnerium");
```

The process must be able to create and write to this directory.

## node_id

The local Cnerium node identity.

Typical setter:

```cpp
config.set_node_id("orders-node");
```

Typical getter:

```cpp
const std::string &node = config.node_id();
```

The node id identifies the local runtime instance.

For local development:

```txt
orders-node
dev-node
durable-orders-realtime-node
```

For production:

```txt
orders-api-prod-1
payments-api-prod-a
shop-api-kampala-1
```

Use a stable value when possible. A stable node id makes logs and storage behavior easier to understand.

## vix_config_path

The Vix configuration path known to Cnerium.

Typical setter:

```cpp
config.set_vix_config_path("vix.json");
```

Typical getter:

```cpp
const std::string &path = config.vix_config_path();
```

This value is useful when Cnerium runtime resources need to align with the Vix project configuration.

It does not make Cnerium the owner of Vix configuration. Vix remains responsible for reading and applying its own application configuration.

## enable_realtime

Enables realtime event support for the attached Cnerium layer.

Typical usage:

```cpp
config.enable_realtime("/ws", "0.0.0.0", 9090);
```

The arguments are:

```txt
endpoint
  public WebSocket endpoint

host
  WebSocket bind host

port
  WebSocket bind port
```

Example:

```cpp
config.enable_realtime(
    "/ws",
    "0.0.0.0",
    9090);
```

After realtime is enabled, the attached Cnerium object can emit events:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

The event API belongs to Cnerium. The transport belongs to Vix WebSocket.

## realtime_config

`AppConfig` owns a realtime configuration object.

Typical access pattern:

```cpp
const auto &realtime = config.realtime();
```

Depending on the current API, mutable access may also be available:

```cpp
auto &realtime = config.realtime();
```

The realtime configuration stores whether realtime is enabled and how the WebSocket layer should be attached.

The common public flow is to use:

```cpp
config.enable_realtime("/ws", "0.0.0.0", 9090);
```

rather than manually editing the realtime configuration directly.

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

  config.set_name("orders-service");
  config.set_data_dir("data/cnerium");
  config.set_node_id("orders-node");
  config.set_vix_config_path("vix.json");
  config.enable_realtime("/ws", "0.0.0.0", 9090);

  auto cnerium = cnerium::attach(app, std::move(config));

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

This example configures Cnerium storage, node identity, Vix config path, and realtime support. The backend is still started by Vix.

## Production configuration

For production, avoid vague or temporary settings.

Prefer:

```cpp
config.set_name("orders-service");
config.set_data_dir("/var/lib/orders-service/cnerium");
config.set_node_id("orders-api-prod-1");
config.set_vix_config_path("/etc/orders-service/vix.json");
```

Avoid:

```cpp
config.set_name("app");
config.set_data_dir("/tmp/cnerium");
config.set_node_id("random-node-every-boot");
```

A durable route depends on storage. If the data directory is temporary or deleted during deployment, Cnerium may lose stored responses needed for safe replay.

## Development configuration

For local development:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-dev");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-dev-node");
```

This keeps project data local and easy to delete when resetting examples.

To clear local durable state during development:

```bash
rm -rf data/cnerium
```

Only do this in development. Deleting Cnerium storage removes the stored responses and request hashes used for durable replay.

## Realtime configuration example

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
config.enable_realtime("/ws", "0.0.0.0", 9090);

auto cnerium = cnerium::attach(app, std::move(config));
```

Then emit from a durable handler:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

If the same durable request is safely retried, the handler is not executed again, so this event is not emitted again by the handler.

## Relationship with Vix configuration

`AppConfig` is not a replacement for Vix configuration.

Use Vix for:

```txt
HTTP server behavior
normal routing
middleware
runtime behavior
Vix project configuration
Vix build and run workflow
WebSocket transport behavior
```

Use Cnerium `AppConfig` for:

```txt
Cnerium service name
Cnerium data directory
Cnerium node id
Cnerium realtime attachment settings
Cnerium store-related runtime settings
```

The separation should stay visible in application code.

## Validation and startup

Cnerium resources are normally started with:

```cpp
if (!cnerium.start())
{
  return 1;
}
```

If the configuration is invalid, storage cannot be opened, or realtime resources cannot start, `start()` should fail.

A common startup order is:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app, std::move(config));

register_routes(app, cnerium);

if (!cnerium.start())
{
  return 1;
}

app.run();
```

This keeps Cnerium startup explicit before the Vix HTTP server starts serving durable routes.

## Common mistakes

Do not use `AppConfig` to replace Vix configuration.

Do not put production durable storage in `/tmp`.

Do not use a new random node id on every boot unless your deployment model explicitly requires it.

Do not enable realtime and then forget to call `cnerium.start()`.

Do not assume the data directory is only a cache. It stores reliability metadata used by durable route replay.

Do not delete the data directory in production unless you understand the consequences.

## Summary

`cnerium::app::AppConfig` configures the attached Cnerium reliability layer.

Use it to set the service name, durable data directory, node id, Vix config path, and optional realtime settings. It does not own the Vix application and does not replace Vix configuration.

A good production configuration uses stable names, stable node identity, and persistent writable storage.
