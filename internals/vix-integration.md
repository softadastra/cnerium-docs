# Vix Integration

This page explains how Cnerium integrates with Vix internally.

Cnerium is built for the Vix ecosystem. It does not replace `vix::App`, does not create a second HTTP runtime, and does not define a competing backend model. Its job is to attach to a Vix application and add durable execution semantics to selected write operations.

The public integration starts here:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

That line defines the relationship.

Vix owns the backend. Cnerium attaches to it.

## Integration goal

The goal of the Vix integration is to make durable behavior available inside a normal Vix backend without forcing developers to leave the Vix programming model.

A Vix developer should not feel that Cnerium is a separate framework with a different universe, different server, different router, and different lifecycle.

The intended experience is:

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

The normal routes remain normal Vix routes. The critical write route is registered through Cnerium because it needs retry safety.

## What Vix owns

Vix remains the owner of the backend application layer.

Cnerium relies on Vix for:

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

Cnerium should not duplicate these systems.

If a feature belongs to the backend application model, it belongs to Vix. If a feature belongs to durable retry behavior for selected routes, it belongs to Cnerium.

This boundary is the core of the integration.

## What Cnerium adds

Cnerium adds reliability behavior around selected Vix routes.

It owns:

```txt
attach model
durable route registration helpers
durable request wrapper
durable response type
idempotency checks
request body hashing
replay protection
stored response replay
application-level realtime event emission
Cnerium storage integration
```

Cnerium does not decide how the whole backend is structured. Vix already does that.

Cnerium only answers a narrower question:

```txt
Should this critical write operation execute now, replay a stored response, or be rejected?
```

## Attach model

Cnerium integrates through attachment.

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

The attached Cnerium object keeps a reference to the Vix app. It uses that reference to register durable routes into the existing Vix router.

The Vix app is not moved into Cnerium. It is not owned by Cnerium. It remains the application object controlled by the user.

This is important because the developer should still think:

```txt
I am building a Vix backend.
I am attaching Cnerium where reliability matters.
```

not:

```txt
I am switching from Vix to another backend framework.
```

## Route registration

A normal Vix route is registered directly on `vix::App`:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true}
  });
});
```

A durable Cnerium route is registered through the attached Cnerium layer:

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

Internally, Cnerium still registers a route into the Vix application. The difference is that the Vix callback points to a Cnerium adapter and durable route executor.

Conceptually:

```txt
cnerium.durable_post(...)
  creates DurableRoute
  stores DurableRoute in AttachedApp
  registers POST route on vix::App
  Vix calls Cnerium adapter when the route matches
```

The route is hosted by Vix. The durable decision belongs to Cnerium.

## HTTP request flow

A normal Vix route follows this flow:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Vix handler
  -> Vix response writer
```

A Cnerium durable route follows this flow:

```txt
client
  -> Vix HTTP server
  -> Vix router
  -> Cnerium Vix HTTP adapter
  -> DurableRoute
  -> DurableRequest
  -> Idempotency check
  -> ReplayProtection
  -> Store
  -> DurableHandler, only for a new safe request
  -> DurableResponse
  -> Vix response writer
```

The server does not change. The router does not change. The response is still written through Vix.

Cnerium inserts a reliability decision before the user handler runs.

## VixHttp adapter

The `VixHttp` adapter is the bridge between Vix HTTP and Cnerium durable routes.

Its responsibility is narrow:

```txt
receive a Vix request
execute the matching Cnerium DurableRoute
convert the DurableResponse into a Vix response
preserve status code, body, and content type
```

It should not implement:

```txt
an HTTP server
a router
middleware
request parsing
session handling
response ownership
```

Vix already owns those systems.

A thin adapter keeps the integration understandable and prevents duplicated framework behavior.

## DurableRequest and Vix request

`cnerium::DurableRequest` wraps the underlying Vix HTTP request.

It exposes request data needed by durable handlers:

```txt
method
target
path
body
headers
query parameters
route parameters
JSON body
Idempotency-Key
request body hash
native Vix request
```

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
          {"idempotency_key", key}
      });
    });
```

`DurableRequest` does not mean Cnerium owns HTTP. It means a durable handler needs a request view adapted to the durable execution model.

For normal Vix routes, use Vix request types.

For durable Cnerium routes, use `DurableRequest`.

## DurableResponse and Vix response

A durable handler returns `cnerium::DurableResponse`.

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id}
});
```

