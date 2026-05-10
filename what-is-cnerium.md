# What is Cnerium?

Cnerium is a fast, minimal, and modular C++ web framework built on top of Vix.

It provides a clean application layer for building HTTP services, JSON APIs, middleware pipelines, route handlers, and runtime-powered applications with modern C++.

Cnerium is designed for developers who want the performance and control of C++ without manually writing every low-level layer of a web server.

## The idea

Cnerium gives you a simple framework-style API:

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

The goal is simple:

> Make C++ backend development feel direct, clean, and productive.

Cnerium does not try to hide C++.
It gives C++ a better structure for building web applications.

## Why Cnerium exists

C++ is fast, mature, and powerful.

But building backend applications in C++ often requires too much low-level work:

```txt
request parsing
response formatting
routing
middleware execution
JSON handling
connection handling
thread management
server lifecycle management
```

Cnerium provides these pieces as small, focused modules.

Instead of starting from raw sockets or manually wiring every layer, you can start with `App` and build from there.

## Main features

Cnerium provides:

```txt
high-level App API
route registration
dynamic route parameters
request helpers
response helpers
JSON request parsing
JSON response generation
middleware pipelines
custom error handlers
custom not-found handlers
server layer
runtime layer
thread pool support
Vix integration
```

## A modular framework

Cnerium is not one large monolithic library.

It is built as a set of small modules:

```txt
cnerium/json
cnerium/http
cnerium/router
cnerium/middleware
cnerium/server
cnerium/runtime
cnerium/app
```

Each module has one clear responsibility.

## Module overview

### JSON

The JSON module provides JSON parsing, serialization, typed access, JSON Pointer, merge patch, diff/patch, NDJSON, streaming parsing, and schema validation.

It is used by the HTTP, server, and app layers to read request bodies and build JSON responses.

### HTTP

The HTTP module provides the core HTTP primitives:

```txt
Method
Status
HeaderMap
Request
Response
```

It does not own the server loop.
It defines the request and response objects used by the framework.

### Router

The router module matches HTTP methods and paths.

It supports static and dynamic routes:

```txt
/
/users
/users/:id
/shops/:shop_id/products/:product_id
```

Routes are matched in insertion order.

The first matching route wins.

### Middleware

The middleware module provides a composable request/response pipeline.

A middleware can inspect the request, modify the response, call `next()`, or stop the pipeline early.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

### Server

The server module connects routing, middleware, handlers, request parsing, response writing, errors, and the TCP listener.

It is the first complete HTTP execution layer.

### Runtime

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

It allows Cnerium to run server connections and background tasks on worker threads.

### App

The app module is the main user-facing layer.

Most users should start here:

```cpp
#include <cnerium/app/app.hpp>
```

`App` owns the runtime and server internally, while still giving access to lower-level layers when needed.

## How Cnerium runs a request

At a high level, one request follows this path:

```txt
TCP connection
  -> raw HTTP request
  -> RequestParser
  -> Request
  -> Router
  -> Middleware
  -> Handler
  -> Response
  -> ResponseWriter
  -> raw HTTP response
```

When using the high-level `App` API, most of this is handled for you.

You write the route logic:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"id", std::string(ctx.param("id"))}
  });
});
```

Cnerium handles the rest.

## Cnerium and Vix

Cnerium is built for the Vix ecosystem.

Vix provides the broader C++ runtime and tooling foundation.
Cnerium focuses specifically on the web framework layer.

In Cnerium documentation, examples use Vix utilities for output and logging.

For simple output:

```cpp
#include <vix/print.hpp>

vix::print("Hello from Cnerium");
```

For application logs:

```cpp
#include <vix/console.hpp>

vix::console.info("Server started");
vix::console.warn("This is a warning");
vix::console.error("Something failed");
```

This keeps examples clean and avoids unnecessary `std::cout` boilerplate.

## Philosophy

Cnerium follows a few simple principles.

### Simple API first

The default API should be easy to read:

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello");
});
```

### Modular internals

Each layer has one job.

```txt
JSON handles JSON.
HTTP defines request and response primitives.
Router matches paths.
Middleware composes request processing.
Server executes HTTP requests.
Runtime manages concurrency.
App gives users a clean entry point.
```

### No unnecessary magic

Cnerium should stay explicit.

You can use the high-level API, but you can still access the lower-level runtime and server when needed:

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

### C++ remains C++

Cnerium does not try to turn C++ into another language.

It makes C++ backend development cleaner, faster, and more structured.

## When to use Cnerium

Use Cnerium when you want to build:

```txt
HTTP APIs
JSON services
internal tools
backend services
lightweight web servers
local-first service layers
runtime-powered C++ applications
systems that need C++ performance and control
```

## What Cnerium is not

Cnerium is not a frontend framework.

It does not replace Vue, React, Svelte, or other frontend tools.

It focuses on the backend and application server layer.

## Recommended starting point

Start with the App layer:

```cpp
#include <cnerium/app/app.hpp>
```

Then learn the core concepts in this order:

```txt
1. App
2. AppContext
3. Routing
4. Route parameters
5. Responses
6. JSON
7. Middleware
8. Error handling
9. Runtime
10. Deployment
```

For most applications, `App` is enough.

For advanced use cases, you can go deeper into the individual modules.

## Next step

Continue with installation.

[Open the Installation guide](/installation)
