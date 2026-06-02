# Softadastra SDK Integration

This page explains how Cnerium integrates with the Softadastra SDK internally.

Cnerium is a reliability layer for Vix backends. It needs durable storage because durable routes must remember request hashes and stored responses across retries. That storage foundation comes from the public Softadastra SDK.

The public application model remains:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Vix owns the backend. Cnerium attaches to Vix. The Softadastra SDK provides the durable storage foundation behind Cnerium.

## Integration goal

The goal of the Softadastra SDK integration is to give Cnerium a stable persistence layer for reliability metadata.

A durable route must be able to answer questions like:

```txt
Has this operation already completed?
Was this Idempotency-Key already used?
Was it used with the same request body?
Is there a stored response that can be replayed?
```

Those questions require storage.

Cnerium should not implement its own unrelated storage universe. It should use the public Softadastra SDK because Softadastra is the durable foundation of the ecosystem.

The dependency direction is:

```txt
Cnerium
  -> Softadastra SDK
```

not:

```txt
Cnerium
  -> Softadastra internal engine
```

That distinction matters.

## Public SDK, not internal engine

Cnerium must integrate with the public Softadastra SDK.

It should not depend on private Softadastra engine internals. The engine may exist behind the SDK, but Cnerium’s public and build-time dependency should be the SDK.

This keeps the system understandable for developers:

```txt
Vix
  backend runtime and application model

Cnerium
  backend reliability layer

Softadastra SDK
  durable foundation used by Cnerium
```

A Cnerium user should not need to understand the internal Softadastra engine to build a backend. They should install the SDK, link Cnerium, attach Cnerium to Vix, and use durable routes.

## Why the SDK is needed

A normal route can return a response and forget everything.

A durable route cannot.

When a durable handler completes, Cnerium stores:

```txt
request body hash
stored response
operation metadata
idempotency metadata
```

That stored data is used later when a client retries the same operation.

For example:

```txt
POST /orders
Idempotency-Key: order-123
body: {"product_id":"p1","quantity":2}
```

The first request executes the handler and stores the response.

If the client retries with the same key and body, Cnerium uses the stored metadata to return the same response without running the handler again.

This behavior depends on durable storage. That is where the Softadastra SDK fits.

## What Cnerium stores through the SDK

Cnerium stores framework-level reliability metadata.

It does not store the application’s domain model.

For an order route, Cnerium may store:

```txt
operation: orders.create
key: order-123
request hash: stable hash of the request body
stored response: HTTP status, body, and content type
```

The application still owns its real domain data:

```txt
orders
users
payments
invoices
inventory
business events
audit logs
```

The boundary is:

```txt
Application database
  source of truth for business state

Cnerium store
  retry-safety metadata for durable routes

Softadastra SDK
  durable storage foundation behind the Cnerium store
```

Do not use Cnerium stored responses as your application database.

## Main integration point

The main integration point is the Cnerium store layer.

Conceptually:

```txt
DurableRoute
  -> Idempotency
      -> ReplayProtection
          -> Store
              -> SoftadastraStore adapter
                  -> Softadastra SDK client
```

The durable route should not know SDK details directly.

The idempotency layer should not know SDK details directly.

The `Store` facade gives Cnerium a narrow internal API for reliability metadata. The `SoftadastraStore` adapter maps that internal API to the public Softadastra SDK.

This keeps the integration clean.

## SoftadastraStore adapter

`SoftadastraStore` is the adapter between Cnerium’s store model and the Softadastra SDK.

Its responsibility is narrow:

```txt
initialize SDK-backed storage access
write Cnerium metadata
read Cnerium metadata
delete or clear metadata when supported
translate SDK errors into Cnerium-level results
keep SDK details away from durable route logic
```

It should not contain application domain logic.

It should not know what an order, payment, user, invoice, or shop is.

It only stores Cnerium reliability data.

## SDK client dependency

Cnerium may include the public SDK client header where the adapter needs it:

```cpp
#include <softadastra/sdk/Client.hpp>
```

This belongs in the adapter boundary, not everywhere in Cnerium.

Good location:

```txt
include/cnerium/adapters/SoftadastraStore.hpp
src/adapters/SoftadastraStore.cpp
```

Avoid spreading SDK-specific includes into unrelated modules such as:

```txt
http
reliability
realtime
support
```

Those modules should depend on Cnerium abstractions, not directly on the SDK.

## Store facade boundary

The Cnerium reliability layer should talk to `cnerium::store::Store`.

Example internal dependency:

```txt
ReplayProtection
  -> Store
```

not:

```txt
ReplayProtection
  -> softadastra::sdk::Client
```

This keeps the reliability logic independent from the storage backend.

If Cnerium later adds a test store, memory store, or another SDK-backed store, the reliability layer should not need to change.

## Configuration flow

The user configures Cnerium through `AppConfig`:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");

