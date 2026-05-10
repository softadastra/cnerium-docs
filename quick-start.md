# Quick Start

This guide shows the fastest way to create and run a Cnerium application.

Cnerium is built for the Vix ecosystem, so the recommended workflow is:

```bash
vix new api
cd api
vix add cnerium/app
vix dev
```

## Create a new project

Create a new Vix project:

```bash
vix new api
```

Enter the project directory:

```bash
cd api
```

## Add Cnerium

Install the high-level Cnerium app module:

```bash
vix add cnerium/app
```

`cnerium/app` is the main entry point of the framework.

It gives you:

```txt
App
AppContext
routing
middleware
JSON responses
runtime access
server integration
```

## Create your first app

Open your main source file and use this code:

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

## Run the app

Start the development server:

```bash
vix dev
```

You should see the application start on:

```txt
http://127.0.0.1:8080
```

Test it with curl:

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```txt
Hello from Cnerium
```

## Add another route

Add a second route:

```cpp
app.get("/about", [](AppContext &ctx)
{
  ctx.text("About Cnerium");
});
```

Full example:

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

  app.get("/about", [](AppContext &ctx)
  {
    ctx.text("About Cnerium");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Cnerium app is ready");
  });
}
```

Test both routes:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/about
```

## Route parameters

Cnerium supports dynamic route parameters:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("User id: " + std::string(ctx.param("id")));
});
```

Test it:

```bash
curl http://127.0.0.1:8080/users/42
```

Expected response:

```txt
User id: 42
```

## JSON response

Cnerium can return JSON directly from a handler:

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"},
    {"framework", "Cnerium"}
  });
});
```

Test it:

```bash
curl http://127.0.0.1:8080/health
```

Expected response:

```json
{"ok":true,"status":"healthy","framework":"Cnerium"}
```

## Read JSON request body

For `POST` routes, use `ctx.json()` to parse the request body:

```cpp
app.post("/users", [](AppContext &ctx)
{
  auto body = ctx.json();

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "user created"},
    {"name", body["name"]}
  });
});
```

Test it:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'
```

Expected response:

```json
{"ok":true,"message":"user created","name":"Gaspard"}
```

## Add middleware

Middleware runs before the final route handler.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

Full example:

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
    vix::console.info("Cnerium app is ready");
  });
}
```

Test headers:

```bash
curl -i http://127.0.0.1:8080/
```

You should see:

```txt
X-App: Cnerium
```

## Access the runtime

`App` owns the runtime internally, but you can still access it:

```cpp
app.runtime().post([]()
{
  vix::console.info("background task executed");
});
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
    ctx.text("Hello with runtime");
  });

  app.runtime().post([]()
  {
    vix::console.info("background task executed");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Cnerium app is ready");
  });
}
```

## Complete quick-start example

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

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Hello from Cnerium");
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"},
      {"framework", "Cnerium"}
    });
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.post("/users", [](AppContext &ctx)
  {
    auto body = ctx.json();

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "user created"},
      {"name", body["name"]}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Cnerium app is ready");
  });
}
```

Run it:

```bash
vix dev
```

Test it:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/users/42

curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'
```

## Useful Vix commands

During development:

```bash
vix dev
```

Run manually:

```bash
vix run
```

Build only:

```bash
vix build
```

Validate before committing:

```bash
vix fmt --check
vix check --tests
```

Run tests:

```bash
vix tests
```

Build for release:

```bash
vix build --preset release
```

## What you learned

You created a Cnerium app with:

```txt
GET /
GET /health
GET /users/:id
POST /users
middleware
JSON responses
runtime access
```

You also used:

```txt
App
AppContext
ctx.text()
ctx.json()
ctx.param()
ctx.status()
app.use()
app.listen()
```

## Next step

Continue with your first full app.

[Open First App](/first-app)
