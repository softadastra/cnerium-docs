# Router

`cnerium::router` provides the routing layer of Cnerium.

It matches HTTP methods and paths, extracts dynamic route parameters, and returns a lightweight match result.

The router module is intentionally small and predictable.

It is used by higher-level modules like:

```txt
cnerium/server
cnerium/app
```

## Package

```txt
cnerium/router
```

Current version:

```txt
0.6.0
```

Package metadata:

```json
{
  "name": "router",
  "namespace": "cnerium",
  "version": "0.6.0",
  "type": "header-only",
  "include": "include",
  "license": "MIT",
  "description": "Fast and minimal HTTP router for the Cnerium web framework. Provides path routing, method matching and handler dispatch.",
  "repository": "https://github.com/cnerium/router",
  "deps": {
    "cnerium/http": "0.7.0"
  }
}
```

## Install

```bash
vix add cnerium/router
```

For normal Cnerium applications, install the app layer instead:

```bash
vix add cnerium/app
```

`cnerium/app` pulls the router module through the framework dependency chain.

## Include

Use the main public header:

```cpp
#include <cnerium/router/router.hpp>
```

This gives access to:

```txt
version.hpp
Params.hpp
MatchResult.hpp
Route.hpp
Router.hpp
```

You will usually also need HTTP methods:

```cpp
#include <cnerium/http/Method.hpp>
```

## Namespace

```cpp
using namespace cnerium::router;
```

Or use fully qualified names:

```cpp
cnerium::router::Router router;
```

## Basic route match

```cpp
#include <cnerium/http/Method.hpp>
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::router;

int main()
{
  Router router;

  router.get("/");

  auto result = router.match(Method::Get, "/");

  if (result)
  {
    vix::print("Matched root route");
  }
  else
  {
    vix::print("No match");
  }
}
```

## Router

`Router` stores routes and matches incoming method/path pairs.

```cpp
Router router;

router.get("/");
router.get("/about");
router.get("/users/:id");
```

Then match:

```cpp
auto result = router.match(Method::Get, "/users/42");
```

If the route matches, `result` is truthy:

```cpp
if (result)
{
  // matched
}
```

## Register routes

The router provides helpers for HTTP methods:

```cpp
router.get("/path");
router.post("/path");
router.put("/path");
router.patch("/path");
router.del("/path");
router.head("/path");
router.options("/path");
```

Example:

```cpp
#include <cnerium/http/Method.hpp>
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::router;

int main()
{
  Router router;

  router.get("/users");
  router.post("/users");

  auto get_result = router.match(Method::Get, "/users");
  auto post_result = router.match(Method::Post, "/users");

  if (get_result)
  {
    vix::print("GET /users matched");
  }

  if (post_result)
  {
    vix::print("POST /users matched");
  }
}
```

## Static routes

A static route has no parameters.

```cpp
router.get("/");
router.get("/about");
router.get("/health");
```

Example:

```cpp
#include <cnerium/http/Method.hpp>
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::router;

int main()
{
  Router router;

  router.get("/");
  router.get("/about");

  auto result = router.match(Method::Get, "/about");

  if (result)
  {
    vix::print("Matched /about");
  }
}
```

## Dynamic routes

A dynamic route contains parameters.

A parameter starts with `:`.

```cpp
router.get("/users/:id");
```

For this path:

```txt
/users/42
```

The router extracts:

```txt
id = 42
```

Example:

```cpp
#include <cnerium/http/Method.hpp>
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::router;

int main()
{
  Router router;

  router.get("/users/:id");

  auto result = router.match(Method::Get, "/users/42");

  if (result)
  {
    vix::print("User id =", result.params().get("id"));
  }
  else
  {
    vix::print("No match");
  }
}
```

## Multiple parameters

A route can contain multiple parameters.

```cpp
router.get("/shops/:shop_id/products/:product_id");
```

Example:

```cpp
#include <cnerium/http/Method.hpp>
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::router;

int main()
{
  Router router;

  router.get("/shops/:shop_id/products/:product_id");

  auto result = router.match(
      Method::Get,
      "/shops/10/products/200");

  if (result)
  {
    vix::print("shop_id:", result.params().get("shop_id"));
    vix::print("product_id:", result.params().get("product_id"));
  }
}
```

Expected output:

```txt
shop_id: 10
product_id: 200
```

## Params

`Params` stores extracted route parameters.

