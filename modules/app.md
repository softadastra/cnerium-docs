# App

`cnerium::app` is the high-level application layer of Cnerium.

It is the main API most users should use to build web applications and HTTP APIs.

The app module connects the lower-level Cnerium layers into one clean interface:

```txt
App
  -> Runtime
  -> Server
  -> Middleware
  -> Router
  -> HTTP
  -> JSON
```

Use it when you want to build a Cnerium application without manually wiring the server, router, middleware, and runtime layers.

## Package

```txt
cnerium/app
```

Current version:

```txt
0.5.0
```

Package metadata:

```json
{
  "name": "app",
  "namespace": "cnerium",
  "version": "0.5.0",
  "type": "header-only",
  "include": "include",
  "license": "MIT",
  "description": "High-level application layer for the Cnerium web framework.",
  "repository": "https://github.com/cnerium/app",
  "deps": [
    {
      "id": "cnerium/runtime",
      "version": "0.4.0"
    }
  ]
}
```

## Install

```bash
vix add cnerium/app
```

This is the recommended package for normal Cnerium applications.

It pulls the full framework stack through the dependency chain.

## Include

Use the main public header:

```cpp
#include <cnerium/app/app.hpp>
```

This gives access to:

```txt
version.hpp
AppConfig.hpp
AppContext.hpp
AppHandler.hpp
App.hpp
```

## Namespace

```cpp
using namespace cnerium::app;
```

Or use fully qualified names:

```cpp
cnerium::app::App app;
```

## Basic app

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

## Role of the App module

The app module gives you the cleanest framework API.

Instead of working directly with lower-level server types:

```cpp
server.get("/", [](cnerium::server::Context &ctx)
{
  ctx.response().text("Hello");
});
```

You can write:

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello");
});
```

The `App` layer adapts your `AppContext` handlers to the server layer internally.

## App

`App` is the main application object.

```cpp
App app;
```

It owns or exposes the framework pieces needed by a web application:

```txt
configuration
server
runtime
routes
middleware
error handlers
not-found handler
```

A normal application follows this lifecycle:

```txt
create App
register middleware
register routes
register error handlers
listen
```

Example:

```cpp
App app;

app.use(...);

app.get("/", ...);
app.post("/users", ...);

app.set_not_found_handler(...);
app.set_error_handler(...);

app.listen();
```

## AppConfig

`AppConfig` is the high-level configuration object.

It controls both server and runtime settings.

```cpp
AppConfig config;

config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

App app(config);
```

Common fields:

```cpp
config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

config.backlog = 128;
config.read_buffer_size = 8 * 1024;
config.max_request_body_size = 1024 * 1024;
config.max_header_size = 16 * 1024;
config.max_requests_per_connection = 100;
config.read_timeout_ms = 5000;
config.write_timeout_ms = 5000;
config.keep_alive_timeout_ms = 10000;
```

## Configured app

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  AppConfig config;

  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 4;

  App app(config);

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Configured Cnerium app");
  });

  app.listen([]()
  {
    vix::console.info("Configured app is ready");
  });
}
```

When an app is created with `AppConfig`, you can call:

```cpp
app.listen();
```

or:

```cpp
app.listen(callback);
```

The configured host and port will be used.

## AppContext

`AppContext` is the high-level request/response context used inside route handlers.

Example:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"id", std::string(ctx.param("id"))}
  });
});
```

It provides helpers for:

```txt
request data
route parameters
headers
body
JSON body
text responses
HTML responses
JSON responses
status codes
raw request access
raw response access
```

## AppContext request helpers

Common request helpers:

```cpp
ctx.method();
ctx.path();
ctx.query();
ctx.header("Content-Type");
ctx.param("id");
ctx.has_param("id");
ctx.has_params();
ctx.body();
ctx.json();
ctx.request();
```

Example:

```cpp
app.get("/inspect/:id", [](AppContext &ctx)
{
  ctx.json({
    {"method", cnerium::http::to_string(ctx.method())},
    {"path", std::string(ctx.path())},
    {"query", std::string(ctx.query())},
    {"id", std::string(ctx.param("id"))},
    {"user_agent", std::string(ctx.header("User-Agent"))}
  });
});
```

## AppContext response helpers

Common response helpers:

```cpp
ctx.text("Hello");
ctx.html("<h1>Hello</h1>");
ctx.json({{"ok", true}});
ctx.status(cnerium::http::Status::created);
ctx.ok("done");
ctx.error(cnerium::http::Status::bad_request, "invalid request");
ctx.response();
```

Example:

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

## AppHandler

`AppHandler` is the route handler type used by the app layer.

```cpp
using AppHandler = std::function<void(AppContext &)>;
```

Example:

```cpp
AppHandler hello = [](AppContext &ctx)
{
  ctx.text("Hello");
};

