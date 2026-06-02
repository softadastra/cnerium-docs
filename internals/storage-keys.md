# Storage Keys

This page explains how Cnerium thinks about storage keys internally.

Cnerium stores reliability metadata for durable routes. That metadata lets Cnerium decide whether an incoming request should execute, replay a stored response, or be rejected as unsafe.

Application code should normally not build these keys manually. Storage keys are an internal detail of Cnerium’s reliability layer. They are documented here for contributors, debugging, tests, and adapter work.

The public application model remains:

```cpp id="gyw3gk"
vix::App app;

auto cnerium = cnerium::attach(app);

cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);
```

The developer registers a durable operation. Cnerium builds the storage keys behind that operation.

## Purpose

Storage keys exist so Cnerium can persist and retrieve metadata for one durable operation attempt.

A durable request is identified by:

```txt id="q12231"
operation name
Idempotency-Key
request body hash
```

Cnerium must store two main records:

```txt id="yya4jy"
the request body hash
the stored response
```

The request hash tells Cnerium whether a retry is safe.

The stored response lets Cnerium return the same result without executing the handler again.

## What a key represents

A storage key represents Cnerium metadata, not application domain data.

For example, this request:

```bash id="jwh4t8"
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

belongs to this durable operation:

```txt id="z5hacr"
operation: orders.create
key:       order-123
body:      {"product_id":"p1","quantity":2}
```

Cnerium may store metadata conceptually like this:

```txt id="t202q4"
request hash for orders.create + order-123
stored response for orders.create + order-123
```

That metadata is used only for durable route replay behavior.

The actual order should still be stored by the application in its own database or domain storage.

## Conceptual key format

A simple conceptual key format is:

```txt id="v0rtdt"
cnerium:<record-type>:<operation>:<idempotency-key>
```

For request hashes:

```txt id="ezykhx"
cnerium:hash:<operation>:<idempotency-key>
```

For stored responses:

```txt id="8xsob2"
cnerium:response:<operation>:<idempotency-key>
```

Example:

```txt id="fvapyy"
cnerium:hash:orders.create:order-123
cnerium:response:orders.create:order-123
```

This format is useful for documentation and debugging, but application code should not depend on the exact string layout unless it is working inside Cnerium internals.

The exact implementation may evolve.

## Record types

Cnerium storage should keep record types explicit.

The core record types are:

```txt id="lk8j9d"
hash
response
```

`hash` stores the stable request body hash for an operation and idempotency key.

`response` stores the replayable HTTP response produced by the durable handler.

Future versions may add additional record types, such as:

```txt id="qq4ds3"
meta
lock
journal
audit
event
```

Those should be added carefully. Cnerium storage should remain focused on durable route correctness, not become a general application database.

## Operation name in keys

The operation name is part of the key.

For example:

```txt id="klqwle"
orders.create
payments.create
users.register
```

This matters because two different operations may receive the same raw idempotency key.

Conceptually:

```txt id="3uaw4p"
cnerium:response:orders.create:key-123
cnerium:response:payments.create:key-123
```

These should not collide because they represent different backend operations.

That is why operation names must be stable and specific.

Good operation names:

```txt id="y9w0dh"
orders.create
payments.create
invoices.create
users.register
workflows.start
```

Avoid vague operation names:

```txt id="voip6w"
create
post
submit
handler
action
```

A vague operation name makes storage harder to inspect and increases the chance of future confusion.

## Idempotency key in keys

The `Idempotency-Key` is part of the storage key because it identifies one logical client operation attempt.

Example:

```txt id="bkftq0"
Idempotency-Key: order-123
```

Cnerium uses it with the operation name:

```txt id="m2v2xq"
orders.create + order-123
```

That pair identifies the durable operation attempt.

The request body hash is stored as a value under the hash key. It is not normally part of the storage key itself. This allows Cnerium to detect when the same key is reused with a different body.

## Why the body hash is stored as a value

The body hash should be stored as metadata for the operation and idempotency key.

Conceptually:

```txt id="r9x9b5"
key:
  cnerium:hash:orders.create:order-123

value:
  stable hash of {"product_id":"p1","quantity":2}
