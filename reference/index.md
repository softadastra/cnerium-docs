# Reference

The reference section gives direct API-oriented documentation for the main Cnerium types and Vix output helpers used across the docs.

Use this section when you already understand the guide and want to quickly check:

```txt
available classes
important methods
configuration fields
handler signatures
request helpers
response helpers
runtime helpers
printing helpers
logging helpers
```

For learning, start with the guide.

For quick lookup, use the reference pages.

## Reference pages

```txt
1. App
2. AppContext
3. AppConfig
4. Server
5. Runtime
6. vix::print
7. vix::console
```

## App

`App` is the main high-level application object.

Use it to register routes, middleware, error handlers, and start the application.

```cpp
#include <cnerium/app/app.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Hello from Cnerium");
  });

  app.listen("127.0.0.1", 8080);
}
```

Common API:

```cpp
app.use(...)

app.get(...)
app.post(...)
app.put(...)
app.delete_(...)
app.route(...)

app.listen(...)
app.set_not_found_handler(...)
app.set_error_handler(...)

app.config()
app.server()
app.runtime()
```

[Open App reference](/reference/app)

## AppContext

`AppContext` is the high-level context passed to route handlers.

It gives access to the request, response, route parameters, body, JSON parsing, and response helpers.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"id", std::string(ctx.param("id"))}
  });
});
```

Request helpers:

```cpp
ctx.method()
ctx.path()
ctx.query()
ctx.header("Content-Type")
ctx.param("id")
ctx.has_param("id")
ctx.has_params()
ctx.body()
ctx.json()
ctx.request()
```

Response helpers:

```cpp
ctx.status(...)
ctx.text(...)
ctx.html(...)
ctx.json(...)
ctx.ok(...)
ctx.error(...)
ctx.response()
```

[Open AppContext reference](/reference/app-context)

## AppConfig

`AppConfig` controls the high-level app configuration.

It is used by the app layer to configure both the server and the runtime.

```cpp
AppConfig config;

config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

App app(config);
```

Important fields:

```cpp
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

[Open AppConfig reference](/reference/app-config)

## Server

`cnerium::server::Server` is the lower-level HTTP server layer.

Most applications should use `App`, but `Server` is useful when working closer to the framework internals.

```cpp
#include <cnerium/server/server.hpp>

using namespace cnerium::server;

int main()
{
  Server server;

  server.get("/", [](Context &ctx)
  {
    ctx.response().text("Hello from server");
  });

  server.run();
}
```

Common API:

```cpp
server.use(...)

server.get(...)
server.post(...)
server.put(...)
server.patch(...)
server.delete_(...)
server.add(...)

server.set_not_found_handler(...)
server.set_error_handler(...)

server.config()
server.run()
```

[Open Server reference](/reference/server)

## Runtime

`cnerium::runtime` provides the concurrent execution layer.

In normal apps, access it through:

```cpp
app.runtime()
```

Example:

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

Main runtime types:

```cpp
Task
ThreadPool
Executor
Scheduler
Runtime
ServerRunner
```

Common runtime API:

```cpp
runtime.start()
runtime.post(...)
runtime.dispatch(...)
runtime.stop()
runtime.join()

runtime.executor()
runtime.scheduler()
```

[Open Runtime reference](/reference/runtime)

## vix::print

`vix::print` is used for simple output in examples and standalone snippets.

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print("Hello from Vix");
  vix::print("name:", "Gaspard", "age:", 25);
}
```

It supports:

```txt
strings
numbers
booleans
containers
optional
variant
tuple
custom formatters
custom separators
custom ending
stderr output
flush
pretty containers
```

[Open vix::print reference](/reference/vix-print)

## vix::console

`vix::console` is used for application logs.

```cpp
#include <vix/console.hpp>

int main()
{
  vix::console.info("Application started");
  vix::console.warn("This is a warning");
  vix::console.error("This is an error");
}
```

Common log levels:

```cpp
vix::console.debug(...)
vix::console.log(...)
vix::console.info(...)
vix::console.warn(...)
vix::console.error(...)
```

Environment variables:

```bash
VIX_CONSOLE_LEVEL=debug
VIX_COLOR=always
NO_COLOR=1
```

[Open vix::console reference](/reference/vix-console)

## Recommended lookup order

Use this order if you are checking the framework API:

```txt
1. App
2. AppContext
3. AppConfig
4. Server
5. Runtime
6. vix::print
7. vix::console
```

This follows the normal application flow:

```txt
configure app
register routes
handle requests
send responses
run background tasks
print/log output
```

## Main include files

High-level app:

```cpp
#include <cnerium/app/app.hpp>
```

Lower-level server:

```cpp
#include <cnerium/server/server.hpp>
```

Runtime:

```cpp
#include <cnerium/runtime/runtime.hpp>
```

Printing:

```cpp
#include <vix/print.hpp>
```

Console logging:

```cpp
#include <vix/console.hpp>
```

## Common namespaces

```cpp
using namespace cnerium::app;
using namespace cnerium::http;
using namespace cnerium::json;
using namespace cnerium::server;
using namespace cnerium::runtime;
```

For normal app code, this is usually enough:

```cpp
using namespace cnerium::app;
```

Then use fully qualified names for HTTP status codes when needed:

```cpp
cnerium::http::Status::created
cnerium::http::Status::bad_request
cnerium::http::Status::not_found
```

## Common handler signatures

App route handler:

```cpp
[](cnerium::app::AppContext &ctx)
{
}
```

App middleware:

```cpp
[](auto &ctx, auto next)
{
  next();
}
```

Server route handler:

```cpp
[](cnerium::server::Context &ctx)
{
}
```

Server error handler:

```cpp
[](cnerium::server::Context &ctx, const std::exception &ex)
{
}
```

Runtime task:

```cpp
[]()
{
}
```

## Common response patterns

Text response:

```cpp
ctx.text("Hello");
```

JSON success:

```cpp
ctx.json({
  {"ok", true}
});
```

Created response:

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true},
  {"message", "created"}
});
```

Error response:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "invalid request"}
});
```

No content response:

```cpp
ctx.response().empty(cnerium::http::Status::no_content);
```

## Common request patterns

Read route parameter:

```cpp
std::string id(ctx.param("id"));
```

Read header:

```cpp
std::string type(ctx.header("Content-Type"));
```

Read raw body:

```cpp
std::string body(ctx.body());
```

Read JSON body:

```cpp
auto body = ctx.json();
```

Validate JSON field:

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

## Common middleware patterns

Add global header:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

Request log:

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

## Common runtime pattern

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

Copy request data before scheduling background work.

Do not capture `AppContext&` inside runtime tasks.

## Common error handlers

Not-found handler:

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

Error handler:

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

## Reference vs Guide

Use the guide when you want explanations and learning flow.

```txt
/guide/
```

Use the reference when you want direct API lookup.

```txt
/reference/
```

Use examples when you want complete working code.

```txt
/examples/
```

## Summary

The reference section is for quick API lookup.

Start with:

```txt
App
AppContext
AppConfig
```

Then use lower-level references when needed:

```txt
Server
Runtime
```

For output and logs:

```txt
vix::print
vix::console
```

## Next step

Continue with the App reference.

[Open App reference](/reference/app)
