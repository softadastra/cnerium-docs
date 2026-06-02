# Design Boundaries

This page defines the design boundaries of Cnerium.

Cnerium exists to add reliability behavior to selected Vix backend operations. It should not become a second Vix, a general web framework, a frontend framework, a deployment platform, a database ORM, or a replacement for the Softadastra SDK.

The public model is simple:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

That model is the boundary.

Vix owns the backend application. Cnerium attaches to it. Softadastra SDK provides the durable storage foundation behind Cnerium.

If a design change makes that relationship less clear, it should be questioned.

## Core boundary

Cnerium has one central responsibility:

```txt
Make selected Vix backend write operations durable, idempotent, replay-safe, and easier to reason about under retries.
```

That means Cnerium should focus on:

```txt
durable routes
idempotency keys
request body hashing
replay protection
stored responses
retry-safe handler execution
application-level realtime events tied to durable operations
Softadastra SDK-backed reliability storage
```

It should not grow into a framework that owns every part of the backend.

A developer should understand Cnerium as:

```txt
I build my backend with Vix.
I attach Cnerium to protect critical write operations.
```

not:

```txt
I leave Vix and build my backend in a different framework.
```

## Vix boundary

Vix owns the backend runtime and application model.

Cnerium should not duplicate Vix responsibilities.

Vix owns:

```txt
HTTP server
routing
middleware
request parsing
response writing
normal request and response APIs
application lifecycle
runtime executor
WebSocket transport
sessions
build workflow
development workflow
production workflow
CLI experience
project structure
```

Cnerium can use Vix public APIs, but it should not reimplement these systems.

For example, this is correct:

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

This keeps Vix visible as the backend owner.

## Cnerium boundary

Cnerium owns the reliability layer around selected routes.

Cnerium owns:

```txt
attach model
durable route registration
DurableRequest
DurableResponse
DurableRoute
Idempotency
IdempotencyKey
RequestHash
ReplayProtection
StoredResponse
Store facade
Cnerium storage keys
application-level realtime event model
Vix HTTP adapter
Vix WebSocket adapter
Softadastra SDK store adapter
```

These are Cnerium concepts because they directly support retry-safe backend operations.

The question for every new feature should be:

```txt
Does this make selected Vix write operations more reliable under retries?
```

If the answer is no, the feature probably belongs somewhere else.

## Softadastra SDK boundary

Softadastra SDK provides the durable foundation behind Cnerium.

Cnerium should depend on the public SDK, not on private Softadastra engine internals.

Correct dependency:

```txt
Cnerium
  -> Softadastra SDK
```

Avoid:

```txt
Cnerium
  -> internal Softadastra engine headers
```

The SDK boundary matters because a Cnerium user should not need to study the internal engine before using durable backend routes.

The user-facing story should remain:

```txt
Install Vix.
Install Softadastra SDK.
Use Cnerium with a Vix backend.
```

Cnerium should expose backend reliability concepts. It should not expose internal Softadastra engine concepts as part of its normal API.

## Application boundary

Cnerium is not the application’s domain model.

It does not own:

```txt
orders
payments
users
invoices
products
inventory
subscriptions
shops
business workflows
domain rules
```

The application owns those.

Cnerium only owns the retry-safety metadata around selected operations.

For example, in an order route:

```txt
application database
  stores the order

Cnerium store
  stores the request hash and stored HTTP response

Softadastra SDK
  provides durable storage primitives behind Cnerium
```

A stored response is not an order database. It is the replayable HTTP result of one durable operation attempt.

## Route boundary

Not every route should be durable.

Normal Vix routes should stay normal:

```cpp
app.get("/health", health_handler);
app.get("/products", list_products);
app.get("/orders/{id}", get_order);
```

Critical write routes can use Cnerium:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);

cnerium.durable_post(
    "/payments",
    "payments.create",
    create_payment);
```

Good candidates for durable routes:

```txt
POST /orders
POST /payments
POST /invoices
POST /users/register
POST /subscriptions
POST /workflows/start
```

Poor candidates:

```txt
GET /health
GET /status
GET /products
GET /orders/{id}
static files
read-only endpoints
```

Cnerium is valuable because it is selective. It protects the dangerous write operations without changing the rest of the backend.

## HTTP boundary

Cnerium should not implement its own HTTP server.

Vix already receives requests, matches routes, and writes responses.

The Cnerium HTTP integration should remain:

```txt
Vix HTTP server
  -> Vix router
      -> Cnerium route callback for durable routes
          -> VixHttp adapter
              -> DurableRoute
                  -> DurableResponse
          -> Vix response writer
