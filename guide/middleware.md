# Middleware

Middleware lets you run code before the final route handler.

It is useful for:

```txt
global headers
logging
authentication
authorization
request inspection
response mutation
early rejection
fallback handling
```

A middleware receives:

```txt
context
next continuation
```

If the middleware calls `next()`, Cnerium continues to the next middleware or route handler.

If it does not call `next()`, the pipeline stops there.

## Basic middleware

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
    ctx.text("Hello from middleware");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Middleware example is ready");
  });
}
```

Run:

```bash
vix dev
```

Test:

```bash
curl -i http://127.0.0.1:8080/
```

You should see:

```txt
X-App: Cnerium
```

## How middleware works

A middleware is a function that receives:

```cpp
ctx
next
```

Example:

```cpp
app.use([](auto &ctx, auto next)
{
  // before the next middleware or handler
  next();
  // after the next middleware or handler
});
```

The important part is `next()`.

```cpp
next();
```

It tells Cnerium to continue the pipeline.

## Middleware order

Middleware runs in the order it is registered.

```cpp
app.use([](auto &ctx, auto next)
{
  vix::console.info("middleware 1");
  next();
});

app.use([](auto &ctx, auto next)
{
  vix::console.info("middleware 2");
  next();
});

app.get("/", [](AppContext &ctx)
{
  ctx.text("handler");
});
```

Execution order:

```txt
middleware 1
middleware 2
handler
```

## Add global headers

A common use case is adding headers to every response.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  ctx.response().set_header("X-Powered-By", "Cnerium");
  next();
});
```

This avoids repeating headers in every route.

## Request logging

Use middleware to log incoming requests.

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

Example output:

```txt
[info] request GET /
```

## Stop the pipeline early

If a middleware does not call `next()`, the request stops there.

This is called short-circuiting.

```cpp
app.use([](auto &ctx, auto next)
{
  if (ctx.request().path() == "/admin")
  {
    ctx.response().set_status(cnerium::http::Status::forbidden);
    ctx.response().text("Access denied");
    return;
  }

  next();
});
```

For `/admin`, the route handler will not run.

## Authentication guard

Middleware can protect routes.

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

Then define the route:

```cpp
app.get("/admin", [](AppContext &ctx)
{
  ctx.text("Welcome to admin");
});
```

Test without auth:

```bash
curl -i http://127.0.0.1:8080/admin
```

Test with auth:

```bash
curl -i http://127.0.0.1:8080/admin \
  -H "X-Auth: secret"
```

## Middleware can modify the response

Middleware can set headers before the handler runs.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

It can also modify the response after the handler runs:

```cpp
app.use([](auto &ctx, auto next)
{
  next();

  ctx.response().set_header("X-After", "done");
});
```

This pattern is useful when you want to apply a response change after route handling.

## Before and after middleware

```cpp
app.use([](auto &ctx, auto next)
{
  vix::console.info("before handler");

  next();

  vix::console.info("after handler");
});
```

Execution:

```txt
before handler
handler
after handler
```

## Multiple middleware

You can chain multiple middleware.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});

app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-Version", "0.1.0");
  next();
});

app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello");
});
```

Both headers will be added.

## Middleware and route handlers

Middleware runs before the route handler.

```txt
request
  -> middleware 1
  -> middleware 2
  -> middleware 3
  -> route handler
  -> response
```

If one middleware stops early:

```txt
request
  -> middleware 1
  -> middleware 2 stops
  -> response
```

The route handler is skipped.

## Middleware context

In app-level middleware, `ctx` gives access to the lower-level request and response.

Common methods:

```cpp
ctx.request()
ctx.response()
```

Example:

```cpp
app.use([](auto &ctx, auto next)
{
  const auto path = ctx.request().path();

  ctx.response().set_header("X-Request-Path", std::string(path));

  next();
});
```

In route handlers, you normally use `AppContext` helpers:

```cpp
ctx.path();
ctx.param("id");
ctx.text("Hello");
ctx.json({{"ok", true}});
```

## Middleware vs route handler

Use middleware for cross-cutting behavior.

Use route handlers for endpoint-specific behavior.

Good middleware use cases:

```txt
logging
auth checks
global headers
CORS headers
request limits
maintenance mode
```

Good route handler use cases:

```txt
create user
list products
return health status
update order
delete item
```

## Maintenance mode middleware

```cpp
bool maintenance_mode = true;

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

This stops all requests before they reach route handlers.

## Simple CORS headers

For simple APIs, middleware can add CORS headers.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("Access-Control-Allow-Origin", "*");
  ctx.response().set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  ctx.response().set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  next();
});
```

For production, configure CORS more carefully.

## Basic request timer

You can measure how long a request takes.

```cpp
#include <chrono>
```

```cpp
app.use([](auto &ctx, auto next)
{
  const auto start = std::chrono::steady_clock::now();

  next();

  const auto end = std::chrono::steady_clock::now();
  const auto ms =
      std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

  vix::console.info(
    "request completed",
    ctx.request().path(),
    "in",
    ms,
    "ms"
  );
});
```

## Complete example

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

  app.get("/admin", [](AppContext &ctx)
  {
    ctx.text("Welcome to admin");
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
    vix::console.info("Middleware guide example is ready");
  });
}
```

## Test the example

Public route:

```bash
curl -i http://127.0.0.1:8080/
```

Health route:

```bash
curl -i http://127.0.0.1:8080/health
```

Admin route without auth:

```bash
curl -i http://127.0.0.1:8080/admin
```

Admin route with auth:

```bash
curl -i http://127.0.0.1:8080/admin \
  -H "X-Auth: secret"
```

## Best practices

### Register global middleware early

Middleware only applies according to how the app/server pipeline is built.

Keep global middleware near the top of `main()`.

```cpp
App app;

app.use(headers_middleware);
app.use(logging_middleware);
app.use(auth_middleware);

register_routes(app);
```

### Keep middleware focused

Good:

```txt
one middleware for headers
one middleware for logging
one middleware for authentication
```

Avoid one large middleware that does everything.

### Call `next()` when the request should continue

```cpp
app.use([](auto &ctx, auto next)
{
  next();
});
```

### Do not call `next()` when the middleware already produced the response

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

### Prefer JSON errors for APIs

```cpp
ctx.response().set_status(cnerium::http::Status::unauthorized);
ctx.response().json({
  {"ok", false},
  {"error", "unauthorized"}
});
```

### Move reusable middleware into files

For larger projects:

```txt
include/api/middleware/
├── AppHeaders.hpp
├── RequestLogger.hpp
└── AuthGuard.hpp
```

Example:

```cpp
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

## Common mistakes

### Forgetting `next()`

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

### Calling `next()` after returning an error

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

### Doing business logic in middleware

Middleware should not contain endpoint-specific business logic.

Use handlers and services for that.

## Summary

Middleware lets you process requests before route handlers.

Use it for:

```txt
headers
logging
auth
guards
request inspection
response mutation
early rejection
```

Call `next()` to continue.

Do not call `next()` when the middleware has already produced the final response.

Middleware runs in registration order.

## Next step

Continue with error handling.

[Open Error Handling](/guide/error-handling)
