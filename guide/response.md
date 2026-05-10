# Response

A response is what your Cnerium application sends back to the client.

In most applications, you write responses through `AppContext`.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello from Cnerium");
});
```

Cnerium supports:

```txt
text responses
HTML responses
JSON responses
status codes
headers
error responses
empty responses
raw response access
```

## Basic text response

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Hello from Cnerium");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Response example is ready");
  });
}
```

Run:

```bash
vix dev
```

Test:

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```txt
Hello from Cnerium
```

## Response helpers

The most common helpers are:

```cpp
ctx.text("Hello");
ctx.html("<h1>Hello</h1>");
ctx.json({{"ok", true}});
ctx.status(cnerium::http::Status::created);
ctx.ok("done");
ctx.error(cnerium::http::Status::bad_request, "Invalid request");
ctx.response();
```

For most routes, use the `AppContext` helpers first.

Use `ctx.response()` when you need lower-level access.

## Text response

Use `ctx.text()` for plain text:

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Home page");
});
```

Cnerium sets the response body and uses a text content type internally.

## HTML response

Use `ctx.html()` for HTML:

```cpp
app.get("/page", [](AppContext &ctx)
{
  ctx.html("<h1>Hello from Cnerium</h1>");
});
```

Test:

```bash
curl http://127.0.0.1:8080/page
```

Expected response:

```html
<h1>Hello from Cnerium</h1>
```

## JSON response

Use `ctx.json()` for JSON:

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"},
    {"framework", "Cnerium"}
  });
});
```

Test:

```bash
curl http://127.0.0.1:8080/health
```

Expected response:

```json
{"ok":true,"status":"healthy","framework":"Cnerium"}
```

## Nested JSON response

Cnerium uses `cnerium::json`, so you can build nested JSON objects and arrays.

```cpp
app.get("/api/info", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"app", {
      {"name", "Cnerium API"},
      {"version", "0.1.0"}
    }},
    {"features", cnerium::json::array{
      "routing",
      "middleware",
      "json",
      "runtime"
    }}
  });
});
```

## Status codes

Use `ctx.status()` to set the HTTP status.

```cpp
app.post("/users", [](AppContext &ctx)
{
  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "user created"}
  });
});
```

The call can be chained:

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true}
});
```

## Common status codes

```cpp
cnerium::http::Status::ok
cnerium::http::Status::created
cnerium::http::Status::bad_request
cnerium::http::Status::unauthorized
cnerium::http::Status::forbidden
cnerium::http::Status::not_found
cnerium::http::Status::internal_server_error
```

Example:

```cpp
app.get("/missing", [](AppContext &ctx)
{
  ctx.status(cnerium::http::Status::not_found).json({
    {"ok", false},
    {"error", "resource not found"}
  });
});
```

## Headers

Use `ctx.response().set_header()` to set headers.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.response().set_header("X-App", "Cnerium");
  ctx.text("Hello");
});
```

Test with headers:

```bash
curl -i http://127.0.0.1:8080/
```

Expected header:

```txt
X-App: Cnerium
```

## Multiple headers

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.response().set_header("X-App", "Cnerium");
  ctx.response().set_header("X-Version", "0.1.0");
  ctx.response().set_header("Cache-Control", "no-store");

  ctx.text("Hello");
});
```

## Headers from middleware

For global headers, prefer middleware:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

This applies the header to every response that passes through the middleware.

## Error response

Use JSON for API errors:

```cpp
app.get("/error", [](AppContext &ctx)
{
  ctx.status(cnerium::http::Status::bad_request).json({
    {"ok", false},
    {"error", "invalid request"}
  });
});
```

Or use the helper:

```cpp
ctx.error(cnerium::http::Status::bad_request, "invalid request");
```

A good API error response should be simple:

```json
{
  "ok": false,
  "error": "invalid request"
}
```

## Success response

You can return a simple success response:

```cpp
app.post("/tasks", [](AppContext &ctx)
{
  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "task created"}
  });
});
```

Or use:

```cpp
ctx.ok("task created");
```

## Empty response

For routes that should return no body, set an empty response through the lower-level response object:

```cpp
app.delete_("/users/:id", [](AppContext &ctx)
{
  ctx.response().empty(cnerium::http::Status::no_content);
});
```

A `204 No Content` response should not include a response body.

## Reading and modifying the raw response

Use `ctx.response()` when you need direct access to the underlying response object:

```cpp
app.get("/raw", [](AppContext &ctx)
{
  auto &res = ctx.response();

  res.set_status(cnerium::http::Status::ok);
  res.set_header("X-Mode", "raw");
  res.text("Raw response access");
});
```

Most applications should use:

```cpp
ctx.text();
ctx.html();
ctx.json();
ctx.status();
```

Use `ctx.response()` for lower-level control.

## Response chaining

Many response helpers are designed to be chained.

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true},
  {"message", "created"}
});
```

This keeps handlers short and readable.

