# Test Durable Behavior

This guide shows how to test the behavior of a Cnerium durable route.

A durable route is not only tested by checking that it returns `201 Created` on the first request. The important behavior is what happens when the same operation is retried, when the idempotency key is reused incorrectly, and when the key is missing.

A good durable route test should confirm four cases:

```txt
new request
  -> handler executes and response is stored

same key with same body
  -> stored response is returned

same key with different body
  -> 409 Conflict

missing Idempotency-Key
  -> 400 Bad Request
```

These cases prove that the route is using Cnerium’s reliability layer instead of behaving like an ordinary `POST` route.

## Example route

Assume the application has a durable order route:

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

      const std::string order_id = "ord_" + request.idempotency_key_value();

      return cnerium::created({
          {"ok", true},
          {"order_id", order_id},
          {"product_id", product_id},
          {"quantity", quantity}
      });
    });
```

The route is registered as:

```txt
POST /orders
operation: orders.create
```

The operation name matters because it scopes the idempotency key and stored response for this durable route.

## Run the application

Start the application normally.

If you are testing the example target from the Cnerium repository:

```bash
vix build --build-target all -v -- -DCNERIUM_BUILD_EXAMPLES=ON
./build-ninja/cnerium_durable_orders_realtime
```

If you are testing your own Vix backend, run it with the normal Vix workflow:

```bash
vix build
vix run
```

The server should start and listen on the configured HTTP port. In most local examples, the default port is `8080`.

## Test 1: first request

Send a valid request with an `Idempotency-Key`:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected status:

```txt
HTTP/1.1 201 Created
```

Example response body:

```json
{
  "ok": true,
  "order_id": "ord_order-123",
  "product_id": "p1",
  "quantity": 2
}
```

This proves that the request was accepted and the durable handler produced a response.

For this first request, Cnerium should execute the handler, compute the request body hash, store the hash, store the response, and return the response through Vix.

## Test 2: safe retry

Send the same request again with the same key and the same body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected status:

```txt
HTTP/1.1 201 Created
```

The response body should match the first response.

This confirms that Cnerium recognized the request as a safe retry. The operation name is the same, the idempotency key is the same, and the request body hash is the same.

The important behavior is that the durable handler should not run again. Cnerium should return the stored response.

## Test 3: unsafe key reuse

Reuse the same `Idempotency-Key`, but change the body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Expected status:

```txt
HTTP/1.1 409 Conflict
```

Example response body:

```json
{
  "error": "Idempotency-Key was reused with a different request body"
}
```

This confirms that Cnerium is not treating the request as a new operation and is not replaying the stored response incorrectly.

The same key with a different body is an unsafe retry. Cnerium rejects it before the handler runs.

## Test 4: missing key

Send the request without an `Idempotency-Key`:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected status:

```txt
HTTP/1.1 400 Bad Request
```

A durable route requires an idempotency key. Without it, Cnerium cannot identify the logical operation, so it cannot safely decide whether the request is new or a retry.

This test confirms that the route is enforcing the durable protocol.

## Test 5: validation error

Send a request with a key but invalid input:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-invalid-1" \
  -d '{"product_id":"p1","quantity":0}'
```

Expected status:

```txt
HTTP/1.1 400 Bad Request
```

Example response body:

```json
{
  "error": "Field quantity must be greater than zero"
}
```

This confirms that normal application validation still belongs inside the durable handler.

If the client corrects the body, it should use a new idempotency key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-valid-1" \
  -d '{"product_id":"p1","quantity":2}'
```

A corrected body is a new operation attempt. Reusing the previous key with a different body may produce `409 Conflict`.

## Test with a generated key

For manual testing, a readable key is fine:

```txt
order-123
```

For scripts, generate a fresh key per logical operation:

```bash
KEY="order-$(date +%s)"

curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{"product_id":"p1","quantity":2}'
```

Then retry with the same key:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{"product_id":"p1","quantity":2}'
```

The second request should return the same response.

## Test that the handler does not run twice

To verify replay behavior during development, add a temporary visible side effect inside the handler.

For example:

```cpp
vix::print("durable handler executed");
```

Then send the same request twice:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-log-test" \
  -d '{"product_id":"p1","quantity":2}'

curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-log-test" \
  -d '{"product_id":"p1","quantity":2}'
```

The message should appear only for the first request.

This is a useful development check because the HTTP response alone may not prove whether the handler ran again or whether the response was replayed from storage.

Remove temporary debug output before committing production code.

## Test realtime emission behavior

If the durable handler emits a realtime event:

```cpp
cnerium.emit(
    "order.created",
    cnerium::support::object({
        {"order_id", cnerium::Json(order_id)}
    }));
```

the event should be emitted when the handler runs.

The expected behavior is:

```txt
first request with a new key
  -> handler runs
  -> event is emitted
  -> response is stored

same key with same body
  -> stored response is returned
  -> handler does not run
  -> event is not emitted again by the handler

same key with different body
  -> 409 Conflict
  -> handler does not run
  -> event is not emitted by the handler
```

This confirms that durable route replay also protects handler-side realtime notifications from being duplicated.

## Test persistence across restart

A durable route is most useful when stored responses survive process restarts.

To test this:

1. Start the application.
2. Send a valid durable request.
3. Stop the application.
4. Start the application again.
5. Retry the same request with the same key and body.

Example first request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: restart-test-1" \
  -d '{"product_id":"p1","quantity":2}'
```

Stop and restart the server, then retry:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: restart-test-1" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected behavior:

```txt
same response is returned
handler does not execute again
```

If the route behaves like a new request after restart, check the configured Cnerium data directory. The storage path may be temporary, deleted during rebuilds, or not writable.

## Test storage location

If you configured:

```cpp
config.set_data_dir("data/cnerium");
```

inspect the directory after running requests:

```bash
find data/cnerium -maxdepth 3 -type f 2>/dev/null
```

The exact file layout is internal to Cnerium and may change. The goal is only to confirm that the application can write durable metadata.

If the directory is empty, check that:

```txt
cnerium.start() succeeded
the request hit the durable route
the request included an Idempotency-Key
the process can write to the directory
the Softadastra SDK is installed and available
```

## Test using a small script

For repeated local testing, create a small shell script.

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
KEY="${KEY:-order-script-test}"

echo "First request"
curl -i -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{"product_id":"p1","quantity":2}'

echo
echo "Safe retry"
curl -i -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{"product_id":"p1","quantity":2}'

echo
echo "Unsafe retry"
curl -i -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{"product_id":"p2","quantity":1}'
```

Run it:

```bash
chmod +x test-durable-orders.sh
./test-durable-orders.sh
```

This script checks the three most important cases.

## Automated tests

Manual `curl` tests are useful, but durable behavior should also be covered by automated tests.

At minimum, test:

```txt
new request returns expected status and body
same key with same body returns the same response
same key with different body returns 409
missing key returns 400
handler side effects happen once for safe retries
stored response survives restart when persistence is expected
```

For unit-level tests, call the durable route or reliability service directly if your project exposes those seams.

For integration tests, start the backend, send real HTTP requests, and assert the status codes and response bodies.

A durable route is only reliable if the retry behavior is tested, not just the first successful request.

## Common failures

If the safe retry executes the handler again, check that the request uses exactly the same `Idempotency-Key` and exactly the same body.

If unsafe key reuse does not return `409 Conflict`, confirm that the route is registered through `cnerium.durable_post`, not `app.post`.

If a missing key is accepted, the request may be reaching a normal Vix route instead of a durable route.

If replay works before restart but fails after restart, check the configured data directory and whether the storage backend is persistent.

If realtime events are emitted twice for the same key and body, confirm that the event is emitted inside the durable handler and that the second request is actually replayed from storage.

## Summary

Testing a Cnerium durable route means testing retry behavior.

A successful first request is only the beginning. A good test confirms that the same key and body returns the stored response, the same key with a different body returns `409 Conflict`, a missing key returns `400 Bad Request`, and side effects inside the durable handler are not repeated for safe retries.

That is the behavior that makes Cnerium useful.
