# Replay Protection

Replay protection is the part of Cnerium that decides whether an incoming durable request should execute, return a stored response, or be rejected.

It is closely related to idempotency, but the two ideas are not exactly the same. Idempotency gives a repeated operation a stable identity. Replay protection enforces the rules around that identity so the backend does not accidentally execute an unsafe repeat request.

In practice, replay protection answers one question:

```txt
Is this request safe to process now?
```

For a durable route, Cnerium must answer that question before the user handler runs.

## Why replay protection exists

A backend can receive the same request more than once.

That can happen because a client timed out, a connection was reset, a mobile network dropped, a proxy interrupted the response, or the client retried automatically after not receiving a result.

For critical writes, a repeated request is only safe when it is the same logical operation with the same request body.

This is safe:

```txt
operation: orders.create
Idempotency-Key: order-123
body: {"product_id":"p1","quantity":2}
```

Retried as:

```txt
operation: orders.create
Idempotency-Key: order-123
body: {"product_id":"p1","quantity":2}
```

This is not safe:

```txt
operation: orders.create
Idempotency-Key: order-123
body: {"product_id":"p2","quantity":1}
```

The key is the same, but the payload is different. The backend must not guess what the client intended. It must reject the request.

Replay protection is the mechanism that makes that distinction explicit.

## The durable route decision

When a durable request reaches Cnerium, the handler is not called immediately.

Cnerium first checks the durable state associated with the operation name and the idempotency key.

The result can be one of four actions:

```txt
Execute
Replay
Conflict
Invalid
```

These actions map to clear backend behavior.

`Execute` means the request is new and the handler may run.

`Replay` means the same operation was already completed with the same request body, so Cnerium should return the stored response.

`Conflict` means the same idempotency key was reused with a different request body, so Cnerium should reject the request.

`Invalid` means the request does not contain a usable idempotency key, so Cnerium cannot safely process it as a durable operation.

## Execute

The request should execute when Cnerium has not seen the idempotency key for that operation before.

Example:

```txt
operation: orders.create
Idempotency-Key: order-123
body hash: abc
```

If there is no stored state for this operation and key, Cnerium lets the handler run.

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
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

      return cnerium::created({
          {"ok", true}
      });
    });
```

After the handler returns, Cnerium stores the request hash and the durable response. That stored state is what makes future retries safe.

## Replay

The request should replay when the same operation and idempotency key already exist and the request body hash matches the stored hash.

Example:

```txt
stored:
  operation: orders.create
  key: order-123
  body hash: abc

incoming:
  operation: orders.create
  key: order-123
  body hash: abc
```

This means the incoming request is a retry of the same logical operation.

Cnerium returns the stored response. It does not call the durable handler again.

That behavior matters because the handler may contain side effects:

```txt
create order
reserve inventory
emit realtime event
send email
write audit record
start workflow
```

A safe retry should not repeat those side effects. It should receive the result that was already produced.

## Conflict

The request should fail with a conflict when the idempotency key exists but the request body hash does not match.

Example:

```txt
stored:
  operation: orders.create
  key: order-123
  body hash: abc

incoming:
  operation: orders.create
  key: order-123
  body hash: def
```

This is not a safe retry. The client reused the same key for a different payload.

Cnerium returns:

```txt
HTTP/1.1 409 Conflict
```

A typical response body is:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This is a deliberate failure. It prevents the idempotency key from changing meaning after it has already been used.

## Invalid

The request is invalid when it cannot be evaluated as a durable operation.

The common case is a missing `Idempotency-Key` header.

Example:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

A durable route cannot safely process this request because there is no stable client-provided operation key.

Cnerium rejects it instead of treating it as a normal `POST`.

This is important. If a route is declared durable, the client must participate in the durable protocol by sending an idempotency key.

## Replay protection flow

The full flow looks like this:

```txt
Vix receives the request
Vix matches the route
Cnerium wraps the Vix request as DurableRequest
Cnerium reads the Idempotency-Key
Cnerium computes the request body hash
Cnerium checks stored replay state

if key is missing:
  return 400 Bad Request

if key is new:
  execute handler
  store request hash
  store response
  return response

if key exists and body hash matches:
  return stored response

if key exists and body hash differs:
  return 409 Conflict
```

The durable handler only runs in the new request case.

## Relationship with Idempotency-Key

Replay protection depends on the `Idempotency-Key`, but the key alone is not enough.

The key identifies one logical operation from the client’s point of view. The request body hash verifies that the repeated request is still the same operation.

This is why Cnerium uses both.

```txt
Idempotency-Key
  identifies the operation attempt

request body hash
  protects the key from being reused with a different payload

operation name
  scopes the key to a specific backend action
```

Together, these values make the replay decision reliable enough for critical write routes.

## Relationship with stored responses

Replay protection needs stored responses.

When the safe replay case is detected, Cnerium should not ask the user handler to reconstruct the result. It should return the response that was produced by the original execution.

That response contains:

```txt
status code
body
content type
```

This means a retry can receive the original order id, invoice id, payment result, or workflow id without running the operation again.

A stored response is not just a cache optimization. It is part of the correctness model.

## Replay protection and side effects

Replay protection is most valuable when a handler performs side effects.

For example:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [&cnerium](cnerium::DurableRequest &request)
    {
      const auto body = request.json();
      const std::string order_id = "ord_" + request.idempotency_key_value();

      cnerium.emit(
          "order.created",
          cnerium::support::object({
              {"order_id", cnerium::Json(order_id)}
          })
      );

      return cnerium::created({
          {"ok", true},
          {"order_id", order_id}
      });
    });
```

If the same request is retried safely, Cnerium returns the stored response and does not call the handler again. The `order.created` event is not emitted again by the handler.

This prevents duplicate notifications for a completed operation.

The same principle applies to database writes, external API calls, messages, emails, and workflow starts. Keep the critical side effects inside the durable handler so they are protected by Cnerium’s replay decision.

## What replay protection does not solve

Replay protection is not a replacement for the rest of the backend’s correctness model.

It does not replace database transactions, unique constraints, authorization, validation, stock conflict checks, payment provider rules, or domain-level consistency.

For example, an order route may still need to verify:

```txt
the user is authenticated
the product exists
the stock is available
the quantity is valid
the payment method is allowed
the final database write is transactional
```

Replay protection only answers whether this request should execute as a new operation, replay a stored result, or be rejected as unsafe.

That is a narrow but important responsibility.

## Client behavior

Replay protection works best when clients follow a simple rule:

```txt
One logical operation, one idempotency key.
```

A client should generate a key before sending the durable request. If the request times out or the connection fails, the client should retry with the same key and the same body.

A client should generate a new key when it is submitting a corrected request or starting a genuinely new operation.

For example, if the first request has an invalid quantity and the client wants to correct it, the corrected request should use a new idempotency key. The body has changed, so it is a different operation attempt.

## Testing replay protection

Start the application and send a valid request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Send the same request again:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

The response should be the same.

Now send a different body with the same key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

The response should be:

```txt
HTTP/1.1 409 Conflict
```

This confirms that Cnerium can distinguish a safe retry from unsafe key reuse.

## Summary

Replay protection is the decision layer behind Cnerium durable routes.

It checks the operation name, idempotency key, and request body hash before the durable handler runs. A new request executes the handler. A safe retry returns the stored response. A reused key with a different body returns a conflict. A missing key is rejected.

This is what makes critical Vix backend routes safer under retries, timeouts, and lost responses.
