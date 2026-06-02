# DurableResponse

`cnerium::DurableResponse` is the response type returned by Cnerium durable route handlers.

A normal Vix route writes directly to a Vix response object. A Cnerium durable route is different because Cnerium must be able to store the response and return it again later if the client safely retries the same operation.

That is why durable handlers return a response object instead of writing directly to `vix::Response`.

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

The returned `DurableResponse` is used for two things:

```txt
the current HTTP response
the stored response used for safe retries
```

This makes it part of Cnerium’s reliability model, not just a convenience wrapper.

## Header

```cpp
#include <cnerium/cnerium.hpp>
```

or directly:

```cpp
#include <cnerium/http/DurableResponse.hpp>
```

Most applications should include:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Namespace

The concrete type is:

```cpp
cnerium::http::DurableResponse
```

A public alias is available:

```cpp
cnerium::DurableResponse
```

Most application code should use the public alias:

```cpp
return cnerium::DurableResponse::bad_request(
    "Missing required field: product_id");
```

or the response helper functions:

```cpp
return cnerium::created({
    {"ok", true}
});
```

## Purpose

`DurableResponse` exists because Cnerium needs a response that can be persisted.

When a durable route receives a new valid request, the handler runs and returns a `DurableResponse`. Cnerium converts that response into a stored response and writes it back through the Vix response system.

When the same request is retried with the same `Idempotency-Key` and the same body, Cnerium does not execute the handler again. It loads the stored response and writes it through Vix.

The response object must therefore contain enough information to replay the result later:

```txt
HTTP status code
response body
content type
```

## Basic usage

A simple success response can be written with `cnerium::created`:

```cpp
return cnerium::created({
    {"ok", true}
});
```

A validation error can be written with `bad_request`:

```cpp
return cnerium::DurableResponse::bad_request(
    "Missing required field: product_id");
```

A durable handler must always return a `DurableResponse`:

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

## Success responses

For creation-style routes, use a `201 Created` response.

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id},
    {"product_id", product_id},
    {"quantity", quantity}
});
```

This is useful for routes such as:

```txt
POST /orders
POST /payments
POST /invoices
POST /users/register
POST /workflows/start
```

The response should contain the data the client needs if the original response is lost and later replayed.

For example, if an order was created, return the order id:

```json
{
  "ok": true,
  "order_id": "ord_order-123"
}
```

A safe retry should receive the same useful response, not a vague “already processed” message.

## Error responses

Durable handlers can return error responses for validation failures.

```cpp
if (product_id.empty())
{
  return cnerium::DurableResponse::bad_request(
      "Missing required field: product_id");
}
```

Another example:

```cpp
if (quantity <= 0)
{
  return cnerium::DurableResponse::bad_request(
      "Field quantity must be greater than zero");
}
```

The handler still owns application validation. Cnerium owns retry behavior.

If the client corrects the request body after a validation error, it should use a new `Idempotency-Key`, because the corrected body is a new operation attempt.

## JSON responses

Most durable route responses are JSON.

Example:

```cpp
return cnerium::created({
    {"ok", true},
    {"payment_id", payment.id},
    {"status", payment.status}
});
```

The JSON payload should be stable and useful for replay.

A client that retries after a lost response should receive enough information to continue normally. For creation routes, that usually means returning the generated resource id and current status.

## Text responses

If the current API exposes text response helpers, use them for simple text output. In most Cnerium durable routes, JSON is preferred because stored responses are commonly consumed by API clients.

A text response can still be durable if it contains a status code, body, and content type. The important requirement is that Cnerium can store and replay it later.

## Status code

A `DurableResponse` carries an HTTP status code.

Common status codes for durable routes are:

```txt
201 Created
  the operation completed and created a resource or command result

200 OK
  the operation completed and returned a normal success result

400 Bad Request
  the request body or required fields are invalid

409 Conflict
  the idempotency key was reused with a different request body
