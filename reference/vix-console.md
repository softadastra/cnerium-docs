# vix::console

`vix::console` is the Vix console logger.

Cnerium documentation uses it for application logs instead of `std::cout`.

Use `vix::console` when you want readable logs with levels such as:

```txt
debug
log
info
warn
error
```

For simple standalone output, use:

```cpp
#include <vix/print.hpp>
```

and:

```cpp
vix::print(...);
```

For application logs, use:

```cpp
#include <vix/console.hpp>
```

and:

```cpp
vix::console.info(...);
```

## Include

```cpp
#include <vix/console.hpp>
```

## Basic usage

```cpp
#include <vix/console.hpp>

int main()
{
  vix::console.log("Hello from Vix console");
  vix::console.info("Application started");
  vix::console.warn("This is a warning");
  vix::console.error("This is an error");

  return 0;
}
```

## Log levels

`vix::console` provides common log methods:

```cpp
vix::console.debug(...);
vix::console.log(...);
vix::console.info(...);
vix::console.warn(...);
vix::console.error(...);
```

Use them like this:

```cpp
vix::console.debug("debug details");
vix::console.log("normal message");
vix::console.info("application started");
vix::console.warn("something needs attention");
vix::console.error("something failed");
```

## When to use each level

| Level | Use for |
|---|---|
| `debug` | Detailed development diagnostics |
| `log` | General plain output |
| `info` | Normal application lifecycle messages |
| `warn` | Recoverable problems or important warnings |
| `error` | Failures and errors |

## Application startup logs

Use `info()` for startup messages.

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

## Request logs

