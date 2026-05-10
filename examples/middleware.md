# Middleware

This example shows how to use middleware in a Cnerium app.

Middleware lets you run code before the final route handler.

You will learn how to:

```txt
add global headers
log requests
protect routes
stop requests early
return JSON errors
use multiple middleware
control middleware order
```

## Code

Create or replace:

```txt
src/main.cpp
```

with:

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
    ctx.response().set_header("X-Powered-By", "Cnerium");
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

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.get("/admin", [](AppContext &ctx)
  {
    ctx.text("Welcome to admin");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Middleware example is ready");
  });
}
```

## Run

```bash
vix dev
```

The app listens on:

```txt
http://127.0.0.1:8080
```

## Test the public route

```bash
curl -i http://127.0.0.1:8080/
```

Expected response body:

```txt
Public route
```

Expected headers include:

```txt
X-App: Cnerium
X-Powered-By: Cnerium
```

## Test the health route

```bash
curl -i http://127.0.0.1:8080/health
```

Expected response:

```json
{"ok":true,"status":"healthy"}
```

## Test the protected route without auth

```bash
curl -i http://127.0.0.1:8080/admin
```

Expected status:

```txt
401 Unauthorized
```

Expected response:

```json
{"ok":false,"error":"unauthorized"}
```

## Test the protected route with auth

```bash
curl -i http://127.0.0.1:8080/admin \
  -H "X-Auth: secret"
```

Expected response:

```txt
Welcome to admin
```

## What middleware does

A middleware receives two values:

```txt
ctx
next
```

Example:

```cpp
app.use([](auto &ctx, auto next)
{
  next();
});
```

`ctx` gives access to the request and response.

`next()` continues to the next middleware or route handler.

## Middleware order

Middleware runs in the order it is registered.

```cpp
app.use(first);
app.use(second);
app.use(third);
```

Execution order:

```txt
first
second
third
route handler
```

Each middleware must call `next()` for the next middleware to run.

## Add global headers

This middleware adds headers to every response:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  ctx.response().set_header("X-Powered-By", "Cnerium");
  next();
});
```

Because this middleware calls `next()`, the request continues to the route handler.

## Request logging

This middleware logs the HTTP method and path:

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

Example log:

```txt
request GET /
request GET /health
request GET /admin
```

Use `vix::console` for app logs.

## Protect a route

This middleware protects `/admin`.

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

If the request is not authorized, the middleware returns a response and does not call `next()`.

That stops the pipeline.

## Short-circuit behavior

A middleware can stop the request early.

```cpp
app.use([](auto &ctx, auto next)
{
  if (blocked)
  {
    ctx.response().set_status(cnerium::http::Status::forbidden);
    ctx.response().json({
      {"ok", false},
      {"error", "forbidden"}
    });
    return;
  }

  next();
});
```

If `next()` is not called, the route handler does not run.

## Before and after middleware

Middleware can run code before and after the handler.

```cpp
app.use([](auto &ctx, auto next)
{
  vix::console.info("before");

  next();

  vix::console.info("after");
});
```

Execution:

```txt
before
handler
after
```

This is useful for request timing and response mutation.

## Timing middleware

Add this include:

```cpp
#include <chrono>
```

Then add middleware:

```cpp
app.use([](auto &ctx, auto next)
{
  const auto start = std::chrono::steady_clock::now();

  next();

  const auto end = std::chrono::steady_clock::now();
  const auto ms =
      std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

  ctx.response().set_header("X-Duration-Ms", std::to_string(ms));

  vix::console.info(
    "completed",
    ctx.request().path(),
    "in",
    ms,
    "ms"
  );
});
```

This runs after the route handler and adds a duration header.

## Complete example with timing

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <chrono>
#include <string>

using namespace cnerium::app;

