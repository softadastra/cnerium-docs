# Runtime Server

This example shows how to use the Cnerium runtime from an application.

You will learn how to:

```txt
access the runtime from App
schedule background tasks
return a response immediately
copy request data safely
track scheduled jobs
use runtime logs
configure worker threads
```

Most Cnerium applications do not need to manage the runtime manually.

Use:

```cpp
app.runtime()
```

when you need background work.

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

#include <atomic>
#include <chrono>
#include <string>
#include <thread>

using namespace cnerium::app;

int main()
{
  AppConfig config;
  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 4;

  App app(config);

  std::atomic<int> scheduled_jobs{0};
  std::atomic<int> completed_jobs{0};

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "Runtime server example"}
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.get("/jobs", [&scheduled_jobs, &completed_jobs](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"scheduled_jobs", scheduled_jobs.load()},
      {"completed_jobs", completed_jobs.load()}
    });
  });

  app.post("/jobs", [&app, &scheduled_jobs, &completed_jobs](AppContext &ctx)
  {
    const int job_id = ++scheduled_jobs;
    std::string path(ctx.path());

    app.runtime().post([job_id, path, &completed_jobs]()
    {
      vix::console.info("job", job_id, "started from", path);

      std::this_thread::sleep_for(std::chrono::milliseconds(500));

      ++completed_jobs;

      vix::console.info("job", job_id, "completed");
    });

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "job scheduled"},
      {"job_id", job_id}
    });
  });

  app.listen([]()
  {
    vix::console.info("Runtime server example is ready");
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

## Test the root route

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```json
{"ok":true,"message":"Runtime server example"}
```

## Test health

```bash
curl http://127.0.0.1:8080/health
```

Expected response:

```json
{"ok":true,"status":"healthy"}
```

## Check jobs

```bash
curl http://127.0.0.1:8080/jobs
```

Expected response at the beginning:

```json
{"ok":true,"scheduled_jobs":0,"completed_jobs":0}
```

## Schedule a job

```bash
curl -X POST http://127.0.0.1:8080/jobs
```

Expected response:

```json
{"ok":true,"message":"job scheduled","job_id":1}
```

The response is returned immediately.

The background task continues inside the runtime.

## Schedule multiple jobs

```bash
curl -X POST http://127.0.0.1:8080/jobs
curl -X POST http://127.0.0.1:8080/jobs
curl -X POST http://127.0.0.1:8080/jobs
```

Then check:

```bash
curl http://127.0.0.1:8080/jobs
```

Expected response after the jobs complete:

```json
{"ok":true,"scheduled_jobs":3,"completed_jobs":3}
```

## What the runtime does

The runtime executes tasks outside the current route handler.

In this example, the route does this:

```cpp
app.runtime().post(task);
```

The task is queued and executed by worker threads.

The handler then immediately returns:

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true},
  {"message", "job scheduled"},
  {"job_id", job_id}
});
```

This pattern is useful when the request should not wait for the whole job to finish.

## Configure runtime threads

The runtime worker count is configured with `AppConfig`.

```cpp
AppConfig config;
config.thread_count = 4;

App app(config);
```

This means the runtime can use four worker threads.

For development, a small value is enough.

For production, choose the value based on CPU count and workload.

## Access the runtime

`App` exposes the runtime through:

```cpp
app.runtime()
```

Use it like this:

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

You can also use:

```cpp
app.runtime().dispatch([]()
{
  vix::console.info("dispatched task");
});
```

For most application code, use `post()`.

## Background task from route

This is the core pattern:

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  app.runtime().post([]()
  {
    vix::console.info("background job");
  });

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "job scheduled"}
  });
});
```

The request schedules work and returns a response.

## Copy request data safely

Do not capture `AppContext&` in a background task.

Wrong:

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

This is unsafe because the background task may run after the request has finished.

Correct:

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  std::string path(ctx.path());

  app.runtime().post([path]()
  {
    vix::console.info("job from", path);
  });

  ctx.json({{"ok", true}});
});
```

Copy the data you need before scheduling the task.

## Track background jobs

This example uses atomics:

```cpp
std::atomic<int> scheduled_jobs{0};
std::atomic<int> completed_jobs{0};
```

When a job is scheduled:

```cpp
const int job_id = ++scheduled_jobs;
```

When the job completes:

```cpp
++completed_jobs;
```

This keeps the counters safe across worker threads.

## Why `std::atomic`

Background tasks may run on different threads.

If several tasks modify the same counter, use a thread-safe type.

Good:

```cpp
std::atomic<int> completed_jobs{0};
```

Avoid this for shared threaded counters:

```cpp
int completed_jobs = 0;
```

## Add a job result route

You can expose runtime state through a route:

```cpp
app.get("/jobs", [&scheduled_jobs, &completed_jobs](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"scheduled_jobs", scheduled_jobs.load()},
    {"completed_jobs", completed_jobs.load()}
  });
});
```

This makes it easy to inspect background work.

## Add a startup background task

You can also schedule work before the app starts listening.

```cpp
app.runtime().post([]()
{
  vix::console.info("startup background task");
});
```

Full example:

```cpp
App app;

