# Use Idempotency-Key

Durable routes in Cnerium require an `Idempotency-Key` header.

The key is what lets Cnerium recognize that two HTTP requests are attempts to complete the same logical operation. Without that key, a durable route cannot know whether an incoming `POST` is new or a retry after a timeout, dropped connection, or lost response.

This guide explains how to use `Idempotency-Key` correctly from the client side and what behavior to expect from a Cnerium durable route.

## The basic rule

Use one idempotency key for one logical operation.

For example, if a client is creating one order, it should generate one key before sending the request:

```txt
order-123
```

Then it sends the request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

If the request times out or the response is lost, the client should retry with the same key and the same body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

The key should not be regenerated for the retry.

That is the most important rule.

## Why the key exists

A backend can complete a request and still fail to deliver the response.

The sequence can look like this:

```txt
client sends POST /orders
server receives the request
server creates the order
server sends the response
network connection drops
client does not receive the response
```

From the server’s point of view, the order was created.

From the client’s point of view, the request failed or timed out.

The client may retry. Without an idempotency key, the backend has no stable way to know whether the second request is a new order or the same order attempt.

Cnerium uses the `Idempotency-Key` to connect the retry to the original operation.

## What the key identifies

An `Idempotency-Key` identifies one logical operation attempt.

It is not necessarily the final database id. It is not necessarily the order id, payment id, invoice id, or user id. It is a client-provided operation key that stays the same across retries.

For example:

```txt
operation: orders.create
key:       order-123
body:      {"product_id":"p1","quantity":2}
```

Together, these values describe one attempt to create an order.

Cnerium also hashes the request body. That prevents the same key from being reused with a different payload.

## Good key usage

Good client behavior looks like this:

```txt
1. Generate an idempotency key before sending the operation.
2. Send the request with that key.
3. If the request times out, retry with the same key.
4. Keep the request body the same when retrying.
5. Generate a new key only for a new operation attempt.
```

For example:

```txt
first attempt:
  Idempotency-Key: order-123
  body: {"product_id":"p1","quantity":2}

safe retry:
  Idempotency-Key: order-123
  body: {"product_id":"p1","quantity":2}

new operation:
  Idempotency-Key: order-124
  body: {"product_id":"p2","quantity":1}
```

This gives Cnerium enough information to distinguish a retry from a new operation.

## Bad key usage

The common mistakes are simple but dangerous.

Do not generate a new key on every retry:

```txt
first attempt:
  Idempotency-Key: order-123

retry:
  Idempotency-Key: order-456
```

Cnerium will treat these as two different operations because the client changed the key.

Do not reuse the same key with a different body:

```txt
first attempt:
  Idempotency-Key: order-123
  body: {"product_id":"p1","quantity":2}

second request:
  Idempotency-Key: order-123
  body: {"product_id":"p2","quantity":1}
```

Cnerium rejects this with `409 Conflict` because the key has already been used for a different request body.

Do not omit the key on a durable route:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

A durable route requires the key because retry safety depends on it.

## First request

Send the first request with a new key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected response:

```txt
HTTP/1.1 201 Created
```

Example body:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

Because this is the first time Cnerium sees this key for the `orders.create` operation, the durable handler runs. Cnerium stores the request hash and the response.

## Retry with the same key and body

Now send the same request again:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected response:

```txt
HTTP/1.1 201 Created
```

The body should match the first response.

Cnerium recognizes this as a safe retry. The operation name is the same, the idempotency key is the same, and the request body hash is the same. Cnerium returns the stored response instead of running the durable handler again.

This is the behavior that prevents duplicate order creation.

## Reuse the same key with a different body

Now keep the same key but change the body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Expected response:

```txt
HTTP/1.1 409 Conflict
```

Example body:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This request is not a safe retry. The key already belongs to a previous body. Cnerium rejects it instead of guessing what the client intended.

## Omit the key

If the key is missing:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

The durable route rejects the request.

A durable route cannot safely process a critical write without an operation key. Missing keys should be treated as client errors.

## Generate keys on the client

