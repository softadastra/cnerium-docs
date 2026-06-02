# Payments

This example shows how to use a Cnerium durable route for a payment-style operation.

Payments are a natural example for Cnerium because retry behavior matters. A client may send a payment request, the server may process it, and the response may still be lost before the client receives it. If the client retries and the backend executes the handler again, the system may create duplicate payment work.

Cnerium does not turn this example into a complete payment provider integration. It focuses on the backend reliability pattern: one logical payment request, one `Idempotency-Key`, one durable response.

The backend still follows the normal Vix model:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

Vix owns the application. Cnerium attaches to it and protects the critical route.

## Route structure

This example exposes two routes:

```txt
GET /health
POST /payments
```

`GET /health` is a normal Vix route.

`POST /payments` is a durable Cnerium route because it represents a critical write operation.

The durable operation name is:

```txt
payments.create
```

That name is part of the idempotency scope. It separates payment creation from other durable operations such as `orders.create`, `invoices.create`, or `users.register`.

## Complete example

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>

struct Payment
{
  std::string id;
  std::string order_id;
  int amount_cents{};
  std::string currency;
  std::string status;
};

Payment create_payment(
    const std::string &idempotency_key,
    const std::string &order_id,
    int amount_cents,
    const std::string &currency)
{
  return Payment{
      "pay_" + idempotency_key,
      order_id,
      amount_cents,
      currency,
      "created"};
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
        {"service", "payments"}
    });
  });

  cnerium.durable_post(
      "/payments",
      "payments.create",
      [](cnerium::DurableRequest &request)
      {
        const auto body = request.json();

        const std::string order_id =
            cnerium::support::string_or(body, "order_id", "");

        const int amount_cents =
            cnerium::support::int_or(body, "amount_cents", 0);

        const std::string currency =
            cnerium::support::string_or(body, "currency", "USD");

        if (order_id.empty())
        {
          return cnerium::DurableResponse::bad_request(
              "Missing required field: order_id");
        }

        if (amount_cents <= 0)
        {
          return cnerium::DurableResponse::bad_request(
              "Field amount_cents must be greater than zero");
        }

        if (currency.empty())
        {
          return cnerium::DurableResponse::bad_request(
              "Missing required field: currency");
        }

        const Payment payment =
            create_payment(
                request.idempotency_key_value(),
                order_id,
                amount_cents,
                currency);

        return cnerium::created({
            {"ok", true},
            {"payment_id", payment.id},
            {"order_id", payment.order_id},
            {"amount_cents", payment.amount_cents},
            {"currency", payment.currency},
            {"status", payment.status}
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

The example uses a deterministic payment id derived from the idempotency key:

```cpp
"pay_" + idempotency_key
```

That keeps the example simple and easy to test. In a real system, the payment id may come from your database or a payment provider. The retry-safety model remains the same.

## Request body

The durable payment route expects JSON like this:

```json
{
  "order_id": "ord_123",
  "amount_cents": 2500,
  "currency": "USD"
}
```

The handler reads the body:

```cpp
const auto body = request.json();
const std::string order_id = cnerium::support::string_or(body, "order_id", "");
const int amount_cents = cnerium::support::int_or(body, "amount_cents", 0);
const std::string currency = cnerium::support::string_or(body, "currency", "USD");
```

Then it validates the input before creating the payment response.

Cnerium protects retry behavior. The application still owns validation and domain rules.

## First request

Send a payment request with an `Idempotency-Key`:

```bash
curl -i -X POST http://127.0.0.1:8080/payments \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: payment-123" \
  -d '{"order_id":"ord_123","amount_cents":2500,"currency":"USD"}'
```

Expected status:

```txt
HTTP/1.1 201 Created
```

Example body:

```json
{
  "ok": true,
  "payment_id": "pay_payment-123",
  "order_id": "ord_123",
  "amount_cents": 2500,
  "currency": "USD",
  "status": "created"
}
```

This is the first request for `payments.create` with the key `payment-123`. Cnerium executes the handler, stores the request hash, stores the response, and returns the result.

## Safe retry

Send the same request again with the same key and the same body:

```bash
curl -i -X POST http://127.0.0.1:8080/payments \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: payment-123" \
  -d '{"order_id":"ord_123","amount_cents":2500,"currency":"USD"}'
```

Expected status:

```txt
HTTP/1.1 201 Created
```

The body should match the first response.

The durable handler should not execute again. Cnerium should return the stored response.

This is the main reason payments are a strong example for durable routes. A client can retry after a timeout without creating another payment operation.

## Unsafe key reuse

Now reuse the same key with a different amount:

```bash
curl -i -X POST http://127.0.0.1:8080/payments \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: payment-123" \
  -d '{"order_id":"ord_123","amount_cents":3000,"currency":"USD"}'
```

Expected status:

```txt
HTTP/1.1 409 Conflict
```

Example body:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This is not a safe retry. The idempotency key already belongs to the previous body. Cnerium rejects the request before the handler runs.

## Missing Idempotency-Key

A durable payment route requires an idempotency key:

```bash
curl -i -X POST http://127.0.0.1:8080/payments \
  -H "Content-Type: application/json" \
  -d '{"order_id":"ord_123","amount_cents":2500,"currency":"USD"}'
```

Expected status:

```txt
HTTP/1.1 400 Bad Request
```

Without a key, Cnerium cannot know whether this request is new or a retry.

For payment-like operations, accepting a critical write without a retry identity is risky.

## Why payments need idempotency

Payment operations often involve multiple systems.

A backend may validate the request, create a local payment record, call an external provider, update status, and return a response to the client. Any of those steps can succeed while the client still fails to receive the response.

The dangerous sequence is:

```txt
client sends POST /payments
server accepts the request
server creates the payment operation
server returns the response
network connection drops
client retries
```

If the backend treats the retry as a new request, it may create duplicate payment work.

Cnerium prevents the durable handler from running twice for the same key and body. A safe retry receives the stored response.

## External payment providers

Many payment providers have their own idempotency mechanism.

When integrating with a real provider, use provider-level idempotency as well. Cnerium protects the backend route. The provider’s idempotency mechanism protects the provider-side operation.

A practical mapping can look like this:

```txt
client operation key
  -> Idempotency-Key header
  -> Cnerium durable route
  -> payment service
  -> provider idempotency key
```

The same logical operation should remain traceable across layers.

For example:

```cpp
const std::string provider_key = request.idempotency_key_value();
```

Then the application payment service can pass that key to the provider if the provider supports it.

Cnerium does not remove the need to follow the provider’s own reliability rules.

## Add a payment service boundary

For a real backend, keep payment logic outside the route handler.

```cpp
class PaymentService
{
public:
  Payment create(
      const std::string &idempotency_key,
      const std::string &order_id,
      int amount_cents,
      const std::string &currency)
  {
    return create_payment(
        idempotency_key,
        order_id,
        amount_cents,
        currency);
  }
};
```

Then use it from the durable handler:

```cpp
PaymentService payments;

cnerium.durable_post(
    "/payments",
    "payments.create",
    [&payments](cnerium::DurableRequest &request)
    {
      const auto body = request.json();
      const std::string order_id = cnerium::support::string_or(body, "order_id", "");
      const int amount_cents = cnerium::support::int_or(body, "amount_cents", 0);
      const std::string currency = cnerium::support::string_or(body, "currency", "USD");

      if (order_id.empty())
      {
        return cnerium::DurableResponse::bad_request(
            "Missing required field: order_id");
      }

      if (amount_cents <= 0)
      {
        return cnerium::DurableResponse::bad_request(
            "Field amount_cents must be greater than zero");
      }

      const Payment payment =
          payments.create(
              request.idempotency_key_value(),
              order_id,
              amount_cents,
              currency);

      return cnerium::created({
          {"ok", true},
          {"payment_id", payment.id},
          {"order_id", payment.order_id},
          {"amount_cents", payment.amount_cents},
          {"currency", payment.currency},
          {"status", payment.status}
      });
    });
```

The service runs only when Cnerium allows the durable handler to execute.

## Realtime payment event

A payment route can emit a realtime event after successful creation:

```cpp
cnerium.emit(
    "payment.created",
    cnerium::support::object({
        {"payment_id", cnerium::Json(payment.id)},
        {"order_id", cnerium::Json(payment.order_id)},
        {"amount_cents", cnerium::Json(payment.amount_cents)},
        {"currency", cnerium::Json(payment.currency)},
        {"status", cnerium::Json(payment.status)}
    }));
```

If the same payment request is safely retried, Cnerium returns the stored response and does not run the handler again. The event is not emitted again by the handler.

That prevents duplicate handler-side realtime notifications.

## Failure considerations

Cnerium gives the route a retry-safety layer, but payment correctness also needs domain-level protection.

A serious payment backend should still use:

```txt
database transactions
unique constraints
audit logs
provider-level idempotency
clear payment status transitions
authorization
amount and currency validation
fraud and risk checks where appropriate
```

Cnerium does not replace those mechanisms. It prevents one important class of duplicate execution caused by retries and lost responses.

For real payment systems, think carefully about the commit point between local state, provider calls, and stored durable responses.

## What to verify

When this example is working correctly, these behaviors should hold:

```txt
POST /payments with a new key and valid body
  returns 201 Created

POST /payments with the same key and same body
  returns the same stored response

POST /payments with the same key and different body
  returns 409 Conflict

POST /payments without Idempotency-Key
  returns 400 Bad Request
```

If the safe retry executes the handler again, check that the key and body are exactly the same.

If unsafe key reuse does not return `409 Conflict`, confirm that the route is registered with `cnerium.durable_post`, not `app.post`.

## Summary

The payments example shows why Cnerium exists.

A payment-like route is a critical write operation. If the client retries after a lost response, the backend must not blindly execute the handler again. Cnerium uses the operation name, `Idempotency-Key`, request body hash, and stored response to make that retry safe.

Use Cnerium to protect the backend route. Use your domain storage and payment provider mechanisms to protect the full payment workflow.