```

When a retry arrives, Cnerium computes the incoming body hash and compares it with the stored value.

Safe retry:

```txt id="dr078q"
stored hash == incoming hash
```

Unsafe key reuse:

```txt id="tweklw"
stored hash != incoming hash
```

If the hash were part of the key, Cnerium could accidentally treat a changed body as a separate record instead of detecting the conflict. The stable operation key should point to the original body hash.

## Stored response value

The stored response is stored under the response key.

Conceptually:

```txt id="ofctsd"
key:
  cnerium:response:orders.create:order-123

value:
  {
    "status_code": 201,
    "body": "{\"ok\":true,\"order_id\":\"ord_order-123\"}",
    "content_type": "application/json; charset=utf-8"
  }
```

The stored response must preserve:

```txt id="vs98ff"
HTTP status code
response body
content type
```

When a safe retry arrives, Cnerium loads this value and writes it back through Vix.

The handler is not executed again.

## StoreKey

`cnerium::store::StoreKey` is the internal type responsible for building or representing Cnerium storage keys.

The exact API may evolve, but the responsibility should remain narrow:

```txt id="lfebts"
represent a storage key
build hash keys
build response keys
keep key formatting consistent
avoid duplicated string-building logic
```

A key helper type prevents the same key format from being recreated differently across `ReplayProtection`, `Store`, and adapters.

## Key construction rules

Cnerium storage keys should follow stable rules.

A key should include:

```txt id="jhbih7"
Cnerium namespace prefix
record type
operation name
idempotency key
```

A key should not include:

```txt id="9chmjv"
raw request body
request body hash as part of the primary operation key
temporary process id
random runtime id
values that change on every boot
```

The key must be stable across retries and process restarts.

If the key changes between attempts, replay protection cannot work.

## Namespace prefix

A namespace prefix prevents collisions with other data stored through the same underlying SDK or storage backend.

Recommended conceptual prefix:

```txt id="k1qqvw"
cnerium
```

Example:

```txt id="hmxmcf"
cnerium:hash:orders.create:order-123
```

This makes it clear that the record belongs to Cnerium, not to the application’s order database, user database, or another framework component.

## Sanitization

Storage keys should be safe for the underlying storage backend.

Operation names and idempotency keys may contain characters that are inconvenient for filenames, paths, or storage engines.

Cnerium should avoid assuming that raw user-provided idempotency keys are always safe for direct use in every backend.

A robust implementation may normalize, escape, encode, or hash key parts internally.

The public contract should remain:

```txt id="z5lps8"
same operation name + same Idempotency-Key
  maps to the same Cnerium storage identity
```

The internal representation can change as long as that contract holds.

## Avoid leaking sensitive data

Storage keys should not contain sensitive information.

Do not build idempotency keys from raw secrets, passwords, tokens, personal data, or payment details.

Bad examples:

```txt id="o2ie3k"
cnerium:response:users.register:password-abc123
cnerium:response:payments.create:card-4111111111111111
cnerium:response:users.register:gaspard@example.com
```

Better examples:

```txt id="y1u7y0"
registration-7f3c2a
payment-attempt-9ac10e
order-123
```

The client controls the `Idempotency-Key`, so application documentation should encourage keys that are unique and non-sensitive.

Cnerium internals should also avoid logging raw request bodies or sensitive values when reporting storage keys.

## Key stability across restarts

Storage keys must be stable across process restarts.

For example, this first request:

```txt id="ykgzbh"
operation: orders.create
key: order-123
```

must map to the same storage key after the server restarts.

Otherwise, a retry after restart may not find the stored response.

Avoid building keys with values such as:

```txt id="31fflq"
process id
memory address
random startup id
current timestamp
temporary node id generated on every boot
```

The node id may be useful for storage organization or diagnostics, but it should not break replay of the same operation unless the design explicitly scopes storage per node.

## Node identity and keys

Cnerium has a node id in `AppConfig`:

```cpp id="ja6xoq"
config.set_node_id("orders-node");
```

The node id identifies the local runtime instance.

Whether node id is part of storage namespacing depends on the store design. If it is used in key prefixes, contributors must understand the effect:

```txt id="yupbtl"
node id included in keys
  replay is scoped to that node identity

node id not included in operation keys
  replay can survive node identity changes if storage is shared
