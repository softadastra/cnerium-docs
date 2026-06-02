# Why Cnerium Exists

Cnerium exists because ordinary backend request handling is not enough for some operations.

A web backend can receive a request, execute the handler, change state, and still fail to deliver the response to the client. From the server’s point of view, the operation succeeded. From the client’s point of view, the request failed or timed out. When the client retries, the backend must decide whether this is a new operation or the same operation being retried.

Many systems do not make that distinction explicitly. They receive the second request and execute the handler again.

For read-only endpoints, that is usually fine. For write operations, it can corrupt application behavior.

## The failure window

Consider an order creation endpoint:

```txt
POST /orders
```

The client sends:

```json
{
  "product_id": "p1",
  "quantity": 2
}
```

A normal backend flow looks simple:

```txt
client sends request
server receives request
server creates order
server returns response
client receives response
```

The dangerous case happens between the server completing the operation and the client receiving the response:

```txt
client sends request
server receives request
server creates order
network connection drops
client never receives response
```

At this point, the system has two different truths.

The server knows the order was created. The client does not know whether the order was created, rejected, or never processed. Retrying is reasonable from the client side, but unsafe on the server side unless the backend has a reliability rule.

Without that rule, the retry may create a second order.

## Why retry behavior matters

Retries are not a rare edge case. They are a normal part of distributed systems.

They can happen because of network timeouts, mobile connectivity, reverse proxy timeouts, browser retries, API client retries, process restarts, connection resets, or responses lost after the server already completed the operation.

A backend that accepts write requests must be able to answer this question:

```txt
Have I already completed this logical operation?
```

If the backend cannot answer that question, retrying a critical write is dangerous.

This is why Cnerium treats selected write operations as durable operations rather than ordinary request handlers.

## The duplicate write problem

The most visible failure is duplicate creation.

A user clicks “Pay”, the payment request reaches the server, the server creates a payment intent, but the response is lost. The frontend retries. If the backend treats the retry as a new request, the user may now have two payment intents.

The same pattern appears in many domains:

```txt
orders
payments
invoices
registrations
stock reservations
workflow starts
message delivery
critical notifications
```

The details change, but the failure shape is the same. A client repeats a request because it did not receive a response. The server may repeat an operation because it does not remember that the first request already completed.

Cnerium is designed to make that class of bug harder to create.

## Why normal HTTP semantics are not enough

HTTP methods have semantic meaning, but they do not automatically give an application durable execution behavior.

A `GET` request is expected to be safe and repeatable. A `PUT` request is often designed to be idempotent by resource identity. A `POST` request is commonly used for creating new work, starting a process, submitting a form, creating an order, or initiating a payment. Those operations often need application-level idempotency.

The server must connect the retry to the original logical operation.

That requires more than route matching. It requires a stable operation name, an idempotency key, a deterministic request body hash, and a stored response that can be returned later.

Cnerium provides that structure for Vix backends.

## The Cnerium rule

Cnerium uses an explicit `Idempotency-Key` header on durable routes.

The client generates one key for one logical operation and sends it with the request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Cnerium combines:

```txt
operation name
Idempotency-Key
request body hash
```

The operation name separates different backend actions. The idempotency key identifies one logical request from the client. The request body hash prevents the same key from being reused for a different operation payload.

The result is a clear decision model:

```txt
missing Idempotency-Key
  -> 400 Bad Request

new Idempotency-Key
  -> execute the handler and store the response

same Idempotency-Key with the same request body
  -> return the stored response

same Idempotency-Key with a different request body
  -> 409 Conflict
```

This is the foundation of Cnerium.

## Why stored responses matter

It is not enough to simply remember that a key was used.

If a client retries after a timeout, it still needs the result of the operation. The best response is not “already processed”. The best response is the same response the client would have received if the network had not failed.

That is why Cnerium stores the response produced by the durable handler.

A stored response contains:

```txt
status code
body
content type
```

If the same request is retried safely, Cnerium returns the stored response without executing the handler again.

This keeps the client experience consistent. The client can retry and still receive the order id, invoice id, or payment result that was produced by the original successful request.

## Why the request body is hashed

The `Idempotency-Key` identifies a logical operation, but a key can be misused.

For example, this request is valid:

```txt
Idempotency-Key: order-123
body: {"product_id":"p1","quantity":2}
```

Retrying the exact same body with the exact same key is safe.

This is not safe:

```txt
Idempotency-Key: order-123
body: {"product_id":"p2","quantity":1}
```

The key now points to a different operation. If the backend accepted it, the meaning of `order-123` would be ambiguous. Cnerium rejects that case with `409 Conflict`.

Hashing the body lets Cnerium detect this misuse without storing or comparing every request body directly as part of the decision.

## Why this belongs in Cnerium, not in every route handler

A developer can implement idempotency manually in every critical route. In practice, that leads to repeated logic, incomplete edge case handling, inconsistent storage keys, inconsistent error responses, and different retry behavior between endpoints.

Cnerium centralizes the reliability rule.

The route handler remains focused on application logic:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body = request.json();

      const std::string product_id =
          cnerium::support::string_or(body, "product_id", "");

      const int quantity =
          cnerium::support::int_or(body, "quantity", 0);

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

The handler describes how to process a new safe request. Cnerium decides whether the handler should run at all.

That separation is the point.

## Why Cnerium attaches to Vix

Vix already owns the backend application model.

It provides `vix::App`, routing, middleware, HTTP request and response handling, the runtime executor, WebSocket support, build workflow, development workflow, and production workflow. Cnerium does not need to recreate any of that.

Instead, Cnerium attaches to an existing Vix application:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Then it registers durable routes into that app:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

This keeps Vix as the foundation and makes Cnerium a reliability layer, not a competing framework.

A developer who understands Vix should be able to understand Cnerium as an addition to the same model.

## Why Softadastra is involved

Cnerium needs durable storage for request hashes, stored responses, and framework metadata. That storage must survive the request, the connection, and ideally process restarts.

The Softadastra SDK provides the durable foundation used by Cnerium. Cnerium does not expose Softadastra internals as its application API. It uses the SDK behind a small store facade so durable route behavior can be expressed at the application level.

The dependency direction is:

```txt
application code
  -> Vix
  -> Cnerium
      -> Softadastra SDK
```

The application should not need to know how the SDK stores a response in order to use a durable route.

## What Cnerium deliberately avoids

Cnerium is intentionally narrow.

It does not try to become the place where every backend concept is documented or reinvented. It does not replace Vix routing, middleware, WebSocket, templates, database, ORM, CLI, deployment, or project templates.

That is a design boundary, not a missing feature.

The purpose of Cnerium is to make selected backend operations reliable under retry conditions. It exists because those operations need a stronger execution contract than ordinary request handling gives them.

## The practical result

With Cnerium, a critical write endpoint has a clear retry contract.

The client sends one idempotency key for one logical operation. The server executes the handler only once for that key and body. If the response is lost and the client retries, the server returns the stored response. If the key is reused incorrectly with a different body, the server rejects it.

That is the reason Cnerium exists.

It gives Vix backends a focused reliability layer for the part of backend development where accidental duplication is most dangerous.
