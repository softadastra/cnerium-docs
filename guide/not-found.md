# Not Found

A `404 Not Found` response is returned when no route matches the incoming request.

In Cnerium, you can use the default not-found behavior or define your own not-found handler.

For APIs, the recommended style is to return a JSON response.

## What “not found” means

A request is considered not found when the method and path do not match any registered route.

Example:

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Home");
});
```

This route matches:

```txt
GET /
```

But this request does not match:

```txt
GET /missing
```

So Cnerium should return `404 Not Found`.

## Basic example

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Home");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Not found example is ready");
  });
}
```

Run:

```bash
vix dev
```

Test an existing route:

```bash
curl -i http://127.0.0.1:8080/
```

Test a missing route:

```bash
curl -i http://127.0.0.1:8080/missing
```

## Default not-found response

The server layer provides a default not-found handler.

It returns a `404 Not Found` response with a simple JSON body:

```json
{
  "ok": false,
  "error": "Not Found",
  "framework": "cnerium"
}
```

This gives a safe fallback when no custom handler is registered.

## Custom not-found handler

Use `set_not_found_handler()` to customize the response.

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

Now missing routes return your custom JSON response.

## Complete custom example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "Home"}
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
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

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Custom not-found example is ready");
  });
}
```

Test it:

```bash
curl -i http://127.0.0.1:8080/missing
```

Expected response:

```json
{"ok":false,"error":"route not found","path":"/missing"}
```

## Include the request path

Including the path is useful during development:

```cpp
{"path", std::string(ctx.path())}
```

Example response:

```json
{
  "ok": false,
  "error": "route not found",
  "path": "/api/unknown"
}
```

For public production APIs, this is usually fine, but avoid exposing internal routing details beyond the requested path.

## JSON not-found response

For APIs, prefer JSON:

```cpp
app.set_not_found_handler([](cnerium::server::Context &ctx)
{
  ctx.status(cnerium::http::Status::not_found)
      .json({
        {"ok", false},
        {"error", "not found"}
      });
});
```

This keeps API responses consistent.

## Text not-found response

For simple apps, a text response may be enough:

```cpp
app.set_not_found_handler([](cnerium::server::Context &ctx)
{
  ctx.status(cnerium::http::Status::not_found)
      .text("Not Found");
});
```

## HTML not-found response

For browser-facing applications, you can return HTML:

```cpp
app.set_not_found_handler([](cnerium::server::Context &ctx)
{
  ctx.status(cnerium::http::Status::not_found)
      .html("<h1>404</h1><p>Page not found</p>");
});
```

For JSON APIs, prefer JSON.

## Not found vs resource not found

There are two different cases:

```txt
route not found
resource not found
```

A route is not found when no route exists:

```txt
GET /unknown
```

A resource is not found when the route exists, but the requested item does not:

```txt
GET /users/999
```

Handle route not found with `set_not_found_handler()`.

Handle resource not found inside the route handler.

## Resource not found example

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  const auto id = ctx.param("id");

  const bool user_exists = false;

  if (!user_exists)
  {
    ctx.status(cnerium::http::Status::not_found).json({
      {"ok", false},
      {"error", "user not found"},
      {"id", std::string(id)}
    });
    return;
  }

  ctx.json({
    {"ok", true}
  });
});
```

This is not the same as the global not-found handler.

The route matched, but the resource did not exist.

## Method mismatch

A route must match both the HTTP method and the path.

If you register:

```cpp
app.get("/users", [](AppContext &ctx)
{
  ctx.text("users");
});
```

Then this matches:

```txt
GET /users
```

But this does not match that route:

```txt
POST /users
```

If no `POST /users` route exists, the request should fall through to not-found handling.

## Route order and not found

Routes are matched in insertion order.

Register specific routes before dynamic routes when needed:

```cpp
app.get("/users/me", [](AppContext &ctx)
{
  ctx.text("Current user");
});

app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("User id: " + std::string(ctx.param("id")));
});
```

