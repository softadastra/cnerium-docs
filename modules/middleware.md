# Middleware

`cnerium::middleware` provides the middleware pipeline system used by Cnerium.

A middleware is a function that runs during the request/response lifecycle.

It can:

```txt
inspect the request
modify the response
call the next middleware
stop the pipeline early
return an error response
add headers
perform authentication checks
log requests
```

The middleware module is used by higher-level modules like:

```txt
cnerium/server
cnerium/app
```

## Package

```txt
cnerium/middleware
```

Current version:

```txt
0.3.0
```

Package metadata:

```json
{
  "name": "middleware",
  "namespace": "cnerium",
  "version": "0.3.0",
  "type": "header-only",
  "include": "include",
  "license": "MIT",
  "description": "Composable middleware system for the Cnerium web framework.",
  "repository": "https://github.com/cnerium/middleware",
  "deps": [
    {
      "id": "cnerium/http",
      "version": "0.7.0"
    },
    {
      "id": "cnerium/json",
      "version": "0.4.0"
    }
  ]
}
```

## Install

```bash
vix add cnerium/middleware
```

For normal Cnerium applications, install the app layer instead:

```bash
vix add cnerium/app
```

`cnerium/app` pulls the middleware module through the framework dependency chain.

## Include

Use the main public header:

```cpp
#include <cnerium/middleware/middleware.hpp>
```

This gives access to:

```txt
version.hpp
Context.hpp
Next.hpp
Middleware.hpp
Pipeline.hpp
```

You will usually also need the HTTP module:

```cpp
#include <cnerium/http/http.hpp>
```

## Namespace

```cpp
using namespace cnerium::middleware;
```

Or use fully qualified names:

```cpp
cnerium::middleware::Pipeline pipeline;
```

## Basic example

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

  pipeline.use([](Context &ctx, Next)
  {
    ctx.response().text("Hello from middleware");
  });

  pipeline.run(ctx);

  vix::print("Response body:", ctx.response().body());
}
```

Expected output:

```txt
Response body: Hello from middleware
```

## Core types

The middleware module has four important public types:

```txt
Context
Next
Middleware
Pipeline
```

## Context

`Context` represents one middleware execution context.

It stores non-owning references to:

```txt
Request
Response
```

Example:

```cpp
Request req;
Response res;

Context ctx(req, res);
```

Then access the request and response:

```cpp
ctx.request();
ctx.response();
```

## Context example

```cpp
#include <cnerium/http/http.hpp>
#include <cnerium/middleware/middleware.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::middleware;

int main()
{
  Request req;
  req.set_method(Method::Get);
  req.set_path("/hello");

  Response res;

  Context ctx(req, res);

  ctx.response().set_status(Status::ok);
  ctx.response().text("Hello");

  vix::print("path:", ctx.request().path());
  vix::print("status:", to_int(ctx.response().status()));
  vix::print("body:", ctx.response().body());
}
```

## Context validity

A `Context` created from a request and response is valid:

```cpp
Context ctx(req, res);

if (ctx.valid())
{
  // safe to use
}
```

A default-constructed context is empty:

```cpp
Context ctx;

if (!ctx.valid())
{
  // no request/response attached
}
```

Use default construction only when you need a placeholder.

Most code should construct `Context` from a request and response.

## Next

`Next` is the continuation callback.

It means:

```txt
continue to the next middleware
```

Example:

```cpp
Next next([]()
{
  vix::print("next called");
});

if (next)
{
  next();
}
```

In a middleware, call `next()` when the request should continue.

```cpp
pipeline.use([](Context &ctx, Next next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

If you do not call `next()`, the pipeline stops.

## Middleware

`Middleware` is the callable type used by the pipeline.

```cpp
using Middleware = std::function<void(Context &, Next)>;
```

A middleware receives:

```txt
Context&
Next
```

Example:

```cpp
Middleware mw = [](Context &ctx, Next next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
};
```

## Pipeline

`Pipeline` stores and runs middleware in order.

```cpp
Pipeline pipeline;

pipeline.use(middleware);
pipeline.run(ctx);
```

Middleware is executed in insertion order.

```txt
middleware 1
middleware 2
middleware 3
```

If one middleware does not call `next()`, execution stops there.

## Chained middleware

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
    vix::print("Middleware 1");
    next();
  });

  pipeline.use([](Context &ctx, Next next)
  {
    ctx.response().set_header("X-Version", "0.1.0");
    vix::print("Middleware 2");
    next();
  });

  pipeline.use([](Context &ctx, Next)
  {
    ctx.response().text("Hello from chained middleware");
    vix::print("Middleware 3");
  });

  pipeline.run(ctx);

  vix::print("Body:", ctx.response().body());
  vix::print("X-App:", ctx.response().header("X-App"));
  vix::print("X-Version:", ctx.response().header("X-Version"));
}
```

Expected execution:

```txt
Middleware 1
Middleware 2
Middleware 3
```

## Short-circuit behavior

A middleware can stop the pipeline by not calling `next()`.

```cpp
pipeline.use([](Context &ctx, Next)
{
  if (ctx.request().path() == "/admin")
  {
    ctx.response().set_status(Status::forbidden);
    ctx.response().text("Access denied");
    return;
  }
});
```

In this case, later middleware will not run.

## Short-circuit example

```cpp
#include <cnerium/http/http.hpp>
#include <cnerium/middleware/middleware.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;
using namespace cnerium::middleware;

