# Configure Storage

Cnerium needs storage because durable routes must remember completed operations.

When a durable route receives a request, Cnerium checks the operation name, the `Idempotency-Key`, and the request body hash. If the request is new, the handler runs and Cnerium stores the response. If the same request is retried later, Cnerium returns the stored response instead of running the handler again.

That behavior requires a place to store Cnerium metadata.

Storage is not an optional optimization. It is part of the durable route model.

## What Cnerium stores

Cnerium stores framework-level reliability data.

For a durable operation, Cnerium needs to persist enough information to answer future retry requests correctly.

The stored data includes:

```txt
request hash metadata
stored HTTP response
operation-level keys
Cnerium runtime metadata
```

A stored response contains:

```txt
status code
response body
content type
```

For example, after this request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Cnerium may store metadata for the logical operation:

```txt
operation: orders.create
key:       order-123
hash:      hash of {"product_id":"p1","quantity":2}
response:  HTTP 201 response returned by the handler
```

The application should not usually manage these keys directly. They belong to the Cnerium reliability layer.

## What Cnerium storage is not

Cnerium storage is not your application database.

If an order is created, your application should still store the order in its own domain storage. Cnerium stores the durable route response so a retry can receive the same HTTP result.

The distinction matters:

```txt
application database
  stores domain state such as orders, users, invoices, payments

Cnerium storage
  stores reliability metadata for durable route replay
```

Do not use Cnerium stored responses as the source of truth for your business data.

Cnerium storage is also not a general HTTP cache. It is tied to operation names, idempotency keys, request body hashes, and durable responses. Its purpose is correctness under retries, not performance optimization.

## Configure the data directory

The most common storage setting is the Cnerium data directory.

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");

auto cnerium = cnerium::attach(app, std::move(config));
```

The data directory is where Cnerium stores local reliability data through its store layer.

For local development, a relative path is usually fine:

```cpp
config.set_data_dir("data/cnerium");
```

For production, prefer an explicit path managed by your deployment environment:

```cpp
config.set_data_dir("/var/lib/orders-service/cnerium");
```

The process must have permission to create and write files in that location.

## Development configuration

For examples and local testing, use the development config:

```cpp
cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

config.set_name("orders-service");
config.set_data_dir("data/cnerium");
config.set_node_id("orders-node");
```

Then attach it to the Vix app:

```cpp
vix::App app;

auto cnerium =
    cnerium::attach(app, std::move(config));
```

This keeps the storage configuration explicit while preserving the Vix ownership model.

The backend is still started by Vix:

```cpp
if (!cnerium.start())
{
  return 1;
}

