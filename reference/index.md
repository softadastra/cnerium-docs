# Reference

This reference documents the public Cnerium API.

Cnerium is intentionally small. It is not the place where the full Vix backend API is documented. Vix owns the application runtime, HTTP server, router, middleware, request and response model, WebSocket transport, project workflow, and production lifecycle.

Cnerium documents the pieces it adds on top of a Vix backend:

```txt
attach model
durable routes
idempotency
replay protection
stored responses
realtime event emission
Cnerium configuration
```

The public API should be read with this model in mind:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Vix owns the backend. Cnerium attaches to it.

## Main API

The main entry point is `cnerium::attach`.

```cpp
auto cnerium = cnerium::attach(app);
```

This attaches Cnerium to an existing `vix::App` and returns an attached Cnerium layer.

The attached layer is used to register durable routes, configure Cnerium behavior, start Cnerium resources, and emit realtime events.

Read: [attach](/reference/attach)

## AttachedApp

`cnerium::AttachedApp` is the object returned by `cnerium::attach`.

Most application code can use `auto`:

```cpp
auto cnerium = cnerium::attach(app);
```

The attached object owns Cnerium runtime resources. It keeps a reference to the Vix application, registers durable routes into that application, stores durable route objects, and exposes event emission APIs.

The Vix app itself remains owned by the caller.

Read: [AttachedApp](/reference/attached-app)

## AppConfig

`cnerium::app::AppConfig` configures the attached Cnerium layer.

It is used for Cnerium-level settings such as the service name, data directory, node id, Vix config path, and optional realtime support.

Example:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
config.enable_realtime("/ws", "0.0.0.0", 9090);

auto cnerium =
    cnerium::attach(app, std::move(config));
```

This configuration does not replace Vix configuration. It only configures Cnerium’s reliability layer.

Read: [AppConfig](/reference/app-config)

## Durable routes

A durable route is registered through the attached Cnerium layer:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

The route is still hosted by Vix. Cnerium wraps the handler with idempotency, request body hashing, replay protection, and stored response behavior.

The route handler receives `cnerium::DurableRequest` and returns `cnerium::DurableResponse`.

Read:

```txt
DurableRequest
DurableResponse
DurableRoute
```

## DurableRequest

`cnerium::DurableRequest` is the request type passed to durable route handlers.

It wraps the underlying Vix HTTP request and exposes the data needed by durable operations:

```cpp
const auto body = request.json();
const std::string key = request.idempotency_key_value();
const auto hash = request.request_hash();
```

Use it inside `cnerium.durable_post` handlers.

Read: [DurableRequest](/reference/durable-request)

## DurableResponse

`cnerium::DurableResponse` is the response type returned by durable route handlers.

Cnerium needs a durable response because it must be able to store the response and replay it later.

Example:

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id}
});
```

A normal Vix route writes directly to `vix::Response`. A durable Cnerium route returns a durable response.

Read: [DurableResponse](/reference/durable-response)

## DurableRoute

`cnerium::http::DurableRoute` is the execution object behind `cnerium.durable_post`.

Application code usually does not instantiate it directly. It is documented because it explains the internal execution contract of durable routes.

A durable route:

```txt
reads the Idempotency-Key
computes the request body hash
checks replay protection
executes the handler for new requests
returns stored responses for safe retries
rejects unsafe key reuse
stores the final durable response
```

Read: [DurableRoute](/reference/durable-route)

## Idempotency

`cnerium::reliability::Idempotency` coordinates the core durable route decision.

It uses an operation name, an `Idempotency-Key`, and a request body hash to decide whether a request should execute, replay, conflict, or fail as invalid.

Application code usually interacts with idempotency through `cnerium.durable_post`, not by manually creating `Idempotency`.

Read: [Idempotency](/reference/idempotency)

## Store

`cnerium::store::Store` is the storage facade used by Cnerium’s reliability layer.

It stores request hashes, durable responses, and framework metadata through the Softadastra SDK-backed storage layer.

Application code normally does not use the store directly. It configures storage through `AppConfig`, then lets durable routes persist the required metadata.

Read: [Store](/reference/store)

## Realtime

Cnerium can emit application-level realtime events from durable operations.

Example:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

The event API belongs to Cnerium because the event is tied to a durable application operation. The transport belongs to Vix WebSocket.

Read: [Realtime](/reference/realtime)

## Public namespaces

Cnerium uses nested namespaces internally, while exposing common aliases in `namespace cnerium`.

Common public names include:

```cpp
cnerium::AttachedApp
cnerium::DurableRequest
cnerium::DurableResponse
cnerium::DurableHandler
cnerium::Json
cnerium::Event
cnerium::EventPayload
```

More specific implementation types live in namespaces such as:

```cpp
cnerium::app
cnerium::http
cnerium::reliability
cnerium::store
cnerium::realtime
cnerium::support
cnerium::adapters
```

Application code should usually start with the simple public API:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Minimal application

A minimal Cnerium-enabled Vix backend looks like this:

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

This is the expected public model.

Do not replace `vix::App` with a separate Cnerium application object. Cnerium should attach to Vix, not compete with it.

## Reference sections

Use the reference pages when you need exact API behavior:

```txt
attach
  how to attach Cnerium to vix::App

AttachedApp
  methods available on the attached Cnerium layer

AppConfig
  configuration for Cnerium runtime resources

DurableRequest
  request wrapper used by durable handlers

DurableResponse
  storable response type returned by durable handlers

DurableRoute
  internal route execution contract

Idempotency
  durable route idempotency decision model

Store
  storage facade behind durable route metadata

Realtime
  event emission API for durable operations
```

For broader backend topics such as normal routing, middleware, WebSocket server behavior, static files, templates, database, ORM, or Vix project workflow, use the Vix documentation.
