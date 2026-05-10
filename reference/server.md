# Server

`cnerium::server::Server` is the lower-level HTTP server layer of Cnerium.

It connects:

```txt
HTTP request parsing
routing
middleware
route handlers
not-found handling
error handling
response writing
TCP listener
```

Most applications should use the high-level app layer:

```cpp
#include <cnerium/app/app.hpp>
```

Use `cnerium::server::Server` directly when you need lower-level control over the HTTP server layer.

## Include

```cpp
#include <cnerium/server/server.hpp>
```

## Namespace

```cpp
using namespace cnerium::server;
```

Or use the fully qualified name:

```cpp
cnerium::server::Server server;
```

## Basic usage

```cpp
#include <cnerium/server/server.hpp>
#include <vix/console.hpp>

using namespace cnerium::server;

int main()
{
  Server server;

  server.get("/", [](Context &ctx)
  {
    ctx.response().text("Hello from Cnerium server");
  });

  vix::console.info("Server running on http://127.0.0.1:8080");

  server.run();
}
```

Test:

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```txt
Hello from Cnerium server
```

## Server role

The server layer is responsible for the HTTP execution path.

```txt
TCP connection
  -> request parser
  -> Request
  -> middleware pipeline
  -> router
  -> handler
  -> Response
  -> response writer
```

The app layer builds on top of this server layer.

## Server vs App

Use `App` for normal applications.

Use `Server` when you are working closer to the framework internals.

| API | Purpose |
|---|---|
| `cnerium::app::App` | High-level application API |
| `cnerium::server::Server` | Lower-level HTTP server API |

High-level app:

```cpp
App app;

app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello");
});
```

Lower-level server:

```cpp
Server server;

server.get("/", [](Context &ctx)
{
  ctx.response().text("Hello");
});
```

## Constructor

Create a server with default config:

```cpp
Server server;
```

Create a server with explicit config:

```cpp
Config config;

config.host = "127.0.0.1";
config.port = 8080;

Server server(config);
```

## Config

`Config` controls server behavior.

```cpp
Config config;

config.host = "127.0.0.1";
config.port = 8080;
config.backlog = 128;
config.read_buffer_size = 8 * 1024;
config.max_request_body_size = 1024 * 1024;
config.max_header_size = 16 * 1024;
config.max_requests_per_connection = 100;
config.read_timeout_ms = 5000;
config.write_timeout_ms = 5000;
config.keep_alive_timeout_ms = 10000;
```

## Config fields

```cpp
std::string host;
std::uint16_t port;

int backlog;

std::size_t read_buffer_size;
std::size_t max_request_body_size;
std::size_t max_header_size;
std::size_t max_requests_per_connection;

std::uint32_t read_timeout_ms;
std::uint32_t write_timeout_ms;
std::uint32_t keep_alive_timeout_ms;
```

## Default config

Typical defaults:

```txt
host                         127.0.0.1
port                         8080
backlog                      128
read_buffer_size             8192
max_request_body_size        1048576
max_header_size              16384
max_requests_per_connection  100
read_timeout_ms              5000
write_timeout_ms             5000
keep_alive_timeout_ms        10000
```

## Validate config

Use `valid()`:

```cpp
Config config;

if (!config.valid())
{
  vix::console.error("invalid server config");
  return 1;
}
```

Reset to defaults:

```cpp
config.reset();
```

## Configured server example

```cpp
#include <cnerium/server/server.hpp>
#include <vix/console.hpp>

using namespace cnerium::server;

int main()
{
  Config config;

  config.host = "127.0.0.1";
  config.port = 8080;
  config.backlog = 128;
  config.read_buffer_size = 8 * 1024;
  config.max_request_body_size = 1024 * 1024;
  config.max_header_size = 16 * 1024;
  config.max_requests_per_connection = 100;
  config.read_timeout_ms = 5000;
  config.write_timeout_ms = 5000;
  config.keep_alive_timeout_ms = 10000;

  if (!config.valid())
  {
    vix::console.error("invalid server config");
    return 1;
  }

  Server server(config);

  server.get("/", [](Context &ctx)
  {
    ctx.response().text("Configured Cnerium server");
  });

  vix::console.info("Configured server running on http://127.0.0.1:8080");

  server.run();
}
```