Cnerium needs a response object because the result must be storable.

A normal Vix response is written once. A durable response may need to be returned again later when the client safely retries the same request.

The integration flow is:

```txt
DurableHandler returns DurableResponse
Cnerium stores replayable response metadata
VixHttp writes the response through Vix
```

For safe retries:

```txt
Cnerium loads StoredResponse
VixHttp writes the stored response through Vix
handler is not executed again
```

This is why durable handlers do not write directly to `vix::Response`.

## Response writing

Vix remains responsible for writing the final HTTP response.

Cnerium produces either:

```txt
fresh DurableResponse from the handler
stored response from replay
bad request response for invalid key
conflict response for unsafe key reuse
```

The Vix adapter converts that result into the Vix response wrapper.

The adapter must preserve:

```txt
HTTP status code
response body
Content-Type
```

This matters because stored response replay should behave like the original response.

## Lifecycle integration

The lifecycle is intentionally explicit:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

`cnerium.start()` starts resources owned by Cnerium:

```txt
store
Softadastra SDK-backed storage adapter
optional realtime adapter
Cnerium runtime state
```

`app.run()` starts the Vix HTTP application.

Cnerium should not call `app.run()` internally because that would blur ownership. The application should remain visibly controlled by Vix.

## Shutdown integration

Cnerium should stop only what it owns.

It may stop:

```txt
Cnerium runtime state
store resources
realtime adapter
Softadastra SDK-backed adapter resources
```

It should not destroy the Vix app.

The Vix application lifecycle belongs to the caller and to Vix.

A simple application should rely on ordinary C++ lifetime:

```cpp
int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  if (!cnerium.start())
  {
    return 1;
  }

  app.run();

  return 0;
}
```

When `main` exits, objects are destroyed in reverse order.

## Runtime executor

Vix owns the runtime executor used by its server and WebSocket infrastructure.

Cnerium may need access to Vix runtime facilities for adapters such as realtime event delivery. That access should remain integration-level, not ownership-level.

The rule is:

```txt
Cnerium may use Vix runtime resources through public Vix APIs.
Cnerium should not become the owner of the Vix runtime.
```

This keeps Cnerium stable as a layer on top of Vix rather than a forked runtime model.

## WebSocket integration

Vix owns the WebSocket transport.

Cnerium exposes application-level realtime events:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

The internal bridge is the `VixWebSocket` adapter.

Its responsibility is to:

```txt
start configured Vix WebSocket support
convert Cnerium events to Vix JSON payloads
broadcast events
broadcast events to rooms
stop realtime support when needed
```

It should not implement a second WebSocket stack.

The relationship is:

```txt
Cnerium says what happened.
Vix delivers it.
```

## Realtime event flow

When a durable handler emits an event, the flow is:

```txt
DurableHandler
  -> cnerium.emit
  -> Cnerium realtime layer
  -> VixWebSocket adapter
  -> Vix WebSocket runtime
  -> connected clients
```

If a request is replayed from storage, the handler does not run. Therefore, events emitted inside the handler are not emitted again.

This gives durable operations a clean event behavior:

```txt
new request
  handler runs
  event may be emitted
  response is stored

safe retry
  stored response is returned
  handler does not run
  event is not emitted again by the handler
```

## Vix JSON integration

Cnerium uses Vix JSON types through its support layer.

```cpp
using Json = vix::json::Json;
```

This avoids creating a separate JSON model inside Cnerium.

The benefit is practical:

```txt
Vix HTTP responses use Vix-compatible JSON.
Cnerium durable responses use the same JSON foundation.
Cnerium realtime event payloads can be converted to Vix WebSocket payloads.
```

Cnerium should reuse Vix primitives where they are already the ecosystem standard.

## Build integration

Cnerium should build as a normal C++ library that links against Vix and the Softadastra SDK.

The dependency direction should be clear:

```txt
Cnerium
  -> Vix public targets
  -> Softadastra SDK public targets
```

Cnerium should not require developers to manually patch Vix internals.

A consumer should be able to use Cnerium in a Vix project with the normal Vix build workflow.

For example:

```bash
vix build
vix run
```

or inside the Cnerium repository:

```bash
vix build --build-target all -v -- -DCNERIUM_BUILD_EXAMPLES=ON
```