app.get("/", hello);
```

Most of the time, you simply pass lambdas directly.

## Register routes

The app layer provides route helpers:

```cpp
app.get("/", handler);
app.post("/users", handler);
app.put("/users/:id", handler);
app.delete_("/users/:id", handler);
app.route(cnerium::http::Method::Patch, "/users/:id", handler);
```

`delete_()` uses an underscore because `delete` is a reserved keyword in C++.

## GET route

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Home");
});
```

## POST route

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

## PUT route

```cpp
app.put("/users/:id", [](AppContext &ctx)
{
  auto body = ctx.json();

  ctx.json({
    {"ok", true},
    {"message", "user updated"},
    {"id", std::string(ctx.param("id"))},
    {"name", body["name"]}
  });
});
```

## DELETE route

```cpp
app.delete_("/users/:id", [](AppContext &ctx)
{
  ctx.response().empty(cnerium::http::Status::no_content);
});
```

## Explicit method route

```cpp
app.route(cnerium::http::Method::Patch, "/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"message", "user patched"},
    {"id", std::string(ctx.param("id"))}
  });
});
```

## Route parameters

Use `:name` in the route path.

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

## JSON responses

Use `ctx.json()`.

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

## JSON request bodies

Use `ctx.json()` to parse the request body as JSON.

```cpp
app.post("/users", [](AppContext &ctx)
{
  auto body = ctx.json();

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"name", body["name"]},
    {"email", body["email"]}
  });
});
```

For client input, use `try/catch`.

```cpp
app.post("/users", [](AppContext &ctx)
{
  try
  {
    auto body = ctx.json();

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
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

## Middleware

Use `app.use()` to register middleware.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

Middleware can:

```txt
inspect the request
modify the response
call next()
stop the request early
return errors
```

## Middleware example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.use([](auto &ctx, auto next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    next();
  });

  app.use([](auto &ctx, auto next)
  {
    vix::console.info(
      "request",
      cnerium::http::to_string(ctx.request().method()),
      ctx.request().path()
    );

    next();
  });

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

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Public route");
  });

  app.get("/admin", [](AppContext &ctx)
  {
    ctx.text("Welcome to admin");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("App middleware example is ready");
  });
}
```

Test:

```bash
curl -i http://127.0.0.1:8080/
curl -i http://127.0.0.1:8080/admin
curl -i http://127.0.0.1:8080/admin -H "X-Auth: secret"
```

## Not-found handler

Use `set_not_found_handler()` to customize unmatched routes.

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

This is useful for APIs that should always return JSON.

## Error handler

Use `set_error_handler()` to convert thrown exceptions into HTTP responses.

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

This keeps unexpected errors from escaping the request lifecycle.

## Runtime access

`App` exposes the runtime.

```cpp
app.runtime()
```

Use it for background work.

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

## Background task from a route

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  app.runtime().post([]()
  {
    vix::console.info("background job executed");
  });

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "job scheduled"}
  });
});
```

## Copy request data before background work

Do not capture `AppContext&` inside a background task.

Wrong:

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  app.runtime().post([&ctx]()
  {
    vix::console.info(ctx.path());
  });

  ctx.json({{"ok", true}});
});
```

Correct:

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  std::string path(ctx.path());

  app.runtime().post([path]()
  {
    vix::console.info("background job from", path);
  });

  ctx.json({{"ok", true}});
});
```

The request context may no longer be valid when the background task runs.

## Server access

`App` also exposes the lower-level server when needed.

```cpp
app.server()
```

Most applications do not need this.

Use it only when you need lower-level control that is not exposed by the high-level app API.

## Configuration access

You can read the app configuration:

```cpp
const auto &config = app.config();

