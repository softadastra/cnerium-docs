# Routing

Routing is how Cnerium connects an HTTP request to the code that should handle it.

A route is made of:

```txt
HTTP method
path pattern
handler
```

Example:

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello from Cnerium");
});
```

When a request matches the method and path, Cnerium executes the handler.

## Basic route

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
    vix::console.info("Cnerium app is ready");
  });
}
```

Run the app:

```bash
vix dev
```

Test it:

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```txt
Hello from Cnerium
```

## Route methods

Cnerium provides helpers for common HTTP methods:

```cpp
app.get("/", handler);
app.post("/users", handler);
app.put("/users/:id", handler);
app.delete_("/users/:id", handler);
```

`delete_()` uses an underscore because `delete` is a reserved keyword in C++.

## GET routes

Use `get()` for routes that read data.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Home page");
});

app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"}
  });
});
```

Test:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
```

## POST routes

Use `post()` for routes that create data.

```cpp
app.post("/users", [](AppContext &ctx)
{
  auto body = ctx.json();

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "user created"},
    {"name", body["name"]}
  });
});
```

Test:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'
```

## PUT routes

Use `put()` for routes that update data.

```cpp
app.put("/users/:id", [](AppContext &ctx)
{
  auto id = ctx.param("id");
  auto body = ctx.json();

  ctx.json({
    {"ok", true},
    {"message", "user updated"},
    {"id", std::string(id)},
    {"name", body["name"]}
  });
});
```

Test:

```bash
curl -X PUT http://127.0.0.1:8080/users/42 \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada"}'
```

## DELETE routes

Use `delete_()` for routes that remove data.

```cpp
app.delete_("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"message", "user deleted"},
    {"id", std::string(ctx.param("id"))}
  });
});
```

Test:

```bash
curl -X DELETE http://127.0.0.1:8080/users/42
```

## Explicit method routes

You can also register a route with an explicit HTTP method:

```cpp
#include <cnerium/http/Method.hpp>

app.route(cnerium::http::Method::Patch, "/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"message", "user patched"},
    {"id", std::string(ctx.param("id"))}
  });
});
```

Use `route()` when you want to register a method that does not have a direct helper.

## Static routes

A static route has no parameters.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Home");
});

app.get("/about", [](AppContext &ctx)
{
  ctx.text("About");
});

app.get("/contact", [](AppContext &ctx)
{
  ctx.text("Contact");
});
```

Static routes are useful for fixed endpoints.

```txt
/
 /about
 /contact
 /health
```

## Dynamic routes

A dynamic route contains parameters.

A route parameter starts with `:`.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("User id: " + std::string(ctx.param("id")));
});
```

Test:

```bash
curl http://127.0.0.1:8080/users/42
```

Expected response:

```txt
User id: 42
```

## Multiple route parameters

A route can contain multiple parameters.

```cpp
app.get("/shops/:shop_id/products/:product_id", [](AppContext &ctx)
{
  ctx.json({
    {"shop_id", std::string(ctx.param("shop_id"))},
    {"product_id", std::string(ctx.param("product_id"))}
  });
});
```

Test:

```bash
curl http://127.0.0.1:8080/shops/10/products/200
```

Expected response:

```json
{"shop_id":"10","product_id":"200"}
```

## Reading route parameters

Use `ctx.param(name)`:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  auto id = ctx.param("id");

  ctx.json({
    {"ok", true},
    {"id", std::string(id)}
  });
});
```

`ctx.param()` returns a string-like value.

If you need an integer, parse it:

```cpp
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

Then:

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

## Checking if a parameter exists

Use `has_param()`:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  if (!ctx.has_param("id"))
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", "missing id"}
    });
    return;
  }

  ctx.text("User id: " + std::string(ctx.param("id")));
});
```

Use `has_params()` if you only need to know whether the route has any parameters:

```cpp
if (ctx.has_params())
{
  // route has at least one extracted parameter
}
```

## Route order matters

Cnerium routes are matched in insertion order.

The first matching route wins.

This matters when a static route and a dynamic route can both match the same path.

Good:

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

`/users/me` is registered first, so it matches before `/users/:id`.

Avoid this order:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("User id: " + std::string(ctx.param("id")));
});

app.get("/users/me", [](AppContext &ctx)
{
  ctx.text("Current user");
});
```

In that case, `/users/me` may be treated as:

```txt
id = "me"
```

## Route groups by convention

Cnerium does not need a complex routing DSL to keep projects clean.

For larger applications, group routes by feature using functions.

Example:

```cpp
#pragma once

#include <cnerium/app/app.hpp>

namespace api::handlers
{
  inline void register_user_routes(cnerium::app::App &app)
  {
    app.get("/users", [](cnerium::app::AppContext &ctx)
    {
      ctx.json({
        {"ok", true},
        {"data", cnerium::json::array{}}
      });
    });

    app.get("/users/:id", [](cnerium::app::AppContext &ctx)
    {
      ctx.json({
        {"ok", true},
        {"id", std::string(ctx.param("id"))}
      });
    });
  }
}
```

Then in `main.cpp`:

```cpp
#include <api/handlers/UserHandlers.hpp>

int main()
{
  cnerium::app::App app;

  api::handlers::register_user_routes(app);

  app.listen("127.0.0.1", 8080);
}
```

This keeps `main.cpp` clean.

## Complete routing example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Method.hpp>
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

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Home");
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.get("/users", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"data", cnerium::json::array{}}
    });
  });

  app.get("/users/me", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"user", "current"}
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

    ctx.json({
      {"ok", true},
      {"id", *id}
    });
  });

  app.post("/users", [](AppContext &ctx)
  {
    auto body = ctx.json();

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "user created"},
      {"name", body["name"]}
    });
  });

  app.put("/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "user updated"},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.delete_("/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "user deleted"},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.route(cnerium::http::Method::Patch, "/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "user patched"},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Routing example is ready");
  });
}
```

## Test the routes

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/users
curl http://127.0.0.1:8080/users/me
curl http://127.0.0.1:8080/users/42

curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'

curl -X PUT http://127.0.0.1:8080/users/42 \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada"}'

curl -X DELETE http://127.0.0.1:8080/users/42
```

## Best practices

### Keep routes readable

Good:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"id", std::string(ctx.param("id"))}
  });
});
```

Avoid putting too much business logic directly inside the route when the app grows.

### Keep route names simple

Good:

```txt
/users
/users/:id
/shops/:shop_id/products/:product_id
```

Avoid vague or inconsistent paths:

```txt
/do-user-stuff
/getUserById
/user_get
```

### Register static routes first

Good:

```cpp
app.get("/users/me", handler);
app.get("/users/:id", handler);
```

### Keep handlers thin

For larger applications, move logic into services:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  const auto user = user_service.find(ctx.param("id"));
  ctx.json(user);
});
```

## Summary

Routing connects HTTP requests to C++ handlers.

You can register routes with:

```cpp
app.get()
app.post()
app.put()
app.delete_()
app.route()
```

Use `:name` for dynamic parameters:

```txt
/users/:id
/shops/:shop_id/products/:product_id
```

Use `ctx.param("name")` to read route parameters.

Route order matters because the first matching route wins.

## Next step

Continue with route parameters.

[Open Route Parameters](/guide/route-parameters)