## Context

`Context` represents one server request lifecycle.

It gives access to:

```txt
request
response
route parameters
```

Common usage:

```cpp
server.get("/users/:id", [](Context &ctx)
{
  const auto id = ctx.params().get("id");

  ctx.response().text("User id: " + std::string(id));
});
```

## Context request access

```cpp
ctx.request()
```

Example:

```cpp
server.get("/inspect", [](Context &ctx)
{
  const auto &req = ctx.request();

  ctx.response().json({
    {"method", cnerium::http::to_string(req.method())},
    {"path", std::string(req.path())},
    {"query", std::string(req.query())}
  });
});
```

## Context response access

```cpp
ctx.response()
```

Example:

```cpp
server.get("/", [](Context &ctx)
{
  ctx.response().set_status(cnerium::http::Status::ok);
  ctx.response().text("Hello");
});
```

## Context params access

```cpp
ctx.params()
```

Example:

```cpp
server.get("/shops/:shop_id/products/:product_id", [](Context &ctx)
{
  ctx.response().json({
    {"shop_id", std::string(ctx.params().get("shop_id"))},
    {"product_id", std::string(ctx.params().get("product_id"))}
  });
});
```

## Handler

A server route handler has this type:

```cpp
using Handler = std::function<void(Context &)>;
```

Example:

```cpp
Handler home = [](Context &ctx)
{
  ctx.response().text("Home");
};

server.get("/", home);
```

Most code uses lambdas directly.

## Route helpers

`Server` exposes helpers for common HTTP methods.

```cpp
server.get(path, handler);
server.post(path, handler);
server.put(path, handler);
server.patch(path, handler);
server.delete_(path, handler);
server.add(method, path, handler);
```

## `get()`

Register a `GET` route.

```cpp
server.get("/", [](Context &ctx)
{
  ctx.response().text("Home");
});
```

With route parameters:

```cpp
server.get("/users/:id", [](Context &ctx)
{
  ctx.response().json({
    {"ok", true},
    {"id", std::string(ctx.params().get("id"))}
  });
});
```

## `post()`

Register a `POST` route.

```cpp
server.post("/users", [](Context &ctx)
{
  auto body = ctx.request().json();

  ctx.response().set_status(cnerium::http::Status::created);
  ctx.response().json({
    {"ok", true},
    {"message", "user created"},
    {"name", body["name"]}
  });
});
```

## `put()`

Register a `PUT` route.

```cpp
server.put("/users/:id", [](Context &ctx)
{
  auto body = ctx.request().json();

  ctx.response().json({
    {"ok", true},
    {"message", "user updated"},
    {"id", std::string(ctx.params().get("id"))},
    {"name", body["name"]}
  });
});
```

## `patch()`

Register a `PATCH` route.

```cpp
server.patch("/users/:id", [](Context &ctx)
{
  ctx.response().json({
    {"ok", true},
    {"message", "user patched"},
    {"id", std::string(ctx.params().get("id"))}
  });
});
```

## `delete_()`

Register a `DELETE` route.

```cpp
server.delete_("/users/:id", [](Context &ctx)
{
  ctx.response().empty(cnerium::http::Status::no_content);
});
```

The method is named `delete_()` because `delete` is a reserved C++ keyword.

## `add()`

Register a route with an explicit HTTP method.

```cpp
server.add(cnerium::http::Method::Options, "/users", [](Context &ctx)
{
  ctx.response().empty(cnerium::http::Status::no_content);
});
```

Use `add()` when you want full control over the HTTP method.