```cpp
Params params;

params.set("id", "42");

if (params.contains("id"))
{
  vix::print(params.get("id"));
}
```

Common operations:

```cpp
params.set("id", "42");
params.get("id");
params.contains("id");
params.empty();
params.size();
params.clear();
```

## Iterate params

```cpp
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::router;

int main()
{
  Params params;

  params.set("shop_id", "10");
  params.set("product_id", "200");

  for (const auto &[key, value] : params)
  {
    vix::print(key, "=", value);
  }
}
```

## MatchResult

`MatchResult` represents the result of matching a route.

It stores:

```txt
matched state
extracted params
```

Create a successful result:

```cpp
MatchResult result = MatchResult::success();
```

Create a successful result with params:

```cpp
Params params;
params.set("id", "42");

MatchResult result = MatchResult::success(params);
```

Create a failed result:

```cpp
MatchResult result = MatchResult::failure();
```

## Check match result

You can check a result with:

```cpp
result.matched();
result.failed();
```

Or use it directly in an `if`:

```cpp
if (result)
{
  // matched
}
```

Example:

```cpp
auto result = router.match(Method::Get, "/users/42");

if (result.matched())
{
  vix::print("matched");
}

if (result)
{
  vix::print("also matched");
}
```

## Access params from MatchResult

```cpp
auto result = router.match(Method::Get, "/users/42");

if (result)
{
  auto id = result.params().get("id");
  vix::print("id:", id);
}
```

If the route has no dynamic parameters, the result can still match with empty params.

```cpp
auto result = router.match(Method::Get, "/about");

if (result && result.params().empty())
{
  vix::print("matched static route");
}
```

## Route

`Route` represents one route pattern.

You can use it directly when testing route matching behavior.

```cpp
#include <cnerium/http/Method.hpp>
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::router;

int main()
{
  Route route(Method::Get, "/users/:id");

  auto result = route.match(Method::Get, "/users/42");

  if (result)
  {
    vix::print("id:", result.params().get("id"));
  }
}
```

Most applications use `Router` instead of working with `Route` directly.

## Method matching

Routes match both method and path.

```cpp
router.get("/users");
router.post("/users");
```

This means:

```txt
GET /users   -> matches GET route
POST /users  -> matches POST route
PUT /users   -> no match unless a PUT route exists
```

Example:

```cpp
#include <cnerium/http/Method.hpp>
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::router;

int main()
{
  Router router;

  router.get("/users");
  router.post("/users");

  auto get_result = router.match(Method::Get, "/users");
  auto post_result = router.match(Method::Post, "/users");
  auto put_result = router.match(Method::Put, "/users");

  vix::print("GET matched:", static_cast<bool>(get_result));
  vix::print("POST matched:", static_cast<bool>(post_result));
  vix::print("PUT matched:", static_cast<bool>(put_result));
}
```

## Route order matters

Routes are matched in insertion order.

The first matching route wins.

This matters when static and dynamic routes can both match the same path.

Good:

```cpp
router.get("/users/me");
router.get("/users/:id");
```

Bad:

```cpp
router.get("/users/:id");
router.get("/users/me");
```

If `/users/:id` is registered first, `/users/me` may match as:

```txt
id = me
```

## Static route before dynamic route

Example:

```cpp
#include <cnerium/http/Method.hpp>
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::router;

int main()
{
  Router router;

  router.get("/users/me");
  router.get("/users/:id");

  auto result = router.match(Method::Get, "/users/me");

  if (result)
  {
    if (result.params().empty())
    {
      vix::print("Matched static route /users/me");
    }
    else
    {
      vix::print("Matched dynamic route id=", result.params().get("id"));
    }
  }
}
```

Expected output:

```txt
Matched static route /users/me
```

## Test multiple routes

```cpp
#include <cnerium/http/Method.hpp>
#include <cnerium/router/router.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::router;

int main()
{
  Router router;

  router.get("/");
  router.get("/users");
  router.get("/users/:id");
  router.post("/users");
  router.get("/shops/:shop_id/products/:product_id");

  auto test = [&](Method method, std::string_view path)
  {
    auto result = router.match(method, path);

    vix::print(
        vix::options{.end = ""},
        to_string(method),
        path,
        "->");

    if (!result)
    {
      vix::print("NO MATCH");
      return;
    }

    if (result.params().empty())
    {
      vix::print("MATCH (no params)");
      return;
    }

    vix::print("MATCH params:");

    for (const auto &[key, value] : result.params())
    {
      vix::print(" ", key, "=", value);
    }
  };

  test(Method::Get, "/");
  test(Method::Get, "/users");
  test(Method::Get, "/users/42");
  test(Method::Post, "/users");
  test(Method::Get, "/shops/10/products/200");
  test(Method::Get, "/unknown");
}
```