The key can be any stable string that is unique enough for the operation.

For browser or JavaScript clients, a UUID-style key is usually a good default:

```js
const idempotencyKey = crypto.randomUUID();

await fetch("/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  },
  body: JSON.stringify({
    product_id: "p1",
    quantity: 2,
  }),
});
```

If the request fails and the client retries, reuse the same `idempotencyKey`.

Do not call `crypto.randomUUID()` again for the retry of the same logical operation.

## Store the key while retrying

A client should keep the key for as long as it may retry the operation.

For a simple frontend, that may mean keeping it in memory while the request is pending.

For a more reliable offline-first or mobile client, it may mean storing the pending operation locally with its idempotency key and body until the server response is received.

Conceptually:

```txt
pending operation:
  method: POST
  path: /orders
  idempotency_key: order-123
  body: {"product_id":"p1","quantity":2}
```

If the app restarts before the request succeeds, it can retry the same pending operation with the same key and body.

This pattern fits well with unreliable networks.

## Corrected requests need a new key

If the user changes the submitted data after a validation error, use a new idempotency key.

For example, this request is invalid:

```txt
Idempotency-Key: order-123
body: {"product_id":"p1","quantity":0}
```

The user corrects the quantity:

```txt
body: {"product_id":"p1","quantity":2}
```

That corrected request should use a new key:

```txt
Idempotency-Key: order-124
body: {"product_id":"p1","quantity":2}
```

The body changed, so it is a new operation attempt.

If the client reuses `order-123` with the corrected body, Cnerium may reject it as a conflict because the same key now refers to a different body.

## Key scope

Cnerium scopes idempotency keys by operation name.

That means the same raw key can be used in different operation namespaces without representing the same durable operation:

```txt
orders.create + key-123
payments.create + key-123
```

These are different operations.

Even so, clients should avoid intentionally reusing keys across unrelated operations when it is easy to generate unique keys. Unique keys make logs, debugging, and support easier.

## Server-side access

Inside a durable handler, the key is available through `DurableRequest`:

```cpp
const std::string key =
    request.idempotency_key_value();
```

Example:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const std::string order_id =
          "ord_" + request.idempotency_key_value();

      return cnerium::created({
          {"ok", true},
          {"order_id", order_id}
      });
    });
```

This is useful for examples and deterministic local demos. In a production system, the final domain id may come from the database or another service. The idempotency key should still be used to protect retry behavior.

## Idempotency-Key and side effects

The practical reason to use an idempotency key is to avoid repeating side effects.

A durable handler may create a database row, reserve inventory, emit a realtime event, send a notification, or call an external provider. If the same request is retried safely, Cnerium returns the stored response and does not call the handler again.

That means side effects inside the durable handler are not repeated for the same key and body.

This is why critical side effects should stay inside the durable handler. If the application performs side effects before the request reaches Cnerium, those side effects are outside Cnerium’s replay protection.

## Idempotency-Key and external providers

Some external systems, especially payment providers, have their own idempotency mechanism.

When integrating with such systems, keep the model consistent. The Cnerium idempotency key can be passed to the external provider when appropriate, or mapped to a provider-specific key.

The important rule is that the same logical operation should remain traceable across layers:

```txt
client operation key
  -> Cnerium Idempotency-Key
  -> application operation
  -> external provider idempotency key, if used
```

Cnerium protects the backend route. It does not remove the need to use provider-level idempotency when the provider supports it.

## Testing checklist

Use these requests to verify key behavior.

First request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Safe retry:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Unsafe reuse:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Missing key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected behavior:

```txt
first request
  -> handler executes

safe retry
  -> stored response is returned

unsafe reuse
  -> 409 Conflict

missing key
  -> 400 Bad Request
```

## Summary

Use `Idempotency-Key` to identify one logical operation across retries.

Generate the key once. Send it with the durable request. Reuse it only when retrying the same request with the same body. Use a new key for a new operation or a corrected body.

Cnerium uses the key, the operation name, and the request body hash to decide whether to execute the handler, replay a stored response, or reject the request.