app.run();
```

`cnerium.start()` opens or prepares Cnerium runtime resources. `app.run()` starts the Vix HTTP application.

## Node identity

Cnerium configuration includes a node id:

```cpp
config.set_node_id("orders-node");
```

The node id identifies the local Cnerium runtime instance.

Use a stable value for the service or deployment environment. For local development, a simple name is enough:

```txt
orders-node
durable-orders-realtime-node
dev-node
```

For production, use a predictable identity that fits your deployment model:

```txt
orders-api-prod-1
payments-api-kampala-1
shop-api-node-a
```

Avoid random node ids on every boot unless the application has a specific reason. Stable node identity makes logs, storage, and debugging easier.

## Service name

Set a clear application name:

```cpp
config.set_name("orders-service");
```

The name should describe the service that owns the durable operations.

Good names:

```txt
orders-service
payments-service
invoices-service
shop-api
registration-api
```

Avoid vague names:

```txt
app
backend
server
test
```

The name is useful in logs, storage organization, debugging, and future tooling.

## Complete configuration example

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

#include <string>
#include <utility>

int main()
{
  vix::App app;

  cnerium::app::AppConfig config = cnerium::app::AppConfig::development();

  config.set_name("orders-service");
  config.set_data_dir("data/cnerium");
  config.set_node_id("orders-node");

  auto cnerium = cnerium::attach(app, std::move(config));

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

The storage configuration belongs to Cnerium. The HTTP application still belongs to Vix.

## Verify storage behavior

Start the application and send a valid request:

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

Expected behavior:

```txt
same response
handler not executed again
stored response returned
```

Then reuse the same key with a different body:

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

If this behavior works, Cnerium can store and read the reliability metadata for the durable route.

## Check the data directory

After running durable requests, inspect the configured data directory:

```bash
find data/cnerium -maxdepth 3 -type f 2>/dev/null
```

The exact files and layout depend on the current store implementation. Application code should not depend on the internal file names.

The point of this check is only to confirm that Cnerium can write to the configured location.

If no files appear, verify that:

```txt
the route actually received a valid durable request
cnerium.start() succeeded
the process can write to the data directory
the Softadastra SDK is installed and usable
```

## Production paths

For production, avoid writing durable metadata into temporary or source-controlled directories.

Avoid:

```txt
/tmp/cnerium
./data inside a read-only deployment
project directories that may be deleted on redeploy
paths owned by another user
```

Prefer:

```txt
/var/lib/<service>/cnerium
/srv/<service>/cnerium
a mounted persistent volume
a deployment-managed writable data directory
```

Example:

```cpp
config.set_data_dir("/var/lib/orders-service/cnerium");
```

The directory should survive process restarts. If it is deleted, Cnerium may lose the stored responses needed to replay completed operations.

## Permissions

The process must be able to create and write to the data directory.

On Linux, check permissions with:

```bash
ls -ld /var/lib/orders-service/cnerium
```

Create the directory when needed:

```bash
sudo mkdir -p /var/lib/orders-service/cnerium
sudo chown -R "$USER:$USER" /var/lib/orders-service/cnerium
```

For a systemd service, the owner should usually be the service user, not your interactive shell user.

If Cnerium cannot write to the data directory, `cnerium.start()` should fail or durable route behavior may not work correctly.

## Storage and process restarts

A durable route is most useful when stored responses survive process restarts.

A simple in-memory approach would only help during the lifetime of one process. Cnerium is designed to use the Softadastra SDK-backed store so reliability metadata can be persisted beyond one request and one process lifetime.

After a restart, a retry with the same key and body should still be able to receive the stored response if the storage backend preserved the data.

This is why the data directory should be stable.

## Storage and application writes

Cnerium stores retry metadata and stored responses. Your application still owns domain writes.

For example, an order route may do three things:

```txt
validate the request
create the order in the application database
return a durable response
```

Cnerium then stores the response so future retries can replay it.

For high-value operations, think carefully about the relationship between the domain write and the stored response. If the domain write succeeds but the process crashes before the response is stored, a future retry may not have a stored response even though the domain state exists.

Cnerium improves the retry model, but it does not remove the need for transactions, unique constraints, audit logs, and domain-level consistency checks.

## Storage and external systems

If a durable handler calls an external system such as a payment provider, use that provider’s idempotency support when available.

The same logical operation should stay traceable across layers:

```txt
client Idempotency-Key
  -> Cnerium durable route
  -> application domain write
  -> external provider idempotency key
```

Cnerium protects the backend route. It does not automatically make an external provider idempotent unless your application uses the provider’s idempotency mechanism.

## Clearing storage during development

During local development, you may want to clear the Cnerium data directory to reset durable route state.

For example:

```bash
rm -rf data/cnerium
```

Only do this in development.

Deleting storage removes Cnerium’s memory of completed durable operations. After deletion, a retry with an old idempotency key may be treated as a new request because the stored metadata is gone.

Do not delete production storage unless you understand the consequences.

## Backup considerations

For production systems, Cnerium storage should be treated as reliability metadata.

Whether it needs backup depends on the value of the operations being protected and how the rest of your application is designed.

For high-value operations such as payments, invoices, financial records, and inventory reservations, domain storage remains the primary source of truth. Cnerium storage helps replay HTTP responses and prevent retry ambiguity. Keep backups and audit trails for the domain data first, then decide how Cnerium metadata should be retained.

## Troubleshooting

If a durable request always executes again instead of replaying a stored response, check that the same `Idempotency-Key` and the same request body are being used.

If the same key with a different body does not return `409 Conflict`, verify that the request is hitting the durable route and not a normal Vix `app.post` route.

If `cnerium.start()` fails, check the configured data directory and SDK installation.

If the project builds but your editor reports missing SDK headers, configure IntelliSense to use the build’s `compile_commands.json`.

If storage behavior changes after restarting the app, check whether the data directory is stable or being deleted during rebuilds, deployments, or test runs.

## Summary

Cnerium storage holds the reliability metadata needed by durable routes.

It stores request hashes and durable responses so safe retries can receive the original result and unsafe retries can be rejected. Configure a stable data directory, use a clear service name and node id, and remember that Cnerium storage is not your application database. It is the retry-safety layer for selected Vix backend operations.
