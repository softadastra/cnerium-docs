# Architecture

This page describes the internal architecture of Cnerium.

It is written for contributors and advanced users who want to understand how Cnerium is structured behind the public API. Application developers should usually start with the public model:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

That line is the center of Cnerium’s architecture.

Vix owns the backend application. Cnerium attaches to it. Softadastra provides the durable storage foundation behind the reliability layer.

Cnerium is not a second backend runtime. It is not a replacement for Vix. It is a reliability layer for selected Vix routes.

## High-level model

Cnerium has one main responsibility:

```txt
Make selected Vix backend operations durable, idempotent, and safe under retries.
```

The architecture follows that responsibility.

```txt
Application code
  -> vix::App
      -> normal Vix routes
      -> Cnerium attached layer
          -> durable routes
          -> idempotency
          -> replay protection
          -> stored responses
          -> realtime application events
          -> Cnerium store
              -> Softadastra SDK
```

Each layer has a clear role.

Vix owns the backend application model.

Cnerium owns the durable route execution model.

Softadastra SDK owns the durable storage foundation used by Cnerium.

## Design boundary

The most important boundary is between Vix and Cnerium.

Vix owns:

```txt
HTTP server
routing
middleware
request parsing
response writing
application lifecycle
runtime executor
WebSocket transport
build workflow
development workflow
production workflow
```

Cnerium owns:

```txt
attach model
durable route registration
durable request wrapper
durable response type
idempotency checks
request body hashing
replay protection
stored responses
Cnerium store keys
application-level realtime events
```

Softadastra SDK owns:

```txt
durable local storage foundation
SDK client API
storage primitives used by the Cnerium store
```

This separation prevents Cnerium from becoming another backend universe. A developer who knows Vix should see Cnerium as a focused reliability extension.

## Public architecture

The public architecture should look like this:

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

This is the intended shape.

The application starts with `vix::App`. Normal routes stay in Vix. Critical write routes are registered through Cnerium. Cnerium starts its own resources. Vix runs the HTTP application.

## Main modules

Cnerium is organized around a small set of modules.

```txt
include/cnerium/app
include/cnerium/http
include/cnerium/reliability
include/cnerium/store
include/cnerium/realtime
include/cnerium/adapters
include/cnerium/support
```

The source tree follows the same structure:

```txt
src/app
src/http
src/reliability
src/store
src/realtime
src/adapters
src/support
```

Each module should remain narrow.

Cnerium should not grow into a general web framework. Vix already owns that layer.

## app module

The `app` module contains the attachment and runtime coordination layer.

Important files:

```txt
include/cnerium/app/AppConfig.hpp
include/cnerium/app/AppRuntime.hpp
include/cnerium/app/AttachedApp.hpp
```

Depending on the current repository state, older `App.hpp` APIs may still exist for compatibility or transition. The preferred architecture is the attached model:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

The app module coordinates:

```txt
Cnerium configuration
runtime startup
store ownership
durable route registration
optional realtime startup
access to the attached vix::App
```

It should not own the Vix application.

## AttachedApp

`AttachedApp` is the public object returned by `cnerium::attach`.

It keeps a reference to `vix::App` and owns the Cnerium resources needed by durable routes.

Conceptually:

```txt
AttachedApp
  references vix::App
  owns AppRuntime
  owns durable route registrations
  exposes durable_post
  exposes emit and emit_to
  exposes start and stop
```

The object must stay alive while the Vix application is serving requests.

This is why examples store it in a variable:

```cpp
auto cnerium = cnerium::attach(app);
```

and avoid temporary attachment:

```cpp
cnerium::attach(app).durable_post(...);
```

## AppRuntime

`AppRuntime` owns runtime resources used by Cnerium.

It is responsible for preparing and stopping internal services such as:

```txt
Cnerium store
Softadastra SDK-backed storage access
realtime adapter when enabled
runtime state
```

Application code should rarely need to access `AppRuntime` directly. It exists behind `AttachedApp`.

The public lifecycle should remain:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

`cnerium.start()` starts Cnerium resources. `app.run()` starts the Vix HTTP application.

## AppConfig

`AppConfig` describes Cnerium runtime settings.

It includes values such as:

```txt
service name
data directory
node id
Vix config path
realtime endpoint
realtime host
realtime port
```