int main()
{
  Request req;
  req.set_path("/admin");

  Response res;
  Context ctx(req, res);

  Pipeline pipeline;

  pipeline.use([](Context &ctx, Next)
  {
    if (ctx.request().path() == "/admin")
    {
      ctx.response().set_status(Status::forbidden);
      ctx.response().text("Access denied");
      return;
    }
  });

  pipeline.use([](Context &ctx, Next)
  {
    ctx.response().text("Welcome");
  });

  pipeline.run(ctx);

  vix::print("Status:", to_int(ctx.response().status()));
  vix::print("Body:", ctx.response().body());
}
```

Expected output:

```txt
Status: 403
Body: Access denied
```

## Continue or stop

Use this pattern:

```cpp
pipeline.use([](Context &ctx, Next next)
{
  if (should_stop)
  {
    ctx.response().set_status(Status::forbidden);
    ctx.response().json({
      {"ok", false},
      {"error", "forbidden"}
    });
    return;
  }

  next();
});
```

Call `next()` only when the request should continue.

## Add headers

Middleware is useful for global headers.

```cpp
pipeline.use([](Context &ctx, Next next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

This makes the header available in the final response.

## Request inspection

Middleware can inspect request data.

```cpp
pipeline.use([](Context &ctx, Next next)
{
  vix::print(
    "request",
    to_string(ctx.request().method()),
    ctx.request().path()
  );

  next();
});
```

In app-level code, prefer `vix::console` for logs.

## Authentication guard

```cpp
pipeline.use([](Context &ctx, Next next)
{
  if (ctx.request().path() == "/admin")
  {
    const auto auth = ctx.request().header("X-Auth");

    if (auth != "secret")
    {
      ctx.response().set_status(Status::unauthorized);
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

This stops unauthorized requests before they reach the final handler.

## Fallback middleware

You can place a final middleware at the end to produce a response if nothing else did.

```cpp
pipeline.use([](Context &ctx, Next)
{
  ctx.response().set_status(Status::not_found);
  ctx.response().json({
    {"ok", false},
    {"error", "not handled"}
  });
});
```

At the app/server layer, not-found handling is usually managed by the server.

## Full pipeline example

```cpp
#include <cnerium/http/http.hpp>
#include <cnerium/middleware/middleware.hpp>
#include <vix/print.hpp>

#include <string_view>

using namespace cnerium::http;
using namespace cnerium::middleware;

int main()
{
  auto run_case = [](std::string_view path)
  {
    Request req;
    req.set_method(Method::Get);
    req.set_path(std::string(path));

    Response res;
    Context ctx(req, res);

    Pipeline pipeline;

    pipeline.use([](Context &ctx, Next next)
    {
      ctx.response().set_header("X-Powered-By", "Cnerium");
      next();
    });

    pipeline.use([](Context &ctx, Next next)
    {
      if (ctx.request().path() == "/admin")
      {
        ctx.response().set_status(Status::forbidden);
        ctx.response().text("Access denied");
        return;
      }

      next();
    });

    pipeline.use([](Context &ctx, Next next)
    {
      if (ctx.request().path() == "/hello")
      {
        ctx.response().set_status(Status::ok);
        ctx.response().text("Hello from middleware pipeline");
        return;
      }

      next();
    });

    pipeline.use([](Context &ctx, Next)
    {
      ctx.response().set_status(Status::not_found);
      ctx.response().text("Route not handled");
    });

    pipeline.run(ctx);

    vix::print("GET", path);
    vix::print("  Status:", to_int(ctx.response().status()), reason_phrase(ctx.response().status()));
    vix::print("  X-Powered-By:", ctx.response().header("X-Powered-By"));
    vix::print("  Body:", ctx.response().body());
    vix::print();
  };

  run_case("/hello");
  run_case("/admin");
  run_case("/unknown");
}
```

Expected behavior:

```txt
GET /hello
  Status: 200 OK
  X-Powered-By: Cnerium
  Body: Hello from middleware pipeline

GET /admin
  Status: 403 Forbidden
  X-Powered-By: Cnerium
  Body: Access denied

GET /unknown
  Status: 404 Not Found
  X-Powered-By: Cnerium
  Body: Route not handled
```

## Pipeline operations

`Pipeline` provides useful container operations:

```cpp
pipeline.use(middleware);
pipeline.run(ctx);

pipeline.size();
pipeline.empty();
pipeline.reserve(8);
pipeline.clear();

pipeline.middleware();

pipeline.begin();
pipeline.end();
pipeline.cbegin();
pipeline.cend();
```

Example:

```cpp
Pipeline pipeline;

pipeline.reserve(4);

pipeline.use([](Context &ctx, Next next)
{
  next();
});

vix::print("middleware count:", pipeline.size());
```

## Middleware order

Middleware runs in the same order it is registered.

```cpp
pipeline.use(first);
pipeline.use(second);
pipeline.use(third);
```

Execution:

```txt
first
second
third
```

But each middleware must call `next()` for the next one to run.

## Before and after behavior

A middleware can run code before and after `next()`.

```cpp
pipeline.use([](Context &ctx, Next next)
{
  vix::print("before");

  next();

  vix::print("after");
});
```

If there is a handler after it, the order is:

```txt
before
handler
after
```

This is useful for timing, logging, and response mutation.

## Timing middleware

```cpp
#include <chrono>
```

```cpp
pipeline.use([](Context &ctx, Next next)
{
  const auto start = std::chrono::steady_clock::now();

  next();

  const auto end = std::chrono::steady_clock::now();
  const auto ms =
      std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

  ctx.response().set_header("X-Duration-Ms", std::to_string(ms));
});
```

This sets a response header after the rest of the pipeline has run.

## Use middleware in Cnerium App

Most users use middleware through `App`.

```cpp
#include <cnerium/app/app.hpp>
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
    ctx.text("middleware works");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Middleware app example is ready");
  });
}
```

## App middleware example

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
    vix::console.info("Middleware module app example is ready");
  });
}
```

