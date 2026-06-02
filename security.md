# Security

Security matters for Cnerium because durable backend operations often protect sensitive or high-value actions.

Cnerium is designed to make selected Vix backend write operations safer under retries. It handles idempotency, request body hashing, replay protection, stored responses, and retry-safe handler execution.

Cnerium does not replace the rest of your backend security model.

The public model remains:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Vix owns the backend application. Cnerium attaches to it. Softadastra SDK provides the durable storage foundation behind Cnerium.

Security work in Cnerium should preserve that boundary.

## Security scope

Cnerium protects one specific class of backend risk:

```txt
A client retries a critical write operation and the backend accidentally executes it more than once.
```

Cnerium helps prevent duplicate or ambiguous execution by using:

```txt
operation name
Idempotency-Key
request body hash
stored response
replay protection
```

This protects routes such as:

```txt
POST /orders
POST /payments
POST /invoices
POST /users/register
POST /subscriptions
POST /workflows/start
```

These routes create or change important state. They should not be executed twice because a client retried after a timeout, lost response, mobile network interruption, proxy failure, or process restart.

## What Cnerium does not replace

Cnerium is not a complete security framework.

It does not replace:

```txt
authentication
authorization
input validation
rate limiting
CSRF protection
CORS policy
TLS configuration
database transactions
unique constraints
audit logs
password hashing
secret management
payment provider safety rules
provider-level idempotency
application domain checks
```

A durable route can make retry behavior safer, but the application still owns the full security and correctness model.

For example, a payment route should still verify the user, validate the amount, check the currency, apply business rules, use provider-level idempotency, write audit logs, and protect the domain database with transactions and constraints.

Cnerium only protects the durable route execution path.

## Idempotency-Key safety

A durable route requires an `Idempotency-Key`.

The key identifies one logical operation attempt from the client.

Correct usage:

```txt
same operation
same Idempotency-Key
same request body
```

means:

```txt
safe retry
```

Incorrect usage:

```txt
same operation
same Idempotency-Key
different request body
```

means:

```txt
409 Conflict
```

The key should be unique enough for the operation and stable across retries.

Good examples:

```txt
order-7f3c2a
payment-attempt-9ac10e
registration-5b91fd
workflow-1d7f20
```

Avoid using sensitive values as idempotency keys.

Bad examples:

```txt
password value
access token
credit card number
email address
phone number
personal identifier
session secret
```

The idempotency key may appear in logs, diagnostics, storage keys, traces, or support reports. Treat it as an operation identifier, not as a place to put secrets.

## Request body hashing

Cnerium hashes the request body to detect unsafe key reuse.

The request hash is used to distinguish:

```txt
same key + same body
  safe retry

same key + different body
  conflict
```

The request body hash should be stable and deterministic.

It should not rely on implementation-defined behavior such as `std::hash`.

The hash exists for replay protection. It is not a password hash. It is not an encryption mechanism. It should not be described as protecting sensitive request contents by itself.

If the request body contains sensitive data, that data still needs normal application-level protection.

## Stored responses

Cnerium stores durable responses so safe retries can receive the same result.

A stored response contains:

```txt
HTTP status code
response body
content type
```

This is important for retry safety, but it also has security implications.

Do not return secrets in durable responses unless the application deliberately intends to expose them to the client.

Avoid responses that contain:

```txt
passwords
access tokens
refresh tokens
private keys
payment card data
internal credentials
sensitive personal data
debug traces
raw internal errors
```

A stored response may remain available for replay as long as Cnerium storage keeps it.

Design durable responses carefully.

Good durable response for an order:

```json
{
  "ok": true,
  "order_id": "ord_123",
  "status": "created"
}
```

Bad durable response:

```json
{
  "ok": true,
  "order_id": "ord_123",
  "internal_debug_dump": "...",
  "access_token": "..."
}
```

A durable response should contain what the client needs to continue after a retry, not private internal state.

## Storage security

Cnerium storage is reliability metadata.

It stores request hashes, stored responses, operation metadata, and idempotency metadata.

It is not the application database.

For production, use a stable writable data directory with correct permissions:

```cpp
config.set_data_dir("/var/lib/orders-service/cnerium");
```

Prepare the directory for the service user:

```bash
sudo mkdir -p /var/lib/orders-service/cnerium
sudo chown -R orders:orders /var/lib/orders-service/cnerium
```

The exact user and group depend on your deployment.

Avoid production storage paths such as:

```txt
/tmp/cnerium
build directories
source-controlled directories
world-writable directories
directories deleted on deploy
directories shared by unrelated services
```

The storage directory may contain replayable response data. Protect it accordingly.

