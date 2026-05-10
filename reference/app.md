# App

`cnerium::app::App` is the main high-level application object.

It is the recommended entry point for building Cnerium web applications and HTTP APIs.

Use `App` to:

```txt
configure an application
register middleware
register routes
register not-found handlers
register error handlers
access the runtime
access the lower-level server
start listening
```

For most projects, this is the main include you need:

```cpp
#include <cnerium/app/app.hpp>
```

## Include

```cpp
#include <cnerium/app/app.hpp>
```

## Namespace

```cpp
using namespace cnerium::app;
```

Or use the fully qualified name:

```cpp
cnerium::app::App app;
```

## Basic usage

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

## Constructor

Create an app with default configuration:

```cpp
App app;
```

Create an app with explicit configuration:

```cpp
AppConfig config;

config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

App app(config);
```

## Default construction

```cpp
App app;
```

Use this for small examples and local demos.

Then listen with explicit host and port:

```cpp
app.listen("127.0.0.1", 8080);
```

## Construction with AppConfig

```cpp
AppConfig config;

config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

App app(config);

app.listen();
```

When the app is constructed with `AppConfig`, `listen()` uses the configured host and port.

## App lifecycle

A normal Cnerium app follows this lifecycle:

```txt
create App
register middleware
register routes
register not-found handler
register error handler
listen
```

Example:

```cpp
int main()
{
  App app;

  app.use(...);

  app.get("/", ...);
  app.post("/users", ...);

  app.set_not_found_handler(...);
  app.set_error_handler(...);

  app.listen("127.0.0.1", 8080);
}
```

## Route methods

`App` exposes helpers for common HTTP methods.

```cpp
app.get(path, handler);
app.post(path, handler);
app.put(path, handler);
app.delete_(path, handler);
app.route(method, path, handler);
```

`delete_()` uses an underscore because `delete` is a reserved C++ keyword.

## `get()`

Register a `GET` route.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Home");
});
```

With route parameters:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"id", std::string(ctx.param("id"))}
  });
});
```

## `post()`

Register a `POST` route.

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

## `put()`

Register a `PUT` route.

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

## `delete_()`

Register a `DELETE` route.

```cpp
app.delete_("/users/:id", [](AppContext &ctx)
{
  ctx.response().empty(cnerium::http::Status::no_content);
});
```

## `route()`

Register a route with an explicit HTTP method.

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

Use `route()` when you want a method that does not have a direct helper.

## Route handler signature

An app route handler receives an `AppContext&`.

```cpp
[](AppContext &ctx)
{
}
```

The named handler type is:

```cpp
using AppHandler = std::function<void(AppContext &)>;
```

Example:

```cpp
AppHandler home = [](AppContext &ctx)
{
  ctx.text("Home");
};

app.get("/", home);
```

Most code uses lambdas directly.

## Route parameters

Use `:name` in the route path.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("User id: " + std::string(ctx.param("id")));
});
```

For:

```txt
GET /users/42
```

Cnerium extracts:

```txt
id = 42
```

Read it with:

```cpp
ctx.param("id")
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

## Route order

Routes are matched in registration order.

Register specific routes before dynamic routes.

Good:

```cpp
app.get("/users/me", [](AppContext &ctx)
{
  ctx.text("current user");
});

app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("user id: " + std::string(ctx.param("id")));
});
```

Avoid:

```cpp
app.get("/users/:id", show_user);
app.get("/users/me", current_user);
```

If the dynamic route is registered first, `/users/me` may match as:

```txt
id = me
```

## `use()`

Register middleware.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

Middleware runs before route handlers.

A middleware can:

```txt
inspect the request
modify the response
call next()
stop the request early
return an error response
```

## Middleware signature

Middleware usually uses this signature:

```cpp
[](auto &ctx, auto next)
{
  next();
}
```

Example:

```cpp
app.use([](auto &ctx, auto next)
{
  vix::console.info(
    "request",
    cnerium::http::to_string(ctx.request().method()),
    ctx.request().path()
  );

  next();
});
```

## Middleware order

Middleware runs in the order it is registered.

```cpp
app.use(first);
app.use(second);
app.use(third);
```

Execution:

```txt
first
second
third
route handler
```

Each middleware must call `next()` for the request to continue.

## Stop a request in middleware

If a middleware does not call `next()`, the pipeline stops.

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

## `set_not_found_handler()`

Register a custom handler for unmatched routes.

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

Use this to return consistent JSON for missing routes.

## Not-found handler signature

```cpp
[](cnerium::server::Context &ctx)
{
}
```

The not-found handler receives the lower-level server context.

## `set_error_handler()`

Register a custom handler for exceptions thrown during request handling.

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

Use this to prevent unexpected exceptions from escaping the request lifecycle.

## Error handler signature

```cpp
[](cnerium::server::Context &ctx, const std::exception &ex)
{
}
```

For production, log the real exception server-side and return a safe message to the client.

## `listen()`

Start the application.

There are several common forms.

## Listen with explicit host and port

```cpp
app.listen("127.0.0.1", 8080);
```

