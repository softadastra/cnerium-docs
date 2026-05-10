# Error Handling

Error handling is how a Cnerium application turns failures into clean HTTP responses.

In a web application, errors can come from:

```txt
invalid JSON
missing fields
invalid route parameters
unauthorized requests
missing resources
thrown exceptions
unexpected server failures
```

Cnerium gives you several ways to handle them:

```txt
manual error responses
validation branches
try/catch inside handlers
custom error handler
custom not-found handler
```

For APIs, the recommended style is to return JSON errors.

## Basic error response

Use `ctx.status()` and `ctx.json()`:

```cpp
app.get("/error", [](AppContext &ctx)
{
  ctx.status(cnerium::http::Status::bad_request).json({
    {"ok", false},
    {"error", "invalid request"}
  });
});
```

Response:

```json
{"ok":false,"error":"invalid request"}
```

## Recommended error shape

For most APIs, use a simple and consistent shape:

```json
{
  "ok": false,
  "error": "message"
}
```

Example:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "name is required"}
});
```

For development, you can include details:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "invalid JSON body"},
  {"message", ex.what()}
});
```

For production, avoid exposing internal details.

## Common status codes

```cpp
cnerium::http::Status::bad_request
cnerium::http::Status::unauthorized
cnerium::http::Status::forbidden
cnerium::http::Status::not_found
cnerium::http::Status::internal_server_error
```

Use them like this:

```cpp
ctx.status(cnerium::http::Status::not_found).json({
  {"ok", false},
  {"error", "user not found"}
});
```

## Status code guide

| Status | Use when |
|--------|----------|
| `400 Bad Request` | The client sent invalid input |
| `401 Unauthorized` | Authentication is missing or invalid |
| `403 Forbidden` | The client is authenticated but not allowed |
| `404 Not Found` | The resource or route does not exist |
| `500 Internal Server Error` | Something unexpected failed on the server |

## Create a small helper

For clean handlers, create a helper for JSON errors.

```cpp
void json_error(AppContext &ctx,
                cnerium::http::Status status,
                std::string message)
{
  ctx.status(status).json({
    {"ok", false},
    {"error", std::move(message)}
  });
}
```

Then use it:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  const auto id = ctx.param("id");

  if (id.empty())
  {
    json_error(ctx, cnerium::http::Status::bad_request, "missing user id");
    return;
  }

  ctx.json({
    {"ok", true},
    {"id", std::string(id)}
  });
});
```

## Validate route parameters

Route parameters are strings.

If you expect a number, parse it safely.

```cpp
#include <optional>
#include <string>
#include <string_view>

std::optional<int> parse_id(std::string_view raw)
{
  try
  {
    return std::stoi(std::string(raw));
  }
  catch (...)
  {
    return std::nullopt;
  }
}
```

Use it in a route:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  const auto id = parse_id(ctx.param("id"));

  if (!id)
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", "invalid user id"}
    });
    return;
  }

  ctx.json({
    {"ok", true},
    {"id", *id}
  });
});
```

Test:

```bash
curl http://127.0.0.1:8080/users/abc
```

Expected response:

```json
{"ok":false,"error":"invalid user id"}
```

## Validate JSON request bodies

When reading JSON from clients, always validate the body.

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

Invalid JSON should return `400 Bad Request`, not crash the server.

## Handle missing resources