Example:

```cpp
cnerium::app::AppConfig config =
    cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
config.enable_realtime("/ws", "0.0.0.0", 9090);

auto cnerium =
    cnerium::attach(app, std::move(config));
```

This configuration belongs to Cnerium. It does not replace Vix configuration.

## http module

The `http` module contains the durable route HTTP-facing model.

Important files:

```txt
include/cnerium/http/DurableRequest.hpp
include/cnerium/http/DurableResponse.hpp
include/cnerium/http/DurableHandler.hpp
include/cnerium/http/DurableRoute.hpp
```

This module does not implement an HTTP server. Vix already does that.

The `http` module defines how a durable route sees a request, returns a response, and executes a reliability-protected handler.

## DurableRequest

`DurableRequest` wraps the Vix HTTP request.

It gives durable handlers access to:

```txt
method
target
path
body
headers
Idempotency-Key
request hash
JSON body
route parameters
query parameters
native Vix request
```

It exists because durable handlers need retry-specific helpers.

Normal Vix routes should use Vix request types. Durable Cnerium routes should use `DurableRequest`.

## DurableResponse

`DurableResponse` is the response returned by a durable handler.

It must be storable because Cnerium may need to replay it later.

A durable response contains:

```txt
HTTP status code
response body
content type
```

The route handler returns it:

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id}
});
```

Cnerium converts it into a Vix response for the current request and into a stored response for future safe retries.

## DurableRoute

`DurableRoute` is the execution object behind `cnerium.durable_post`.

It owns:

```txt
operation name
store reference
user durable handler
```

Its job is to execute this flow:

```txt
receive Vix request
wrap it as DurableRequest
read Idempotency-Key
compute request body hash
check replay protection
execute handler only for new safe requests
store response
replay stored response for safe retries
reject unsafe key reuse
reject missing keys
```

Application code usually does not instantiate `DurableRoute` directly. `AttachedApp::durable_post` creates and stores it.

## reliability module

The `reliability` module contains the durable decision logic.

Important files:

```txt
include/cnerium/reliability/Idempotency.hpp
include/cnerium/reliability/IdempotencyKey.hpp
include/cnerium/reliability/ReplayProtection.hpp
include/cnerium/reliability/RequestHash.hpp
include/cnerium/reliability/DurableResult.hpp
```

This module decides whether a durable request should:

```txt
execute
replay
conflict
fail as invalid
```

It does not know about the Vix server. It works with operation names, keys, hashes, and stored metadata.

## IdempotencyKey

`IdempotencyKey` represents the `Idempotency-Key` header.

It is a small value object around the key string.

A valid key identifies one logical client operation attempt. The same key should be reused only when retrying the same request body.

## RequestHash

`RequestHash` represents a stable hash of the request body.

Cnerium uses this hash to detect unsafe key reuse.

Safe retry:

```txt
same operation
same key
same request body hash
```

Unsafe reuse:

```txt
same operation
same key
different request body hash
```

The hash must be stable. It should not rely on implementation-defined `std::hash` behavior.

## ReplayProtection

`ReplayProtection` checks stored metadata and returns a durable decision.

Its rules are:

```txt
missing or invalid key
  -> Invalid

new key
  -> Execute

same key with same body hash
  -> Replay

same key with different body hash
  -> Conflict
```

This logic is the heart of Cnerium’s reliability model.

## Idempotency

`Idempotency` coordinates request body hashing and replay protection.

It exposes methods such as:

```txt
check
check_hash
commit
commit_hash
hash_body
```

`DurableRoute` normally calls this service internally. Application code should usually use `cnerium.durable_post` instead of calling `Idempotency` directly.

## DurableResult

`DurableResult` carries the result of a replay protection check.

It can represent:

```txt
Execute
Replay
Conflict
Invalid
```

For replay results, it also carries the stored response that should be returned.

`DurableRoute` converts this result into HTTP behavior.

## store module

The `store` module stores Cnerium reliability metadata.

Important files:

```txt
include/cnerium/store/Store.hpp
include/cnerium/store/StoreKey.hpp
include/cnerium/store/StoredResponse.hpp
```

The store is not the application database.

It stores:

```txt
request hashes
stored responses
operation metadata
framework runtime metadata
```

Application domain data remains the responsibility of the application.

## StoredResponse

`StoredResponse` is the persisted form of a durable response.

It contains:

```txt
status code
body
content type
```

When a safe retry arrives, Cnerium loads the stored response and writes it back through the Vix response writer.

## StoreKey

`StoreKey` is used to build consistent internal keys for Cnerium metadata.

Conceptually, Cnerium stores data under keys such as:

```txt
cnerium:hash:<operation>:<key>
cnerium:response:<operation>:<key>
```

Application code should not depend on the exact key format. It is an internal detail.

## Store

`Store` is the facade used by the reliability layer.

It sits between Cnerium’s idempotency logic and the Softadastra SDK-backed storage foundation.

The dependency direction is:

```txt
DurableRoute
  -> Idempotency
      -> ReplayProtection
          -> Store
              -> Softadastra SDK