Use `vix::console` inside middleware.

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.use([](auto &ctx, auto next)
  {
    vix::console.info(
      "request",
      cnerium::http::to_string(ctx.request().method()),
      ctx.request().path()
    );

    next();
  });

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("hello");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Request log example is ready");
  });
}
```

Example output:

```txt
request GET /
```

## Error logs

Use `error()` for failures.

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

For production APIs, log the real exception and return a safe response.

## Warning logs

Use `warn()` for recoverable or suspicious situations.

```cpp
app.use([](auto &ctx, auto next)
{
  if (ctx.request().path() == "/admin")
  {
    const auto auth = ctx.request().header("X-Auth");

    if (auth != "secret")
    {
      vix::console.warn("unauthorized admin request");

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

## Debug logs

Use `debug()` for details that are useful during development.

```cpp
vix::console.debug("loading config");
vix::console.debug("route matched", "/users/:id");
vix::console.debug("query", ctx.request().query());
```

Debug logs may be hidden depending on the active console level.

## Set level in code

You can set the console level programmatically.

```cpp
#include <vix/console.hpp>

int main()
{
  vix::console.set_level(vix::Console::Level::Debug);

  vix::console.debug("Debug message visible");
  vix::console.info("Info message visible");
  vix::console.warn("Warning message visible");
  vix::console.error("Error message visible");

  vix::console.set_level(vix::Console::Level::Warn);

  vix::console.debug("This should not appear");
  vix::console.info("This should not appear");
  vix::console.warn("Only warnings and errors now");
  vix::console.error("Still visible");

  return 0;
}
```

## Environment variables

`vix::console` can be configured from environment variables.

```bash
VIX_CONSOLE_LEVEL=debug ./your_app
VIX_COLOR=always ./your_app
NO_COLOR=1 ./your_app
```

Common variables:

| Variable | Purpose |
|---|---|
| `VIX_CONSOLE_LEVEL` | Controls the minimum visible log level |
| `VIX_COLOR` | Controls color output |
| `NO_COLOR` | Disables color output |

## Show environment usage

```cpp
#include <vix/console.hpp>

int main()
{
  vix::console.log("Try with:");
  vix::console.log("VIX_CONSOLE_LEVEL=debug ./your_app");
  vix::console.log("VIX_COLOR=always ./your_app");
  vix::console.log("NO_COLOR=1 ./your_app");

  vix::console.debug("Debug line");
  vix::console.info("Info line");
  vix::console.warn("Warn line");
  vix::console.error("Error line");

  return 0;
}
```

## `VIX_CONSOLE_LEVEL`

Use `VIX_CONSOLE_LEVEL` to control visible logs.

Example:

```bash
VIX_CONSOLE_LEVEL=debug ./api
```

This makes debug logs visible.

Typical values:

```txt
debug
log
info
warn
error
```

Use `debug` during development.

Use `info` or `warn` for production depending on how much output you want.

## `VIX_COLOR`

Use `VIX_COLOR` to control color output.

```bash
VIX_COLOR=always ./api
```

This forces color output.

Common values:

```txt
always
auto
never
```

## `NO_COLOR`

Use `NO_COLOR=1` to disable colored output.

```bash
NO_COLOR=1 ./api
```

This is useful in CI, log files, or environments that do not support ANSI colors.

## Threaded logs

`vix::console` can be used from multiple threads.

```cpp
#include <vix/console.hpp>

#include <thread>
#include <vector>

static void run_worker(int id)
{
  for (int i = 0; i < 5; ++i)
  {
    vix::console.info("worker", id, "iteration", i);
  }
}

int main()
{
  std::vector<std::thread> threads;

  for (int i = 0; i < 4; ++i)
  {
    threads.emplace_back(run_worker, i + 1);
  }

  for (auto &thread : threads)
  {
    thread.join();
  }

  vix::console.info("All workers finished");

  return 0;
}
```

This is useful for runtime and background task examples.

## Logging runtime tasks

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <chrono>
#include <string>
#include <thread>

using namespace cnerium::app;

int main()
{
  App app;

  app.post("/jobs", [&app](AppContext &ctx)
  {
    std::string path(ctx.path());

    app.runtime().post([path]()
    {
      vix::console.info("background job started from", path);

      std::this_thread::sleep_for(std::chrono::milliseconds(500));

      vix::console.info("background job completed");
    });

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "job scheduled"}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Runtime logging example is ready");
  });
}
```

## Log multiple value types

`vix::console` accepts multiple values.

```cpp
#include <vix/console.hpp>

#include <string>
#include <string_view>

enum class Status
{
  Idle = 0,
  Running = 1,
  Failed = 2
};

int main()
{
  const char *raw = "raw c-string";
  std::string text = "std::string";
  std::string_view view = "std::string_view";

  int number = 42;
  double price = 19.99;
  bool ok = true;
  Status status = Status::Running;

  int value = 10;
  int *ptr = &value;

  vix::console.log("raw:", raw);
  vix::console.log("text:", text);
  vix::console.log("view:", view);
  vix::console.log("number:", number);
  vix::console.log("price:", price);
  vix::console.log("ok:", ok);
  vix::console.log("status:", status);
  vix::console.log("pointer:", ptr);

  return 0;
}
```

## Hot loop logs

Avoid logging too much inside hot loops.

This example works, but can generate a lot of output:

```cpp
#include <vix/console.hpp>

int main()
{
  for (int i = 0; i < 1000; ++i)
  {
    vix::console.log("hot loop message", i);
  }

  vix::console.warn("Warnings are not rate-limited");
  vix::console.error("Errors are not rate-limited");

  return 0;
}
```

For tight loops, log only important milestones.

Good:

```cpp
for (int i = 0; i < 1000; ++i)
{
  if (i % 100 == 0)
  {
    vix::console.debug("progress", i);
  }
}
```

## vix::console vs vix::print

Use `vix::console` for logs.

Use `vix::print` for simple output.

| Tool | Use for |
|---|---|
| `vix::console` | Application logs |
| `vix::print` | Simple example output |

Example:

```cpp
vix::console.info("server started");
vix::console.warn("slow request");
vix::console.error("request failed");
```

For standalone examples:

```cpp
vix::print("value:", value);
```

## Cnerium app example

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
    vix::console.info(
      "request",
      cnerium::http::to_string(ctx.request().method()),
      ctx.request().path()
    );

    next();
  });

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "vix::console reference example"}
    });
  });

  app.get("/warn", [](AppContext &ctx)
  {
    vix::console.warn("warning route called");

    ctx.json({
      {"ok", true},
      {"warning", "logged"}
    });
  });

  app.get("/error", [](AppContext &ctx)
  {
    vix::console.error("error route called");

    ctx.status(cnerium::http::Status::internal_server_error).json({
      {"ok", false},
      {"error", "example error"}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("vix::console reference example is ready");
  });
}
```

## Test the Cnerium example

```bash
vix dev
```

Then:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/warn
curl -i http://127.0.0.1:8080/error
```

With debug enabled:

```bash
VIX_CONSOLE_LEVEL=debug vix dev
```

## Complete example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <atomic>
#include <chrono>
#include <string>
#include <thread>

using namespace cnerium::app;

int main()
{
  vix::console.set_level(vix::Console::Level::Debug);

  AppConfig config;
  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 4;

  App app(config);

  std::atomic<int> scheduled_jobs{0};

  app.use([](auto &ctx, auto next)
  {
    vix::console.debug(
      "request",
      cnerium::http::to_string(ctx.request().method()),
      ctx.request().path()
    );

    next();
  });

  app.get("/", [](AppContext &ctx)
  {
    vix::console.info("home route called");

    ctx.json({
      {"ok", true},
      {"message", "vix::console complete example"}
    });
  });

  app.post("/jobs", [&app, &scheduled_jobs](AppContext &ctx)
  {
    const int job_id = ++scheduled_jobs;
    std::string path(ctx.path());

    vix::console.info("job", job_id, "scheduled");

    app.runtime().post([job_id, path]()
    {
      vix::console.debug("job", job_id, "started from", path);

      std::this_thread::sleep_for(std::chrono::milliseconds(500));

      vix::console.info("job", job_id, "completed");
    });

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "job scheduled"},
      {"job_id", job_id}
    });
  });

  app.get("/warn", [](AppContext &ctx)
  {
    vix::console.warn("manual warning route called");

    ctx.json({
      {"ok", true},
      {"message", "warning logged"}
    });
  });

  app.get("/fail", [](AppContext &ctx)
  {
    vix::console.error("manual failure route called");

    ctx.status(cnerium::http::Status::internal_server_error).json({
      {"ok", false},
      {"error", "manual failure"}
    });
  });

  app.set_not_found_handler([](cnerium::server::Context &ctx)
  {
    vix::console.warn("route not found:", ctx.path());

    ctx.status(cnerium::http::Status::not_found)
        .json({
          {"ok", false},
          {"error", "route not found"},
          {"path", std::string(ctx.path())}
        });
  });

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

  app.listen([]()
  {
    vix::console.info("vix::console complete example is ready");
  });
}
```

## Test the complete example

Run:

```bash
VIX_CONSOLE_LEVEL=debug vix dev
```

Then:

```bash
curl http://127.0.0.1:8080/

curl -X POST http://127.0.0.1:8080/jobs

curl http://127.0.0.1:8080/warn

curl -i http://127.0.0.1:8080/fail

curl -i http://127.0.0.1:8080/missing
```

## API overview

Common methods:

```cpp
vix::console.debug(values...);
vix::console.log(values...);
vix::console.info(values...);
vix::console.warn(values...);
vix::console.error(values...);
```

Set level:

```cpp
vix::console.set_level(vix::Console::Level::Debug);
vix::console.set_level(vix::Console::Level::Info);
vix::console.set_level(vix::Console::Level::Warn);
vix::console.set_level(vix::Console::Level::Error);
```

Environment:

```bash
VIX_CONSOLE_LEVEL=debug
VIX_COLOR=always
NO_COLOR=1
```

## Common patterns

Startup log:

```cpp
vix::console.info("App is ready");
```

Request log:

```cpp
vix::console.info("request", method, path);
```

Debug log:

```cpp
vix::console.debug("matched route", route);
```

Warning:

```cpp
vix::console.warn("unauthorized request");
```

Error:

```cpp
vix::console.error("unhandled exception:", ex.what());
```

Runtime job:

```cpp
vix::console.info("job", id, "completed");
```

## Best practices

### Use console for application logs

Good:

```cpp
vix::console.info("server started");
```

### Use print for simple examples

Good:

```cpp
vix::print("value:", value);
```

### Use levels intentionally

Use:

```txt
debug  detailed diagnostics
info   normal lifecycle
warn   suspicious or recoverable issues
error  failures
```

### Keep production logs safe

Log internal errors server-side:

```cpp
vix::console.error("unhandled exception:", ex.what());
```

Return safe responses to users:

```json
{"ok":false,"error":"internal server error"}
```

### Avoid excessive logs in hot loops

Prefer milestone logs or debug logs.

### Enable debug logs only when needed

```bash
VIX_CONSOLE_LEVEL=debug ./api
```

### Use environment variables in deployment

For production services:

```dotenv
VIX_CONSOLE_LEVEL=info
VIX_COLOR=auto
```

For CI or plain logs:

```dotenv
NO_COLOR=1
```

## Common mistakes

### Using std::cout for app logs

Prefer:

```cpp
vix::console.info("App is ready");
```

instead of:

```cpp
std::cout << "App is ready\n";
```

### Using debug logs for important errors

Wrong:

```cpp
vix::console.debug("database failed");
```

Correct:

```cpp
vix::console.error("database failed");
```

### Logging too much in tight loops

Avoid thousands of logs per request unless debugging a specific issue.

### Exposing internal errors to clients

Do not return exception details in production responses.

Log them with:

```cpp
vix::console.error(...)
```

Return:

```json
{"ok":false,"error":"internal server error"}
```

### Forgetting the include

```cpp
#include <vix/console.hpp>
```

## Summary

`vix::console` is the recommended logging helper for Cnerium applications.

It supports:

```txt
debug
log
info
warn
error
environment-controlled levels
color configuration
threaded logs
multi-value logging
```

Use it for app logs, request logs, error logs, runtime task logs, and diagnostics.

Use `vix::print` for simple standalone output.

## Next step

Continue with release notes.

[Open Releases](/releases/)