```

For most simple local deployments, stable node ids keep behavior easier to reason about.

Avoid random node ids on every boot unless the storage model is designed for that.

## Service name and keys

The service name may also be used for storage organization.

Example:

```cpp id="b3izla"
config.set_name("orders-service");
```

A service name can help separate metadata between services using the same storage foundation.

Conceptually:

```txt id="kguebn"
cnerium:<service>:response:<operation>:<key>
```

This can be useful, but the exact format is an internal decision.

The important rule is that a service should use a stable name in production. Changing the service name may change the namespace where Cnerium looks for stored responses.

## Storage keys and operation renames

Renaming an operation changes its idempotency namespace.

For example, changing:

```txt id="y4ptbg"
orders.create
```

to:

```txt id="re3qll"
orders.new
```

means Cnerium will look under different storage keys.

A retry for an old request may no longer find the stored response if the operation name changed.

Treat operation names as stable API-level identifiers, not casual labels.

If an operation must be renamed, consider compatibility behavior or migration for existing durable metadata.

## Storage keys and route path changes

The route path is not necessarily part of the storage key.

The operation name is the durable identity.

For example:

```txt id="a3aigv"
POST /orders
operation: orders.create
```

If the route path later changes to:

```txt id="eg9zut"
POST /v1/orders
operation: orders.create
```

the durable storage namespace can remain the same if the operation name remains the same.

This is useful because the HTTP path can evolve while the logical operation remains stable.

If the semantics of the operation change, update the operation name deliberately.

## Storage keys and versions

If an operation changes in a way that affects its request body meaning or response meaning, consider versioning the operation name.

Example:

```txt id="g7n71f"
orders.create.v1
orders.create.v2
```

or:

```txt id="6sgs0d"
orders.create
orders.create_with_inventory_reservation
```

Do not version names casually. Version only when the durable operation contract changes enough that old stored responses should not be mixed with new behavior.

## Key lookup flow

For an incoming durable request, Cnerium conceptually performs:

```txt id="lo1goq"
read operation name
read Idempotency-Key
build hash storage key
load stored hash if present

if no hash exists:
  execute handler
  store hash
  store response

if hash exists:
  compare with incoming body hash

if hash matches:
  build response storage key
  load stored response
  replay response

if hash differs:
  return 409 Conflict
```

The request body hash is stored first as the comparison record. The stored response is the replay record.

## New request storage

For a new request:

```txt id="rvazt6"
operation: orders.create
key: order-123
incoming hash: abc
```

Cnerium stores:

```txt id="8mjl1s"
cnerium:hash:orders.create:order-123
  -> abc

cnerium:response:orders.create:order-123
  -> stored response
```

The order matters from a correctness perspective. Cnerium should avoid states where one record exists without the other when possible.

In practice, storage consistency depends on the underlying SDK and commit strategy.

## Safe retry lookup

For a safe retry:

```txt id="e1b21k"
operation: orders.create
key: order-123
incoming hash: abc
```

Cnerium reads:

```txt id="320iny"
cnerium:hash:orders.create:order-123
```

The stored hash matches the incoming hash.

Then Cnerium reads:

```txt id="g48u1q"
cnerium:response:orders.create:order-123
```

and returns that stored response.

The user handler does not run again.

## Unsafe reuse lookup

For unsafe reuse:

```txt id="cxqevs"
operation: orders.create
key: order-123
incoming hash: def
```

Cnerium reads:

```txt id="si0kku"
cnerium:hash:orders.create:order-123
```

The stored hash does not match the incoming hash.

Cnerium returns:

```txt id="c9h81i"
HTTP 409 Conflict
```

It should not read the stored response as the answer for the changed body, and it should not execute the handler as a new request.

## Missing key behavior

If the `Idempotency-Key` is missing, Cnerium should not build operation-specific storage keys.

The request is invalid for a durable route.

Expected behavior:

```txt id="rm8th4"
missing Idempotency-Key
  -> 400 Bad Request
  -> no handler execution
  -> no stored response