## Do not treat storage as a cache

Cnerium storage should not be treated as a disposable cache in production.

Deleting Cnerium storage removes the metadata used to identify completed durable operations.

After deletion, a retry with an old idempotency key may be treated as a new request because Cnerium no longer has the previous hash and stored response.

That can break retry safety.

Development reset is fine:

```bash
rm -rf data/cnerium
```

Production deletion should be deliberate and carefully understood.

## Logging

Logs are useful for diagnosing durable route behavior, but logs must not expose sensitive data.

Good fields to log:

```txt
operation name
route path
status code
decision: execute, replay, conflict, invalid
request hash
sanitized idempotency key hash
storage result
```

Be careful with:

```txt
raw request bodies
raw response bodies
raw Idempotency-Key values
authorization headers
cookies
payment data
personal information
internal SDK errors with secrets
```

A safe log entry shape is:

```txt
operation=orders.create
decision=replay
status=201
request_hash=...
idempotency_key_hash=...
```

Avoid:

```txt
body={"email":"...","password":"..."}
Authorization: Bearer ...
```

Cnerium should make retry behavior observable without leaking private data.

## Error responses

Error responses should be clear but not overly revealing.

Good examples:

```txt
Missing or invalid Idempotency-Key
Idempotency-Key was reused with a different request body
Request body must be valid JSON
Missing required field: product_id
```

Avoid exposing:

```txt
filesystem paths
internal SDK stack traces
private storage keys
database errors
secret values
raw exception dumps
```

For example, this is acceptable:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This is not acceptable for a public API response:

```json
{
  "error": "failed to read /var/lib/orders-service/cnerium/internal/key/..."
}
```

Internal details can be logged safely for operators, but public responses should remain stable and careful.

## Authentication and authorization

Cnerium does not authenticate users.

A durable route should still require the same authentication and authorization checks as any other critical backend route.

For example, before creating an order, the application should verify:

```txt
the user is authenticated
the user is allowed to create the order
the product exists
the quantity is allowed
the account or shop context is valid
```

Cnerium ensures the handler is not executed twice for the same safe retry. It does not decide who is allowed to execute the operation.

Authorization belongs to Vix middleware, application services, or domain logic.

## Input validation

Cnerium does not replace input validation.

A durable handler must validate its request body:

```cpp
const auto body = request.try_json();

if (!body.has_value())
{
  return cnerium::DurableResponse::bad_request(
      "Request body must be valid JSON");
}

const std::string product_id =
    cnerium::support::string_or(*body, "product_id", "");

if (product_id.empty())
{
  return cnerium::DurableResponse::bad_request(
      "Missing required field: product_id");
}
```

Durability protects retry behavior. Validation protects the application from invalid input.

Both are required.

## Rate limiting and abuse prevention

A durable route can still be abused.

An attacker can send many unique idempotency keys, causing the backend to store many records.

Applications should use rate limiting, authentication, quotas, and abuse controls where appropriate.

Possible protections include:

```txt
rate limit by user
rate limit by IP
limit request body size
limit key length
reject malformed keys
expire old durable metadata when safe
monitor conflict rates
monitor invalid request rates
```

Cnerium should help make durable operations safer. It should not become a storage exhaustion vector.

## Idempotency key length

Applications should define reasonable limits for idempotency key length.

Very long keys can create storage, logging, memory, or filesystem issues depending on the backend.

A practical policy is:

```txt
keys must be non-empty
keys should be reasonably short
keys should use safe printable characters
keys should not contain secrets
```

The exact length limit can be application-specific.

Cnerium internals should avoid assuming that the raw key is safe for direct use in filenames or storage paths.

## Storage key safety

Cnerium may build internal storage keys from:

```txt
namespace prefix
record type
operation name
idempotency key
```

The raw idempotency key comes from the client, so it must be handled carefully.

Cnerium should avoid unsafe direct use of raw keys in filesystem paths or storage names without encoding, escaping, hashing, or validation.

The public contract should be:

```txt
same operation name + same Idempotency-Key
  maps to the same durable operation identity
```

The internal representation can be made safe for the storage backend.

## Realtime events

Realtime events are notifications.

They are not the source of truth and they are not a secure delivery channel by themselves.

If a durable handler emits an event:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

the event payload should not include secrets.

Good payload:

```json
{
  "order_id": "ord_123",
  "status": "created"
}
```

Bad payload:

```json
{
  "order_id": "ord_123",
  "internal_token": "...",
  "private_note": "..."
}
```

Event authorization and room access belong to the underlying Vix WebSocket and application access model.

Cnerium should not assume that every connected client is allowed to receive every event.