## Route parameters

Route parameters use `:name`.

```cpp
server.get("/users/:id", [](Context &ctx)
{
  const auto id = ctx.params().get("id");

  ctx.response().text("User id: " + std::string(id));
});
```

For:

```txt
GET /users/42
```

The server extracts:

```txt
id = 42
```

## Multiple route parameters

```cpp
server.get("/shops/:shop_id/products/:product_id", [](Context &ctx)
{
  const auto shop_id = ctx.params().get("shop_id");
  const auto product_id = ctx.params().get("product_id");

  ctx.response().json({
    {"ok", true},
    {"shop_id", std::string(shop_id)},
    {"product_id", std::string(product_id)}
  });
});
```

## Route order

Routes are matched in registration order.

Register specific routes before dynamic routes.

Good:

```cpp
server.get("/users/me", [](Context &ctx)
{
  ctx.response().text("current user");
});

server.get("/users/:id", [](Context &ctx)
{
  ctx.response().text("user id: " + std::string(ctx.params().get("id")));
});
```

Avoid:

```cpp
server.get("/users/:id", show_user);
server.get("/users/me", current_user);
```

If the dynamic route is registered first, `/users/me` may match as:

```txt
id = me
```

## Middleware

Register global middleware with `use()`.

```cpp
server.use([](cnerium::middleware::Context &ctx,
              cnerium::middleware::Next next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

Middleware runs before the matched route handler.

## Middleware signature

Server middleware uses the middleware module types:

```cpp
[](cnerium::middleware::Context &ctx,
   cnerium::middleware::Next next)
{
  next();
}
```

Example:

```cpp
server.use([](cnerium::middleware::Context &ctx,
              cnerium::middleware::Next next)
{
  vix::console.info(
    "request",
    cnerium::http::to_string(ctx.request().method()),
    ctx.request().path()
  );

  next();
});
```

## Middleware short-circuit

If middleware does not call `next()`, the route handler does not run.

```cpp
server.use([](cnerium::middleware::Context &ctx,
              cnerium::middleware::Next next)
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

## Not-found handler

Use `set_not_found_handler()` to customize unmatched routes.

```cpp
server.set_not_found_handler([](Context &ctx)
{
  ctx.response().set_status(cnerium::http::Status::not_found);
  ctx.response().json({
    {"ok", false},
    {"error", "route not found"},
    {"path", std::string(ctx.request().path())}
  });
});
```

## Default not-found handler

The default not-found handler returns a JSON response shaped like:

```json
{"ok":false,"error":"Not Found","framework":"cnerium"}
```

Use a custom not-found handler for API-specific response shapes.

## Error handler

Use `set_error_handler()` to convert exceptions into HTTP responses.

```cpp
server.set_error_handler([](Context &ctx, const std::exception &ex)
{
  vix::console.error("unhandled exception:", ex.what());

  ctx.response().set_status(cnerium::http::Status::internal_server_error);
  ctx.response().json({
    {"ok", false},
    {"error", "internal server error"}
  });
});
```

## ErrorHandler type

The error handler type is:

```cpp
using ErrorHandler = std::function<void(Context &, const std::exception &)>;
```

The default error handler returns a `500 Internal Server Error` JSON response.

For production, log the real exception server-side and return a safe message to the client.

## `config()`

Access the active server configuration.

```cpp
const auto &config = server.config();

vix::console.info(
  "server",
  "http://" + config.host + ":" + std::to_string(config.port)
);
```

## `run()`

Start the blocking server loop.

```cpp
server.run();
```

A typical server ends with:

```cpp
vix::console.info("Server running on http://127.0.0.1:8080");
server.run();
```

## Complete server example

```cpp
#include <cnerium/server/server.hpp>
#include <cnerium/middleware/middleware.hpp>
#include <cnerium/http/Status.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>

using namespace cnerium::server;

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

  void json_error(Context &ctx,
                  cnerium::http::Status status,
                  std::string message)
  {
    ctx.response().set_status(status);
    ctx.response().json({
      {"ok", false},
      {"error", std::move(message)}
    });
  }

  Server build_server()
  {
    Config config;

    config.host = "127.0.0.1";
    config.port = 8080;
    config.backlog = 128;
    config.max_request_body_size = 1024 * 1024;
    config.max_header_size = 16 * 1024;
    config.read_timeout_ms = 5000;
    config.write_timeout_ms = 5000;
    config.keep_alive_timeout_ms = 10000;

    Server server(config);

    server.use([](cnerium::middleware::Context &ctx,
                  cnerium::middleware::Next next)
    {
      ctx.response().set_header("X-App", "Cnerium");
      ctx.response().set_header("X-Powered-By", "Cnerium");
      next();
    });

    server.use([](cnerium::middleware::Context &ctx,
                  cnerium::middleware::Next next)
    {
      vix::console.info(
        "request",
        cnerium::http::to_string(ctx.request().method()),
        ctx.request().path()
      );

      next();
    });

    server.get("/", [](Context &ctx)
    {
      ctx.response().json({
        {"ok", true},
        {"message", "Server reference example"}
      });
    });

    server.get("/health", [](Context &ctx)
    {
      ctx.response().json({
        {"ok", true},
        {"status", "healthy"}
      });
    });

    server.get("/users/:id", [](Context &ctx)
    {
      const auto id = parse_id(ctx.params().get("id"));

      if (!id)
      {
        json_error(ctx, cnerium::http::Status::bad_request, "invalid user id");
        return;
      }

      ctx.response().json({
        {"ok", true},
        {"id", *id}
      });
    });

    server.post("/echo", [](Context &ctx)
    {
      try
      {
        auto body = ctx.request().json();

        ctx.response().set_status(cnerium::http::Status::created);
        ctx.response().json({
          {"ok", true},
          {"data", body}
        });
      }
      catch (const std::exception &ex)
      {
        json_error(ctx, cnerium::http::Status::bad_request, ex.what());
      }
    });

    server.get("/boom", [](Context &)
    {
      throw std::runtime_error("server handler failed");
    });

    server.delete_("/users/:id", [](Context &ctx)
    {
      ctx.response().empty(cnerium::http::Status::no_content);
    });

    server.set_not_found_handler([](Context &ctx)
    {
      ctx.response().set_status(cnerium::http::Status::not_found);
      ctx.response().json({
        {"ok", false},
        {"error", "route not found"},
        {"path", std::string(ctx.request().path())}
      });
    });

    server.set_error_handler([](Context &ctx, const std::exception &ex)
    {
      vix::console.error("unhandled exception:", ex.what());

      ctx.response().set_status(cnerium::http::Status::internal_server_error);
      ctx.response().json({
        {"ok", false},
        {"error", "internal server error"}
      });
    });

    return server;
  }
}

int main()
{
  auto server = build_server();

  const auto &config = server.config();

  vix::console.info(
    "Server reference example running on",
    "http://" + config.host + ":" + std::to_string(config.port)
  );

  server.run();
}
```

## Test the complete example

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/users/42
curl -i http://127.0.0.1:8080/users/abc

curl -X POST http://127.0.0.1:8080/echo \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'

curl -i -X DELETE http://127.0.0.1:8080/users/42

curl -i http://127.0.0.1:8080/missing
curl -i http://127.0.0.1:8080/boom
```

## API overview

```cpp
class Server
{
public:
  Server();
  explicit Server(const Config &config);

  Server &use(cnerium::middleware::Middleware middleware);

  Server &get(std::string path, Handler handler);
  Server &post(std::string path, Handler handler);
  Server &put(std::string path, Handler handler);
  Server &patch(std::string path, Handler handler);
  Server &delete_(std::string path, Handler handler);

  Server &add(cnerium::http::Method method,
              std::string path,
              Handler handler);

  void set_not_found_handler(Handler handler);
  void set_error_handler(ErrorHandler handler);

  const Config &config() const;

  void run();
};
```

This overview is simplified for quick reference.

## Related types

```cpp
cnerium::server::Config
cnerium::server::Context
cnerium::server::Handler
cnerium::server::ErrorHandler
```

## Config API

```cpp
Config

host
port
backlog
read_buffer_size
max_request_body_size
max_header_size
max_requests_per_connection
read_timeout_ms
write_timeout_ms
keep_alive_timeout_ms

valid()
reset()
```

## Context API

```cpp
Context

request()
response()
params()
```

## Handler API

```cpp
using Handler = std::function<void(Context &)>;
```

## ErrorHandler API

```cpp
using ErrorHandler = std::function<void(Context &, const std::exception &)>;
```

## Common patterns

Text response:

```cpp
server.get("/", [](Context &ctx)
{
  ctx.response().text("Hello");
});
```

JSON response:

```cpp
server.get("/health", [](Context &ctx)
{
  ctx.response().json({
    {"ok", true},
    {"status", "healthy"}
  });
});
```

Created response:

```cpp
server.post("/users", [](Context &ctx)
{
  ctx.response().set_status(cnerium::http::Status::created);
  ctx.response().json({
    {"ok", true},
    {"message", "created"}
  });
});
```

Bad request:

```cpp
ctx.response().set_status(cnerium::http::Status::bad_request);
ctx.response().json({
  {"ok", false},
  {"error", "invalid request"}
});
```

No content:

```cpp
ctx.response().empty(cnerium::http::Status::no_content);
```

## Best practices

### Use App for normal applications

Prefer:

```cpp
#include <cnerium/app/app.hpp>
```

Use `Server` when you need lower-level control.

### Register middleware before routes

Good:

```cpp
server.use(headers);
server.use(logger);

server.get("/", home);
```

### Register specific routes before dynamic routes

Good:

```cpp
server.get("/users/me", current_user);
server.get("/users/:id", show_user);
```

### Use custom error handlers

Always convert unexpected exceptions into safe responses.

```cpp
server.set_error_handler(...);
```

### Use JSON not-found responses for APIs

```cpp
server.set_not_found_handler(...);
```

### Use safe config in production

Behind Nginx:

```cpp
config.host = "127.0.0.1";
config.port = 8080;
```

### Keep handlers small

Handlers should:

```txt
read request data
validate input
call logic
write response
```

Move business logic to functions or services.

### Use `vix::console` for logs

```cpp
vix::console.info("server started");
vix::console.warn("unauthorized request");
vix::console.error("unhandled exception:", ex.what());
```

## Common mistakes

### Using Server when App is enough

For normal application development, prefer:

```cpp
App app;
```

### Forgetting to call `server.run()`

Routes are only registered until you start the server loop.

```cpp
server.run();
```

### Forgetting `next()` in middleware

Wrong:

```cpp
server.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
});
```

Correct:

```cpp
server.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

### Returning internal error details in production

Log the real exception:

```cpp
vix::console.error("unhandled exception:", ex.what());
```

Return safe JSON:

```json
{"ok":false,"error":"internal server error"}
```

### Returning a body with 204

Wrong:

```cpp
ctx.response().set_status(cnerium::http::Status::no_content);
ctx.response().json({{"ok", true}});
```

Correct:

```cpp
ctx.response().empty(cnerium::http::Status::no_content);
```

## Summary

`cnerium::server::Server` is the lower-level HTTP server API.

It provides:

```txt
configuration
middleware
routes
handlers
not-found handling
error handling
server startup
```

Use it directly for low-level control.

Use `cnerium::app::App` for normal applications.

## Next step

Continue with Runtime reference.

[Open Runtime reference](/reference/runtime)
