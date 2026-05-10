# Modules

Cnerium is built as a set of small, focused modules.

Each module has one responsibility and can be understood independently.

The high-level application layer is `cnerium/app`.
Most users should start there.

```cpp
#include <cnerium/app/app.hpp>
```

Lower-level modules are useful when you want to understand how Cnerium is built or when you need more direct control.

## Module stack

Cnerium is organized in layers:

```txt
cnerium/app
  -> cnerium/runtime
  -> cnerium/server
  -> cnerium/middleware
  -> cnerium/router
  -> cnerium/http
  -> cnerium/json
```

Each layer depends on the layer below it.

## Recommended learning order

Read the modules in this order:

```txt
1. JSON
2. HTTP
3. Router
4. Middleware
5. Server
6. Runtime
7. App
```

This order follows the architecture from the smallest building block to the high-level framework API.

## Package overview

```txt
cnerium/json        0.4.0
cnerium/http        0.7.0
cnerium/router      0.6.0
cnerium/middleware  0.3.0
cnerium/server      0.5.0
cnerium/runtime     0.4.0
cnerium/app         0.5.0
```

## Dependency chain

```txt
cnerium/json
  ↓
cnerium/http
  ↓
cnerium/router
  ↓
cnerium/middleware
  ↓
cnerium/server
  ↓
cnerium/runtime
  ↓
cnerium/app
```

Some modules also share lower-level dependencies.

For example:

```txt
cnerium/http depends on cnerium/json
cnerium/router depends on cnerium/http
cnerium/middleware depends on cnerium/http and cnerium/json
cnerium/server depends on cnerium/middleware and cnerium/router
cnerium/runtime depends on cnerium/server
cnerium/app depends on cnerium/runtime
```

## Install the full framework

For most applications, install the app layer:

```bash
vix add cnerium/app
```

This gives you the high-level API:

```cpp
#include <cnerium/app/app.hpp>
```

Example:

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

## Install individual modules

You can install modules individually when you need them directly.

```bash
vix add cnerium/json
vix add cnerium/http
vix add cnerium/router
vix add cnerium/middleware
vix add cnerium/server
vix add cnerium/runtime
vix add cnerium/app
```

For a complete web application, prefer:

```bash
vix add cnerium/app
```

## JSON

The JSON module provides JSON parsing, serialization, typed access, JSON Pointer, merge patch, diff/patch, NDJSON, streaming parsing, and schema validation.

Package:

```txt
cnerium/json
```

Version:

```txt
0.4.0
```

Include:

```cpp
#include <cnerium/json/json.hpp>
```

Example:

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value data = {
    {"name", "Gaspard"},
    {"age", 25},
    {"active", true}
  };

  vix::print(data.dump(true));
}
```

[Open JSON module](/modules/json)

## HTTP

The HTTP module provides the core HTTP primitives used by the framework.

It includes:

```txt
Method
Status
HeaderMap
Request
Response
```

Package:

```txt
cnerium/http
```

Version:

```txt
0.7.0
```

Include:

```cpp
#include <cnerium/http/http.hpp>
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Response res;

  res.set_status(Status::created);
  res.json({
    {"ok", true},
    {"message", "created"}
  });

  vix::print(to_int(res.status()), reason_phrase(res.status()));
  vix::print(res.body());
}
```

[Open HTTP module](/modules/http)

## Router

The router module matches HTTP methods and paths.

It supports static routes and dynamic route parameters.

Package:

```txt
cnerium/router
```

Version:

```txt
0.6.0
```

Include:

```cpp
#include <cnerium/router/router.hpp>
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
    vix::print("User id:", result.params().get("id"));
  }
}
```

[Open Router module](/modules/router)

## Middleware

The middleware module provides a composable request/response pipeline.

A middleware can inspect a request, mutate a response, call `next()`, or stop execution early.

Package:

```txt
cnerium/middleware
```

Version:

```txt
0.3.0
```

Include:

```cpp
#include <cnerium/middleware/middleware.hpp>
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <cnerium/middleware/middleware.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::middleware;

int main()
{
  Request req;
  Response res;
  Context ctx(req, res);

  Pipeline pipeline;

  pipeline.use([](Context &ctx, Next next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    next();
  });

  pipeline.use([](Context &ctx, Next)
  {
    ctx.response().text("Hello from middleware");
  });

  pipeline.run(ctx);

  vix::print(ctx.response().body());
}
```

[Open Middleware module](/modules/middleware)

## Server

The server module connects routing, middleware, handlers, HTTP request parsing, response writing, error handling, and the TCP listener.

Package:

```txt
cnerium/server
```

Version:

```txt
0.5.0
```

Include:

```cpp
#include <cnerium/server/server.hpp>
```

Example:

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

[Open Server module](/modules/server)

## Runtime

The runtime module provides concurrent execution.

It includes:

```txt
Task
ThreadPool
Executor
Scheduler
Runtime
ServerRunner
```

Package:

```txt
cnerium/runtime
```

Version:

```txt
0.4.0
```

Include:

```cpp
#include <cnerium/runtime/runtime.hpp>
```

Example:

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/console.hpp>

using namespace cnerium::runtime;

int main()
{
  Runtime runtime;

  runtime.start();

  runtime.post([]()
  {
    vix::console.info("background task");
  });

  runtime.stop();
  runtime.join();
}
```

[Open Runtime module](/modules/runtime)

## App

The app module is the high-level user-facing layer.

Most applications should use this module.

Package:

```txt
cnerium/app
```

Version:

```txt
0.5.0
```

Include:

```cpp
#include <cnerium/app/app.hpp>
```

Example:

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

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Cnerium app is ready");
  });
}
```

[Open App module](/modules/app)

## Which module should you use?

For a normal web application, use:

```cpp
#include <cnerium/app/app.hpp>
```

Use lower-level modules only when you need direct control.

| Need | Use |
|------|-----|
| Build a web app or API | `cnerium/app` |
| Run background tasks | `cnerium/runtime` or `app.runtime()` |
| Build a custom server layer | `cnerium/server` |
| Work with routing directly | `cnerium/router` |
| Build middleware pipelines directly | `cnerium/middleware` |
| Work with HTTP primitives | `cnerium/http` |
| Parse or build JSON directly | `cnerium/json` |

## Header overview

```cpp
#include <cnerium/json/json.hpp>
#include <cnerium/http/http.hpp>
#include <cnerium/router/router.hpp>
#include <cnerium/middleware/middleware.hpp>
#include <cnerium/server/server.hpp>
#include <cnerium/runtime/runtime.hpp>
#include <cnerium/app/app.hpp>
```

For most applications:

```cpp
#include <cnerium/app/app.hpp>
```

## Package metadata overview

```txt
cnerium/json
  type: header-only
  license: Apache-2.0

cnerium/http
  type: header-only
  license: MIT
  deps: cnerium/json

cnerium/router
  type: header-only
  license: MIT
  deps: cnerium/http

cnerium/middleware
  type: header-only
  license: MIT
  deps: cnerium/http, cnerium/json

cnerium/server
  type: header-only
  license: MIT
  deps: cnerium/middleware, cnerium/router

cnerium/runtime
  type: header-only
  license: MIT
  deps: cnerium/server

cnerium/app
  type: header-only
  license: MIT
  deps: cnerium/runtime
```

## Summary

Cnerium is modular.

The lower layers provide focused primitives.

The higher layers combine them into a complete framework.

Use `cnerium/app` for normal applications.

Learn the modules in this order:

```txt
JSON
HTTP
Router
Middleware
Server
Runtime
App
```

## Next step

Continue with the JSON module.

[Open JSON module](/modules/json)
