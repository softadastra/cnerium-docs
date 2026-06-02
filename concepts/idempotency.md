# Idempotency

Idempotency is the rule that lets a backend recognize a repeated request as the same logical operation instead of treating it as a new one.

In Cnerium, idempotency is used by durable routes to make critical `POST` operations safe under retries. The client sends an `Idempotency-Key` header. Cnerium combines that key with the durable operation name and the request body hash. If the same operation is retried with the same key and the same body, Cnerium returns the stored response instead of executing the handler again.

This is the behavior that protects routes such as order creation, payment creation, invoice creation, account registration, stock reservation, and workflow start commands from accidental duplicate execution.

## Why idempotency matters

A backend can complete an operation and still fail to deliver the response.

That is the situation Cnerium is designed for.

```txt
client sends request
server receives request
server creates the order
network connection drops
client never receives the response
```

The client does not know whether the order was created. Retrying is reasonable. The backend, however, must not blindly run the same creation logic again.

Without idempotency, the retry may create a second order.

With idempotency, the backend can say: this is the same logical operation as before, and the correct response is the response already produced by the first execution.

## Idempotency in Cnerium

Cnerium applies idempotency to durable routes.

A durable route is registered with a stable operation name:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);
```

The operation name is part of the idempotency namespace. It prevents unrelated routes from sharing the same idempotency state.

Then the client sends a request with an `Idempotency-Key`:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Cnerium uses three values to identify the request:

```txt
operation name
Idempotency-Key
request body hash
```

For this example, the logical operation is:

```txt
operation: orders.create
key:       order-123
body:      {"product_id":"p1","quantity":2}
```

The body is hashed so Cnerium can detect whether a retry is actually the same request.

## The decision model

When a durable request arrives, Cnerium makes one of four decisions.

```txt
1. The key is missing or invalid
   -> reject the request

2. The key is new
   -> execute the handler and store the response

3. The key exists and the body hash matches
   -> replay the stored response

4. The key exists but the body hash is different
   -> reject the request as a conflict
