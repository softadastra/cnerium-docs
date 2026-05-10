# Runtime

The runtime is the execution layer of Cnerium.

It provides the thread pool, executor, scheduler, and server integration used to run tasks and process connections concurrently.

Most applications do not need to use the runtime directly at the beginning.
When you use `App`, Cnerium owns and wires the runtime for you.

```cpp
App app;

app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello from Cnerium");
});

app.listen("127.0.0.1", 8080);
```

But when you need background tasks or lower-level control, you can access the runtime through:

```cpp
app.runtime()
```

## What the runtime provides

The runtime module provides:

```txt
Task
ThreadPool
Executor
Scheduler
Runtime
ServerRunner
```

At a high level:

```txt
Runtime
  -> ThreadPool
  -> Workers
  -> TaskQueue
  -> Tasks
```

## When to use the runtime

Use the runtime when you need to:

```txt
run background tasks
schedule work outside a route handler
offload work to worker threads
integrate the server with concurrent execution
control thread count
prepare long-running app infrastructure
```

For normal HTTP routing, start with `App`.

For background work, use `app.runtime()`.

## Basic runtime access from App

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

`app.runtime().post()` submits a task to the runtime.

## Task

A task is the basic unit of work executed by the runtime.

```cpp
using Task = std::function<void()>;
```

A task is usually a lambda:

```cpp
runtime.post([]()
{
  vix::console.info("task running");
});
```

Tasks take no arguments and return no value.

If you need data inside the task, capture it:

```cpp
std::string name = "Cnerium";

app.runtime().post([name]()
{
  vix::console.info("background task for", name);
});
```

## RuntimeConfig

`RuntimeConfig` controls runtime behavior.

The most important field is `thread_count`.

```cpp
cnerium::app::AppConfig config;
config.thread_count = 4;

cnerium::app::App app(config);
```

This config is passed from the high-level `AppConfig` into the lower-level runtime configuration.

## Configure thread count

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  AppConfig config;
  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 4;

  App app(config);

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Runtime configured with custom thread count");
  });

  app.listen([]()
  {
    vix::console.info("App is ready");
  });
}
```

Use a small thread count during development.

For production, choose a value based on your server CPU, workload, and blocking behavior.

## Runtime lifecycle

The runtime lifecycle is:

```txt
start
post tasks
stop
join
```

When using `App`, the lifecycle is managed for you.

When using `Runtime` directly, you control it:

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
    vix::console.info("task 1");
  });

  runtime.dispatch([]()
  {
    vix::console.info("task 2");
  });

  runtime.stop();
  runtime.join();

  vix::console.info("runtime stopped");
}
```

## `post()` and `dispatch()`

The runtime exposes:

```cpp
runtime.post(task);
runtime.dispatch(task);
```

For now, both submit a task for execution.

Use `post()` as the default.

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

Use `dispatch()` when you want to express “execute this work through the runtime”.

```cpp
app.runtime().dispatch([]()
{
  vix::console.info("dispatched task");
});
```

## Background task example

This example schedules a background task before the server starts.

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.runtime().post([]()
  {
    vix::console.info("warming cache");
  });

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("Hello from Cnerium");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Runtime background task example is ready");
  });
}
```

## Background task from a route

You can also submit work from a route handler.

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  app.runtime().post([]()
  {
    vix::console.info("job executed in background");
  });

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "job scheduled"}
  });
});
```

This is useful when a request should return quickly while work continues asynchronously.

## Important note about captured data

Be careful when capturing request data in a background task.

This is unsafe:

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  app.runtime().post([&ctx]()
  {
    vix::console.info(ctx.path());
  });

  ctx.json({{"ok", true}});
});
```

The request context may no longer be valid when the background task runs.

Instead, copy the data you need:

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  std::string path(ctx.path());

  app.runtime().post([path]()
  {
    vix::console.info("background job from", path);
  });

  ctx.json({{"ok", true}});
});
```

## ThreadPool

The runtime uses a thread pool internally.

You can use `ThreadPool` directly if you are working at a lower level.

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/console.hpp>

#include <chrono>
#include <thread>

using namespace cnerium::runtime;

int main()
{
  ThreadPool pool;

  pool.start();

  for (int i = 0; i < 5; ++i)
  {
    pool.post([i]()
    {
      vix::console.info("task", i, "running");
      std::this_thread::sleep_for(std::chrono::milliseconds(100));
    });
  }

  std::this_thread::sleep_for(std::chrono::seconds(1));

  pool.stop();
  pool.join();

  vix::console.info("thread pool stopped");
}
```

For application code, prefer `Runtime` or `app.runtime()`.

## Executor

`Executor` is a non-owning task submission interface over a `ThreadPool`.

```cpp
ThreadPool pool;
pool.start();

Executor executor(pool);

