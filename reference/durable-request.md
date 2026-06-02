# DurableRequest

`cnerium::DurableRequest` is the request type passed to Cnerium durable route handlers.

It wraps the underlying Vix HTTP request and exposes the information needed by durable operations: method, target, path, body, headers, query values, route parameters, JSON parsing, idempotency key access, and request body hashing.

A durable route handler receives it like this:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body = request.json();
      const std::string key = request.idempotency_key_value();

      return cnerium::created({
          {"ok", true},
          {"idempotency_key", key}
      });
    });
```

`DurableRequest` does not replace the Vix request model for normal routes. It exists because durable routes need reliability-specific request information.

Use `vix::Request` in normal Vix routes. Use `cnerium::DurableRequest` in Cnerium durable routes.

## Header

```cpp
#include <cnerium/cnerium.hpp>
```

or directly:

```cpp
#include <cnerium/http/DurableRequest.hpp>
```

Most applications should include:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

## Namespace

The concrete type is:

```cpp
cnerium::http::DurableRequest
```

A public alias is available:

```cpp
cnerium::DurableRequest
```

Most application code should use the public alias:

```cpp
[](cnerium::DurableRequest &request)
{
  // durable handler
}
```

## Purpose

`DurableRequest` exists to give durable handlers a request object that fits the Cnerium execution model.

A normal Vix route receives Vix request and response objects:

```cpp
app.get("/health", [](vix::Request &req, vix::Response &res)
{
  (void)req;

  res.json({
      {"ok", true}
  });
});
```

A durable Cnerium route receives `DurableRequest` and returns `DurableResponse`:

```cpp
cnerium.durable_post(
    "/orders",
    "orders.create",
    [](cnerium::DurableRequest &request)
    {
      const auto body = request.json();

      return cnerium::created({
          {"ok", true}
      });
    });
```

The durable request still comes from Vix. Cnerium wraps it so durable handlers can access the idempotency key, request hash, and other request data through a focused API.

## Construction

Application code normally does not construct `DurableRequest` directly.

Cnerium creates it internally when a durable route receives a Vix HTTP request.

Conceptually:

```txt
Vix receives HTTP request
Vix matches the route
Cnerium wraps the Vix request as DurableRequest
Cnerium performs the durability decision
Cnerium calls the durable handler only when execution is safe
```

The handler receives the wrapper:

```cpp
[](cnerium::DurableRequest &request)
{
  // use request here
}
```

## method

Returns the HTTP method.

```cpp
std::string method() const;
```

Example:

```cpp
const std::string method = request.method();
```

For a route registered with `durable_post`, the method is expected to be `POST`.

Most durable handlers do not need to check the method because the route registration already determines it.

## target

Returns the full request target.

```cpp
std::string target() const;
```

The target may include the query string.

Example:

```cpp
const std::string target = request.target();
```

For a request such as:

```txt
/orders?source=mobile
```

the target may include the full value:

```txt
/orders?source=mobile
```

Use `path()` when you only need the path part.

## path

Returns the request path.

```cpp
std::string path() const;
```

Example:

```cpp
const std::string path = request.path();
```

For most durable handlers, the path is already known from route registration. It can still be useful for logging, diagnostics, or generic handlers.

## body

Returns the raw request body.

```cpp
const std::string &body() const noexcept;
```

Example:

```cpp
const std::string &raw_body = request.body();
```

Cnerium uses the body internally to compute the request hash used by replay protection.

If the handler expects JSON, use `json()` or `try_json()` instead of manually parsing the raw body.

## header

Returns the value of an HTTP header.

```cpp
std::string header(std::string_view name) const;
```

Example:

```cpp
const std::string content_type = request.header("Content-Type");
```

If the header is missing, the method returns an empty string.

Use this for request metadata that is relevant to your durable operation.

## has_header

Returns whether a header exists.

```cpp
bool has_header(std::string_view name) const;
```

Example:

```cpp
if (request.has_header("Content-Type"))
{
  const std::string content_type =
      request.header("Content-Type");
}
```

Durable routes require `Idempotency-Key`, but application code usually does not need to manually check it. Cnerium validates the key before the handler executes.

## idempotency_key

Returns the `Idempotency-Key` header as a value object.

```cpp
cnerium::reliability::IdempotencyKey
idempotency_key() const;
```

Example:

```cpp
const auto key = request.idempotency_key();