```

This avoids polluting storage with incomplete durable records.

## Partial storage failure

A difficult internal case is partial storage failure.

For example:

```txt id="xkwnph"
handler executes
hash record is stored
response record fails to store
```

Now a retry may see the hash and expect a response, but the response is missing.

The architecture should minimize this risk. Where possible, the store should use an atomic or transaction-like operation to commit related records.

If atomic commit is not available, Cnerium should define clear recovery behavior.

Possible internal strategies include:

```txt id="uw5d9c"
store response first, then hash marker
store a single combined record
store a pending marker and finalize after response write
use SDK transaction support when available
return a clear internal error if replay metadata is incomplete
```

The best long-term design is to avoid split-brain metadata where the hash and response disagree.

## Combined record option

One way to reduce partial failure is to store a single record per operation and key.

Conceptually:

```txt id="z5eo9h"
cnerium:operation:<operation>:<key>
  -> {
       "hash": "...",
       "response": {
         "status_code": 201,
         "body": "...",
         "content_type": "application/json; charset=utf-8"
       }
     }
```

This can make replay logic simpler because the hash and response are loaded together.

Separate keys are easier to reason about and inspect, but combined records may be safer depending on the SDK storage guarantees.

The final implementation should choose the model that gives the strongest correctness with the available storage primitives.

## Key format should be internal

Application developers should not rely on exact storage key strings.

Do not document user-facing behavior that requires users to read or write:

```txt id="l5b7az"
cnerium:response:orders.create:order-123
```

The public API should remain:

```cpp id="eps81z"
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

The key format is for internals, diagnostics, and tests.

## Debugging storage keys

For debugging, it can be useful to log key components:

```txt id="yrqkss"
operation name
idempotency key
record type
request hash
```

Avoid logging raw request bodies or sensitive idempotency keys in production logs.

A safer log shape is:

```txt id="bm02jw"
operation=orders.create
record=response
key_hash=...
request_hash=...
```

This lets operators understand retry behavior without exposing sensitive client data.

## Testing key behavior

Storage key tests should verify behavior, not only strings.

Important tests:

```txt id="l3li7h"
same operation + same key maps to same storage identity
different operation + same key does not collide
same operation + different key does not collide
same key + different body returns conflict
safe retry loads the stored response
operation rename changes namespace deliberately
stored response can be replayed after restart
```

If tests assert exact key strings, keep those tests in internal store-key tests, not public API tests.

## Relationship with Softadastra SDK

Cnerium builds storage keys. The Softadastra SDK stores the data.

The SDK should not need to know what `orders.create` means. It only receives keys and values from the Cnerium store adapter.

The meaning belongs to Cnerium:

```txt id="v6vv1q"
operation name
idempotency key
request hash
stored response
```

The storage durability belongs to the SDK.

## Relationship with Store

`Store` is the facade that owns key usage.

The reliability layer should ask the store for high-level operations where possible:

```txt id="331kqz"
get stored hash
put stored hash
get stored response
put stored response
```

or better:

```txt id="wns4xy"
check durable operation
commit durable operation
```

The deeper the abstraction, the less key formatting leaks into reliability code.

## Relationship with ReplayProtection

`ReplayProtection` depends on storage keys indirectly.

It should not build raw key strings everywhere.

Instead, it should ask the store whether an operation and key already exist, and what hash or response is associated with them.

This keeps replay protection focused on rules:

```txt id="fnm3dl"
missing key -> Invalid
new key -> Execute
same hash -> Replay
different hash -> Conflict
```

and keeps key formatting inside the store layer.

## Common mistakes

Do not include raw request bodies in storage keys.

Do not include random runtime data in storage keys.

Do not let operation names be vague or unstable.

Do not treat key format as public API.

Do not delete production Cnerium storage casually.

Do not store sensitive personal data in idempotency keys.

Do not make the request body hash part of the primary operation identity.

Do not let different operations collide because they share the same idempotency key.

## Summary

Cnerium storage keys identify reliability metadata for durable routes.

They are built from a Cnerium namespace, a record type, a stable operation name, and the client-provided idempotency key. The request body hash is stored as metadata so Cnerium can detect unsafe key reuse. The stored response is persisted so safe retries can receive the original result without executing the handler again.

Application code should not depend on key strings. Developers should use `cnerium.durable_post`, stable operation names, and correct `Idempotency-Key` behavior. Cnerium owns the storage key design behind the scenes.
