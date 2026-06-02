# Durable Orders

This example shows a small Vix backend with one Cnerium durable route for order creation.

The goal is to demonstrate the core Cnerium behavior without introducing a large application structure. The backend has one normal Vix route and one durable Cnerium route:

```txt
GET /health
POST /orders
```

`GET /health` is a normal Vix route. It can be called repeatedly without changing state.

`POST /orders` is a durable route. It creates a logical order operation and must be safe when the client retries the same request after a timeout or lost response.

## What this example proves

This example proves four things:

```txt
A new durable request executes the handler.
A retry with the same Idempotency-Key and same body returns the stored response.
A retry with the same Idempotency-Key and a different body returns 409 Conflict.
A missing Idempotency-Key is rejected.
```

The example also reinforces the Cnerium architecture boundary:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Vix owns the backend. Cnerium attaches to the Vix app and protects selected write operations.

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
        {"service", "durable-orders"}
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

        const std::string order_id =
            "ord_" + request.idempotency_key_value();

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

This is intentionally small. In a real application, the handler would usually call a service, write to a database, reserve inventory, or create a domain event. The reliability behavior remains the same.

## Route structure

The health route is ordinary Vix code:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true},
      {"service", "durable-orders"}
  });
});
```

Cnerium is not involved because this route does not need durable execution.

The order route is different:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

It is a `POST` route that creates state. If the client retries after a timeout, the backend must not accidentally create another order.

That is why this route is registered through Cnerium.

## Operation name

The durable route uses the operation name:

```txt
orders.create
```

The operation name is part of the idempotency scope. Cnerium uses it together with the `Idempotency-Key` and the request body hash.

A stable operation name makes the route behavior explicit. In a larger backend, you may have operations such as:

```txt
orders.create
payments.create
invoices.create
users.register
```

These operations should not share the same idempotency namespace.

## Request body

The route expects a JSON body:

```json
{
  "product_id": "p1",
  "quantity": 2
}
```

The handler reads it with:

```cpp
const auto body = request.json();
```

Then extracts fields:

```cpp
const std::string product_id = cnerium::support::string_or(body, "product_id", "");
const int quantity = cnerium::support::int_or(body, "quantity", 0);
```

The example keeps validation simple and visible.

## Validation

The route rejects missing or invalid fields:

```cpp
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
```

Cnerium handles retry safety. The application still handles domain validation.

A durable route does not remove the need to validate input. It only changes the execution contract around retries.

## Response

For a valid order request, the route returns:

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id},
    {"product_id", product_id},
    {"quantity", quantity}
});
```

The response is a `cnerium::DurableResponse`.

Cnerium can store this response and replay it later if the client retries the same operation with the same key and body.

## Run the example

Build and run the backend.

For a standalone Vix project:

```bash
vix build
vix run
```

Inside the Cnerium repository, if examples are enabled:

```bash
vix build --build-target all -v -- -DCNERIUM_BUILD_EXAMPLES=ON
./build-ninja/cnerium_durable_orders_realtime
```

The server should listen on the configured HTTP port. Local examples usually use `8080`.

## First request

Send a valid request with an `Idempotency-Key`:

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

This is the first request for the `orders.create` operation with the key `order-123`. Cnerium executes the handler, stores the request hash, stores the response, and returns the result.

## Safe retry

Send the same request again with the same key and the same body:

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

The important behavior is that the handler should not execute again. Cnerium returns the stored response because this is a safe retry of the same logical operation.

## Unsafe key reuse

Now reuse the same key with a different body:

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

This is not a safe retry. The key already belongs to a previous body. Cnerium rejects the request instead of executing the handler or replaying the wrong response.

## Missing key

A durable route requires an `Idempotency-Key`.

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected response:

```txt
HTTP/1.1 400 Bad Request
```

Without a key, Cnerium cannot identify the logical operation. The route cannot safely decide whether the request is new or a retry.

## Why the handler should not run twice

The example creates a deterministic order id from the idempotency key:

```cpp
const std::string order_id =
    "ord_" + request.idempotency_key_value();
```

This keeps the demo simple, but the real point is handler execution.

In a real service, the handler might insert a database row, reserve stock, create a payment intent, send an email, or emit a realtime event. Those actions should not happen twice because a client retried after losing the response.

Cnerium prevents the durable handler from running again for a safe retry.

## Add a service layer

For a slightly more realistic structure, move the order creation logic into a function:

```cpp
struct Order
{
  std::string id;
  std::string product_id;
  int quantity{};
};

Order create_order(
    const std::string &idempotency_key,
    const std::string &product_id,
    int quantity)
{
  return Order{
      "ord_" + idempotency_key,
      product_id,
      quantity};
}
```

Then call it inside the durable handler:

```cpp
const Order order = create_order(request.idempotency_key_value(),
        product_id,
        quantity);

return cnerium::created({
    {"ok", true},
    {"order_id", order.id},
    {"product_id", order.product_id},
    {"quantity", order.quantity}
});
```

Cnerium still decides whether the handler should execute. The service only runs for a new safe request.

## Complete example with service function

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>

struct Order
{
  std::string id;
  std::string product_id;
  int quantity{};
};

Order create_order(
    const std::string &idempotency_key,
    const std::string &product_id,
    int quantity)
{
  return Order{
      "ord_" + idempotency_key,
      product_id,
      quantity};
}

int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true},
        {"service", "durable-orders"}
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

        const Order order =
            create_order(
                request.idempotency_key_value(),
                product_id,
                quantity);

        return cnerium::created({
            {"ok", true},
            {"order_id", order.id},
            {"product_id", order.product_id},
            {"quantity", order.quantity}
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

This shape is closer to how real projects should grow: the route handles HTTP-level parsing and validation, while the service owns the domain action.

## What to check

When this example is working correctly, these behaviors should be true:

```txt
POST /orders without Idempotency-Key
  returns 400 Bad Request

POST /orders with a new key and valid body
  returns 201 Created

POST /orders with the same key and same body
  returns the same stored response

POST /orders with the same key and different body
  returns 409 Conflict
```

If the second request executes the handler again, the durable route is not replaying correctly. Check that the same key and exactly the same body are being sent.

If the conflict test does not return `409`, make sure the route was registered with `cnerium.durable_post`, not `app.post`.

## Summary

The durable orders example is the smallest useful Cnerium backend pattern.

It keeps Vix as the application owner, attaches Cnerium, registers a normal health route with Vix, and registers a critical order creation route with `cnerium.durable_post`.

The value is not the order example itself. The value is the durable behavior: safe retries replay the stored response, unsafe retries are rejected, and the handler is not executed twice for the same completed operation.