```

Application handlers usually return `201`, `200`, or `400`.

The `409 Conflict` response is normally produced by Cnerium’s replay protection before the handler runs.

## Content type

A `DurableResponse` also carries a content type.

For JSON responses, the content type should be:

```txt
application/json; charset=utf-8
```

This matters because the stored response must preserve how the result should be written back to the client.

When Cnerium replays a stored response, it should return the same status code, body, and content type as the original durable response.

## Complete order example

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body =
          request.try_json();

      if (!body.has_value())
      {
        return cnerium::DurableResponse::bad_request(
            "Request body must be valid JSON");
      }

      const std::string product_id =
          cnerium::support::string_or(*body, "product_id", "");

      const int quantity =
          cnerium::support::int_or(*body, "quantity", 0);

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

This handler returns a durable response for every application-level result. It does not write directly to a Vix response.

## Relationship with StoredResponse

`DurableResponse` is the response returned by the user handler.

`StoredResponse` is the persisted form used by Cnerium for replay.

The relationship is:

```txt
DurableResponse
  returned by the handler

StoredResponse
  persisted by Cnerium after successful execution

Vix response writer
  writes either the fresh DurableResponse or the replayed StoredResponse
```

Application code normally works with `DurableResponse`. Cnerium converts it internally when it needs to store or replay the result.

## Relationship with Vix Response

A normal Vix route writes directly to `vix::Response`:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true}
  });
});
```

A Cnerium durable route returns `DurableResponse`:

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

This difference is intentional.

A normal Vix response is written once. A durable response may need to be stored and replayed later.

## Replay behavior

When a durable response is returned from a new request, Cnerium stores it.

First request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Example response:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

Safe retry:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Cnerium returns the stored response. The handler does not run again.

That replay behavior is the reason the response must be durable.

## Response design

A durable response should contain what the client needs if the original response was lost.

Good response for an order creation route:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "status": "created"
}
```

Good response for a payment creation route:

```json
{
  "ok": true,
  "payment_id": "pay_123",
  "status": "created"
}
```

Good response for a registration route:

```json
{
  "ok": true,
  "registration_id": "reg_123",
  "status": "pending_verification"
}
```

Avoid returning only:

```json
{
  "ok": true
}
```

That may be enough for a demo, but real clients usually need the created resource id or operation status after a retry.

## Validation response design

For validation failures, return clear messages:

```cpp
return cnerium::DurableResponse::bad_request(
    "Field quantity must be greater than zero");
```

A client can use that message to fix the request.

If the client changes the body, it should use a new idempotency key. The corrected body is a new operation attempt.

## Side effects and response timing

A durable response should be returned after the application operation has completed.

For example:

```txt
validate request
create order
emit optional notification
return DurableResponse
Cnerium stores the response
```

If the handler returns success before the application operation actually completes, Cnerium may store a success response that does not reflect real domain state.

For serious operations, keep the response aligned with the commit point of the application logic.

## Limitations

`DurableResponse` does not replace domain transactions, database constraints, external provider idempotency, or audit logging.

It only gives Cnerium a response object that can be written now and replayed later.

For high-value operations, still use:

```txt
database transactions
unique constraints
domain validation
provider-level idempotency
audit logs
clear status transitions
```

Cnerium gives the route a retry-safe response model. It does not replace the rest of the backend’s correctness model.

## Common mistakes

Do not write directly to `vix::Response` inside a durable handler. Return `DurableResponse`.

Do not return a response that lacks the identifiers the client needs after a retry.

Do not treat a durable response as your domain database. It is the HTTP result of a durable operation.

Do not make the response depend on realtime event delivery. Events are notifications. The durable response is the request result.

Do not assume a safe retry runs the handler again. It should receive the stored response.

## Summary

`cnerium::DurableResponse` is the storable response returned by durable route handlers.

It contains the status code, body, and content type needed to write the current response and replay the same result later. Cnerium stores it after a new durable operation completes and returns it when the same request is retried safely.

Use it for critical write routes where clients need a stable result after retries, timeouts, or lost responses.