```

This keeps Softadastra details behind a small Cnerium storage API.

## realtime module

The `realtime` module contains the application-level event model.

Important files:

```txt
include/cnerium/realtime/Event.hpp
include/cnerium/realtime/EventPayload.hpp
include/cnerium/realtime/Realtime.hpp
include/cnerium/realtime/RealtimeConfig.hpp
```

Cnerium realtime does not implement the WebSocket transport.

It defines:

```txt
event type
event payload
realtime configuration
emit behavior
```

Vix handles the WebSocket server and transport.

## Event

`Event` represents an application event.

Example:

```cpp
cnerium::Event event{
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })};
```

Event names should describe completed facts:

```txt
order.created
payment.created
invoice.created
user.registered
workflow.started
```

## EventPayload

`EventPayload` is a JSON payload used by realtime events.

It is backed by Cnerium JSON, which is backed by Vix JSON.

The payload should contain useful identifiers and minimal state needed by connected clients.

## RealtimeConfig

`RealtimeConfig` stores realtime settings:

```txt
enabled
endpoint
host
port
```

It is usually configured through `AppConfig`:

```cpp
config.enable_realtime("/ws", "0.0.0.0", 9090);
```

## adapters module

The `adapters` module connects Cnerium to Vix and Softadastra.

Important files:

```txt
include/cnerium/adapters/VixHttp.hpp
include/cnerium/adapters/VixWebSocket.hpp
include/cnerium/adapters/SoftadastraStore.hpp
```

Adapters must remain thin.

They should translate between Cnerium types and external ecosystem types without duplicating the external system.

## VixHttp adapter

`VixHttp` bridges Cnerium durable responses and Vix HTTP responses.

It is responsible for:

```txt
executing a DurableRoute from a Vix request
writing DurableResponse into Vix response wrapper
preserving status code
preserving body
preserving content type
```

It does not implement an HTTP server, router, middleware layer, or request parser.

Vix already owns those responsibilities.

## VixWebSocket adapter

`VixWebSocket` bridges Cnerium realtime events to the Vix WebSocket runtime.

It is responsible for:

```txt
starting Vix WebSocket support when configured
stopping realtime support
converting Cnerium event payloads to Vix JSON payloads
emitting events
emitting events to rooms
```

It does not implement a second WebSocket protocol or session system.

## SoftadastraStore adapter

`SoftadastraStore` bridges Cnerium store operations to the Softadastra SDK.

It is responsible for storage integration, not application domain logic.

Cnerium should depend on the public Softadastra SDK, not on internal Softadastra engine APIs.

This matters for the public direction of the project. Cnerium should expose a clean backend reliability API. The Softadastra SDK should remain the durable foundation behind that API.

## support module

The `support` module contains small shared utility types and helpers.

Important files:

```txt
include/cnerium/support/Error.hpp
include/cnerium/support/Json.hpp
include/cnerium/support/Result.hpp
include/cnerium/support/String.hpp
```

This module should stay small.

It should not become a general-purpose framework utility library. If a feature belongs to Vix, it should remain in Vix. If it belongs to Softadastra, it should remain in the Softadastra SDK.

## Json

Cnerium uses the Vix JSON type.

This keeps Cnerium aligned with the Vix backend and WebSocket model.

```cpp
using Json = vix::json::Json;
```

Public helpers such as `support::object`, `support::string_or`, and `support::int_or` make examples easier to read.

## Result

Cnerium can reuse the Softadastra core result type where appropriate.

The purpose is to avoid duplicating common primitives already provided by the ecosystem.

Cnerium should reuse stable ecosystem foundations instead of creating parallel versions.

## Request lifecycle

A durable request follows this internal path:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Vix route callback registered by Cnerium
  -> VixHttp adapter
  -> DurableRoute
  -> DurableRequest
  -> Idempotency
  -> ReplayProtection
  -> Store
  -> DurableHandler, only if request should execute
  -> DurableResponse
  -> StoredResponse commit
  -> Vix response writer
```