```

This is the core idempotency behavior.

The handler only runs in the second case, when the request is new and safe to execute.

## First request

The first request uses a new key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Cnerium has not seen this key for `orders.create`, so it executes the durable handler.

The handler may return:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

Cnerium stores the response with the request hash.

The stored response is important because the client may need the exact result later if a retry happens.

## Safe retry

If the client sends the same request again with the same key and the same body, Cnerium treats it as a safe retry:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Cnerium checks the stored hash. It matches the incoming request body hash. The original response is returned.

The handler is not executed again.

That distinction matters. If the handler creates an order, emits an event, sends a notification, or starts a workflow, those side effects should not happen twice for the same logical operation.

## Unsafe key reuse

If the same key is reused with a different body, Cnerium rejects the request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

This is not a retry of the same operation. It is a different payload using an already consumed idempotency key.

Cnerium returns:

```txt
HTTP/1.1 409 Conflict
```

Example body:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This behavior prevents a key from changing meaning over time.

## Missing key

A durable route requires an idempotency key.

If the client sends a request without one:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

Cnerium rejects the request.

A durable route cannot safely process a critical write without an identifier for the logical operation. Without that identifier, Cnerium cannot know whether the request is new or a retry.

## What the key represents

An `Idempotency-Key` represents one logical operation from the client’s point of view.

It is not the same thing as a database id. It is not necessarily the final order id, payment id, invoice id, or user id. It is a client-side operation key used to make retries safe.

A good key should be unique enough for the operation and stable across retries.

For example:

```txt
order-123
checkout-2026-06-02-0001
payment-intent-client-abc
registration-4f8c1a
```

The exact format is up to the client. The important rule is that the same logical operation must reuse the same key when retried.

## Client responsibility

Cnerium can enforce idempotency on the server, but the client must use keys correctly.

Good behavior:

```txt
Generate one key before sending the operation.
Use the same key if the request times out.
Use the same body when retrying the same operation.
Treat a replayed response as the result of the original operation.
Generate a new key for a genuinely new operation.
```

Bad behavior:

```txt
Generate a new key on every retry.
Reuse the same key for different request bodies.
Share keys between unrelated operations.
Omit the key on durable routes.
```

If the client generates a new key for every retry, the server will treat each retry as a new operation. Cnerium cannot connect those requests because the client has changed the identity of the operation.

## Operation names and key scope

The operation name is part of the idempotency scope.

This means the same raw key can be scoped differently depending on the operation:

```txt
orders.create + order-123
payments.create + order-123
```

These should not collide because they represent different backend operations.

This is why operation names must be stable and meaningful.

Good operation names:

```txt
orders.create
payments.create
invoices.create
users.register
subscriptions.create
workflows.start
```

Avoid vague operation names:

```txt
create
submit
post
handler
action
```

A vague name makes stored reliability state harder to understand and increases the chance of collisions or future confusion.

## Stored response replay

Cnerium does not only remember that a key was used. It stores the response produced by the durable handler.

That response contains:

```txt
HTTP status code
response body
content type
```

When a safe retry arrives, Cnerium returns the stored response.

This is different from returning a generic message such as:

```json
{
  "ok": true,
  "already_processed": true
}
```

A generic message may not contain the data the client needs. If the first response contained an order id, invoice id, payment id, or workflow id, the retry should receive that same data.

Stored response replay gives the client a stable result.

## Idempotency and side effects

The most important practical benefit of idempotency is side-effect control.

Inside a durable handler, the application may:

```txt
insert a database row
create a payment intent
reserve inventory
send an email
emit a realtime event
start a workflow
write an audit record
```

Those actions should happen once for one logical operation.

With Cnerium, safe retries return the stored response and do not run the handler again. That prevents duplicate side effects caused by lost responses or client retries.

However, Cnerium only protects the code inside the durable route execution path. If the application performs side effects before the durable route is reached, those side effects are outside Cnerium’s protection.

Keep critical side effects inside the durable handler.

## Idempotency and validation errors

A durable handler may return validation errors.

For example:

```cpp
if (product_id.empty())
{
  return cnerium::DurableResponse::bad_request(
      "Missing required field: product_id");
}
```

The current route behavior should be understood as: the durable route produces a durable response for the request that reached the handler. If the response is stored, retrying the same invalid request with the same key and body may return the same validation response.

That can be useful because the client gets consistent behavior for the same submitted operation. It also means the client should create a new idempotency key when submitting a corrected request body.

This follows the same rule: same key means same logical operation. A corrected body is a different operation attempt and should use a new key.

## Idempotency is not locking

Idempotency is not a general locking system.

It does not replace database transactions, unique constraints, stock reservation rules, or application-level consistency checks. It prevents one class of retry-related duplicate execution by connecting repeated requests to a stored result.

A serious backend may still need:

```txt
database constraints
transactions
application validation
authorization
rate limiting
audit logs
domain-level conflict checks
```

Cnerium does not remove those responsibilities. It adds a retry-safety layer around selected routes.

## Idempotency is not caching

A stored response may look similar to a cache entry, but the purpose is different.

A cache is usually an optimization. It tries to avoid recomputing or refetching data.

Cnerium’s stored response is part of the correctness model. It represents the result of a completed logical operation and is used to make retries safe.

That is why the stored response is tied to:

```txt
operation name
idempotency key
request body hash
```

It should not be treated as a generic HTTP cache.

## Example route

A complete durable order route can look like this:

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

      const std::string order_id =
          "ord_" + request.idempotency_key_value();

      return cnerium::created({
          {"ok", true},
          {"order_id", order_id},
          {"product_id", product_id},
          {"quantity", quantity}
      });
    });
```

The handler does not manually implement idempotency. It only describes what should happen for a new safe request. Cnerium handles the decision before the handler is called.

## Summary

Idempotency in Cnerium means that one logical operation can be safely retried without executing its handler twice.

The client sends an `Idempotency-Key`. Cnerium combines it with the operation name and request body hash. A new key executes the handler. The same key with the same body replays the stored response. The same key with a different body returns a conflict.

This gives critical Vix backend routes a clear retry contract without changing the rest of the application model.