auto cnerium = cnerium::attach(app, std::move(config));
```

The data directory is passed to the Cnerium runtime.

The runtime prepares the store.

The store uses the Softadastra SDK-backed adapter.

The application does not need to manually construct the SDK client in ordinary usage.

## Startup flow

The startup flow should remain explicit:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

Internally, `cnerium.start()` prepares Cnerium resources.

That includes:

```txt
validating Cnerium configuration
initializing the store
initializing the Softadastra SDK-backed adapter
starting optional realtime support
marking the Cnerium runtime as running
```

If the SDK is missing, misconfigured, or unable to open storage, Cnerium startup should fail clearly.

A backend should not start serving durable routes if the durable storage layer is unavailable.

## Data directory

The data directory comes from `AppConfig`:

```cpp
config.set_data_dir("data/cnerium");
```

For local development, this is fine.

For production, use a stable writable path:

```cpp
config.set_data_dir("/var/lib/orders-service/cnerium");
```

This path is used by Cnerium’s storage layer through the Softadastra SDK integration.

The path should survive process restarts. If the data directory is deleted, Cnerium may lose stored responses and request hashes needed for replay protection.

## Node identity

Cnerium also passes a node identity through configuration:

```cpp
config.set_node_id("orders-node");
```

The node id identifies the local Cnerium runtime instance.

For development:

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

The SDK integration should use this identity where relevant for local durable storage, logs, sync-related foundations, or future observability.

Use stable node ids when possible.

## Service name

The service name is configured with:

```cpp
config.set_name("orders-service");
```

The name identifies the application using Cnerium.

It can be used for:

```txt
storage namespacing
logs
diagnostics
future tooling
debugging
```

Good names:

```txt
orders-service
payments-service
registration-api
shop-api
```

Avoid vague names like:

```txt
app
server
test
backend
```

## Build integration

Cnerium should link against the public Softadastra SDK package.

The dependency should be discoverable through CMake:

```cmake
find_package(sdk-cpp CONFIG QUIET)
```

Expected public targets may include:

```txt
softadastra::sdk
sdk-cpp::sdk-cpp
sdk-cpp
```

Cnerium should resolve the installed SDK target and link it as a public dependency when Cnerium public headers expose SDK-backed types.

If SDK types are kept only inside `.cpp` files, the dependency can be narrower. But if public Cnerium headers include SDK headers, consumers also need the SDK include directories.

## Include path problems

If the compiler or editor reports:

```txt
cannot open source file "softadastra/sdk/Client.hpp"
```

there are two possible causes.

The SDK may not be installed where CMake can find it.

Or the project may build correctly, but VS Code IntelliSense is not reading the real CMake compile commands.

The correct long-term fix is to make the build expose the SDK include directories through the resolved SDK target, then configure VS Code to use `compile_commands.json`.

For VS Code, prefer:

```json
{
  "configurations": [
    {
      "name": "Linux",
      "compileCommands": "${workspaceFolder}/build-ninja/compile_commands.json",
      "compilerPath": "/usr/bin/clang++",
      "intelliSenseMode": "linux-clang-x64",
      "cppStandard": "c++20"
    }
  ],
  "version": 4
}
```

Avoid manually adding random SDK include paths to `includePath` if CMake already knows the correct dependency graph.

The editor should follow the build, not invent a parallel build model.

## CMake dependency direction

The dependency graph should remain clear:

```txt
cnerium
  links Vix
  links Softadastra SDK
```

Cnerium should not link private Softadastra engine targets.

A clean CMake dependency file should:

```txt
add default prefixes
find Vix
find Softadastra SDK
resolve public Vix target
resolve public SDK target
fail clearly if either dependency is missing
link Cnerium to those targets
```

The error message should tell the user what is missing:

```txt
Softadastra SDK development package was not found.
Expected CMake package: sdk-cppConfig.cmake
Expected target: softadastra::sdk, sdk-cpp::sdk-cpp or sdk-cpp.
```

That is better than failing later with missing headers.

## Public headers and SDK exposure

Be careful with public headers.

If a public Cnerium header includes:

```cpp
#include <softadastra/sdk/Client.hpp>
```

then every Cnerium consumer must have the SDK include path available while compiling.

That may be acceptable for adapter headers, but it should be deliberate.

A better design is often:

```txt
public Cnerium API
  depends on Cnerium types

adapter implementation
  depends on Softadastra SDK types
```

This reduces the number of places where SDK headers affect users.

For example, `Store.hpp` should expose Cnerium storage concepts. `SoftadastraStore.hpp` may expose SDK integration details if needed.

## Error handling

The SDK adapter should translate SDK errors into Cnerium-level errors or boolean results.

Cnerium durable route logic should not expose raw SDK failure details directly to normal route handlers.

The internal flow should be:

```txt
Softadastra SDK failure
  -> SoftadastraStore detects failure
  -> Store reports failure to reliability layer
  -> Cnerium returns or logs a clear Cnerium-level error
