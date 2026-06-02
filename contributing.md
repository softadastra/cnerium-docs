# Contributing

Thank you for your interest in contributing to Cnerium.

Cnerium is a reliability-first backend layer for Vix applications. It exists to make selected Vix backend write operations durable, idempotent, replay-safe, and easier to reason about under retries, timeouts, crashes, and unstable networks.

Before contributing code, documentation, examples, or design changes, understand the main boundary:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Vix owns the backend application. Cnerium attaches to it. Softadastra SDK provides the durable storage foundation behind Cnerium.

That model should guide every contribution.

## Project direction

Cnerium is not a general-purpose web framework.

It should not become a replacement for Vix, a second HTTP server, a second router, a second middleware system, a full ORM, a frontend framework, or a deployment platform.

Cnerium should stay focused on backend reliability.

The core responsibilities are:

```txt
durable routes
idempotency
request body hashing
replay protection
stored responses
retry-safe handler execution
application-level realtime events tied to durable operations
Softadastra SDK-backed reliability storage
thin adapters for Vix and Softadastra SDK
```

A contribution should strengthen that direction.

## What belongs in Cnerium

Good contributions usually improve one of these areas:

```txt
durable route behavior
idempotency correctness
stored response replay
conflict detection
storage reliability
Softadastra SDK integration
Vix HTTP adapter integration
Vix WebSocket adapter integration
clear public examples
clear documentation
tests for retry behavior
diagnostics for durable route failures
```

Examples of good changes:

```txt
add a test proving that safe retries do not execute the handler twice
improve malformed JSON handling in durable routes
make 409 Conflict responses clearer
improve stored response commit safety
add documentation explaining operation names
improve the Vix adapter without duplicating Vix HTTP behavior
improve SDK detection in CMake
fix IntelliSense include issues through compile_commands.json guidance
```

These changes fit the purpose of the project.

## What does not belong in Cnerium

Avoid contributions that turn Cnerium into another framework layer.

Do not add:

```txt
a separate HTTP server
a separate router
a full middleware framework
a full ORM
a template engine
a frontend rendering system
a package manager
a CLI that replaces Vix CLI
a deployment platform
a general WebSocket server
a general job queue
a complete authentication framework
business domain modules such as orders, payments, shops, or users
```

Some of these features may be useful elsewhere in the ecosystem. They should not live inside Cnerium unless they directly support durable route correctness.

## Architectural rules

Keep these rules in mind when changing the codebase.

```txt
Vix owns the backend application.
Cnerium owns durable route behavior.
Softadastra SDK provides durable storage foundations.
Adapters must remain thin.
Normal Vix routes must stay normal.
Durable routes must stay selective.
Cnerium should use public Vix APIs.
Cnerium should use the public Softadastra SDK.
Cnerium should not expose private Softadastra engine concepts.
```

If a change makes a developer ask, “Why am I no longer using Vix?”, the design is probably moving in the wrong direction.

The correct feeling should be:

```txt
I am building a Vix backend.
I attach Cnerium where retry safety matters.
```

## Repository structure

Cnerium follows a small modular structure.

```txt
include/cnerium/
  adapters/
  app/
  http/
  realtime/
  reliability/
  store/
  support/
  cnerium.hpp
  Version.hpp

src/
  adapters/
  app/
  http/
  realtime/
  reliability/
  store/
  support/

examples/
tests/
docs/
cmake/
```

Each module should keep a narrow responsibility.

The public headers belong under `include/cnerium`.

Implementations belong under `src`.

Examples should stay small and focused on durable route behavior.

Tests should verify the reliability model, not only successful first requests.

## Code style

Use clear, direct C++.

Prefer explicit names over clever abstractions.

A durable route should be easy to read:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body = request.json();

      const std::string product_id =
          cnerium::support::string_or(body, "product_id", "");

      if (product_id.empty())
      {
        return cnerium::DurableResponse::bad_request(
            "Missing required field: product_id");
      }

      return cnerium::created({
          {"ok", true}
      });
    });