If the order is reversed, `/users/me` may match `/users/:id`.

That means it would not reach the not-found handler.

It would be treated as:

```txt
id = "me"
```

## Logging missing routes

You can log missing routes inside the not-found handler:

```cpp
app.set_not_found_handler([](cnerium::server::Context &ctx)
{
  vix::console.warn(
    "not found",
    cnerium::http::to_string(ctx.method()),
    ctx.path()
  );

  ctx.status(cnerium::http::Status::not_found)
      .json({
        {"ok", false},
        {"error", "route not found"},
        {"path", std::string(ctx.path())}
      });
});
```

This is useful during development and debugging.

## Full API example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <optional>
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
      {"message", "Not found guide example"}
    });
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
    const auto id = parse_id(ctx.param("id"));

    if (!id)
    {
      ctx.status(cnerium::http::Status::bad_request).json({
        {"ok", false},
        {"error", "invalid user id"}
      });
      return;
    }

    if (*id != 1)
    {
      ctx.status(cnerium::http::Status::not_found).json({
        {"ok", false},
        {"error", "user not found"},
        {"id", *id}
      });
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

  app.set_not_found_handler([](cnerium::server::Context &ctx)
  {
    vix::console.warn(
      "route not found",
      cnerium::http::to_string(ctx.method()),
      ctx.path()
    );

    ctx.status(cnerium::http::Status::not_found)
        .json({
          {"ok", false},
          {"error", "route not found"},
          {"path", std::string(ctx.path())}
        });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Not found guide example is ready");
  });
}
```

## Test the example

Existing route:

```bash
curl http://127.0.0.1:8080/
```

Health route:

```bash
curl http://127.0.0.1:8080/health
```

Existing user:

```bash
curl http://127.0.0.1:8080/users/1
```

Missing resource:

```bash
curl -i http://127.0.0.1:8080/users/99
```

Invalid parameter:

```bash
curl -i http://127.0.0.1:8080/users/abc
```

Missing route:

```bash
curl -i http://127.0.0.1:8080/missing
```

Wrong method:

```bash
curl -i -X POST http://127.0.0.1:8080/health
```

## Best practices

### Return JSON for APIs

For APIs, use JSON not-found responses:

```cpp
ctx.status(cnerium::http::Status::not_found).json({
  {"ok", false},
  {"error", "route not found"}
});
```

### Keep route not found and resource not found separate

Use the global not-found handler for unmatched routes.

Use route handlers for missing resources.

### Include the path during development

This helps debugging:

```cpp
{"path", std::string(ctx.path())}
```

### Log missing routes

Use `vix::console.warn()` when debugging routing issues.

```cpp
vix::console.warn("route not found", ctx.path());
```

### Register specific routes first

Good:

```cpp
app.get("/users/me", handler);
app.get("/users/:id", handler);
```

### Keep the response shape consistent

Good:

```json
{
  "ok": false,
  "error": "route not found"
}
```

## Common mistakes

### Confusing route not found with resource not found

Wrong:

```cpp
app.set_not_found_handler([](auto &ctx)
{
  // user not found logic
});
```

Correct:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  // user not found logic here
});
```

### Forgetting that method matters

`GET /users` and `POST /users` are different routes.

If only `GET /users` exists, `POST /users` does not match it.

### Registering dynamic routes before specific routes

Wrong:

```cpp
app.get("/users/:id", handler);
app.get("/users/me", handler);
```

Correct:

```cpp
app.get("/users/me", handler);
app.get("/users/:id", handler);
```

## Summary

Use `set_not_found_handler()` to customize unmatched route responses.

Use `404 Not Found` for missing routes and missing resources.

For APIs, return JSON errors.

Keep route not found and resource not found separate.

Register specific routes before dynamic routes.

## Next step

Continue with runtime.

[Open Runtime](/guide/runtime)