## Test the app example

```bash
curl -i http://127.0.0.1:8080/

curl -i http://127.0.0.1:8080/admin

curl -i http://127.0.0.1:8080/admin \
  -H "X-Auth: secret"
```

Expected behavior:

```txt
GET /            -> 200 OK
GET /admin       -> 401 Unauthorized
GET /admin with X-Auth: secret -> 200 OK
```

## Middleware module vs App middleware

The low-level middleware module uses:

```cpp
cnerium::middleware::Context
```

This context wraps:

```txt
Request
Response
```

The app layer uses middleware internally and adapts it into the server lifecycle.

In normal apps:

```cpp
app.use([](auto &ctx, auto next)
{
  // middleware
  next();
});
```

In low-level module tests:

```cpp
Pipeline pipeline;
pipeline.use([](Context &ctx, Next next)
{
  next();
});
```

## API overview

Context API:

```cpp
Context(Request &, Response &)

request()
response()

valid()
clear()
```

Next API:

```cpp
Next(callback)

operator()()
valid()
empty()
clear()
operator bool()
```

Middleware type:

```cpp
using Middleware = std::function<void(Context &, Next)>;
```

Pipeline API:

```cpp
Pipeline

use()
run()

size()
empty()
reserve()
clear()

middleware()

begin()
end()
cbegin()
cend()
```

## Best practices

### Use App middleware for normal apps

Prefer:

```cpp
app.use([](auto &ctx, auto next)
{
  next();
});
```

Use `Pipeline` directly for lower-level code, tests, or framework internals.

### Always call `next()` when the request should continue

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

### Do not call `next()` after final response

```cpp
app.use([](auto &ctx, auto next)
{
  if (blocked)
  {
    ctx.response().set_status(cnerium::http::Status::forbidden);
    ctx.response().text("blocked");
    return;
  }

  next();
});
```

### Keep middleware focused

Good middleware responsibilities:

```txt
headers
logging
auth
request timing
CORS
maintenance mode
```

Avoid putting endpoint business logic inside middleware.

### Register middleware before routes

Keep app setup readable:

```cpp
App app;

register_middleware(app);
register_routes(app);

app.listen();
```

### Use JSON errors for APIs

```cpp
ctx.response().set_status(cnerium::http::Status::unauthorized);
ctx.response().json({
  {"ok", false},
  {"error", "unauthorized"}
});
```

### Use `vix::console` in app logs

For standalone module examples, `vix::print` is fine.

For real apps, use:

```cpp
vix::console.info("request", method, path);
vix::console.warn("unauthorized request");
vix::console.error("middleware failure");
```

## Common mistakes

### Forgetting `next()`

Wrong:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
});
```

This stops the pipeline.

Correct:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

### Calling `next()` after rejecting a request

Wrong:

```cpp
app.use([](auto &ctx, auto next)
{
  if (blocked)
  {
    ctx.response().set_status(cnerium::http::Status::forbidden);
    ctx.response().text("blocked");
  }

  next();
});
```

Correct:

```cpp
app.use([](auto &ctx, auto next)
{
  if (blocked)
  {
    ctx.response().set_status(cnerium::http::Status::forbidden);
    ctx.response().text("blocked");
    return;
  }

  next();
});
```

### Doing too much in one middleware

Prefer several small middleware functions over one large middleware.

### Capturing request references in async work

Middleware runs during the request lifecycle.

Do not store references to request/response objects for later use.

If background work is needed, copy the data first.

## Summary

`cnerium::middleware` provides a composable middleware pipeline.

It includes:

```txt
Context
Next
Middleware
Pipeline
```

Middleware runs in insertion order.

Calling `next()` continues the pipeline.

Not calling `next()` stops the pipeline.

Use middleware for cross-cutting behavior like headers, logging, auth, and request guards.

For normal applications, use middleware through `App`.

## Next step

Continue with the Server module.

[Open Server module](/modules/server)