The build integration should support the public mental model: Cnerium is an ecosystem library attached to Vix, not a separate platform.

## Include integration

The intended public include pattern is:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

`vix.hpp` gives the backend application API.

`cnerium/cnerium.hpp` gives the reliability API.

Cnerium headers may include specific Vix headers internally where needed:

```cpp
#include <vix/http/Request.hpp>
#include <vix/http/ResponseWrapper.hpp>
#include <vix/websocket/server.hpp>
#include <vix/json/json.hpp>
```

Those includes should reflect real adapter needs.

Cnerium should not expose unnecessary Vix internals in its public surface.

## Dependency boundaries

Cnerium should depend only on public Vix APIs.

Avoid depending on:

```txt
private Vix implementation details
unstable internal headers
manual modifications to Vix source code
duplicated Vix runtime logic
```

The integration should remain stable across Vix releases because Cnerium is part of the ecosystem, not a patch against private internals.

If Cnerium needs a capability from Vix, the better direction is usually to expose a clean public Vix API rather than reaching into internals.

## Error handling integration

Cnerium should return durable HTTP responses that Vix can write cleanly.

For example:

```txt
missing Idempotency-Key
  -> 400 Bad Request

same key with different body
  -> 409 Conflict

valid new request
  -> handler response

safe retry
  -> stored response
```

Vix should remain responsible for the actual response writing. Cnerium should produce clear response data for the adapter.

Error messages should be useful, stable, and direct.

## Normal routes and durable routes together

A real Vix backend can mix normal and durable routes:

```cpp
app.get("/health", health_handler);
app.get("/orders/{id}", get_order);
app.get("/products", list_products);

cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);

cnerium.durable_post(
    "/payments",
    "payments.create",
    create_payment);
```

This is the intended integration style.

Most routes remain Vix routes. Only critical write operations become Cnerium durable routes.

## Why not cnerium::App

A Cnerium-owned application object is easy to misunderstand.

This shape:

```cpp
cnerium::App app;
```

suggests that Cnerium is a separate backend framework. It makes a Vix developer ask why they should use Cnerium instead of Vix.

The better public model is:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

This shows that Cnerium is not competing with Vix.

It attaches to Vix and strengthens selected operations.

## Migration from older shape

If older examples use a Cnerium application wrapper, they should be moved toward the attach model.

Old shape:

```cpp
cnerium::App app;

app.durable_post(...);

return app.run();
```

Preferred shape:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);

cnerium.durable_post(...);

if (!cnerium.start())
{
  return 1;
}

app.run();

return 0;
```

This migration improves the mental model.

It makes Vix ownership explicit and keeps Cnerium focused on reliability.

## Testing integration

A Vix integration test should prove that Cnerium routes are registered into the Vix app and that durable behavior works through real HTTP requests.

Minimum test cases:

```txt
normal Vix route responds normally
durable route accepts a new request with Idempotency-Key
safe retry returns the stored response
same key with different body returns 409 Conflict
missing Idempotency-Key returns 400 Bad Request
handler is not executed twice for safe retries
```

These tests prove that the adapter, route registration, storage, and response writing are working together.

## Integration mistakes to avoid

Do not create a second HTTP server inside Cnerium.

Do not duplicate the Vix router.

Do not hide `vix::App` behind a Cnerium-owned application model.

Do not write directly to Vix responses from durable handlers.

Do not make Cnerium WebSocket behavior independent from Vix WebSocket.

Do not depend on private Vix internals.

Do not make all routes durable by default.

Do not let the attached Cnerium object die while the Vix app is still running.

## Contributor rules

When changing the Vix integration, keep these rules:

```txt
Vix owns the backend application.
Cnerium owns durable route behavior.
Adapters must remain thin.
Public APIs should make ownership obvious.
Normal Vix routes must stay normal.
Durable routes must remain selective.
Cnerium should use public Vix APIs.
```

If a change makes Cnerium feel like a separate backend framework, it is probably moving in the wrong direction.

## Summary

Cnerium integrates with Vix through attachment.

The Vix app remains the backend owner. Cnerium registers durable routes into that app, wraps matching Vix requests as durable requests, applies idempotency and replay protection, returns durable responses through the Vix response writer, and emits application-level events through the Vix WebSocket runtime.

The integration is successful when a Vix developer can keep building a normal Vix backend and add Cnerium only where critical write operations need stronger retry guarantees.