```

This keeps the public API stable.

The developer using `cnerium.durable_post` should not need to know the SDK’s internal error model to understand route behavior.

## Storage key ownership

Cnerium owns its internal storage keys.

Conceptually:

```txt
cnerium:hash:<operation>:<key>
cnerium:response:<operation>:<key>
```

These keys are Cnerium’s metadata keys stored through the SDK.

The Softadastra SDK provides storage primitives. It does not define the meaning of Cnerium’s idempotency keys, operation names, or stored response records.

That meaning belongs to Cnerium.

## Stored response format

Cnerium stores replayable HTTP response data.

The stored response contains:

```txt
status code
body
content type
```

A stored response should be serializable to a stable representation, usually JSON text.

Conceptual example:

```json
{
  "status_code": 201,
  "body": "{\"ok\":true,\"order_id\":\"ord_order-123\"}",
  "content_type": "application/json; charset=utf-8"
}
```

The exact internal format may evolve, but it should preserve enough data to replay the original response correctly.

## Request hash format

Cnerium stores a stable request hash.

The hash exists to detect unsafe key reuse.

Safe retry:

```txt
stored hash == incoming body hash
```

Unsafe reuse:

```txt
stored hash != incoming body hash
```

The SDK should store the hash value as Cnerium gives it. The hash algorithm belongs to Cnerium’s reliability layer, not to the SDK adapter.

## SDK integration and replay protection

Replay protection depends on the SDK integration working correctly.

For a new request:

```txt
Cnerium stores request hash
Cnerium stores response
```

For a safe retry:

```txt
Cnerium reads request hash
Cnerium compares body hash
Cnerium reads stored response
Cnerium returns stored response
```

For unsafe reuse:

```txt
Cnerium reads request hash
Cnerium compares body hash
Cnerium returns 409 Conflict
```

All of these require the store to read and write metadata reliably.

## SDK integration and process restarts

The Softadastra SDK integration should allow Cnerium metadata to survive process restarts when configured with persistent storage.

This is important because a client may retry after the server restarts.

A good manual test is:

```txt
start server
send durable request
stop server
start server again
retry same request with same key and body
expect same stored response
```

If the retry executes the handler again, check whether the configured data directory is persistent and whether the SDK-backed store is actually being used.

## SDK integration and tests

Cnerium should have tests that cover the SDK-backed store through durable route behavior.

At minimum:

```txt
new durable request stores response
safe retry loads stored response
unsafe retry reads stored hash and returns 409
missing key never writes a response
stored response survives restart when using persistent storage
```

Unit tests can use a test store.

Integration tests should use the real SDK-backed store.

The public behavior matters more than the internal file layout.

## Local development

During local development, it is acceptable to use:

```cpp
config.set_data_dir("data/cnerium");
```

To reset local state:

```bash
rm -rf data/cnerium
```

Only do this in development.

Deleting the data directory removes stored responses and request hashes. After deletion, an old retry may be treated as a new request because Cnerium no longer has metadata for it.

## Production deployment

For production, use stable persistent storage.

Example:

```cpp
config.set_data_dir("/var/lib/orders-service/cnerium");
```

Prepare permissions:

```bash
sudo mkdir -p /var/lib/orders-service/cnerium
sudo chown -R orders:orders /var/lib/orders-service/cnerium
```

The exact user and group depend on your deployment.

Avoid:

```txt
/tmp/cnerium
build directories
source-controlled directories
directories deleted during deploy
paths shared unsafely by unrelated services
```

Durable route behavior depends on this metadata.

## Relationship with Softadastra vision

The SDK integration is not only a technical dependency.

It expresses the ecosystem architecture:

```txt
Vix
  fast C++ runtime and backend foundation

Softadastra
  durable local-first and offline-first foundation

Cnerium
  reliability-first backend framework layer on top of both
```

Cnerium turns Softadastra’s durable foundation into backend-facing application primitives such as durable routes, idempotency, replay protection, and stored responses.

That is the right relationship.

Cnerium should not expose Softadastra internals. It should expose backend reliability concepts powered by the Softadastra SDK.

## What should not happen

Do not make developers configure the internal Softadastra engine directly just to use Cnerium.

Do not make Cnerium depend on private engine headers.

Do not duplicate the SDK inside Cnerium.

Do not expose SDK internals through unrelated Cnerium public headers.

Do not treat Cnerium storage as a generic application database.

Do not make durable route behavior depend on temporary storage in production.

Do not hide missing SDK installation behind vague compiler errors.

## Contributor rules

When working on the SDK integration, follow these rules:

```txt
Depend on the public Softadastra SDK.
Keep SDK details inside adapters.
Keep Cnerium reliability logic storage-agnostic.
Make startup fail clearly when the SDK or storage is unavailable.
Use AppConfig for user-facing storage configuration.
Do not expose internal Softadastra engine concepts in Cnerium docs.
Do not make users learn the engine before using Cnerium.
```

These rules keep Cnerium understandable as a backend reliability layer.

## Summary

Cnerium integrates with the Softadastra SDK through its store adapter.

The SDK provides the durable storage foundation. Cnerium uses that foundation to persist request hashes, stored responses, and retry metadata for durable routes. The application still owns its domain data, and Vix still owns the backend runtime.

The correct mental model is simple: Cnerium attaches to Vix and uses the Softadastra SDK behind the scenes to make selected write operations durable, idempotent, and safe under retries.
