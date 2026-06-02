# Handle Unsafe Retries

This guide explains how Cnerium handles unsafe retries and how an application should respond to them.

A retry is safe only when it represents the same logical operation with the same `Idempotency-Key` and the same request body. If the same key is reused with a different body, Cnerium treats the request as unsafe and rejects it with `409 Conflict`.

That behavior is intentional. It prevents a key from changing meaning after it has already been used.

## The retry problem

A client may retry a request because it did not receive a response.

That can happen after a timeout, a dropped connection, a mobile network interruption, a proxy failure, or a server response that was lost after the operation completed.

For a durable route, this is safe:

```txt
first request:
  operation: orders.create
  Idempotency-Key: order-123
  body: {"product_id":"p1","quantity":2}

retry:
  operation: orders.create
  Idempotency-Key: order-123
  body: {"product_id":"p1","quantity":2}
```

The key is the same. The body is the same. Cnerium can return the stored response.

This is not safe:

```txt
first request:
  operation: orders.create
  Idempotency-Key: order-123
  body: {"product_id":"p1","quantity":2}

second request:
  operation: orders.create
  Idempotency-Key: order-123
  body: {"product_id":"p2","quantity":1}
```

The key is the same, but the body is different. That is not a retry of the same operation. Cnerium rejects it.

## What Cnerium checks

For every durable request, Cnerium checks three values:

```txt
operation name
Idempotency-Key
request body hash
```

The operation name scopes the durable route. The idempotency key identifies one logical operation attempt. The request body hash verifies that a repeated key still refers to the same submitted payload.

A safe retry must match all three.

If the operation name and key match but the body hash is different, Cnerium cannot safely replay the previous response and cannot safely execute the handler as a new operation. The only correct behavior is to reject the request.

## Unsafe retry response

When a key is reused with a different body, Cnerium returns:

```txt
HTTP/1.1 409 Conflict
```

A typical response body is:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This is not an internal server error. It is a client-side protocol error. The client reused an existing key for a different operation body.

## Test unsafe retry behavior

Start the application and send the first request:

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

The second request is rejected before the durable handler runs.

## Why not execute the handler

When Cnerium sees the same key with a different body, executing the handler would be unsafe.

The key already represents a previous logical operation. If Cnerium allowed the handler to run again with a different payload, the backend would no longer have a stable meaning for that key.

For example, this key:

```txt
order-123
```

would first mean:

```txt
create order for product p1, quantity 2
```

and later mean:

```txt
create order for product p2, quantity 1
```

That breaks the idempotency contract. A key must not change meaning after it has been used.

## Why not replay the stored response

Cnerium also cannot replay the stored response when the body is different.

The stored response belongs to the original request body. Returning it for a different body would mislead the client.

For example, the stored response may say:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

If the client now submitted:

```json
{
  "product_id": "p2",
  "quantity": 1
}
```

then replaying the previous response would be incorrect. The response belongs to a different payload.

That is why the correct response is `409 Conflict`.

## Missing Idempotency-Key

An unsafe retry is not the same as a missing key, but both are invalid for a durable route.

A missing key means Cnerium cannot identify the logical operation:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected result:

```txt
HTTP/1.1 400 Bad Request
```

A reused key with a different body means Cnerium can identify the previous operation, but the new request does not match it:

```txt
HTTP/1.1 409 Conflict
```

These responses mean different things.

```txt
400 Bad Request
  the durable request is missing required retry metadata

409 Conflict
  the idempotency key was already used for a different body
```

## Client behavior after 409 Conflict

When a client receives `409 Conflict` from a durable route, it should not keep retrying the same changed request with the same key.

The client should inspect the request it sent.

If the user is correcting a previous form submission, the corrected request should use a new idempotency key.

For example:

```txt
first request:
  Idempotency-Key: order-123
  body: {"product_id":"p1","quantity":0}

corrected request:
  Idempotency-Key: order-124
  body: {"product_id":"p1","quantity":2}
```

The body changed, so the corrected request is a new operation attempt.

If the client intended to retry the original operation, it should retry with the original body.

## Good client retry logic

A client should store the operation body together with the idempotency key while the operation is pending.

Conceptually:

```txt
pending operation:
  method: POST
  path: /orders
  idempotency_key: order-123
  body: {"product_id":"p1","quantity":2}
```

If the request times out, the client retries the exact same pending operation:

```txt
same method
same path
same idempotency key
same body
```

If the user changes the form after an error, the client creates a new pending operation with a new key.

This simple rule avoids unsafe retries.

## Server-side behavior

Application code does not need to manually check for unsafe retries inside the durable handler.

For example:

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

The handler is written for a new safe request. If Cnerium detects unsafe key reuse, this handler is not called.

That is the point of putting replay protection outside application logic.

## Validation errors and corrected requests

A validation error can be returned by a durable route:

```cpp
if (quantity <= 0)
{
  return cnerium::DurableResponse::bad_request(
      "Field quantity must be greater than zero");
}
```

If the client retries the same invalid body with the same key, Cnerium may return the same durable response.

If the client changes the body to fix the error, it should use a new key.

This may feel strict, but it keeps the model clear:

```txt
same key + same body
  same operation attempt

new body
  new operation attempt
```

A corrected request is not the same submitted operation. It is a new attempt.

## Unsafe retries and side effects

Unsafe retries are rejected before the handler runs.

That means side effects inside the durable handler are not repeated in the conflict case.

For example, if the handler creates an order and emits an event:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [&cnerium](cnerium::DurableRequest &request)
    {
      const std::string order_id = "ord_" + request.idempotency_key_value();

      cnerium.emit(
          "order.created",
          cnerium::support::object({
              {"order_id", cnerium::Json(order_id)}
          }));

      return cnerium::created({
          {"ok", true},
          {"order_id", order_id}
      });
    });
```

A reused key with a different body will not create another order and will not emit `order.created` from that handler.

This is the safety benefit of replay protection.

## Logging unsafe retries

In production, unsafe retries are useful signals.

They can indicate a client bug, an incorrect retry strategy, a frontend state issue, or an integration that is generating keys incorrectly.

A backend may choose to log conflicts at the application boundary.

For example, a service can record:

```txt
operation name
idempotency key
request path
client id
status code
```

Avoid logging sensitive request bodies directly. If body comparison is needed, use hashes or sanitized fields.

Cnerium handles the protocol response. Application observability should help you understand why conflicts happen.

## Do not hide conflicts

A `409 Conflict` should not be silently converted into success.

If the same key is reused with a different body, the client needs to know that the request is invalid under the durable route contract.

Hiding the conflict makes debugging harder and can cause the client to believe that a changed request succeeded when it was actually rejected.

Let the conflict remain visible.

## Complete example

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>

int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true},
        {"service", "orders"}
    });
  });

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

        const std::string order_id = "ord_" + request.idempotency_key_value();

        return cnerium::created({
            {"ok", true},
            {"order_id", order_id},
            {"product_id", product_id},
            {"quantity", quantity}
        });
      });

  if (!cnerium.start())
  {
    return 1;
  }

  app.run();

  return 0;
}
```

Test it with:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'

curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

The first request should create the response. The second request should return `409 Conflict`.

## Summary

An unsafe retry happens when the same `Idempotency-Key` is reused with a different request body for the same durable operation.

Cnerium rejects that case with `409 Conflict`. It does not execute the handler and does not replay the previous response. This keeps idempotency keys stable, prevents ambiguous operations, and protects critical write routes from accidental duplicate or changed execution.