## Event delivery is not authorization

Emitting to a room is not the same as proving that a client is authorized.

For example:

```cpp
cnerium.emit_to(
    "user:123",
    "order.created",
    payload);
```

The application must ensure that only authorized clients can join or receive messages for that room.

Cnerium emits application events. Vix and application logic must protect connection identity, session authorization, and room access.

## Payments and high-value operations

Payment-like operations need more than Cnerium idempotency.

Cnerium can protect the backend route from duplicate handler execution, but a production payment system should also use:

```txt
provider-level idempotency
database transactions
unique payment references
audit logs
status transitions
amount and currency validation
authorization checks
fraud controls where required
clear failure recovery behavior
```

A good mapping is:

```txt
client Idempotency-Key
  -> Cnerium durable route
  -> application payment service
  -> payment provider idempotency key
```

Cnerium protects the route. The provider’s mechanism protects the external payment operation.

## Registration and account flows

Registration routes can also benefit from Cnerium, but they still need normal security controls.

A production registration flow should handle:

```txt
email normalization
password hashing
username validation
unique constraints
verification tokens
rate limiting
abuse detection
email delivery safety
audit logs
privacy requirements
```

Cnerium prevents duplicate handler execution for safe retries. It does not implement account security by itself.

## Secrets

Do not store secrets in:

```txt
Idempotency-Key
operation name
stored response body
realtime event payload
logs
storage keys
documentation examples
test fixtures
```

Use environment variables, secret managers, or the deployment platform’s secret handling for real credentials.

Never commit real secrets to the repository.

## Dependency security

Cnerium depends on Vix and the Softadastra SDK.

Contributors should avoid private or unstable dependency paths.

Correct direction:

```txt
Cnerium
  -> Vix public API
  -> Softadastra SDK public API
```

Avoid:

```txt
Cnerium
  -> private Vix internals
  -> private Softadastra engine internals
```

Private internals are more likely to change and can create unsafe coupling.

Public dependencies are easier to audit, document, and maintain.

## Build and editor security

Do not fix missing include errors by copying SDK headers into the Cnerium repository.

Do not vendor private engine headers into Cnerium just to silence the editor.

If the build works but VS Code reports missing SDK headers, configure IntelliSense to use CMake compile commands:

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

The editor should follow the real build graph.

## Reporting vulnerabilities

If you find a security issue in Cnerium, report it responsibly.

Include enough information to reproduce the issue:

```txt
Cnerium version or commit
Vix version
Softadastra SDK version
operating system
build command
runtime command
minimal code example
HTTP request used to trigger the issue
expected behavior
actual behavior
```

For durable route issues, include:

```txt
operation name
first request
safe retry request
unsafe retry request, if relevant
missing key request, if relevant
```

Do not include real secrets, production tokens, private keys, customer data, payment card data, or personal information in the report.

Use sanitized examples.

## Security review checklist

When reviewing a change, ask:

```txt
Can a safe retry execute the handler twice?
Can the same key be reused with a different body without conflict?
Can a missing key reach the handler?
Can a response store secrets unnecessarily?
Can logs expose request bodies or credentials?
Can raw idempotency keys create unsafe storage paths?
Does the change bypass authentication or authorization?
Does the change expose private SDK or engine internals?
Does the change turn realtime events into a source of truth?
Does the change treat Cnerium storage as application data?
```

A correct change should preserve the durable route safety model and avoid leaking sensitive information.

## Secure defaults

Cnerium should prefer secure defaults where possible.

Good defaults include:

```txt
reject missing Idempotency-Key on durable routes
return 409 for same key with different body
avoid logging raw request bodies
avoid storing secrets in examples
keep adapters thin
use public dependencies
make storage configuration explicit
keep durable route behavior selective
```

Security should not depend on users discovering hidden rules.

## Common mistakes

Do not put secrets in idempotency keys.

Do not expose stored response bodies in logs.

Do not return internal stack traces to clients.

Do not use Cnerium storage as the application database.

Do not delete production durable metadata casually.

Do not make realtime events the only source of truth.

Do not treat Cnerium as authentication or authorization.

Do not skip provider-level idempotency for payments.

Do not copy internal Softadastra engine headers into Cnerium.

Do not make all routes durable by default.

## Summary

Cnerium improves the security and correctness of selected backend write operations by making retries explicit, idempotent, replay-safe, and conflict-aware.

It does not replace authentication, authorization, validation, rate limiting, transactions, provider-level idempotency, or application security design.

Use Cnerium to protect critical Vix routes from duplicate execution. Protect the rest of the system with normal backend security practices.