## Listen with explicit host, port, and callback

```cpp
app.listen("127.0.0.1", 8080, []()
{
  vix::console.info("App is ready");
});
```

## Listen using AppConfig

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;

App app(config);

app.listen();
```

## Listen using AppConfig with callback

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;

App app(config);

app.listen([]()
{
  vix::console.info("App is ready");
});
```

## Startup callback

The startup callback is useful for logs.

```cpp
app.listen("127.0.0.1", 8080, []()
{
  vix::console.info("Cnerium app is ready");
});
```

Keep startup logs short and useful.

## `config()`

Access the app configuration.

```cpp
const auto &config = app.config();

vix::console.info("host", config.host, "port", config.port);
```

This is useful for diagnostics and startup logs.

## `runtime()`

Access the runtime.

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

Use it for background work.

## Runtime task from route

```cpp
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
```

Copy request data before scheduling background tasks.

Do not capture `AppContext&` inside runtime tasks.

## `server()`

Access the lower-level server.

```cpp
auto &server = app.server();
```

Most applications do not need this.

Use it only when you need lower-level server control not exposed by the app layer.

## Complete minimal API

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

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "App reference example"}
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
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

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("App reference example is ready");
  });
}
```

## API overview

```cpp
class App
{
public:
  App();
  explicit App(const AppConfig &config);

  App &use(...);

  App &get(std::string path, AppHandler handler);
  App &post(std::string path, AppHandler handler);
  App &put(std::string path, AppHandler handler);
  App &delete_(std::string path, AppHandler handler);

  App &route(cnerium::http::Method method,
             std::string path,
             AppHandler handler);

  void listen();
  void listen(callback);
  void listen(std::string host, std::uint16_t port);
  void listen(std::string host, std::uint16_t port, callback);

  void set_not_found_handler(...);
  void set_error_handler(...);

  const AppConfig &config() const;

  cnerium::server::Server &server();
  cnerium::runtime::Runtime &runtime();
};
```

This overview is simplified for quick reference.

## Common route patterns

Home route:

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Home");
});
```

Health route:

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"}
  });
});
```

List route:

```cpp
app.get("/users", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"data", cnerium::json::array{}}
  });
});
```

Show route:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"id", std::string(ctx.param("id"))}
  });
});
```

Create route:

```cpp
app.post("/users", [](AppContext &ctx)
{
  auto body = ctx.json();

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"name", body["name"]}
  });
});
```

Delete route:

```cpp
app.delete_("/users/:id", [](AppContext &ctx)
{
  ctx.response().empty(cnerium::http::Status::no_content);
});
```

## Common middleware patterns

Global header:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

Request logger:

```cpp
app.use([](auto &ctx, auto next)
{
  vix::console.info(
    "request",
    cnerium::http::to_string(ctx.request().method()),
    ctx.request().path()
  );

  next();
});
```

Auth guard:

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

## Best practices

### Use App for normal applications

Prefer:

```cpp
#include <cnerium/app/app.hpp>
```

and:

```cpp
App app;
```

### Keep setup order clear

Good:

```cpp
App app;

register_middleware(app);
register_routes(app);
register_error_handlers(app);

app.listen();
```

### Register middleware before routes

This keeps app startup easy to read.

```cpp
app.use(headers);
app.use(logger);

app.get("/", home);
```

### Register specific routes before dynamic routes

Good:

```cpp
app.get("/users/me", current_user);
app.get("/users/:id", show_user);
```

### Use `AppConfig` for real apps

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

App app(config);
```

### Use direct listen arguments for examples

```cpp
app.listen("127.0.0.1", 8080);
```

### Copy data before background tasks

Good:

```cpp
std::string path(ctx.path());

app.runtime().post([path]()
{
  vix::console.info(path);
});
```

Avoid:

```cpp
app.runtime().post([&ctx]()
{
  vix::console.info(ctx.path());
});
```

### Use safe production error responses

Good:

```cpp
vix::console.error("unhandled exception:", ex.what());

ctx.status(cnerium::http::Status::internal_server_error).json({
  {"ok", false},
  {"error", "internal server error"}
});
```

## Common mistakes

### Forgetting to call `listen()`

Routes are registered, but the app will not run until:

```cpp
app.listen(...);
```

### Forgetting `next()` in middleware

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

### Capturing request context in runtime tasks

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

### Using Server when App is enough

For normal apps, use:

```cpp
App app;
```

not:

```cpp
cnerium::server::Server server;
```

### Returning internal exception messages in production

Avoid exposing:

```cpp
ex.what()
```

to clients in production.

Log it with `vix::console.error()` and return a safe JSON error.

## Summary

`App` is the main Cnerium application object.

Use it to:

```txt
register routes
register middleware
configure errors
access runtime
start the app
```

For most applications, this is the main API:

```cpp
cnerium::app::App app;
```

and this is the main include:

```cpp
#include <cnerium/app/app.hpp>
```

## Next step

Continue with AppContext.

[Open AppContext reference](/reference/app-context)