vix::console.info("host", config.host, "port", config.port);
```

This is useful for startup logs or diagnostics.

## Listen

Start the application with `listen()`.

Direct host and port:

```cpp
app.listen("127.0.0.1", 8080);
```

With callback:

```cpp
app.listen("127.0.0.1", 8080, []()
{
  vix::console.info("App is ready");
});
```

Using config:

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;

App app(config);

app.listen();
```

Using config with callback:

```cpp
app.listen([]()
{
  vix::console.info("App is ready");
});
```

## Route organization

For larger apps, move route registration into functions.

```cpp
#pragma once

#include <cnerium/app/app.hpp>

namespace api::handlers
{
  inline void register_health_routes(cnerium::app::App &app)
  {
    app.get("/health", [](cnerium::app::AppContext &ctx)
    {
      ctx.json({
        {"ok", true},
        {"status", "healthy"}
      });
    });
  }
}
```

Then in `main.cpp`:

```cpp
#include <api/handlers/HealthHandlers.hpp>

int main()
{
  cnerium::app::App app;

  api::handlers::register_health_routes(app);

  app.listen("127.0.0.1", 8080);
}
```

## Middleware organization

For reusable middleware, use functions too.

```cpp
#pragma once

#include <cnerium/app/app.hpp>

namespace api::middleware
{
  inline void register_app_headers(cnerium::app::App &app)
  {
    app.use([](auto &ctx, auto next)
    {
      ctx.response().set_header("X-App", "Cnerium");
      next();
    });
  }
}
```

Then:

```cpp
api::middleware::register_app_headers(app);
```

## Complete API example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <optional>
#include <string>
#include <string_view>
#include <vector>

using namespace cnerium::app;

namespace
{
  struct User
  {
    int id{};
    std::string name;
    std::string email;
    bool active{true};
  };

  std::vector<User> users = {
      {1, "Alice", "alice@example.com", true},
      {2, "Bob", "bob@example.com", true},
      {3, "Charlie", "charlie@example.com", false},
  };

  int next_user_id = 4;

  cnerium::json::value to_json(const User &user)
  {
    return cnerium::json::object{
        {"id", user.id},
        {"name", user.name},
        {"email", user.email},
        {"active", user.active}};
  }

  cnerium::json::value users_to_json(const std::vector<User> &items)
  {
    cnerium::json::array result;

    for (const auto &user : items)
    {
      result.push_back(to_json(user));
    }

    return result;
  }

  std::optional<std::size_t> find_user_index_by_id(int id)
  {
    for (std::size_t i = 0; i < users.size(); ++i)
    {
      if (users[i].id == id)
      {
        return i;
      }
    }

    return std::nullopt;
  }

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
  AppConfig config;
  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 4;

  App app(config);

  app.use([](auto &ctx, auto next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    next();
  });

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"name", "Cnerium Users API"},
      {"version", "0.1.0"}
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"},
      {"users_count", static_cast<int>(users.size())}
    });
  });

  app.get("/users", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"count", static_cast<int>(users.size())},
      {"data", users_to_json(users)}
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

    const auto index = find_user_index_by_id(*id);

    if (!index)
    {
      json_error(ctx, cnerium::http::Status::not_found, "user not found");
      return;
    }

    ctx.json({
      {"ok", true},
      {"data", to_json(users[*index])}
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

      if (!body.contains("name") || !body.contains("email"))
      {
        json_error(
          ctx,
          cnerium::http::Status::bad_request,
          "fields 'name' and 'email' are required"
        );
        return;
      }

      User user;
      user.id = next_user_id++;
      user.name = body["name"].as_string();
      user.email = body["email"].as_string();
      user.active = body.contains("active")
                      ? body["active"].as_bool()
                      : true;

      users.push_back(user);

      ctx.status(cnerium::http::Status::created).json({
        {"ok", true},
        {"message", "user created"},
        {"data", to_json(user)}
      });
    }
    catch (const std::exception &ex)
    {
      json_error(ctx, cnerium::http::Status::bad_request, ex.what());
    }
  });

  app.post("/jobs", [&app](AppContext &ctx)
  {
    std::string path(ctx.path());

    app.runtime().post([path]()
    {
      vix::console.info("background job from", path);
    });

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "job scheduled"}
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

  app.listen([]()
  {
    vix::console.info("Cnerium Users API is ready");
  });
}
```

## Test the complete example

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/users
curl http://127.0.0.1:8080/users/1
curl http://127.0.0.1:8080/users/99
curl http://127.0.0.1:8080/users/abc
```

