# Create a Durable POST Route

This guide shows how to create a durable `POST` route with Cnerium.

A durable route is used when a backend operation must be safe under retries. The common case is a route that creates or changes important state, such as an order, payment, invoice, registration, stock reservation, or workflow command.

The route is still hosted by Vix. Cnerium only adds the reliability layer around the selected handler.

## Starting point

Start with a normal Vix application and attach Cnerium.

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true}
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

The application is still a Vix backend. Cnerium is attached to the `vix::App` so it can register durable routes into the same application.

## Add the route

A durable `POST` route is registered with `durable_post`:

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

The route has three parts.

The first argument is the HTTP path:

```txt
/orders
```

The second argument is the stable operation name:

```txt
orders.create
```

The third argument is the durable handler.

The path belongs to the HTTP API. The operation name belongs to Cnerium’s reliability model. The handler contains the application logic that should run only for a new safe request.

## Why the operation name matters

The operation name scopes the idempotency state for the route.

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    handler);
```

Cnerium uses the operation name together with the `Idempotency-Key` and the request body hash.

A good operation name is explicit and stable:

```txt
orders.create
payments.create
invoices.create
users.register
workflows.start
```

Avoid names that are too generic:

```txt
create
submit
post
action
handler
```

Changing the operation name changes the idempotency namespace for the route. Treat it as part of the backend contract.

## Read the JSON body

Inside the durable handler, use `request.json()` to parse the body.

```cpp
const auto body = request.json();
```

Then extract fields from the JSON object:

```cpp
const std::string product_id = cnerium::support::string_or(body, "product_id", "");
const int quantity = cnerium::support::int_or(body, "quantity", 0);
```

This keeps the example simple and explicit.

## Validate input

A durable route still needs normal application validation.

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

Cnerium protects the retry behavior of the route, but it does not replace domain validation. The application is still responsible for validating the submitted data before creating or changing state.

## Return a durable response

A durable handler returns `cnerium::DurableResponse`.

```cpp
return cnerium::created({
    {"ok", true},
    {"order_id", order_id},
    {"product_id", product_id},
    {"quantity", quantity}
});
```

The response is durable because Cnerium can store it and replay it later.

A normal Vix route writes directly to `vix::Response`. A Cnerium durable route returns a response object so Cnerium can preserve the result of the completed operation.

## Complete route

Here is the full route:

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

This route is intentionally small. In a real application, the handler might call a service, insert a database row, reserve stock, write an audit record, or call an external provider. The important rule is that those critical side effects should happen inside the durable handler, after Cnerium has decided that the request is safe to execute.

## Complete application

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

This application has one normal Vix route and one durable Cnerium route.

The health route is ordinary HTTP. The order route is protected against unsafe retries.

## Send a valid request

A durable route requires an `Idempotency-Key`.

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

Because this is the first request for `orders.create` with `order-123`, Cnerium executes the handler and stores the response.

## Retry the same request

Send the same request again:

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

This time, Cnerium returns the stored response. The durable handler is not executed again.

## Reuse the same key with a different body

Now change the request body but keep the same idempotency key:

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

This is not a safe retry. The same key is being used for a different request body, so Cnerium rejects it.

## Missing key

If the client omits the idempotency key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

The route should reject the request.

A durable route cannot evaluate retry safety without a stable key for the logical operation.

## Add a service function

For real applications, keep the durable route handler small and move domain work into a service function.

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

Then call it from the durable handler:

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

The durable handler remains responsible for request-level validation and response creation. The service owns the domain operation.

## Complete application with a service

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

        const Order order =create_order(request.idempotency_key_value(),
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

This keeps the example close to a real backend shape without introducing unrelated infrastructure.

## Add realtime emission

A durable handler can emit an event after the operation succeeds.

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order.id)},
        {"product_id", cnerium::Json(order.product_id)},
        {"quantity", cnerium::Json(order.quantity)}
    })
);
```

To use this inside the handler, capture the attached Cnerium layer by reference:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [&cnerium](cnerium::DurableRequest &request)
    {
      // create order

      cnerium.emit(
          "order.created",
          cnerium::support::object({
              {"order_id", cnerium::Json(order.id)}
          })
      );

      return cnerium::created({
          {"ok", true},
          {"order_id", order.id}
      });
    });
```

If the same request is replayed from storage, the handler is not executed again, so the event is not emitted again by that handler.

## Common mistakes

Do not use `app.post` for critical writes that need retry safety.

```cpp
app.post("/orders", create_order);
```

That is a normal Vix route. It does not provide stored response replay or idempotency conflict detection.

Do not generate a new idempotency key on every retry. The client must reuse the same key for the same logical operation.

Do not reuse the same key with a different request body. Cnerium will reject it as a conflict.

Do not make every route durable. Use durable routes for critical writes, and keep ordinary reads as normal Vix routes.

Do not let critical side effects happen outside the durable handler. Cnerium can only prevent duplicate handler execution for work that happens inside the durable route path.

## Summary

A durable `POST` route is a Vix route protected by Cnerium.

Register it with `cnerium.durable_post`, give it a stable operation name, require the client to send an `Idempotency-Key`, validate the request, perform the operation, and return a `cnerium::DurableResponse`.

On a safe retry, Cnerium returns the stored response instead of running the handler again. On unsafe key reuse, it returns `409 Conflict`.