## Query strings

The router focuses on the path.

A request path should normally be matched without the query string.

At higher layers, the server separates:

```txt
path
query
```

For example:

```txt
/users/42?page=1
```

is handled as:

```txt
path  = /users/42
query = page=1
```

The router matches the path:

```txt
/users/42
```

## Trailing slash behavior

The router is designed to keep matching predictable.

Use consistent route paths in your app.

Recommended:

```txt
/users
/users/:id
/health
```

Avoid mixing unnecessary trailing slashes:

```txt
/users/
/users/:id/
```

Choose one style and keep it consistent.

## Use Router in Cnerium App

Most users do not use `Router` directly.

The high-level app layer uses routing internally.

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

  app.get("/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Router app example is ready");
  });
}
```

## App route helpers

At the app layer, routing is exposed through:

```cpp
app.get("/", handler);
app.post("/users", handler);
app.put("/users/:id", handler);
app.delete_("/users/:id", handler);
app.route(Method::Patch, "/users/:id", handler);
```

These helpers use lower-level routing behind the scenes.

## Complete app example

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
    ctx.text("Router module app example");
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
    vix::console.info("Router module app example is ready");
  });
}
```

## Test the app example

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/users/me
curl http://127.0.0.1:8080/users/42
curl http://127.0.0.1:8080/users/abc

curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'

curl -X PATCH http://127.0.0.1:8080/users/42
```

## API overview

Router API:

```cpp
Router
get()
post()
put()
patch()
del()
head()
options()
add()
match()
clear()
empty()
size()
```

Route API:

```cpp
Route
method()
pattern()
match()
```

Match result API:

```cpp
MatchResult
success()
failure()
matched()
failed()
params()
clear()
operator bool()
```

Params API:

```cpp
Params
set()
get()
contains()
empty()
size()
clear()
begin()
end()
```

## Best practices

### Use App for normal applications

Prefer:

```cpp
#include <cnerium/app/app.hpp>
```

and:

```cpp
app.get("/users/:id", handler);
```

Use `Router` directly for lower-level tests, custom dispatch systems, or framework work.

### Keep route patterns simple

Good:

```txt
/users
/users/:id
/shops/:shop_id/products/:product_id
```

Avoid unclear patterns:

```txt
/doUser
/action/:x/:y
/api/get-user-by-id/:id
```

### Use clear parameter names

Good:

```txt
/users/:id
/shops/:shop_id/products/:product_id
/posts/:slug
```

Avoid:

```txt
/users/:x
/products/:value
/items/:thing
```

### Register specific routes before dynamic routes

Good:

```cpp
router.get("/users/me");
router.get("/users/:id");
```

or at the app layer:

```cpp
app.get("/users/me", handler);
app.get("/users/:id", handler);
```

### Parse route parameters safely

Route parameters are strings.

For numeric ids, parse safely:

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

### Keep routing separate from business logic

Routing should decide which handler runs.

Business logic should live in handlers, services, or repositories.

## Common mistakes

### Registering dynamic routes too early

Wrong:

```cpp
router.get("/users/:id");
router.get("/users/me");
```

Correct:

```cpp
router.get("/users/me");
router.get("/users/:id");
```

### Expecting method mismatch to match

If you only register:

```cpp
router.get("/users");
```

Then:

```txt
POST /users
```

does not match.

Register the method you need:

```cpp
router.post("/users");
```

### Treating route parameters as integers automatically

Parameters are strings.

Convert them explicitly when needed.

### Using Router directly in normal apps

In most application code, use `App`.

```cpp
app.get("/users/:id", handler);
```

## Summary

`cnerium::router` matches HTTP methods and paths.

It supports:

```txt
static routes
dynamic route parameters
method matching
ordered route matching
parameter extraction
```

Use `Router` directly for lower-level work.

Use `App` for normal applications.

Route order matters.

Specific routes should be registered before dynamic routes.

## Next step

Continue with the Middleware module.

[Open Middleware module](/modules/middleware)