app.runtime().post([]()
{
  vix::console.info("warming cache");
});

app.listen("127.0.0.1", 8080);
```

## Complete example with startup task

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
  AppConfig config;
  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 4;

  App app(config);

  std::atomic<int> scheduled_jobs{0};
  std::atomic<int> completed_jobs{0};

  app.runtime().post([]()
  {
    vix::console.info("startup background task");
  });

  app.use([](auto &ctx, auto next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    next();
  });

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "Runtime server example"}
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.get("/jobs", [&scheduled_jobs, &completed_jobs](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"scheduled_jobs", scheduled_jobs.load()},
      {"completed_jobs", completed_jobs.load()}
    });
  });

  app.post("/jobs", [&app, &scheduled_jobs, &completed_jobs](AppContext &ctx)
  {
    const int job_id = ++scheduled_jobs;
    std::string path(ctx.path());

    app.runtime().post([job_id, path, &completed_jobs]()
    {
      vix::console.info("job", job_id, "started from", path);

      std::this_thread::sleep_for(std::chrono::milliseconds(500));

      ++completed_jobs;

      vix::console.info("job", job_id, "completed");
    });

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "job scheduled"},
      {"job_id", job_id}
    });
  });

  app.set_not_found_handler([](cnerium::server::Context &ctx)
  {
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
    vix::console.info("Runtime server example is ready");
  });
}
```

## Test the complete example

Start the app:

```bash
vix dev
```

Run:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/jobs
```

Schedule jobs:

```bash
curl -X POST http://127.0.0.1:8080/jobs
curl -X POST http://127.0.0.1:8080/jobs
curl -X POST http://127.0.0.1:8080/jobs
```

Check again:

```bash
curl http://127.0.0.1:8080/jobs
```

Test missing route:

```bash
curl -i http://127.0.0.1:8080/missing
```

## Expected logs

The terminal should show logs similar to:

```txt
job 1 started from /jobs
job 1 completed
job 2 started from /jobs
job 2 completed
job 3 started from /jobs
job 3 completed
```

The exact order can vary because jobs run on worker threads.

## Runtime vs route handler

Use a route handler when the work is part of the response.

Example:

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true}
  });
});
```

Use the runtime when the work can happen after the response.

Example:

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  app.runtime().post([]()
  {
    vix::console.info("background work");
  });

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true}
  });
});
```

## Use cases

Runtime background tasks are useful for:

```txt
sending notifications
writing audit logs
warming caches
processing jobs
running cleanup tasks
dispatching async work
triggering internal workflows
```

For long-running production jobs, you may later move to a durable queue.

For learning and small services, `app.runtime().post()` is enough.

## Best practices

### Use `app.runtime()` from normal apps

Prefer:

```cpp
app.runtime().post(task);
```

instead of manually creating a `ThreadPool`.

### Copy request data before scheduling

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

### Use thread-safe shared state

Good:

```cpp
std::atomic<int> counter{0};
```

Use mutexes or proper storage for more complex shared state.

### Return quickly

A background route should return after scheduling:

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true},
  {"message", "job scheduled"}
});
```

### Use `vix::console` for runtime logs

```cpp
vix::console.info("job started");
vix::console.warn("job slow");
vix::console.error("job failed");
```

### Keep jobs small

For heavy workflows, split work into smaller tasks or move to a durable job system later.

## Common mistakes

### Capturing `ctx` by reference

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

### Using non-thread-safe shared state

Wrong:

```cpp
int completed_jobs = 0;

app.runtime().post([&completed_jobs]()
{
  ++completed_jobs;
});
```

Correct:

```cpp
std::atomic<int> completed_jobs{0};

app.runtime().post([&completed_jobs]()
{
  ++completed_jobs;
});
```

### Doing long work inside the handler

Wrong:

```cpp
app.post("/jobs", [](AppContext &ctx)
{
  std::this_thread::sleep_for(std::chrono::seconds(5));
  ctx.json({{"ok", true}});
});
```

Better:

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  app.runtime().post([]()
  {
    std::this_thread::sleep_for(std::chrono::seconds(5));
  });

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "job scheduled"}
  });
});
```

### Stopping the runtime manually when using App

When using `App`, let the application manage the runtime lifecycle.

Do not call:

```cpp
app.runtime().stop();
app.runtime().join();
```

inside normal startup code.

## Summary

This example shows how to use Cnerium runtime from an app.

Use:

```cpp
app.runtime().post(...)
```

to schedule background tasks.

Copy request data before scheduling work.

Use thread-safe state when tasks share data.

Use `vix::console` for runtime logs.

Keep route handlers responsive.

## Next step

Continue with the REST API example.

[Open REST API](/examples/rest-api)
