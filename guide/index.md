# Guide

The Cnerium guide teaches the main concepts needed to build real C++ web applications with Cnerium.

Start here after the quick start if you want to understand how the framework is organized and how each part works.

## What you will learn

This guide covers:

```txt
project structure
routing
route parameters
requests
responses
JSON
middleware
error handling
not-found handling
runtime
configuration
printing and logging
deployment
```

Cnerium is modular, but the guide focuses on the high-level `App` API first.

For most applications, you will mainly use:

```cpp
#include <cnerium/app/app.hpp>
```

## Recommended order

Follow the guide in this order:

```txt
1. Project Structure
2. Routing
3. Route Parameters
4. Request
5. Response
6. JSON
7. Middleware
8. Error Handling
9. Not Found
10. Runtime
11. Configuration
12. Printing
13. Deployment
```

## Core mental model

A Cnerium application starts with `App`.

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

The `App` object owns the lower layers internally:

```txt
App
  -> Runtime
  -> Server
  -> Middleware
  -> Router
  -> HTTP
  -> JSON
```

You normally start with `App`, then go deeper only when needed.

## Request lifecycle

A request follows this path:

```txt
client
  -> TCP connection
  -> HTTP request parser
  -> router
  -> middleware
  -> route handler
  -> response
  -> HTTP response writer
  -> client
```

In user code, you mostly work with `AppContext`.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"id", std::string(ctx.param("id"))}
  });
});
```

## Guide pages

### Project Structure

Learn how a Cnerium project should be organized.

[Open Project Structure](/guide/project-structure)

### Routing

Learn how to register routes with `get`, `post`, `put`, `delete_`, and `route`.

[Open Routing](/guide/routing)

### Route Parameters

Learn how dynamic paths like `/users/:id` work.

[Open Route Parameters](/guide/route-parameters)

### Request

Learn how to read request method, path, query, headers, body, and JSON payloads.

[Open Request](/guide/request)

### Response

Learn how to return text, HTML, JSON, status codes, and headers.

[Open Response](/guide/response)

### JSON

Learn how Cnerium integrates with `cnerium::json`.

[Open JSON](/guide/json)

### Middleware

Learn how middleware can inspect requests, modify responses, and stop or continue the pipeline.

[Open Middleware](/guide/middleware)

### Error Handling

Learn how to convert exceptions into clean HTTP responses.

[Open Error Handling](/guide/error-handling)

### Not Found

Learn how to customize the default `404 Not Found` response.

[Open Not Found](/guide/not-found)

### Runtime

Learn how Cnerium uses the runtime, thread pool, executor, and background tasks.

[Open Runtime](/guide/runtime)

### Configuration

Learn how to configure host, port, thread count, request limits, buffers, and timeouts.

[Open Configuration](/guide/configuration)

### Printing

Learn when to use `vix::print` and when to use `vix::console`.

[Open Printing](/guide/printing)

### Deployment

Learn the production deployment model for a Cnerium application.

[Open Deployment](/guide/deployment)

## `vix::print` and `vix::console`

Cnerium documentation avoids `std::cout` in normal examples.

Use `vix::print` for simple output:

```cpp
#include <vix/print.hpp>

vix::print("Hello from Cnerium");
```

Use `vix::console` for application logs:

```cpp
#include <vix/console.hpp>

vix::console.info("Cnerium app is ready");
vix::console.warn("This is a warning");
vix::console.error("Something failed");
```

## Minimal app example

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

## Run it

```bash
vix dev
```

Test it:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
```

## Next step

Start with project structure.

[Open Project Structure](/guide/project-structure)