if (key.is_valid())
{
  const std::string value =
      key.value();
}
```

Most application handlers can use `idempotency_key_value()` when they only need the raw string.

## idempotency_key_value

Returns the raw `Idempotency-Key` header value.

```cpp
std::string idempotency_key_value() const;
```

Example:

```cpp
const std::string order_id = "ord_" + request.idempotency_key_value();
```

This is useful when the application wants to include the operation key in a generated demo id, an audit log, or a call to another idempotent system.

In production, the final domain id often comes from a database or external service. The idempotency key should still remain the retry identity for the operation.

## request_hash

Computes the stable request body hash used by Cnerium.

```cpp
cnerium::reliability::RequestHash
request_hash() const;
```

Example:

```cpp
const auto hash = request.request_hash();
```

Most application handlers do not need to use the request hash directly. Cnerium uses it internally to detect whether a repeated `Idempotency-Key` is being used with the same body or a different body.

Use it for diagnostics only when necessary.

## json

Parses the request body as JSON.

```cpp
cnerium::support::Json json() const;
```

Example:

```cpp
const auto body = request.json();
const std::string product_id = cnerium::support::string_or(body, "product_id", "");

const int quantity = cnerium::support::int_or(body, "quantity", 0);
```

If the body is not valid JSON, this method may throw according to the JSON parser behavior used by the current Cnerium and Vix JSON integration.

Use `try_json()` when the handler should avoid exceptions.

## try_json

Parses the request body as JSON without throwing.

```cpp
std::optional<cnerium::support::Json>
try_json() const noexcept;
```

Example:

```cpp
const auto body = request.try_json();

if (!body.has_value())
{
  return cnerium::DurableResponse::bad_request(
      "Request body must be valid JSON");
}

const std::string product_id = cnerium::support::string_or(*body, "product_id", "");
```

Use this when the route should return a clean validation response for malformed JSON.

## param

Returns a route parameter value.

```cpp
std::string param(std::string_view name) const;
```

Example:

```cpp
const std::string order_id = request.param("id");
```

If the parameter is missing, the method returns an empty string.

Use route parameters for durable routes that operate on a named resource or command path.

## query

Returns a query parameter value.

```cpp
std::string query(std::string_view name) const;
```

Example:

```cpp
const std::string source = request.query("source");
```

If the query parameter is missing, the method returns an empty string.

For durable routes, be careful with query parameters. Cnerium’s core replay protection is based on the request body hash and idempotency key. If query parameters affect the meaning of a critical operation, keep the route design stable and make sure clients retry with the same full request.

## native

Returns the wrapped Vix HTTP request.

```cpp
const vix::http::Request &native() const noexcept;
```

Example:

```cpp
const auto &vix_request = request.native();
```

Most application code should not need this. It is available for integration code that needs access to lower-level Vix request data not exposed directly by `DurableRequest`.

Use it carefully. Durable handlers should usually stay inside the Cnerium request API.

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
        const auto body = request.try_json();

        if (!body.has_value())
        {
          return cnerium::DurableResponse::bad_request(
              "Request body must be valid JSON");
        }

        const std::string product_id = cnerium::support::string_or(*body, "product_id", "");
        const int quantity = cnerium::support::int_or(*body, "quantity", 0);

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

This route uses `try_json()` to return a clean error for invalid JSON and uses `idempotency_key_value()` to produce a deterministic example id.

## Relationship with replay protection

`DurableRequest` provides the values needed by replay protection, but application handlers do not normally run the replay decision themselves.

Before the handler executes, Cnerium has already checked:

```txt
operation name
Idempotency-Key
request body hash
```

If the request is a safe replay, the handler is not called. If the request is an unsafe reuse of the same key with a different body, the handler is not called. If the key is missing, the handler is not called.

The handler receives `DurableRequest` only when Cnerium has decided that the operation should execute.

## Common mistakes

Do not use `DurableRequest` in normal Vix routes. Normal routes should use Vix request and response types.

Do not manually implement idempotency inside every handler. Cnerium performs the idempotency and replay-protection decision before the handler runs.

Do not rely on query parameters to change the meaning of a durable operation unless the route is designed carefully and the client retries the exact same request.

Do not perform critical side effects before the durable route receives the request. Cnerium can only protect side effects that occur inside the durable execution path.

Do not assume `json()` always returns a valid body. Use `try_json()` when the route needs graceful malformed JSON handling.

## Summary

`cnerium::DurableRequest` is the request wrapper used by Cnerium durable route handlers.

It gives handlers access to request data while exposing durable-route helpers such as `idempotency_key_value()`, `request_hash()`, `json()`, and `try_json()`. The object wraps a Vix request, but it belongs to the Cnerium durable route execution model.

Use it only inside durable handlers registered with `cnerium.durable_post`.