Create a user:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com","active":true}'
```

Schedule a background job:

```bash
curl -X POST http://127.0.0.1:8080/jobs
```

Missing route:

```bash
curl -i http://127.0.0.1:8080/missing
```

## API overview

App API:

```cpp
App

use()

get()
post()
put()
delete_()
route()

listen()

set_not_found_handler()
set_error_handler()

config()
server()
runtime()
```

AppConfig API:

```cpp
AppConfig

host
port
thread_count

backlog
read_buffer_size
max_request_body_size
max_header_size
max_requests_per_connection
read_timeout_ms
write_timeout_ms
keep_alive_timeout_ms
```

AppContext request API:

```cpp
method()
path()
query()
header()
param()
has_param()
has_params()
body()
json()
request()
```

AppContext response API:

```cpp
status()
text()
html()
json()
ok()
error()
response()
```

AppHandler:

```cpp
using AppHandler = std::function<void(AppContext &)>;
```

## Best practices

### Use App as the default entry point

For most applications:

```cpp
#include <cnerium/app/app.hpp>
```

### Keep `main.cpp` small

Good structure:

```cpp
int main()
{
  App app;

  register_middleware(app);
  register_routes(app);
  register_error_handlers(app);

  app.listen();
}
```

### Use `AppConfig` for real applications

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

App app(config);
```

### Use direct listen arguments for small examples

```cpp
app.listen("127.0.0.1", 8080);
```

### Use JSON for APIs

Success:

```cpp
ctx.json({
  {"ok", true},
  {"data", data}
});
```

Error:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "invalid request"}
});
```

### Validate request input

Always validate client JSON before using it.

```cpp
if (!body.contains("name"))
{
  ctx.status(cnerium::http::Status::bad_request).json({
    {"ok", false},
    {"error", "name is required"}
  });
  return;
}
```

### Use middleware for cross-cutting behavior

Good middleware responsibilities:

```txt
headers
logging
auth
CORS
maintenance mode
request timing
```

### Use runtime for background work

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

### Copy request data before scheduling tasks

Good:

```cpp
std::string path(ctx.path());

app.runtime().post([path]()
{
  vix::console.info(path);
});
```

### Use `vix::console` for logs

```cpp
vix::console.info("app ready");
vix::console.warn("unauthorized request");
vix::console.error("unhandled exception:", ex.what());
```

## Common mistakes

### Using lower-level Server when App is enough

Prefer:

```cpp
App app;
```

instead of:

```cpp
cnerium::server::Server server;
```

for normal apps.

### Capturing AppContext in background work

Wrong:

```cpp
app.runtime().post([&ctx]()
{
  vix::console.info(ctx.path());
});
```

Correct:

```cpp
std::string path(ctx.path());

app.runtime().post([path]()
{
  vix::console.info(path);
});
```

### Forgetting to call `next()` in middleware

Wrong:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
});
```

Correct:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

### Returning internal exceptions to users in production

Log the internal error:

```cpp
vix::console.error("unhandled exception:", ex.what());
```

Return a safe response:

```cpp
ctx.status(cnerium::http::Status::internal_server_error).json({
  {"ok", false},
  {"error", "internal server error"}
});
```

### Registering dynamic routes before specific routes

Wrong:

```cpp
app.get("/users/:id", show_user);
app.get("/users/me", current_user);
```

Correct:

```cpp
app.get("/users/me", current_user);
app.get("/users/:id", show_user);
```

## Summary

`cnerium::app` is the high-level framework layer.

It provides:

```txt
App
AppConfig
AppContext
AppHandler
```

Use it for normal Cnerium applications.

It gives you routing, middleware, JSON responses, error handling, runtime access, and server startup from one clean API.

For most projects, this is the only Cnerium module you need to include directly:

```cpp
#include <cnerium/app/app.hpp>
```

## Next step

Continue with examples.

[Open Examples](/examples/)