int main()
{
  App app;

  app.use([](auto &ctx, auto next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    ctx.response().set_header("X-Powered-By", "Cnerium");
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
    const auto start = std::chrono::steady_clock::now();

    next();

    const auto end = std::chrono::steady_clock::now();
    const auto ms =
        std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

    ctx.response().set_header("X-Duration-Ms", std::to_string(ms));

    vix::console.info(
      "completed",
      ctx.request().path(),
      "in",
      ms,
      "ms"
    );
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

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.get("/admin", [](AppContext &ctx)
  {
    ctx.text("Welcome to admin");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Middleware example is ready");
  });
}
```

## Test all routes

```bash
curl -i http://127.0.0.1:8080/

curl -i http://127.0.0.1:8080/health

curl -i http://127.0.0.1:8080/admin

curl -i http://127.0.0.1:8080/admin \
  -H "X-Auth: secret"
```

Expected behavior:

| Request | Result |
|--------|--------|
| `GET /` | `200 OK` |
| `GET /health` | `200 OK` JSON |
| `GET /admin` | `401 Unauthorized` |
| `GET /admin` with `X-Auth: secret` | `200 OK` |

## Middleware and response headers

All successful and rejected responses should still include the global headers, because the header middleware runs first.

Example:

```txt
X-App: Cnerium
X-Powered-By: Cnerium
```

The timing middleware adds:

```txt
X-Duration-Ms: 0
```

The exact value depends on the request.

## Add simple CORS headers

For development APIs, you can add simple CORS headers:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("Access-Control-Allow-Origin", "*");
  ctx.response().set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  ctx.response().set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  next();
});
```

For production, configure CORS carefully instead of using `*` everywhere.

## Maintenance mode example

```cpp
bool maintenance_mode = false;

app.use([&maintenance_mode](auto &ctx, auto next)
{
  if (maintenance_mode)
  {
    ctx.response().set_status(cnerium::http::Status::service_unavailable);
    ctx.response().json({
      {"ok", false},
      {"error", "service temporarily unavailable"}
    });
    return;
  }

  next();
});
```

When `maintenance_mode` is true, every request is stopped before reaching route handlers.

## Extract middleware into functions

For larger apps, move middleware registration into functions.

```cpp
void register_headers(cnerium::app::App &app)
{
  app.use([](auto &ctx, auto next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    next();
  });
}

void register_request_logger(cnerium::app::App &app)
{
  app.use([](auto &ctx, auto next)
  {
    vix::console.info(
      "request",
      cnerium::http::to_string(ctx.request().method()),
      ctx.request().path()
    );

    next();
  });
}
```

Then:

```cpp
App app;

register_headers(app);
register_request_logger(app);
```

## Better project structure

For larger projects:

```txt
src/
└── main.cpp

include/
└── api/
    └── middleware/
        ├── Headers.hpp
        ├── RequestLogger.hpp
        └── AuthGuard.hpp
```

Example `Headers.hpp`:

```cpp
#pragma once

#include <cnerium/app/app.hpp>

namespace api::middleware
{
  inline void register_headers(cnerium::app::App &app)
  {
    app.use([](auto &ctx, auto next)
    {
      ctx.response().set_header("X-App", "Cnerium");
      next();
    });
  }
}
```

Then in `main.cpp`:

```cpp
#include <api/middleware/Headers.hpp>

int main()
{
  cnerium::app::App app;

  api::middleware::register_headers(app);

  app.listen("127.0.0.1", 8080);
}
```

## Best practices

### Register middleware before routes

Good:

```cpp
App app;

app.use(headers);
app.use(logger);
app.use(auth);

app.get("/", handler);
```

### Keep middleware focused

Good:

```txt
one middleware for headers
one middleware for logging
one middleware for auth
one middleware for timing
```

Avoid one huge middleware that does everything.

### Call `next()` when the request should continue

```cpp
app.use([](auto &ctx, auto next)
{
  next();
});
```

### Return without `next()` when the request is complete

```cpp
app.use([](auto &ctx, auto next)
{
  if (blocked)
  {
    ctx.response().set_status(cnerium::http::Status::forbidden);
    ctx.response().json({
      {"ok", false},
      {"error", "forbidden"}
    });
    return;
  }

  next();
});
```

### Use JSON errors for APIs

```cpp
ctx.response().set_status(cnerium::http::Status::unauthorized);
ctx.response().json({
  {"ok", false},
  {"error", "unauthorized"}
});
```

### Use `vix::console` for middleware logs

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

This stops every request.

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

### Doing endpoint-specific logic in middleware

Middleware should handle cross-cutting behavior.

Good middleware:

```txt
headers
logging
auth
CORS
timing
maintenance mode
```

Endpoint-specific work belongs inside route handlers or services.

### Capturing request context for later work

Middleware runs inside the request lifecycle.

Do not store references to request or response objects for later use.

Copy the data you need.

## Summary

Middleware lets you add behavior before route handlers.

Use it for:

```txt
headers
logging
auth
CORS
timing
maintenance mode
early rejection
```

Call `next()` when the request should continue.

Return without calling `next()` when the middleware has already produced the final response.

Middleware runs in registration order.

## Next step

Continue with runtime server examples.

[Open Runtime Server](/examples/runtime-server)
