# Route Parameters

Route parameters let you capture dynamic values from the URL.

They are useful for endpoints like:

```txt
/users/:id
/shops/:shop_id/products/:product_id
/posts/:slug
```

A parameter starts with `:` in the route pattern.

## Basic example

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/users/:id", [](AppContext &ctx)
  {
    ctx.text("User id: " + std::string(ctx.param("id")));
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Route parameters example is ready");
  });
}
```

Run the app:

```bash
vix dev
```

Test it:

```bash
curl http://127.0.0.1:8080/users/42
```

Expected response:

```txt
User id: 42
```

## Parameter syntax

A dynamic segment starts with `:`.

```txt
/users/:id
```

In this route:

```txt
/users/42
```

Cnerium extracts:

```txt
id = "42"
```

You can read it with:

```cpp
ctx.param("id");
```

## Multiple parameters

A route can contain several parameters.

```cpp
app.get("/shops/:shop_id/products/:product_id", [](AppContext &ctx)
{
  ctx.json({
    {"shop_id", std::string(ctx.param("shop_id"))},
    {"product_id", std::string(ctx.param("product_id"))}
  });
});
```

Test it:

```bash
curl http://127.0.0.1:8080/shops/10/products/200
```

Expected response:

```json
{"shop_id":"10","product_id":"200"}
```

## Common examples

```txt
/users/:id
/products/:id
/posts/:slug
/shops/:shop_id/products/:product_id
/countries/:country/cities/:city
/files/:name
```

Each `:name` becomes available through `ctx.param("name")`.

## Reading a parameter

Use `ctx.param()`:

```cpp
app.get("/posts/:slug", [](AppContext &ctx)
{
  const auto slug = ctx.param("slug");

  ctx.json({
    {"ok", true},
    {"slug", std::string(slug)}
  });
});
```

`ctx.param()` returns a string-like value.

When you need to store it in JSON or concatenate it with `std::string`, convert it:

```cpp
std::string(ctx.param("slug"))
```

## Checking if a parameter exists

Use `ctx.has_param()`:

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

You can also check if the route has any parameters:

```cpp
if (ctx.has_params())
{
  // at least one route parameter was extracted
}
```

## Convert a parameter to an integer

Route parameters are extracted as strings.

For numeric ids, parse them safely.

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

Test valid and invalid ids:

```bash
curl http://127.0.0.1:8080/users/42
curl http://127.0.0.1:8080/users/abc
```

## Helper function for parameter parsing

For repeated use, create a small helper:

```cpp
std::optional<int> param_as_int(AppContext &ctx, std::string_view key)
{
  return parse_id(ctx.param(key));
}
```

Then use it:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  const auto id = param_as_int(ctx, "id");

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

## Route order matters

Cnerium routes are matched in insertion order.

The first matching route wins.

This is important when static and dynamic routes share the same shape.

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

Here, `/users/me` matches the static route first.

Avoid this:

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

In that order, `/users/me` may match `/users/:id`, with:

```txt
id = "me"
```

## Static route before dynamic route

Use this pattern:

```cpp
app.get("/users/me", current_user_handler);
app.get("/users/:id", show_user_handler);
```

Not this:

```cpp
app.get("/users/:id", show_user_handler);
app.get("/users/me", current_user_handler);
```

This keeps matching predictable.

## Parameters and query strings

Route parameters come from the path.

Query strings are separate.

For this request:

```txt
/users/42?active=true
```

The route parameter is:

```txt
id = "42"
```

The query string is:

```txt
active=true
```

Read them separately:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  const auto id = ctx.param("id");
  const auto query = ctx.query();

  ctx.json({
    {"id", std::string(id)},
    {"query", std::string(query)}
  });
});
```

## Parameters and request body

Route parameters identify the resource.

The request body usually carries the data.

Example:

```cpp
app.put("/users/:id", [](AppContext &ctx)
{
  const auto id = ctx.param("id");
  const auto body = ctx.json();

  ctx.json({
    {"ok", true},
    {"id", std::string(id)},
    {"name", body["name"]}
  });
});
```

Test it:

```bash
curl -X PUT http://127.0.0.1:8080/users/42 \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada"}'
```

## Parameters in JSON responses

When returning a route parameter in JSON, convert it to `std::string`.

```cpp
ctx.json({
  {"ok", true},
  {"id", std::string(ctx.param("id"))}
});
```

This makes the value explicit and safe for JSON output.

## Complete example

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

  std::optional<int> param_as_int(AppContext &ctx, std::string_view key)
  {
    return parse_id(ctx.param(key));
  }
}

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Route parameters demo");
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
    const auto id = param_as_int(ctx, "id");

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

  app.get("/shops/:shop_id/products/:product_id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"shop_id", std::string(ctx.param("shop_id"))},
      {"product_id", std::string(ctx.param("product_id"))}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Route parameters demo is ready");
  });
}
```

## Test the example

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/users/me
curl http://127.0.0.1:8080/users/42
curl http://127.0.0.1:8080/users/abc
curl http://127.0.0.1:8080/shops/10/products/200
```

## Best practices

### Use clear parameter names

Good:

```txt
/users/:id
/shops/:shop_id/products/:product_id
/posts/:slug
```

Avoid vague names:

```txt
/users/:x
/products/:value
/items/:thing
```

### Parse numeric ids safely

Do not assume a route parameter is a valid number.

Use a helper:

```cpp
const auto id = param_as_int(ctx, "id");

if (!id)
{
  ctx.status(cnerium::http::Status::bad_request).json({
    {"ok", false},
    {"error", "invalid id"}
  });
  return;
}
```

### Register static routes first

Good:

```cpp
app.get("/users/me", handler);
app.get("/users/:id", handler);
```

### Keep parameter logic close to the route

For small apps, parsing inside the handler is fine.

For larger apps, use helper functions like:

```cpp
param_as_int(ctx, "id");
```

### Do not put business logic in parameter parsing

Parameter parsing should only validate and convert.

Business rules should live in services.

## Summary

Route parameters capture dynamic parts of the URL.

Use `:name` in the route pattern:

```txt
/users/:id
```

Read it with:

```cpp
ctx.param("id")
```

Check it with:

```cpp
ctx.has_param("id")
```

Convert numeric values safely with a helper.

Register static routes before dynamic routes when they overlap.

## Next step

Continue with request handling.

[Open Request](/guide/request)
