# Server

`cnerium::server` provides the HTTP server layer of Cnerium.

It connects the lower-level modules into a working HTTP execution engine:

```txt
HTTP request parsing
routing
middleware
handlers
not-found handling
error handling
TCP listener
response writing
```

The server module is lower-level than `cnerium/app`.

For normal applications, use:

```cpp
#include <cnerium/app/app.hpp>
```

Use the server module directly when you want more control over the HTTP server layer.

## Package

```txt
cnerium/server
```

Current version:

```txt
0.5.0
```

Package metadata:

```json
{
  "name": "server",
  "namespace": "cnerium",
  "version": "0.5.0",
  "type": "header-only",
  "include": "include",
  "license": "MIT",
  "description": "HTTP server layer for the Cnerium web framework. Connects transport, routing, middleware, and HTTP request/response handling.",
  "repository": "https://github.com/cnerium/server",
  "deps": [
    {
      "id": "cnerium/middleware",
      "version": "0.3.0"
    },
    {
      "id": "cnerium/router",
      "version": "0.6.0"
    }
  ]
}
```

## Install

```bash
vix add cnerium/server
```

For normal Cnerium applications, install the app layer instead:

```bash
vix add cnerium/app
```

`cnerium/app` pulls the server module through the framework dependency chain.

## Include

Use the main public header:

```cpp
#include <cnerium/server/server.hpp>
```

This gives access to:

```txt
version.hpp
Config.hpp
Context.hpp
Handler.hpp
ErrorHandler.hpp
not_found.hpp
Server.hpp
```

## Namespace

```cpp
using namespace cnerium::server;
```

Or use fully qualified names:

```cpp
cnerium::server::Server server;
```

## Basic server

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

## Role of the server module

The server module is responsible for the full HTTP request execution path.

```txt
TCP connection
  -> request parser
  -> request object
  -> router
  -> middleware pipeline
  -> route handler
  -> response object
  -> response writer
```

It is the bridge between low-level HTTP transport and high-level request handling.

## Server vs App

Use `Server` when you want lower-level control.

Use `App` for normal applications.

| Layer | Purpose |
|------|---------|
| `cnerium::server::Server` | Lower-level HTTP server |
| `cnerium::app::App` | High-level application API |

Normal application:

```cpp
#include <cnerium/app/app.hpp>
```

Lower-level server work:

```cpp
#include <cnerium/server/server.hpp>
```

## Config

`Config` controls server behavior.

```cpp
Config config;
config.host = "127.0.0.1";
config.port = 8080;

Server server(config);
```

Common fields:

```cpp
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

## Default configuration

The default server configuration is:

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

Use `valid()` to check basic configuration validity.

```cpp
Config config;

if (!config.valid())
{
  vix::console.error("invalid server config");
  return 1;
}
```

You can reset config to defaults:

```cpp
config.reset();
```

## Config example

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
    ctx.response().text("Configured server");
  });

  vix::console.info("Server running on http://127.0.0.1:8080");

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

In a server handler:

```cpp
server.get("/users/:id", [](Context &ctx)
{
  auto id = ctx.params().get("id");

  ctx.response().text("User: " + std::string(id));
});
```

## Handler

A `Handler` is the route handler callable type.

```cpp
using Handler = std::function<void(Context &)>;
```

Example:

```cpp
Handler hello = [](Context &ctx)
{
  ctx.response().text("Hello");
};
```

Then register it:

```cpp
server.get("/", hello);
```

## Register GET routes

```cpp
server.get("/", [](Context &ctx)
{
  ctx.response().text("Home page");
});

