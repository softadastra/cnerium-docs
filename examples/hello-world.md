# Hello World

This example shows the smallest useful Cnerium application.

It creates an app, registers one route, and starts the server.

## Code

Create or replace:

```txt
src/main.cpp
```

with:

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

## What this does

This app registers one route:

```txt
GET /
```

When the browser or `curl` requests `/`, Cnerium runs the handler and returns:

```txt
Hello from Cnerium
```

## Run the app

From the project root:

```bash
vix dev
```

The app starts on:

```txt
http://127.0.0.1:8080
```

## Test with curl

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```txt
Hello from Cnerium
```

## Add a second route

You can add more routes using `app.get()`.

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"}
  });
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

Test both routes:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
```

Expected health response:

```json
{"ok":true,"status":"healthy"}
```

## Line by line

Include the high-level app module:

```cpp
#include <cnerium/app/app.hpp>
```

Include Vix console logs:

```cpp
#include <vix/console.hpp>
```

Use the app namespace:

```cpp
using namespace cnerium::app;
```

Create the app:

```cpp
App app;
```

Register a route:

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello from Cnerium");
});
```

Start the server:

```cpp
app.listen("127.0.0.1", 8080, []()
{
  vix::console.info("Cnerium app is ready");
});
```

## Route handler

A route handler receives an `AppContext`.

```cpp
[](AppContext &ctx)
{
  ctx.text("Hello from Cnerium");
}
```

`AppContext` gives access to the request and response helpers.

For a text response:

```cpp
ctx.text("Hello from Cnerium");
```

For a JSON response:

```cpp
ctx.json({
  {"ok", true}
});
```

## Host and port

This example listens on:

```txt
127.0.0.1:8080
```

Use this for local development:

```cpp
app.listen("127.0.0.1", 8080);
```

For deployment behind a reverse proxy, you can configure this later with `AppConfig`.

## Minimal version without callback

The startup callback is optional.

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

The callback is useful for logs:

```cpp
app.listen("127.0.0.1", 8080, []()
{
  vix::console.info("Cnerium app is ready");
});
```

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

## Complete final example

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

## Test the final example

```bash
curl http://127.0.0.1:8080/
```

Expected:

```txt
Hello from Cnerium
```

Then:

```bash
curl http://127.0.0.1:8080/health
```

Expected:

```json
{"ok":true,"status":"healthy"}
```

## Common mistakes

### Forgetting to add Cnerium

Install the app package first:

```bash
vix add cnerium/app
```

### Testing the wrong port

This example uses:

```txt
8080
```

So test with:

```bash
curl http://127.0.0.1:8080/
```

### Forgetting to start the app

Run:

```bash
vix dev
```

### Using `std::cout` for startup logs

Prefer:

```cpp
vix::console.info("Cnerium app is ready");
```

## Summary

A minimal Cnerium app needs three steps:

```txt
create App
register route
listen
```

The smallest useful app is:

```cpp
App app;

app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello from Cnerium");
});

app.listen("127.0.0.1", 8080);
```

## Next step

Continue with basic routes.

[Open Basic Routes](/examples/basic-routes)