The important point is that Vix remains the HTTP owner from beginning to end. Cnerium only controls the durable operation decision.

## Normal route lifecycle

A normal Vix route remains simple:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Vix handler
  -> Vix response writer
```

Cnerium should not interfere with normal routes.

A backend can mix both:

```cpp
app.get("/health", health_handler);
app.get("/orders/{id}", get_order);

cnerium.durable_post("/orders", "orders.create", create_order);
```

## Durable route lifecycle

A durable route adds a reliability decision before handler execution:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Cnerium DurableRoute
      -> missing key
          -> 400 Bad Request
      -> new key
          -> execute handler
          -> store response
          -> return response
      -> same key and same body
          -> replay stored response
      -> same key and different body
          -> 409 Conflict
  -> Vix response writer
```

The handler only runs in the new request case.

## Realtime lifecycle

When a durable handler emits an event:

```txt
DurableHandler
  -> cnerium.emit
  -> Realtime
  -> VixWebSocket adapter
  -> Vix WebSocket runtime
  -> connected clients
```

If a safe retry is replayed from storage, the handler does not run, so the event is not emitted again by that handler.

This is intentional. Realtime events should follow successful operation execution, not HTTP retry count.

## Startup lifecycle

A typical application startup is:

```txt
create vix::App
create Cnerium AppConfig
attach Cnerium to vix::App
register normal Vix routes
register durable Cnerium routes
start Cnerium resources
run Vix app
```

In code:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);

register_routes(app, cnerium);

if (!cnerium.start())
{
  return 1;
}

app.run();
```

Cnerium starts before the Vix server begins serving durable routes.

## Shutdown lifecycle

Cnerium should stop only the resources it owns.

It should not destroy the Vix application because it does not own it.

A clean shutdown should respect this boundary:

```txt
Vix application stops serving
Cnerium runtime resources stop
Cnerium store flushes or closes
realtime adapter stops
objects are destroyed in normal C++ order
```

In simple applications, object lifetime in `main` handles most of this naturally.

## Dependency direction

Cnerium should keep a strict dependency direction.

```txt
Cnerium public API
  -> Cnerium internals
      -> Vix public API
      -> Softadastra SDK public API
```

Cnerium should not depend on private Vix internals or private Softadastra engine internals.

The public promise is:

```txt
Vix is the runtime and backend foundation.
Cnerium is the reliability layer.
Softadastra SDK is the durable storage foundation.
```

## What should not be added to Cnerium

Cnerium should not become the place for everything.

Avoid adding:

```txt
a second HTTP server
a second router
a second middleware system
a second WebSocket stack
a database ORM
a template engine
a full authentication framework
a frontend framework
a deployment system
a replacement for Vix CLI
```

Those belong elsewhere in the ecosystem.

Cnerium should remain focused on backend reliability:

```txt
durable routes
idempotency
stored responses
replay protection
retry-safe handlers
realtime notifications tied to durable operations
Softadastra-backed reliability storage
```

## Why this architecture matters

The architecture exists to avoid confusion.

If Cnerium exposes a complete separate application model, a Vix developer will reasonably ask why they should leave Vix to build a backend. That is the wrong message.

Cnerium should make the answer obvious:

```txt
You do not leave Vix.
You keep Vix.
You attach Cnerium only where retry safety matters.
```

That is the architectural identity of Cnerium.

## Summary

Cnerium is a reliability layer attached to Vix.

The architecture is built around that boundary. Vix owns the backend application. Cnerium owns durable route behavior. Softadastra SDK provides the durable storage foundation behind Cnerium.

Internally, Cnerium is split into app, http, reliability, store, realtime, adapters, and support modules. Each module has a narrow responsibility. Together, they make selected Vix routes durable, idempotent, replay-safe, and easier to reason about under retries and unstable network conditions.