server.get("/about", [](Context &ctx)
{
  ctx.response().text("About Cnerium");
});
```

## Register route parameters

```cpp
server.get("/users/:id", [](Context &ctx)
{
  const auto id = ctx.params().get("id");

  ctx.response().text("User id: " + std::string(id));
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
server.get("/shops/:shop_id/products/:product_id", [](Context &ctx)
{
  const auto shop_id = ctx.params().get("shop_id");
  const auto product_id = ctx.params().get("product_id");

  ctx.response().text(
      "Shop: " + std::string(shop_id) +
      ", Product: " + std::string(product_id));
});
```

Test:

```bash
curl http://127.0.0.1:8080/shops/7/products/15
```

## JSON responses

Use the response object to return JSON.

```cpp
server.get("/health", [](Context &ctx)
{
  ctx.response().json({
    {"status", "ok"},
    {"uptime", "ready"}
  });
});
```

Pretty JSON:

```cpp
ctx.response().json({
  {"ok", true},
  {"framework", "Cnerium"}
}, true);
```

## Basic routes example

```cpp
#include <cnerium/server/server.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::server;

int main()
{
  Server server;

  server.get("/", [](Context &ctx)
  {
    ctx.response().text("Home page");
  });

  server.get("/about", [](Context &ctx)
  {
    ctx.response().text("About Cnerium");
  });

  server.get("/users/:id", [](Context &ctx)
  {
    const auto id = ctx.params().get("id");
    ctx.response().text("User id: " + std::string(id));
  });

  server.get("/shops/:shop_id/products/:product_id", [](Context &ctx)
  {
    const auto shop_id = ctx.params().get("shop_id");
    const auto product_id = ctx.params().get("product_id");

    ctx.response().text(
        "Shop: " + std::string(shop_id) +
        ", Product: " + std::string(product_id));
  });

  vix::console.info("Routes example running on http://127.0.0.1:8080");

  server.run();
}
```

Test:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/about
curl http://127.0.0.1:8080/users/42
curl http://127.0.0.1:8080/shops/7/products/15
```

## JSON route example

```cpp
#include <cnerium/server/server.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::server;

int main()
{
  Server server;

  server.get("/", [](Context &ctx)
  {
    ctx.response().json(cnerium::json::object{
      {"ok", true},
      {"framework", "Cnerium"},
      {"version", "0.5.0"}
    }, true);
  });

  server.get("/users/:id", [](Context &ctx)
  {
    const auto id = ctx.params().get("id");

    ctx.response().json(cnerium::json::object{
      {"ok", true},
      {"user", cnerium::json::object{
        {"id", std::string(id)},
        {"name", "Gaspard"},
        {"skills", cnerium::json::array{"C++", "HTTP", "Systems"}}
      }}
    }, true);
  });

  server.get("/health", [](Context &ctx)
  {
    ctx.response().json(cnerium::json::object{
      {"status", "ok"},
      {"uptime", "ready"}
    });
  });

  vix::console.info("JSON server running on http://127.0.0.1:8080");

  server.run();
}
```

Test:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/users/42
curl http://127.0.0.1:8080/health
```

## Middleware

The server integrates the middleware module.

Use `server.use()` to register global middleware.

```cpp
server.use([](cnerium::middleware::Context &ctx,
              cnerium::middleware::Next next)
{
  ctx.response().set_header("X-Powered-By", "Cnerium");
  next();
});
```

Middleware runs before the matched route handler.

## Middleware example

```cpp
#include <cnerium/server/server.hpp>
#include <cnerium/middleware/middleware.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <string_view>

using namespace cnerium::server;

int main()
{
  Server server;

  server.use([](cnerium::middleware::Context &ctx,
                cnerium::middleware::Next next)
  {
    ctx.response().set_header("X-Powered-By", "Cnerium");
    next();
  });

  server.use([](cnerium::middleware::Context &ctx,
                cnerium::middleware::Next next)
  {
    ctx.response().set_header(
        "X-Request-Path",
        std::string(ctx.request().path()));

    next();
  });

  server.use([](cnerium::middleware::Context &ctx,
                cnerium::middleware::Next next)
  {
    if (ctx.request().path() == "/admin")
    {
      const std::string_view auth = ctx.request().header("X-Auth");

      if (auth != "secret")
      {
        ctx.response().set_status(cnerium::http::Status::unauthorized);
        ctx.response().text("Unauthorized");
        return;
      }
    }

    next();
  });

  server.get("/", [](Context &ctx)
  {
    ctx.response().text("Public route");
  });

  server.get("/admin", [](Context &ctx)
  {
    ctx.response().text("Welcome to admin");
  });

  vix::console.info("Middleware server running on http://127.0.0.1:8080");

  server.run();
}
```

Test:

```bash
curl -i http://127.0.0.1:8080/
curl -i http://127.0.0.1:8080/admin
curl -i -H "X-Auth: secret" http://127.0.0.1:8080/admin
```

## Short-circuit middleware

A middleware can stop a request before it reaches the handler.

```cpp
server.use([](cnerium::middleware::Context &ctx,
              cnerium::middleware::Next next)
{
  if (ctx.request().path() == "/admin")
  {
    ctx.response().set_status(cnerium::http::Status::unauthorized);
    ctx.response().json({
      {"ok", false},
      {"error", "unauthorized"}
    });
    return;
  }

  next();
});
```

If `next()` is not called, the route handler is skipped.

## Not-found handler

The server has a default not-found handler.

It returns:

```json
{"ok":false,"error":"Not Found","framework":"cnerium"}
```

You can customize it:

```cpp
server.set_not_found_handler([](Context &ctx)
{
  ctx.response().set_status(cnerium::http::Status::not_found);
  ctx.response().json({
    {"ok", false},
    {"error", "Route not found"},
    {"path", std::string(ctx.request().path())}
  }, true);
});
```

## Not-found example

```cpp
#include <cnerium/server/server.hpp>
#include <cnerium/http/Status.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

using namespace cnerium::server;

int main()
{
  Server server;

  server.set_not_found_handler([](Context &ctx)
  {
    ctx.response().set_status(cnerium::http::Status::not_found);
    ctx.response().json(cnerium::json::object{
      {"ok", false},
      {"error", "Route not found"},
      {"path", std::string(ctx.request().path())}
    }, true);
  });

  server.get("/", [](Context &ctx)
  {
    ctx.response().text("Not-found demo");
  });

  vix::console.info("Not-found server running on http://127.0.0.1:8080");

  server.run();
}
```

Test:

```bash
curl -i http://127.0.0.1:8080/missing
```

## Error handler

The server can convert thrown exceptions into HTTP responses.

The default error handler returns:

```json
{
  "ok": false,
  "error": "Internal Server Error",
  "details": "...",
  "framework": "cnerium"
}
```

You can customize it:

```cpp
server.set_error_handler([](Context &ctx, const std::exception &ex)
{
  ctx.response().set_status(cnerium::http::Status::internal_server_error);
  ctx.response().json({
    {"ok", false},
    {"error", "Internal Server Error"},
    {"message", ex.what()}
  }, true);
});
```

## Error handling example

```cpp
#include <cnerium/server/server.hpp>
#include <cnerium/http/Status.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <stdexcept>

using namespace cnerium::server;

int main()
{
  Server server;

  server.set_not_found_handler([](Context &ctx)
  {
    ctx.response().set_status(cnerium::http::Status::not_found);
    ctx.response().json(cnerium::json::object{
      {"ok", false},
      {"error", "Route not found"},
      {"path", std::string(ctx.request().path())}
    }, true);
  });

  server.set_error_handler([](Context &ctx, const std::exception &ex)
  {
    vix::console.error("unhandled exception:", ex.what());

    ctx.response().set_status(cnerium::http::Status::internal_server_error);
    ctx.response().json(cnerium::json::object{
      {"ok", false},
      {"error", "Internal Server Error"},
      {"message", std::string(ex.what())}
    }, true);
  });

  server.get("/", [](Context &ctx)
  {
    ctx.response().text("Error handling demo");
  });

  server.get("/boom", [](Context &)
  {
    throw std::runtime_error("Something exploded in the handler");
  });

  vix::console.info("Error server running on http://127.0.0.1:8080");

  server.run();
}
```

Test:

```bash
curl -i http://127.0.0.1:8080/
curl -i http://127.0.0.1:8080/missing
curl -i http://127.0.0.1:8080/boom
```

## Server lifecycle

The basic server lifecycle is:

```txt
construct server
register middleware
register routes
register not-found handler
register error handler
run server
```

Example:

```cpp
Server server;

server.use(...);

server.get("/", ...);

server.set_not_found_handler(...);
server.set_error_handler(...);

server.run();
```

`server.run()` starts the blocking server loop.

## `run()` and `listen()`

In examples, the server layer commonly uses:

```cpp
server.run();
```

The high-level app layer commonly uses:

```cpp
app.listen();
```

Use the style exposed by the layer you are working with.

## Access server config

```cpp
const auto &config = server.config();

vix::console.info("host", config.host, "port", config.port);
```

This is useful for startup messages.

## Startup message helper

```cpp
void print_startup_message(const cnerium::server::Config &config)
{
  vix::console.info(
      "Listening on",
      "http://" + config.host + ":" + std::to_string(config.port));
}
```

Then:

```cpp
print_startup_message(server.config());
server.run();
```

## Complete server example

```cpp
#include <cnerium/server/server.hpp>
#include <cnerium/middleware/middleware.hpp>
#include <cnerium/http/Status.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <stdexcept>
#include <string>
#include <string_view>

using namespace cnerium::server;

namespace
{
  Server build_server()
  {
    Server server;

    server.use([](cnerium::middleware::Context &ctx,
                  cnerium::middleware::Next next)
    {
      ctx.response().set_header("X-Powered-By", "Cnerium");
      next();
    });

    server.use([](cnerium::middleware::Context &ctx,
                  cnerium::middleware::Next next)
    {
      if (ctx.request().path() == "/admin")
      {
        const std::string_view auth = ctx.request().header("X-Auth");

        if (auth != "secret")
        {
          ctx.response().set_status(cnerium::http::Status::unauthorized);
          ctx.response().json(cnerium::json::object{
            {"ok", false},
            {"error", "unauthorized"}
          });
          return;
        }
      }

      next();
    });

    server.get("/", [](Context &ctx)
    {
      ctx.response().json(cnerium::json::object{
        {"ok", true},
        {"message", "Server module example"}
      });
    });

    server.get("/health", [](Context &ctx)
    {
      ctx.response().json(cnerium::json::object{
        {"ok", true},
        {"status", "healthy"}
      });
    });

    server.get("/users/:id", [](Context &ctx)
    {
      const auto id = ctx.params().get("id");

      ctx.response().json(cnerium::json::object{
        {"ok", true},
        {"id", std::string(id)}
      });
    });

    server.get("/admin", [](Context &ctx)
    {
      ctx.response().text("Welcome to admin");
    });

    server.get("/boom", [](Context &)
    {
      throw std::runtime_error("server handler exploded");
    });

    server.set_not_found_handler([](Context &ctx)
    {
      ctx.response().set_status(cnerium::http::Status::not_found);
      ctx.response().json(cnerium::json::object{
        {"ok", false},
        {"error", "route not found"},
        {"path", std::string(ctx.request().path())}
      });
    });

    server.set_error_handler([](Context &ctx, const std::exception &ex)
    {
      vix::console.error("unhandled exception:", ex.what());

      ctx.response().set_status(cnerium::http::Status::internal_server_error);
      ctx.response().json(cnerium::json::object{
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
      "Server module example running on",
      "http://" + config.host + ":" + std::to_string(config.port));

  server.run();
}
```

## Test the complete example

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/users/42

curl -i http://127.0.0.1:8080/admin
curl -i -H "X-Auth: secret" http://127.0.0.1:8080/admin

curl -i http://127.0.0.1:8080/missing
curl -i http://127.0.0.1:8080/boom
```

## Server module vs App module

The server module exposes lower-level types:

```cpp
cnerium::server::Server
cnerium::server::Context
cnerium::server::Handler
cnerium::server::Config
```

The app module exposes higher-level types:

```cpp
cnerium::app::App
cnerium::app::AppContext
cnerium::app::AppHandler
cnerium::app::AppConfig
```

In app code, this:

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello");
});
```

is preferred over this:

```cpp
server.get("/", [](Context &ctx)
{
  ctx.response().text("Hello");
});
```

Use `Server` when you are working closer to the framework internals.

## API overview

Config API:

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

Handler type:

```cpp
using Handler = std::function<void(Context &)>;
```

Error handler type:

```cpp
using ErrorHandler = std::function<void(Context &, const std::exception &)>;
```

Default handlers:

```cpp
not_found(ctx)
default_error_handler(ctx, exception)
```

Server API:

```cpp
Server

use()

get()
post()
put()
patch()
delete_()
add()

set_not_found_handler()
set_error_handler()

config()
run()
```

Context API:

```cpp
Context

request()
response()
params()
```

## Best practices

### Use App for normal applications

Prefer:

```cpp
#include <cnerium/app/app.hpp>
```

Use the server module directly only when you need lower-level control.

### Register middleware before routes

Good structure:

```cpp
Server server;

server.use(headers);
server.use(auth);

server.get("/", home);
server.get("/health", health);

server.run();
```

### Use JSON for APIs

Good:

```cpp
ctx.response().json({
  {"ok", true}
});
```

For errors:

```cpp
ctx.response().set_status(cnerium::http::Status::bad_request);
ctx.response().json({
  {"ok", false},
  {"error", "invalid request"}
});
```

### Use custom error handlers

Do not let exceptions escape the request lifecycle.

```cpp
server.set_error_handler(...);
```

### Use custom not-found handlers for APIs

This keeps missing-route responses consistent.

```cpp
server.set_not_found_handler(...);
```

### Keep handlers small

Move business logic into functions or services.

The server handler should read request data, call logic, and write a response.

### Use `vix::console` for logs

```cpp
vix::console.info("server started");
vix::console.warn("route not found");
vix::console.error("unhandled exception:", ex.what());
```

## Common mistakes

### Using Server when App is enough

For most applications, this is simpler:

```cpp
App app;
```

instead of:

```cpp
Server server;
```

### Forgetting to call `server.run()`

Routes are only registered until the server loop starts.

```cpp
server.run();
```

### Exposing internal errors to users

Log the real error:

```cpp
vix::console.error("unhandled exception:", ex.what());
```

Return a safe response:

```json
{"ok":false,"error":"internal server error"}
```

### Forgetting that middleware can stop the request

If middleware does not call `next()`, the route handler is skipped.

### Returning a body with `204 No Content`

Use:

```cpp
ctx.response().empty(cnerium::http::Status::no_content);
```

## Summary

`cnerium::server` is the HTTP server layer of Cnerium.

It connects:

```txt
HTTP
Router
Middleware
Handlers
Not-found handling
Error handling
TCP listener
Response writer
```

Use it directly for lower-level server work.

Use `cnerium::app` for normal applications.

## Next step

Continue with the Runtime module.

[Open Runtime module](/modules/runtime)