executor.post([]()
{
  vix::console.info("task executed");
});

pool.stop();
pool.join();
```

The executor does not own the pool.

It only submits work into it.

## Scheduler

`Scheduler` is a higher-level scheduling facade over `Executor`.

For now, it forwards work to the executor.

```cpp
ThreadPool pool;
pool.start();

Executor executor(pool);
Scheduler scheduler(executor);

scheduler.schedule([]()
{
  vix::console.info("scheduled task");
});

pool.stop();
pool.join();
```

The scheduler is the future extension point for delayed tasks, priorities, affinity, or other scheduling policies.

## ServerRunner

`ServerRunner` connects `Runtime` and `Server`.

It starts the runtime, accepts connections through the server listener, and dispatches connection processing to worker threads.

When using `App`, you usually do not need to create `ServerRunner` manually.

At a lower level:

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <cnerium/server/server.hpp>
#include <vix/console.hpp>

using namespace cnerium::runtime;
using namespace cnerium::server;

int main()
{
  Runtime runtime;
  Server server;

  server.get("/", [](Context &ctx)
  {
    ctx.response().text("Hello from runtime + server");
  });

  vix::console.info("Server running on http://127.0.0.1:8080");

  ServerRunner runner(runtime, server);
  runner.run();
}
```

This is useful for understanding how the lower layers fit together.

## Runtime with App

`App` is the recommended layer for application development.

It owns:

```txt
Runtime
Server
```

And exposes:

```cpp
app.runtime();
app.server();
```

This means you can start simple:

```cpp
App app;
```

And still access advanced control when needed:

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

## Complete example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <atomic>
#include <string>

using namespace cnerium::app;

int main()
{
  AppConfig config;
  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 4;

  App app(config);

  std::atomic<int> scheduled_jobs{0};

  app.use([](auto &ctx, auto next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    next();
  });

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "Runtime guide example"}
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.post("/jobs", [&app, &scheduled_jobs](AppContext &ctx)
  {
    const int job_id = ++scheduled_jobs;

    app.runtime().post([job_id]()
    {
      vix::console.info("running background job", job_id);
    });

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "job scheduled"},
      {"job_id", job_id}
    });
  });

  app.get("/jobs/count", [&scheduled_jobs](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"scheduled_jobs", scheduled_jobs.load()}
    });
  });

  app.listen([]()
  {
    vix::console.info("Runtime guide example is ready");
  });
}
```

## Test the example

Start the app:

```bash
vix dev
```

Test the routes:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/jobs/count

curl -X POST http://127.0.0.1:8080/jobs
curl -X POST http://127.0.0.1:8080/jobs
curl http://127.0.0.1:8080/jobs/count
```

Expected behavior:

```txt
POST /jobs schedules background work.
GET /jobs/count returns the number of scheduled jobs.
vix::console shows background task logs.
```

## Best practices

### Start with App

For normal web applications, use:

```cpp
cnerium::app::App app;
```

Do not start directly with `ThreadPool` or `ServerRunner` unless you are building lower-level infrastructure.

### Use `app.runtime()` for background work

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

### Copy data into background tasks

Do not capture `AppContext&` by reference.

Good:

```cpp
std::string path(ctx.path());

app.runtime().post([path]()
{
  vix::console.info(path);
});
```

Avoid:

```cpp
app.runtime().post([&ctx]()
{
  vix::console.info(ctx.path());
});
```

### Keep route handlers responsive

If a task can run later, schedule it and return a response quickly.

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true},
  {"message", "job scheduled"}
});
```

### Configure thread count explicitly for production

```cpp
AppConfig config;
config.thread_count = 4;

App app(config);
```

Choose the value based on your workload.

### Use `vix::console` for runtime logs

```cpp
vix::console.info("worker started");
vix::console.warn("job took longer than expected");
vix::console.error("background job failed");
```

## Common mistakes

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

### Forgetting that background tasks run later

A task submitted with `post()` may run after the route has already returned.

Do not depend on request-local references.

### Using runtime for normal route logic

For normal request/response logic, keep the code in the route handler.

Use the runtime only when the work should be asynchronous or background.

### Stopping the runtime manually when using App

When using `App`, let the app manage the runtime lifecycle.

Do not manually call:

```cpp
app.runtime().stop();
app.runtime().join();
```

inside normal app startup code.

## Summary

The runtime is Cnerium’s execution layer.

It provides:

```txt
Task
ThreadPool
Executor
Scheduler
Runtime
ServerRunner
```

Use `App` for normal applications.

Use `app.runtime().post()` for background tasks.

Configure runtime behavior through `AppConfig`.

Copy request data before using it in background tasks.

Use `vix::console` for runtime logs.

## Next step

Continue with configuration.

[Open Configuration](/guide/configuration)