```

Avoid unnecessary abstractions that hide the durable execution model.

The reader should be able to see:

```txt
what route is durable
what operation name is used
where validation happens
where the response is returned
where side effects happen
```

## Naming

Use names that describe the durable operation clearly.

Good operation names:

```txt
orders.create
payments.create
invoices.create
users.register
workflows.start
```

Avoid vague names:

```txt
create
submit
post
handler
action
```

Operation names are not casual labels. They are part of the idempotency namespace.

Changing an operation name changes where Cnerium looks for stored request hashes and stored responses.

## Public API guidelines

The preferred public API shape is:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

int main()
{
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

  return 0;
}
```

New public APIs should preserve this model.

Avoid APIs that suggest Cnerium owns the whole backend application.

Prefer:

```cpp
auto cnerium = cnerium::attach(app);
```

over:

```cpp
cnerium::App app;
```

Compatibility wrappers may exist, but documentation and examples should teach the attached model.

## Adapter guidelines

Adapters connect Cnerium to Vix and Softadastra SDK.

They should remain thin.

`VixHttp` should only translate between Vix HTTP types and Cnerium durable response behavior.

It should not implement an HTTP server, router, middleware system, or request parser.

`VixWebSocket` should only translate Cnerium events to Vix WebSocket delivery.

It should not implement a second WebSocket stack.

`SoftadastraStore` should only connect Cnerium storage operations to the public Softadastra SDK.

It should not expose internal engine details or contain application domain logic.

## Storage guidelines

Cnerium storage is reliability metadata.

It stores:

```txt
request hashes
stored responses
operation metadata
idempotency metadata
```

It does not store application domain data.

Application data belongs in the application database or domain storage.

For example:

```txt
application database
  stores orders, users, payments, invoices, products

Cnerium store
  stores request hashes and replayable HTTP responses
```

Do not design features that make Cnerium’s store the source of truth for business data.

## Idempotency guidelines

A durable route uses:

```txt
operation name
Idempotency-Key
request body hash
stored response
```

to decide whether to execute, replay, conflict, or reject.

The rules are:

```txt
new key
  execute handler and store response

same key with same body
  replay stored response

same key with different body
  return 409 Conflict

missing key
  return 400 Bad Request
```

Contributions that touch idempotency must preserve these rules.

If a change causes safe retries to execute the handler again, it is a correctness bug.

If a change allows the same key to be reused with a different body, it is a correctness bug.

## Response guidelines

Durable handlers return `cnerium::DurableResponse`.

They should not write directly to `vix::Response`.

Correct:

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id}
});
```

Avoid designs where durable handlers directly mutate a Vix response object.

Cnerium needs a durable response object because it must store the response and replay it later.

A good durable response includes enough information for the client to continue after a retry.

For creation routes, include the created resource id or operation status.

## Realtime guidelines

Realtime events are notifications tied to durable operation execution.

They are not the source of truth.

They are not a durable queue.

They are not a separate WebSocket framework.

Use events like:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

An event emitted inside a durable handler should emit only when the handler runs.

On safe replay, the handler should not run, so the event should not emit again from that handler.

That behavior must be preserved.

## Error handling

Errors should be clear and useful.

For durable route behavior, common responses are:

```txt
400 Bad Request
  missing or invalid Idempotency-Key
  malformed or invalid request body

409 Conflict
  same Idempotency-Key reused with a different body

201 Created
  operation completed and response was stored

200 OK
  operation completed and response was stored
```

Avoid vague internal failures when a clear message can help the developer.

Dependency errors should also be explicit.

For example, if the Softadastra SDK cannot be found, the message should tell the user what package or target is expected.

## Testing

Tests should cover durable behavior, not only ordinary success.

At minimum, a durable route should be tested with:

```txt
new request with valid key and body
  handler executes
  response is stored

same key with same body
  stored response is returned
  handler does not execute again

same key with different body
  409 Conflict
  handler does not execute

missing key
  400 Bad Request
  handler does not execute
