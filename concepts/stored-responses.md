# Stored Responses

Stored responses are the reason a durable route can return the same result after a retry without executing the handler again.

When a Cnerium durable route processes a new request, it stores the response produced by the handler. If the client later retries the same operation with the same `Idempotency-Key` and the same request body, Cnerium returns that stored response.

This is not a cache optimization. It is part of the correctness model for durable routes.

A retry should not only avoid duplicate execution. It should also give the client the result of the original completed operation.

## Why stored responses matter

Consider an order creation route:

```txt
POST /orders
```

The first request creates an order and returns:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

Now imagine the server created the order, but the network connection dropped before the client received the response. The client does not know whether the request succeeded. Retrying is the correct client behavior.

If the backend only remembered that the key was already used, it could return something like:

```json
{
  "already_processed": true
}
```

That is not enough. The client still needs the `order_id` that was produced by the original execution.

Cnerium stores the original response so the retry receives the same result:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

That is why durable routes store responses, not just idempotency keys.

## What is stored

A stored response contains the minimal HTTP response data needed for replay:

```txt
status code
response body
content type
```

In Cnerium, a durable handler returns a `cnerium::DurableResponse`:

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id},
    {"product_id", product_id},
    {"quantity", quantity}
});
```

Cnerium converts that durable response into a stored response after the handler completes. Later, if a safe retry arrives, Cnerium converts the stored response back into an HTTP response and writes it through Vix.

The application does not need to manually store the response.

## Stored response flow

The flow for a new durable request is:

```txt
client sends request
Vix receives the request
Cnerium checks the Idempotency-Key and request body hash
Cnerium sees this is a new operation
Cnerium executes the durable handler
handler returns DurableResponse
Cnerium stores the request hash
Cnerium stores the response
Vix writes the response to the client
```

The flow for a safe retry is different:

```txt
client retries the same request
Vix receives the request
Cnerium checks the Idempotency-Key and request body hash
Cnerium sees the same operation already completed
Cnerium loads the stored response
Vix writes the stored response to the client
handler is not executed again
```

The last line is important. Stored response replay is what prevents duplicate handler side effects.

## Example

A durable order route may look like this:

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

On the first valid request, the handler runs and returns a response. Cnerium stores that response.

On a safe retry, Cnerium returns the stored response and does not call the handler again.

## Replay example

First request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Example response:

```txt
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
```

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

Retry with the same key and same body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

The response should be the same. The durable handler should not run again.

This behavior gives the client a stable result even if the original response was lost.

## Stored responses and conflicts

A stored response is only replayed when the incoming request body hash matches the stored request hash.

This is safe:

```txt
operation: orders.create
key: order-123
body: {"product_id":"p1","quantity":2}
```

Retried with:

```txt
operation: orders.create
key: order-123
body: {"product_id":"p1","quantity":2}
```

Cnerium can return the stored response.

This is not safe:

```txt
operation: orders.create
key: order-123
body: {"product_id":"p2","quantity":1}
```

The same idempotency key now points to a different request body. Cnerium must not return the stored response for the previous body, and it must not execute the handler as if this were a new operation. It returns `409 Conflict`.

That conflict protects the meaning of the original stored response.

## Stored responses and side effects

Stored responses are especially important when durable handlers perform side effects.

A handler may:

```txt
insert a database row
create a payment intent
reserve inventory
emit a realtime event
send an email
start a workflow
write an audit record
```

Those effects should happen once for one logical operation.

When a safe retry returns the stored response, the handler is not called again. That means the side effects inside the handler are not repeated.

For example:

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

If the same request is replayed from storage, `order.created` is not emitted again by the handler. The stored response is returned instead.

This is one of the practical reasons stored responses exist.

## Stored responses are not HTTP caching

Stored responses may look similar to cached HTTP responses, but the purpose is different.

A normal cache is usually an optimization. It tries to avoid repeated work for performance.

A Cnerium stored response is part of durable route correctness. It exists because a completed operation may need to be reported again after the original response was lost.

The stored response is tied to:

```txt
operation name
idempotency key
request body hash
```

It should not be treated as a generic cache entry for an endpoint.

## Stored responses are not a database model

A stored response is not the same as the domain data created by the operation.

For an order route, the stored response is not the order database. It is the HTTP result of a specific durable request.

The application may still store the order in its own database, call external services, update inventory, or write domain events. Cnerium only stores enough response data to replay the result of the durable route safely.

This separation matters:

```txt
application database
  stores domain state

Cnerium stored response
  stores the HTTP response for a durable operation retry
```

Do not use stored responses as a substitute for your application’s real data model.

## Storage keys

Cnerium stores responses under internal keys derived from the operation name and idempotency key.

Conceptually:

```txt
cnerium:response:<operation>:<key>
```

For example:

```txt
cnerium:response:orders.create:order-123
```

Cnerium also stores request hash metadata so it can decide whether a later request is a safe replay or an unsafe conflict.

Applications should normally not build these keys manually. They are part of Cnerium’s internal reliability layer.

## Storage backend

Cnerium stores framework metadata through its store layer, backed by the public Softadastra SDK.

The application works with durable routes and durable responses. Cnerium handles the storage details behind those APIs.

The dependency relationship remains:

```txt
application code
  -> Cnerium durable route
      -> Cnerium store
          -> Softadastra SDK
```

The application should not need to know where or how a stored response is persisted in order to use durable route replay.

## What should be stored

A durable response should contain the result the client needs if the operation has to be replayed later.

For example, a creation route should usually return the generated id:

```json
{
  "ok": true,
  "order_id": "ord_order-123"
}
```

A payment route may return the payment intent id or status:

```json
{
  "ok": true,
  "payment_id": "pay_123",
  "status": "created"
}
```

An invoice route may return the invoice id:

```json
{
  "ok": true,
  "invoice_id": "inv_123"
}
```

A stored response should be useful to the client without requiring the handler to execute again.

## Validation responses

A durable route may return validation errors.

For example:

```cpp
if (quantity <= 0)
{
  return cnerium::DurableResponse::bad_request(
      "Field quantity must be greater than zero");
}
```

If Cnerium stores that response, retrying the same invalid request with the same key and body may return the same validation error.

That is consistent with the durable route model: same key and same body means the same logical operation attempt.

If the client corrects the body, it should use a new idempotency key. A corrected body is not the same operation attempt.

## Failure considerations

A durable route is only as reliable as the commit point around its operation and stored response.

In a simple example, the handler returns a response and Cnerium stores it afterward. In a production system, the application must still think carefully about the relationship between domain writes and stored response commits.

For example, if a handler writes to a database and then the process crashes before the response is stored, the system may have domain state without a replayable response. Cnerium’s stored response model reduces retry ambiguity, but it does not remove the need for transactional thinking in the application’s domain layer.

For high-value operations such as payments or financial writes, combine Cnerium with database transactions, unique constraints, provider idempotency, and audit logs.

Cnerium gives the route a retry-safety layer. It does not replace all domain correctness mechanisms.

## Summary

Stored responses let Cnerium return the result of a completed durable operation without executing the handler again.

They preserve the HTTP status code, response body, and content type produced by the original handler. When the same request is retried with the same idempotency key and same body, Cnerium returns that stored response. When the same key is reused with a different body, Cnerium rejects the request.

This is what makes durable routes useful after timeouts, lost responses, unstable networks, and client retries.