```

The `VixHttp` adapter should remain thin.

It should do only what is necessary:

```txt
receive a Vix request
execute a DurableRoute
write a DurableResponse through Vix
preserve status code
preserve body
preserve content type
```

It should not grow into a second HTTP framework.

## WebSocket boundary

Cnerium realtime events are application-level events.

Vix owns the WebSocket transport.

Cnerium should expose:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

Vix should own:

```txt
WebSocket server
sessions
rooms
frame parsing
connection lifecycle
heartbeat
transport-level behavior
```

The boundary is:

```txt
Cnerium says what happened.
Vix delivers it.
```

Cnerium realtime should not become a second WebSocket stack.

## Storage boundary

Cnerium storage is reliability metadata, not application data.

Cnerium stores:

```txt
request hashes
stored responses
operation metadata
idempotency metadata
```

The application stores:

```txt
orders
payments
users
products
business records
audit logs
domain events
```

This distinction must stay clear in documentation and code.

Cnerium storage should answer:

```txt
Should this request execute?
Should this request replay?
Should this request conflict?
What response should be replayed?
```

It should not answer:

```txt
What orders does this user have?
What is the current stock level?
What is the payment ledger?
What users exist in the system?
```

Those are application database questions.

## Idempotency boundary

Cnerium owns idempotency at the route execution level.

It uses:

```txt
operation name
Idempotency-Key
request body hash
stored response
```

to decide:

```txt
Execute
Replay
Conflict
Invalid
```

Cnerium does not replace every domain-level consistency mechanism.

A production system still needs:

```txt
database transactions
unique constraints
authorization
validation
provider-level idempotency
audit logs
status transitions
domain conflict checks
```

Cnerium protects the HTTP retry path. It does not replace the full correctness model of the application.

## Response boundary

A durable handler returns `cnerium::DurableResponse`.

It should not write directly to `vix::Response`.

Correct:

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

Avoid:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request, vix::Response &res)
    {
      res.json({
          {"ok", true}
      });
    });
```

A durable response must be storable. That is why Cnerium uses a response object.

The durable response is used for:

```txt
the current response
the stored response used for safe retries
```

## Handler boundary

The durable handler is the boundary for protected side effects.

Side effects inside the handler are protected by Cnerium’s replay decision.

Examples:

```txt
create order
reserve inventory
create payment intent
send notification
emit realtime event
write audit entry
start workflow
```

For a safe retry, the handler does not run again, so these side effects are not repeated.

Side effects outside the durable route lifecycle are not protected by Cnerium.

Keep critical work inside the durable handler or in services called by that handler.

## Realtime boundary

Realtime events should be notifications, not the source of truth.

Correct model:

```txt
durable response
  result returned to the caller

application database
  source of truth for domain state

realtime event
  notification to connected clients
```

Do not design the backend so that the only record of an operation is a realtime event.

If a client misses the event, it should still be able to fetch state through a normal Vix route.

Realtime events are also not a durable job queue. Use a dedicated job or workflow system for guaranteed asynchronous processing.

## Configuration boundary

Vix configuration and Cnerium configuration should remain separate.

Vix configuration owns Vix behavior.

Cnerium `AppConfig` owns Cnerium behavior:

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

Cnerium config should not become a replacement for Vix config.

Use Cnerium config for:

```txt
service name
data directory
node id
Cnerium realtime attachment settings
Cnerium store settings
```

Use Vix config for Vix runtime and backend behavior.

## Build boundary

Cnerium should build as an ecosystem library.

It should link against public Vix and Softadastra SDK targets.

It should not require patching Vix internals.

It should not require copying Softadastra engine files into Cnerium.

The build dependency should be understandable:

```txt
cnerium
  -> Vix
  -> Softadastra SDK
```

If a user sees missing headers like:

```txt
cannot open source file "softadastra/sdk/Client.hpp"
```

the solution should be dependency configuration, SDK installation, or editor compile commands.

It should not require moving engine headers into Cnerium or adding internal paths manually.

## Documentation boundary

Cnerium documentation should not duplicate the full Vix documentation.

Cnerium docs should explain:

```txt
what Cnerium is
why it exists
how it attaches to Vix
how durable routes work
how idempotency works
how replay protection works
how stored responses work
how realtime events relate to durable handlers
how Cnerium uses the Softadastra SDK
```

Vix docs should explain:

```txt
Vix application model
normal routes
middleware
HTTP server
WebSocket transport
build workflow
CLI workflow
database and ORM APIs
project structure
deployment
```

Cnerium docs should link back to Vix concepts where needed instead of copying the whole Vix documentation into Cnerium.

## Public API boundary

The preferred public API should be small and obvious:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

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

The public API should make ownership visible:

```txt
vix::App
  backend owner

cnerium::attach(app)
  reliability attachment

cnerium.durable_post
  selected durable write operation
```

Avoid APIs that suggest Cnerium owns the whole application.

## Compatibility boundary

If older code uses a Cnerium-owned app shape, it should be treated as transitional.

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

The preferred shape is clearer because it keeps Vix as the visible application owner.

Compatibility can exist, but documentation should teach the attached model.

## What belongs in Cnerium

These features belong in Cnerium:

```txt
durable_post
DurableRequest
DurableResponse
IdempotencyKey
RequestHash
ReplayProtection
StoredResponse
Store facade
Softadastra-backed store adapter
realtime event emission from durable operations
Vix HTTP adapter
Vix WebSocket adapter
clear diagnostics for durable route failures
tests for replay behavior
```

These are aligned with Cnerium’s purpose.

## What does not belong in Cnerium

These features should not be added to Cnerium:

```txt
a second HTTP server
a second router
a complete middleware framework
a full ORM
a template engine
a frontend framework
a package manager
a CLI replacing Vix CLI
a deployment platform
a general job queue
a complete authentication framework
a general WebSocket framework
a business domain framework
```

Some of these features may exist elsewhere in the ecosystem. They should not be placed inside Cnerium unless they directly support durable route correctness.

## When a feature is questionable

When a new feature is proposed, ask:

```txt
Does this feature make selected Vix write operations safer under retries?
Does it require Cnerium to own something Vix already owns?
Does it expose Softadastra internals instead of the SDK?
Does it make application developers learn a second backend model?
Can this feature live better in Vix, Softadastra SDK, or application code?
```

If the feature makes Cnerium broader but not more reliable, it probably does not belong.

## Examples of good extensions

Good extensions stay close to Cnerium’s purpose.

Examples:

```txt
durable PUT or PATCH routes with clear semantics
better malformed JSON handling for durable routes
stored response commit safety improvements
idempotency conflict diagnostics
test helpers for durable route replay
store health checks
adapter improvements for Vix response writing
observability around replay, conflict, invalid, and execute decisions
```

These improve the reliability layer without turning Cnerium into a separate framework.

## Examples of bad extensions

Bad extensions blur the boundary.

Examples:

```txt
adding a complete Cnerium router
adding Cnerium middleware that duplicates Vix middleware
adding a Cnerium HTTP server
adding a Cnerium ORM
adding a frontend rendering system
adding a deployment CLI
adding a general WebSocket server independent of Vix
forcing users to configure Softadastra engine internals
```

These make Cnerium harder to understand and less clearly positioned.

## Contributor rules

Contributors should follow these rules:

```txt
Keep Vix visible as the backend owner.
Keep Cnerium focused on durable write operations.
Keep adapters thin.
Use public Vix APIs.
Use the public Softadastra SDK.
Do not expose private engine concepts.
Do not duplicate framework layers already owned by Vix.
Keep public examples small and direct.
Prefer cnerium::attach(app) over cnerium::App.
Treat operation names as stable identifiers.
Treat storage as reliability metadata, not application data.
```

These rules keep the project coherent.

## Why boundaries matter

Boundaries are not only internal engineering rules. They define the product.

If Cnerium tries to be a full framework, it competes with Vix and confuses the ecosystem.

If Cnerium stays focused, its value is obvious:

```txt
Vix gives you the backend runtime.
Softadastra gives you the durable foundation.
Cnerium gives your critical backend routes retry safety.
```

That is a strong and simple story.

## Summary

Cnerium is a reliability-first backend layer attached to Vix.

Its boundaries are clear: Vix owns the backend application, Cnerium owns durable route behavior, and Softadastra SDK provides the durable storage foundation. Cnerium should protect selected critical write operations with idempotency, replay protection, stored responses, and retry-safe handler execution.

Anything outside that mission should stay in Vix, Softadastra SDK, or application code.