```

When storage persistence is expected, also test:

```txt
send request
restart process
retry same request with same key and body
stored response is returned
```

If realtime emission is involved, test that the event is not emitted again during safe replay.

## Running tests

Use the normal Vix workflow:

```bash
vix tests
```

When examples are needed:

```bash
vix build --build-target all -v -- -DCNERIUM_BUILD_EXAMPLES=ON
```

Run the example manually when testing HTTP behavior:

```bash
./build-ninja/cnerium_durable_orders_realtime
```

Then test with `curl`:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Retry the same request and verify that the response is replayed.

## Build and dependency checks

Cnerium depends on Vix and the Softadastra SDK.

The build should fail early and clearly if a dependency is missing.

Expected dependency direction:

```txt
cnerium
  -> Vix public targets
  -> Softadastra SDK public targets
```

Cnerium should not depend on private Vix internals or private Softadastra engine headers.

If VS Code reports missing headers but the project builds, configure IntelliSense to use the build compile commands:

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

The editor should follow the CMake build graph.

## Documentation contributions

Documentation should be professional, direct, and grounded in the actual architecture.

Avoid generic marketing text.

Avoid repeating short artificial sentences.

Avoid making Cnerium sound like a complete replacement for Vix.

Good documentation should explain:

```txt
what Cnerium adds
what Vix still owns
why durable routes exist
how Idempotency-Key works
how safe replay works
why 409 Conflict exists
what storage is used for
what Cnerium does not do
```

Use complete examples that compile with the current API.

Prefer examples that start with:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

## Pull request checklist

Before opening a pull request, check:

```txt
The change fits Cnerium’s reliability-focused direction.
The public API keeps Vix visible as the backend owner.
The change does not duplicate Vix responsibilities.
The change does not expose private Softadastra engine internals.
Tests cover the retry behavior affected by the change.
Examples use the attached model.
Documentation is updated when public behavior changes.
The project builds.
The test suite passes.
```

Use a clear commit message.

Examples:

```txt
fix(reliability): preserve stored response replay for safe retries
docs(internals): clarify Vix integration boundary
test(http): cover unsafe idempotency key reuse
build(cmake): improve Softadastra SDK target detection
```

## Commit style

Use concise commit messages with a clear scope.

Recommended format:

```txt
type(scope): message
```

Examples:

```txt
fix(store): handle missing stored response during replay
docs(reference): document DurableRequest helpers
test(reliability): add conflict case for changed request body
refactor(adapters): keep Vix HTTP bridge narrow
```

Keep the message specific. A good commit message should tell the reader what changed without opening the diff.

## Review priorities

Code review should focus on correctness first.

Important questions:

```txt
Does the change preserve safe retry behavior?
Can the handler execute twice for the same key and body?
Can the same key be reused with a different body without conflict?
Does the change blur the boundary with Vix?
Does the change expose private SDK or engine details?
Does the change make examples harder to understand?
```

A change that makes the API more powerful but less clear should be treated carefully.

## Security considerations

Do not log sensitive request bodies.

Do not encourage clients to use passwords, card numbers, tokens, emails, or other sensitive values as idempotency keys.

Do not store application secrets in Cnerium metadata.

Do not treat Cnerium idempotency as a replacement for authentication, authorization, validation, rate limiting, or provider-level safety mechanisms.

Cnerium improves retry behavior. It does not replace the rest of the backend security model.

## Reporting issues

When reporting a bug, include:

```txt
Cnerium version or commit
Vix version
Softadastra SDK version
operating system
build command
runtime command
minimal code example
request used to reproduce the issue
actual response
expected response
```

For durable route issues, include the exact `curl` commands for:

```txt
first request
safe retry
unsafe retry, if relevant
missing key, if relevant
```

Retry bugs are much easier to diagnose when the operation name, idempotency key, and request bodies are visible.

Avoid including secrets or real personal data in reports.

## Development philosophy

Cnerium should be small, understandable, and reliable.

The best contribution is not the one that adds the most features. The best contribution is the one that makes durable route behavior more correct, easier to test, easier to explain, or harder to misuse.

Keep the project focused.

```txt
Vix gives the backend runtime.
Softadastra SDK gives the durable foundation.
Cnerium gives selected backend operations retry safety.
```

That is the product.

## Summary

Contributing to Cnerium means protecting its focus.

Cnerium should attach to Vix, not replace it. It should use the public Softadastra SDK, not private engine internals. It should make selected critical write routes durable, idempotent, replay-safe, and clear under retries.

Changes that strengthen that purpose are welcome.
