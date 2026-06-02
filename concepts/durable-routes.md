# Durable Routes

A durable route is a backend route whose execution is protected against unsafe retries.

In Cnerium, durable routes are used for operations that create or change important state. They are not a replacement for normal Vix routes. They exist for the specific cases where executing the same handler twice can produce incorrect application behavior.

A health check does not need to be durable. A product listing does not need to be durable. An order creation endpoint probably does.

```cpp
app.get("/health", health_handler);

cnerium.durable_post(
    "/orders",
    "orders.create",
    create_order);
```

The `GET /health` route remains a normal Vix route. The `POST /orders` route is registered through Cnerium because it represents a critical write operation.

## What a durable route changes

A normal route handler runs when the route matches.

A durable route handler only runs when Cnerium decides that the request represents a new, safe operation.

Before the user handler is called, Cnerium checks the incoming request against its reliability state. It reads the `Idempotency-Key`, computes a stable hash of the request body, and checks whether this operation has already been completed.

The possible outcomes are:

```txt
execute the handler
replay a stored response
reject the request as invalid
reject the request as a conflict
```

That decision happens before application logic runs.

This is the main difference between a normal route and a durable route.

## Basic example

A minimal durable route looks like this:

```cpp
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
```

The route has three important parts:

```txt
/orders
  the HTTP path

orders.create
  the stable operation name

handler
  the application logic to run for a new safe request
```

The path belongs to the HTTP API. The operation name belongs to the reliability model. The handler belongs to application code.

## Operation names

Every durable route needs a stable operation name.

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

The operation name tells Cnerium what logical backend operation this route represents. It is used when building storage keys for request hashes and stored responses.

A good operation name should be stable, explicit, and specific enough to avoid collisions:

```txt
orders.create
payments.create
invoices.create
users.register
subscriptions.create
workflows.start
```

Avoid names that are too generic:

```txt
create
post
submit
handler
route
```

A durable route’s operation name is part of the route’s long-term behavior. Changing it changes the idempotency namespace used by Cnerium. In production, treat operation names carefully.

## Idempotency-Key requirement

Durable routes require an `Idempotency-Key` header.

A client should generate one idempotency key for one logical operation and reuse that same key when retrying the same request.

Example:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

If the key is missing, Cnerium rejects the request. A durable route cannot safely process a critical write without knowing whether the request is new or a retry.

The key is not a database id. It is a client-provided identity for one logical request attempt.

Good client behavior:

```txt
create one key for the operation
send the request
if the response is lost, retry with the same key and same body
do not reuse the same key for a different body
```

## Request body hashing

The idempotency key identifies the logical operation, but it is not enough by itself.

A client could accidentally reuse the same key with a different request body. If the backend accepted that, the meaning of the key would become ambiguous.

Cnerium prevents that by hashing the request body.

The safe retry case is:

```txt
Idempotency-Key: order-123
body: {"product_id":"p1","quantity":2}
```

Then the client retries:

```txt
Idempotency-Key: order-123
body: {"product_id":"p1","quantity":2}
```

The key matches. The request body hash matches. Cnerium can replay the stored response.

The unsafe case is:

```txt
Idempotency-Key: order-123
body: {"product_id":"p2","quantity":1}
```

The key matches, but the request body hash does not. Cnerium returns `409 Conflict`.

This makes accidental key reuse visible instead of silently creating incorrect state.

## Stored responses

When a durable route handler returns successfully, Cnerium stores the response.

The stored response contains:

```txt
status code
response body
content type
```

This stored response is used when a safe retry arrives.

For example, the first request may return:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

If the same request is retried with the same key and the same body, Cnerium returns that stored response instead of running the handler again.

This is important because the client usually needs the original result, not just a message saying the operation was already processed.

## Execution flow

A durable route follows this flow:

```txt
Vix receives the HTTP request
Vix matches the route
Cnerium wraps the request as DurableRequest
Cnerium reads the Idempotency-Key
Cnerium computes the request body hash
Cnerium checks the stored reliability state
Cnerium either executes the handler, replays a response, or rejects the request
Vix writes the final HTTP response
```

The HTTP server and router remain Vix responsibilities. Cnerium only adds the reliability decision around the selected route.

## Handler execution

The durable handler is written for the “new safe request” case.

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

The handler does not need to manually check whether the request is a retry. That belongs to Cnerium.

The handler should validate application input, perform the operation, and return a durable response.

## DurableRequest

A durable handler receives a `cnerium::DurableRequest`.

This type is a Cnerium wrapper around the underlying Vix HTTP request. It exposes the request data needed by durable handlers and adds reliability-specific helpers.

Common usage:

```cpp
const auto body = request.json();

const std::string key = request.idempotency_key_value();
const auto hash = request.request_hash();
```

A durable handler should use `DurableRequest` when it needs request data such as the body, headers, path parameters, query parameters, or idempotency key.

For normal Vix routes, use `vix::Request`. For durable Cnerium routes, use `cnerium::DurableRequest`.

## DurableResponse

A durable handler returns a `cnerium::DurableResponse`.

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id}
});
```

Cnerium uses this response for two things:

```txt
write the response to the current HTTP request
store the response for future safe retries
```

That is why durable handlers do not write directly to `vix::Response`. Cnerium needs a response object it can convert to a stored response before passing it back through the Vix response writer.

## Testing a durable route

After running the application, send the first request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected result:

```txt
HTTP/1.1 201 Created
```

Retry the same request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected result:

```txt
HTTP/1.1 201 Created
```

The response should be the same as the first one.

Now reuse the same key with a different body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Expected result:

```txt
HTTP/1.1 409 Conflict
```

This confirms that the route distinguishes a safe retry from unsafe key reuse.

## When to use durable routes

Use durable routes for operations where repeating the handler could create incorrect state.

Good candidates:

```txt
create order
create payment intent
create invoice
register user
reserve stock
start workflow
submit critical form
send critical notification
```

These operations have one thing in common: if the response is lost and the client retries, the backend must not blindly perform the operation again.

A durable route gives the operation a retry contract.

## When not to use durable routes

Do not use durable routes for ordinary read endpoints.

Normal Vix routes are better for:

```txt
GET /health
GET /status
GET /products
GET /orders/{id}
GET /assets/app.css
```

Those routes do not need idempotency keys, request body hashes, stored response replay, or conflict detection.

A backend should not make everything durable by default. Use durable routes where the extra reliability semantics are worth it.

## Durable routes and side effects

A durable handler should be written with side effects in mind.

If the handler sends an email, emits a realtime event, writes a database row, creates a payment, or starts a workflow, remember that the handler is expected to run only for a new safe request. Safe retries should receive the stored response and should not execute the handler again.

That is one of the main reasons durable routes are useful. They make it easier to avoid duplicate side effects caused by retries.

However, Cnerium can only protect side effects that happen inside the durable handler after the reliability check. If application code performs side effects before the durable route logic starts, those side effects are outside Cnerium’s protection.

Keep critical side effects inside the durable handler.

## Durable routes and realtime events

A durable route can emit realtime events after completing the operation:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    })
);
```

If the same request is retried and replayed from storage, the handler is not executed again, so the event is not emitted again by the handler.

This avoids duplicate realtime notifications for the same completed operation.

The event is still only a notification. The durable response remains the result of the operation.

## Summary

A durable route is a Vix route protected by Cnerium.

Vix handles the HTTP application model. Cnerium adds a reliability decision before the handler runs. If the request is new, the handler executes and the response is stored. If the request is a safe retry, the stored response is returned. If the idempotency key is reused with a different body, the request is rejected.

Use durable routes for critical write operations, not for every endpoint.