Use `404 Not Found` when a resource does not exist.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  const auto id = parse_id(ctx.param("id"));

  if (!id)
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", "invalid user id"}
    });
    return;
  }

  const bool found = false;

  if (!found)
  {
    ctx.status(cnerium::http::Status::not_found).json({
      {"ok", false},
      {"error", "user not found"}
    });
    return;
  }

  ctx.json({
    {"ok", true}
  });
});
```

## Authentication errors

Use `401 Unauthorized` when authentication is missing or invalid.

```cpp
app.get("/me", [](AppContext &ctx)
{
  const auto auth = ctx.header("Authorization");

  if (auth.empty())
  {
    ctx.status(cnerium::http::Status::unauthorized).json({
      {"ok", false},
      {"error", "missing authorization header"}
    });
    return;
  }

  ctx.json({
    {"ok", true},
    {"user", "current"}
  });
});
```

## Authorization errors

Use `403 Forbidden` when the client is authenticated but not allowed.

```cpp
app.get("/admin", [](AppContext &ctx)
{
  const bool allowed = false;

  if (!allowed)
  {
    ctx.status(cnerium::http::Status::forbidden).json({
      {"ok", false},
      {"error", "access denied"}
    });
    return;
  }

  ctx.text("Welcome to admin");
});
```

## Middleware errors

Middleware can stop a request early and return an error response.

```cpp
app.use([](auto &ctx, auto next)
{
  if (ctx.request().path() == "/admin")
  {
    const auto auth = ctx.request().header("X-Auth");

    if (auth != "secret")
    {
      ctx.response().set_status(cnerium::http::Status::unauthorized);
      ctx.response().json({
        {"ok", false},
        {"error", "unauthorized"}
      });
      return;
    }
  }

  next();
});
```

If the middleware returns without calling `next()`, the route handler is skipped.

## Custom not-found handler

When no route matches, Cnerium uses a not-found handler.

You can customize it:

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

Test it:

```bash
curl -i http://127.0.0.1:8080/missing
```

This gives your API a consistent JSON response for unknown routes.

## Custom error handler

A custom error handler converts thrown exceptions into HTTP responses.

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

If a handler throws, the error handler can turn that exception into a response.

## Throwing from a handler

Example:

```cpp
app.get("/boom", [](AppContext &ctx)
{
  throw std::runtime_error("something exploded");
});
```

With a custom error handler:

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

Test:

```bash
curl -i http://127.0.0.1:8080/boom
```

Expected response:

```json
{"ok":false,"error":"internal server error","message":"something exploded"}
```

## Production-safe error handler

In production, avoid exposing `ex.what()` directly.

```cpp
app.set_error_handler([](cnerium::server::Context &ctx,
                         const std::exception &)
{
  ctx.status(cnerium::http::Status::internal_server_error)
      .json({
        {"ok", false},
        {"error", "internal server error"}
      });
});
```

You can still log the exception server-side:

```cpp
app.set_error_handler([](cnerium::server::Context &ctx,
                         const std::exception &ex)
{
  vix::console.error("unhandled exception:", ex.what());

  ctx.status(cnerium::http::Status::internal_server_error)
      .json({
        {"ok", false},
        {"error", "internal server error"}
      });
});
```

## Complete example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>

using namespace cnerium::app;

namespace
{
  std::optional<int> parse_id(std::string_view raw)
  {
    try
    {
      return std::stoi(std::string(raw));
    }
    catch (...)
    {
      return std::nullopt;
    }
  }

  void json_error(AppContext &ctx,
                  cnerium::http::Status status,
                  std::string message)
  {
    ctx.status(status).json({
      {"ok", false},
      {"error", std::move(message)}
    });
  }
}

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
    ctx.json({
      {"ok", true},
      {"message", "Error handling guide example"}
    });
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    const auto id = parse_id(ctx.param("id"));

    if (!id)
    {
      json_error(ctx, cnerium::http::Status::bad_request, "invalid user id");
      return;
    }

    if (*id != 1)
    {
      json_error(ctx, cnerium::http::Status::not_found, "user not found");
      return;
    }

    ctx.json({
      {"ok", true},
      {"user", {
        {"id", 1},
        {"name", "Alice"}
      }}
    });
  });

  app.post("/users", [](AppContext &ctx)
  {
    try
    {
      auto body = ctx.json();

      if (!body.is_object())
      {
        json_error(
          ctx,
          cnerium::http::Status::bad_request,
          "request body must be a JSON object"
        );
        return;
      }

      if (!body.contains("name"))
      {
        json_error(ctx, cnerium::http::Status::bad_request, "name is required");
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
      json_error(ctx, cnerium::http::Status::bad_request, ex.what());
    }
  });

  app.get("/admin", [](AppContext &ctx)
  {
    const auto auth = ctx.header("X-Auth");

    if (auth != "secret")
    {
      json_error(ctx, cnerium::http::Status::unauthorized, "unauthorized");
      return;
    }

    ctx.json({
      {"ok", true},
      {"message", "welcome to admin"}
    });
  });

  app.get("/boom", [](AppContext &)
  {
    throw std::runtime_error("something exploded");
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
    vix::console.error("unhandled exception:", ex.what());

    ctx.status(cnerium::http::Status::internal_server_error)
        .json({
          {"ok", false},
          {"error", "internal server error"},
          {"message", ex.what()}
        });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Error handling guide example is ready");
  });
}
```

## Test the example

Successful request:

```bash
curl http://127.0.0.1:8080/
```

Valid user:

```bash
curl http://127.0.0.1:8080/users/1
```

Invalid id:

```bash
curl -i http://127.0.0.1:8080/users/abc
```

Missing user:

```bash
curl -i http://127.0.0.1:8080/users/99
```

Invalid JSON:

```bash
curl -i -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":}'
```

Missing field:

```bash
curl -i -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{}'
```

Unauthorized admin route:

```bash
curl -i http://127.0.0.1:8080/admin
```

Authorized admin route:

```bash
curl -i http://127.0.0.1:8080/admin \
  -H "X-Auth: secret"
```

Missing route:

```bash
curl -i http://127.0.0.1:8080/missing
```

Thrown exception:

```bash
curl -i http://127.0.0.1:8080/boom
```

## Best practices

### Return JSON errors for APIs

Good:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "invalid request"}
});
```

### Use helper functions

Avoid repeating the same error shape in every handler.

```cpp
json_error(ctx, cnerium::http::Status::bad_request, "invalid id");
```

### Validate before using data

Check route parameters and JSON fields before using them.

```cpp
if (!body.contains("name"))
{
  json_error(ctx, cnerium::http::Status::bad_request, "name is required");
  return;
}
```

### Catch client input errors

Use `try/catch` around `ctx.json()`.

### Log server errors

Use `vix::console.error()` for unexpected failures.

```cpp
vix::console.error("unhandled exception:", ex.what());
```

### Do not expose internal details in production

During development, this is useful:

```cpp
{"message", ex.what()}
```

In production, prefer:

```cpp
{"error", "internal server error"}
```

### Use correct status codes

Avoid returning `200 OK` for errors.

Good:

```cpp
ctx.status(cnerium::http::Status::not_found).json({
  {"ok", false},
  {"error", "user not found"}
});
```

## Summary

Use manual JSON responses for expected errors.

Use `try/catch` for invalid client input.

Use `set_not_found_handler()` for unmatched routes.

Use `set_error_handler()` for thrown exceptions.

Use `vix::console.error()` to log unexpected server failures.

Keep error responses consistent.

## Next step

Continue with not-found handling.

[Open Not Found](/guide/not-found)