## Response from route parameters

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"id", std::string(ctx.param("id"))}
  });
});
```

Route parameters are string-like values, so convert them to `std::string` when returning them in JSON.

## Response from request body

```cpp
app.post("/users", [](AppContext &ctx)
{
  auto body = ctx.json();

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "user created"},
    {"user", {
      {"name", body["name"]},
      {"email", body["email"]}
    }}
  });
});
```

## Handle validation errors

```cpp
app.post("/users", [](AppContext &ctx)
{
  try
  {
    auto body = ctx.json();

    if (!body.is_object())
    {
      ctx.status(cnerium::http::Status::bad_request).json({
        {"ok", false},
        {"error", "request body must be a JSON object"}
      });
      return;
    }

    if (!body.contains("name"))
    {
      ctx.status(cnerium::http::Status::bad_request).json({
        {"ok", false},
        {"error", "name is required"}
      });
      return;
    }

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "user created"},
      {"name", body["name"]}
    });
  }
  catch (const std::exception &ex)
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", "invalid JSON body"},
      {"message", ex.what()}
    });
  }
});
```

## Custom not-found response

Use `set_not_found_handler()` to customize 404 responses.

```cpp
app.set_not_found_handler([](cnerium::server::Context &ctx)
{
  ctx.status(cnerium::http::Status::not_found)
      .json({
        {"ok", false},
        {"error", "route not found"},
        {"path", std::string(ctx.path())}
      });
});
```

This is useful for APIs that should always return JSON errors.

## Custom error response

Use `set_error_handler()` to convert exceptions into HTTP responses.

```cpp
app.set_error_handler([](cnerium::server::Context &ctx,
                         const std::exception &ex)
{
  ctx.status(cnerium::http::Status::internal_server_error)
      .json({
        {"ok", false},
        {"error", "internal server error"},
        {"message", ex.what()}
      });
});
```

## Complete example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::app;

int main()
{
  App app;

  app.use([](auto &ctx, auto next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    next();
  });

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Response guide example");
  });

  app.get("/html", [](AppContext &ctx)
  {
    ctx.html("<h1>Hello from Cnerium</h1>");
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.post("/users", [](AppContext &ctx)
  {
    try
    {
      auto body = ctx.json();

      if (!body.is_object())
      {
        ctx.status(cnerium::http::Status::bad_request).json({
          {"ok", false},
          {"error", "request body must be a JSON object"}
        });
        return;
      }

      if (!body.contains("name"))
      {
        ctx.status(cnerium::http::Status::bad_request).json({
          {"ok", false},
          {"error", "name is required"}
        });
        return;
      }

      ctx.status(cnerium::http::Status::created).json({
        {"ok", true},
        {"message", "user created"},
        {"name", body["name"]}
      });
    }
    catch (const std::exception &ex)
    {
      ctx.status(cnerium::http::Status::bad_request).json({
        {"ok", false},
        {"error", "invalid JSON body"},
        {"message", ex.what()}
      });
    }
  });

  app.delete_("/users/:id", [](AppContext &ctx)
  {
    ctx.response().empty(cnerium::http::Status::no_content);
  });

  app.set_not_found_handler([](cnerium::server::Context &ctx)
  {
    ctx.status(cnerium::http::Status::not_found)
        .json({
          {"ok", false},
          {"error", "route not found"},
          {"path", std::string(ctx.path())}
        });
  });

  app.set_error_handler([](cnerium::server::Context &ctx,
                           const std::exception &ex)
  {
    ctx.status(cnerium::http::Status::internal_server_error)
        .json({
          {"ok", false},
          {"error", "internal server error"},
          {"message", ex.what()}
        });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Response guide example is ready");
  });
}
```

## Test the example

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/html
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/users/42

curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'

curl -i -X DELETE http://127.0.0.1:8080/users/42
curl -i http://127.0.0.1:8080/missing
```

## Response helper overview

| Goal | Helper |
|------|--------|
| Text response | `ctx.text("Hello")` |
| HTML response | `ctx.html("<h1>Hello</h1>")` |
| JSON response | `ctx.json({{"ok", true}})` |
| Set status | `ctx.status(Status::created)` |
| Success helper | `ctx.ok("done")` |
| Error helper | `ctx.error(Status::bad_request, "invalid")` |
| Raw response | `ctx.response()` |
| Set header | `ctx.response().set_header("X-App", "Cnerium")` |
| Empty response | `ctx.response().empty(Status::no_content)` |

## Best practices

### Prefer JSON for APIs

For API routes, use JSON consistently:

```cpp
ctx.json({
  {"ok", true},
  {"data", data}
});
```

And for errors:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "invalid request"}
});
```

### Use correct status codes

Use `201 Created` for created resources:

```cpp
ctx.status(cnerium::http::Status::created);
```

Use `400 Bad Request` for invalid client input.

Use `404 Not Found` when a resource does not exist.

Use `500 Internal Server Error` for unexpected server failures.

### Set global headers in middleware

Good:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

Avoid repeating the same header in every route.

### Keep response shapes consistent

Good success shape:

```json
{
  "ok": true,
  "data": {}
}
```

Good error shape:

```json
{
  "ok": false,
  "error": "message"
}
```

### Avoid exposing internal errors in production

During development, returning `ex.what()` is useful.

For production, prefer a generic message:

```cpp
ctx.status(cnerium::http::Status::internal_server_error).json({
  {"ok", false},
  {"error", "internal server error"}
});
```

## Summary

Use `AppContext` to write responses:

```cpp
ctx.text();
ctx.html();
ctx.json();
ctx.status();
ctx.response();
```

Use `ctx.response().set_header()` for headers.

Use JSON for APIs.

Use status codes explicitly when creating resources or returning errors.

Use custom not-found and error handlers for consistent API responses.

## Next step

Continue with JSON.

[Open JSON](/guide/json)
