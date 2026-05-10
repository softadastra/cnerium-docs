# Examples

This section contains practical Cnerium examples.

Use these examples when you want to see how the framework is used in real code.

The examples start small and grow progressively:

```txt
1. Hello World
2. Basic Routes
3. JSON API
4. Middleware
5. Runtime + Server
6. REST API
```

## Recommended order

Follow the examples in this order:

```txt
1. Hello World
2. Basic Routes
3. JSON API
4. Middleware
5. Runtime Server
6. REST API
```

This order starts with the smallest possible app, then introduces routing, JSON, middleware, runtime tasks, and finally a more complete REST API structure.

## Before you start

Create a new Vix project:

```bash
vix new api
cd api
```

Add Cnerium:

```bash
vix add cnerium/app
```

Run the project:

```bash
vix dev
```

Most examples use:

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>
```

For simple standalone output examples, use:

```cpp
#include <vix/print.hpp>
```

## Example structure

A simple Cnerium example can live in:

```txt
src/main.cpp
```

Recommended minimal project:

```txt
api/
├── CMakeLists.txt
├── vix.json
└── src/
    └── main.cpp
```

For larger examples, you can split handlers and middleware into separate files later.

## Hello World

The smallest Cnerium application.

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

Run:

```bash
vix dev
```

Test:

```bash
curl http://127.0.0.1:8080/
```

[Open Hello World](/examples/hello-world)

## Basic Routes

Register multiple routes and read route parameters.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("home");
});

app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text(std::string(ctx.param("id")));
});

app.post("/users", [](AppContext &ctx)
{
  ctx.text("user created");
});
```

You will learn:

```txt
GET routes
POST routes
dynamic parameters
route matching
simple responses
```

[Open Basic Routes](/examples/basic-routes)

## JSON API

Build JSON responses and read JSON request bodies.

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"}
  });
});
```

You will learn:

```txt
JSON responses
JSON request bodies
status codes
input validation
API response shapes
```

[Open JSON API](/examples/json-api)

## Middleware

Add global behavior before route handlers.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

You will learn:

```txt
global headers
request logging
auth guards
short-circuit responses
middleware order
```

[Open Middleware Example](/examples/middleware)

## Runtime Server

Use the runtime for background work.

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

You will learn:

```txt
runtime access
background tasks
safe captures
job scheduling
threaded execution
```

[Open Runtime Server](/examples/runtime-server)

## REST API

A more complete API example with routes, JSON, validation, errors, and background work.

You will learn:

```txt
resource routes
GET list
GET by id
POST create
validation
not-found responses
error helpers
runtime jobs
```

[Open REST API](/examples/rest-api)

## Common commands

Run in development mode:

```bash
vix dev
```

Build:

```bash
vix build
```

Build release:

```bash
vix build --preset release
```

Check the project:

```bash
vix check --tests
```

Format:

```bash
vix fmt
```

## Testing examples with curl

Most examples listen on:

```txt
127.0.0.1:8080
```

Common tests:

```bash
curl http://127.0.0.1:8080/

curl http://127.0.0.1:8080/health

curl http://127.0.0.1:8080/users/1

curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com"}'
```

## Example conventions

Cnerium examples follow these conventions:

```txt
use App for normal applications
use AppContext in route handlers
use ctx.text() for text responses
use ctx.json() for JSON responses
use ctx.status() for status codes
use vix::console for logs
use vix::print for simple standalone output
avoid std::cout in normal examples
```

## Recommended response shape

For API examples, use this shape for success:

```json
{
  "ok": true,
  "data": {}
}
```

And this shape for errors:

```json
{
  "ok": false,
  "error": "message"
}
```

This keeps examples consistent.

## Minimal full app

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
    ctx.json({
      {"ok", true},
      {"message", "Cnerium example"}
    });
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
    vix::console.info("Example app is ready");
  });
}
```

## Best practices

### Start with one file

For learning, keep everything in:

```txt
src/main.cpp
```

Split files only when the example grows.

### Use `App`

For normal examples, use:

```cpp
cnerium::app::App
```

not the lower-level `Server`.

### Keep handlers small

Good:

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"}
  });
});
```

### Use JSON for APIs

Use:

```cpp
ctx.json({
  {"ok", true}
});
```

### Use explicit status codes

For created resources:

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true}
});
```

For invalid input:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "invalid request"}
});
```

### Use `vix::console` for logs

```cpp
vix::console.info("App is ready");
vix::console.warn("Unauthorized request");
vix::console.error("Unhandled exception");
```

## Common mistakes

### Forgetting to run the app

After writing `src/main.cpp`, run:

```bash
vix dev
```

### Testing the wrong port

Most examples use:

```txt
8080
```

Test with:

```bash
curl http://127.0.0.1:8080/
```

### Forgetting the JSON content type

For JSON request bodies:

```bash
-H "Content-Type: application/json"
```

### Capturing request context in background tasks

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

## Summary

The examples section shows Cnerium through practical code.

Start with Hello World.

Then learn routes, JSON, middleware, runtime, and REST APIs.

For most examples, use:

```cpp
#include <cnerium/app/app.hpp>
```

Run with:

```bash
vix dev
```

Test with:

```bash
curl http://127.0.0.1:8080/
```

## Next step

Start with Hello World.

[Open Hello World](/examples/hello-world)
