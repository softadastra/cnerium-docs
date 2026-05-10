# Runtime

`cnerium::runtime` provides the concurrent execution layer of Cnerium.

It includes the runtime primitives used to execute work on worker threads and connect the HTTP server layer to concurrent request processing.

The runtime module provides:

```txt
Task
ThreadPool
Executor
Scheduler
Runtime
ServerRunner
BlockingQueue
TaskQueue
StopToken
thread utilities
```

For normal applications, you usually access the runtime through `cnerium::app::App`:

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

Use the runtime module directly when you need lower-level control over task execution.

## Package

```txt
cnerium/runtime
```

Current version:

```txt
0.4.0
```

Package metadata:

```json
{
  "name": "runtime",
  "namespace": "cnerium",
  "version": "0.4.0",
  "type": "header-only",
  "include": "include",
  "license": "MIT",
  "description": "Concurrent execution runtime for the Cnerium web framework. Provides thread pool, executor, scheduler, and integrates with the HTTP server layer.",
  "repository": "https://github.com/cnerium/runtime",
  "deps": [
    {
      "id": "cnerium/server",
      "version": "0.5.0"
    }
  ]
}
```

## Install

```bash
vix add cnerium/runtime
```

For normal Cnerium applications, install the app layer instead:

```bash
vix add cnerium/app
```

`cnerium/app` pulls the runtime module through the framework dependency chain.

## Include

Use the main public header:

```cpp
#include <cnerium/runtime/runtime.hpp>
```

This gives access to:

```txt
version.hpp
Task.hpp
RuntimeConfig.hpp
ThreadPool.hpp
Executor.hpp
Scheduler.hpp
Runtime.hpp
ServerRunner.hpp
```

It also re-exports selected detail utilities:

```txt
ConcurrencyUtils.hpp
StopToken.hpp
ThreadName.hpp
BlockingQueue.hpp
TaskQueue.hpp
```

## Namespace

```cpp
using namespace cnerium::runtime;
```

Or use fully qualified names:

```cpp
cnerium::runtime::Runtime runtime;
```

## Runtime role

The runtime is responsible for executing tasks.

At a high level:

```txt
Runtime
  -> ThreadPool
  -> Worker threads
  -> TaskQueue
  -> Task
```

A task is submitted with:

```cpp
runtime.post(task);
```

Then a worker thread executes it.

## Basic Runtime example

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/console.hpp>

#include <chrono>
#include <thread>

using namespace cnerium::runtime;

int main()
{
  Runtime runtime;

  runtime.start();

  runtime.post([]()
  {
    vix::console.info("[Runtime] Task 1");
  });

  runtime.dispatch([]()
  {
    vix::console.info("[Runtime] Task 2");
  });

  std::this_thread::sleep_for(std::chrono::milliseconds(200));

  runtime.stop();
  runtime.join();

  vix::console.info("Runtime finished");
}
```

## Task

`Task` is the basic executable unit of the runtime.

```cpp
using Task = std::function<void()>;
```

A task takes no arguments and returns no value.

```cpp
Task task = []()
{
  vix::console.info("task executed");
};

task();
```

Most tasks are lambdas:

```cpp
runtime.post([]()
{
  vix::console.info("background task");
});
```

## Capturing values in tasks

Capture values when the task needs data.

```cpp
std::string name = "Cnerium";

runtime.post([name]()
{
  vix::console.info("task for", name);
});
```

Avoid capturing references to short-lived objects.

Good:

```cpp
std::string path = "/jobs";

runtime.post([path]()
{
  vix::console.info("background job from", path);
});
```

Risky:

```cpp
runtime.post([&path]()
{
  vix::console.info(path);
});
```

Only capture by reference when you are sure the referenced object outlives the task.

## RuntimeConfig

`RuntimeConfig` controls runtime behavior.

```cpp
RuntimeConfig config;
config.thread_count = 4;
config.max_queue_size = 0;
```

Fields:

```txt
thread_count
max_queue_size
```

`thread_count` controls the number of worker threads.

`max_queue_size` is reserved for queue capacity behavior.
A value of `0` means unbounded.

## RuntimeConfig example

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/console.hpp>

#include <chrono>
#include <thread>

using namespace cnerium::runtime;

int main()
{
  RuntimeConfig config;
  config.thread_count = 4;

  Runtime runtime(config);

  runtime.start();

  runtime.post([]()
  {
    vix::console.info("configured runtime task");
  });

  std::this_thread::sleep_for(std::chrono::milliseconds(200));

  runtime.stop();
  runtime.join();
}
```

## Validate RuntimeConfig

Use `valid()`:

```cpp
RuntimeConfig config;
config.thread_count = 4;

if (!config.valid())
{
  vix::console.error("invalid runtime config");
  return 1;
}
```

Reset to defaults:

```cpp
config.reset();
```

## ThreadPool

`ThreadPool` owns worker threads and executes queued tasks.

Basic lifecycle:

```txt
start
post tasks
stop
join
```

Example:

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
      vix::console.info("[ThreadPool] Task", i, "running");
      std::this_thread::sleep_for(std::chrono::milliseconds(100));
    });
  }

  std::this_thread::sleep_for(std::chrono::seconds(1));

  pool.stop();
  pool.join();

  vix::console.info("ThreadPool finished");
}
```

Use `ThreadPool` directly for low-level runtime work.

For app code, prefer `Runtime` or `app.runtime()`.

## Executor

`Executor` is a non-owning task submission interface over a `ThreadPool`.

It does not own the pool.

It only submits work into it.

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

  Executor executor(pool);

  executor.post([]()
  {
    vix::console.info("[Executor] Task executed");
  });

  executor.dispatch([]()
  {
    vix::console.info("[Executor] Dispatch executed");
  });

  std::this_thread::sleep_for(std::chrono::milliseconds(200));

  pool.stop();
  pool.join();
}
```

## Executor API

```cpp
Executor executor(pool);

executor.post(task);
executor.dispatch(task);

executor.valid();
executor.bind(pool);
executor.reset();
executor.pool();
```

Use `post()` as the default submission method.

Use `dispatch()` when you want to express that work should be executed through the executor.

## Scheduler

`Scheduler` is a lightweight scheduling facade above `Executor`.

For now, scheduling forwards directly to `Executor::post()`.

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

  Executor executor(pool);
  Scheduler scheduler(executor);

  scheduler.schedule([]()
  {
    vix::console.info("[Scheduler] scheduled task");
  });

  scheduler.post([]()
  {
    vix::console.info("[Scheduler] posted task");
  });

  scheduler.dispatch([]()
  {
    vix::console.info("[Scheduler] dispatched task");
  });

  std::this_thread::sleep_for(std::chrono::milliseconds(200));

  pool.stop();
  pool.join();
}
```

## Scheduler API

```cpp
Scheduler scheduler(executor);

scheduler.schedule(task);
scheduler.post(task);
scheduler.dispatch(task);

scheduler.valid();
scheduler.bind(executor);
scheduler.reset();
scheduler.executor();
```

`Scheduler` is the extension point for future scheduling policies.

Future versions may add:

```txt
delayed tasks
priorities
worker affinity
round-robin scheduling
task categories
```

## Runtime

`Runtime` is the high-level runtime facade.

It owns and connects the lower runtime pieces.

Use it when you want an easier API than manually managing `ThreadPool`, `Executor`, and `Scheduler`.

```cpp
Runtime runtime;

runtime.start();

runtime.post([]()
{
  vix::console.info("task");
});

runtime.stop();
runtime.join();
```

## Runtime lifecycle

```txt
construct
start
post / dispatch tasks
stop
join
```

Example:

```cpp
Runtime runtime;

runtime.start();

runtime.post(task);

runtime.stop();
runtime.join();
```

When using `App`, this lifecycle is managed for you.

## `post()` and `dispatch()`

The runtime exposes both:

```cpp
runtime.post(task);
runtime.dispatch(task);
```

For now, both submit work to the runtime.

Use `post()` by default.

```cpp
runtime.post([]()
{
  vix::console.info("background task");
});
```

Use `dispatch()` when you want to express runtime dispatch explicitly.

```cpp
runtime.dispatch([]()
{
  vix::console.info("dispatched task");
});
```

## ServerRunner

`ServerRunner` connects the runtime and the server.

It:

```txt
starts the runtime
starts the server listener
accepts connections
dispatches connection processing to runtime workers
```

Example:

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

Most applications do not use `ServerRunner` directly.

The `App` layer wires this for you.

## Runtime with App

In normal Cnerium applications, use the high-level `App` API.

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
    vix::console.info("[Runtime] background task");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("App is ready");
  });
}
```

This is the recommended way to use the runtime in application code.

## Background task from a route

You can submit background work from a route.

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.post("/jobs", [&app](AppContext &ctx)
  {
    app.runtime().post([]()
    {
      vix::console.info("background job executed");
    });

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "job scheduled"}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Background job example is ready");
  });
}
```

The route returns immediately while the task runs in the runtime.

## Copy request data before background work

Do not capture `AppContext&` inside a background task.

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

Correct:

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

The request context belongs to the request lifecycle.
A background task may run after that lifecycle has ended.

## Detail utilities

The runtime module also contains internal utilities under:

```cpp
cnerium::runtime::detail
```

These include:

```txt
BlockingQueue
TaskQueue
StopToken
ConcurrencyUtils
ThreadName
```

They are available through the runtime header for completeness, but normal application code should prefer `Runtime`.

## StopToken

`StopToken` is a lightweight cooperative stop signal.

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/print.hpp>

using namespace cnerium::runtime::detail;

int main()
{
  StopToken token;

  vix::print("stop requested:", token.stop_requested());

  token.request_stop();

  vix::print("stop requested:", token.stop_requested());

  token.reset();

  vix::print("stop requested:", token.stop_requested());
}
```

It is used internally by runtime components to detect shutdown.

## BlockingQueue

`BlockingQueue<T>` is a thread-safe FIFO queue.

It supports:

```txt
push
try_pop
wait_and_pop
stop
stopped
size
empty
```

Example:

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/print.hpp>

using namespace cnerium::runtime::detail;

int main()
{
  BlockingQueue<int> queue;

  queue.push(42);

  int value = 0;

  if (queue.try_pop(value))
  {
    vix::print("value:", value);
  }

  queue.stop();
}
```

`wait_and_pop()` blocks until an item is available or the queue is stopped.

## TaskQueue

`TaskQueue` is a runtime-specific wrapper over `BlockingQueue<Task>`.

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/console.hpp>

using namespace cnerium::runtime;
using namespace cnerium::runtime::detail;

int main()
{
  TaskQueue queue;

  queue.push([]()
  {
    vix::console.info("task from queue");
  });

  Task task;

  if (queue.try_pop(task))
  {
    task();
  }

  queue.stop();
}
```

In normal code, prefer `Runtime` or `ThreadPool`.

## Concurrency utilities

The runtime provides small helpers for thread counts.

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/print.hpp>

using namespace cnerium::runtime::detail;

int main()
{
  vix::print("hardware threads:", hardware_threads());
  vix::print("normalized:", normalize_thread_count(0));
  vix::print("computed workers:", compute_worker_count(4));
}
```

Common helpers:

```cpp
hardware_threads()
clamp_thread_count()
normalize_thread_count()
compute_worker_count()
cpu_relax()
```

## Thread naming

`set_thread_name()` sets the current thread name on supported platforms.

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/console.hpp>

using namespace cnerium::runtime::detail;

int main()
{
  set_thread_name("cnerium-main");

  vix::console.info("thread name set");
}
```

This is useful for debugging and profiling.

On unsupported platforms, it becomes a no-op.

## Complete runtime example

```cpp
#include <cnerium/runtime/runtime.hpp>
#include <vix/console.hpp>

#include <atomic>
#include <chrono>
#include <thread>

using namespace cnerium::runtime;

int main()
{
  RuntimeConfig config;
  config.thread_count = 4;

  Runtime runtime(config);

  std::atomic<int> completed{0};

  runtime.start();

  for (int i = 0; i < 8; ++i)
  {
    runtime.post([i, &completed]()
    {
      vix::console.info("task", i, "started");

      std::this_thread::sleep_for(std::chrono::milliseconds(100));

      ++completed;

      vix::console.info("task", i, "finished");
    });
  }

  std::this_thread::sleep_for(std::chrono::seconds(2));

  runtime.stop();
  runtime.join();

  vix::console.info("completed tasks:", completed.load());
}
```

## Complete App + Runtime example

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

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "Runtime module app example"}
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

    std::string path(ctx.path());

    app.runtime().post([job_id, path]()
    {
      vix::console.info("running background job", job_id, "from", path);
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
    vix::console.info("Runtime module app example is ready");
  });
}
```

## Test the App + Runtime example

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
POST /jobs schedules runtime work.
GET /jobs/count returns the number of scheduled jobs.
vix::console shows background task logs.
```

## API overview

Task:

```cpp
using Task = std::function<void()>;
```

RuntimeConfig:

```cpp
RuntimeConfig

thread_count
max_queue_size

valid()
reset()
```

ThreadPool:

```cpp
ThreadPool

start()
post()
stop()
join()
```

Executor:

```cpp
Executor

bind()
reset()
valid()
operator bool()
pool()

post()
dispatch()
```

Scheduler:

```cpp
Scheduler

bind()
reset()
valid()
operator bool()
executor()

schedule()
post()
dispatch()
```

Runtime:

```cpp
Runtime

start()
stop()
join()

post()
dispatch()

executor()
scheduler()
```

ServerRunner:

```cpp
ServerRunner(runtime, server)

run()
```

Detail utilities:

```cpp
detail::StopToken
detail::BlockingQueue<T>
detail::TaskQueue

detail::hardware_threads()
detail::clamp_thread_count()
detail::normalize_thread_count()
detail::compute_worker_count()
detail::cpu_relax()

detail::set_thread_name()
```

## Best practices

### Use App for normal applications

Prefer:

```cpp
#include <cnerium/app/app.hpp>
```

and access the runtime with:

```cpp
app.runtime()
```

### Use `app.runtime().post()` for background work

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

### Copy request data before scheduling work

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

If work can run later, schedule it:

```cpp
app.runtime().post(task);

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

### Let App manage runtime lifecycle

When using `App`, do not manually call:

```cpp
app.runtime().stop();
app.runtime().join();
```

during normal app startup.

### Use `vix::console` for runtime logs

```cpp
vix::console.info("task started");
vix::console.warn("task took too long");
vix::console.error("task failed");
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

### Forgetting to start the runtime when using it directly

Wrong:

```cpp
Runtime runtime;

runtime.post([]()
{
  vix::console.info("task");
});
```

Correct:

```cpp
Runtime runtime;

runtime.start();

runtime.post([]()
{
  vix::console.info("task");
});

runtime.stop();
runtime.join();
```

### Forgetting to stop and join direct runtime usage

When using `Runtime` or `ThreadPool` directly, shut it down cleanly.

```cpp
runtime.stop();
runtime.join();
```

### Using ThreadPool directly when Runtime is enough

Prefer:

```cpp
Runtime runtime;
```

over manually wiring lower-level pieces.

### Using runtime for normal request logic

If the work is part of the response, keep it in the handler.

Use the runtime for background or asynchronous work.

## Summary

`cnerium::runtime` is the concurrent execution layer of Cnerium.

It provides:

```txt
Task
ThreadPool
Executor
Scheduler
Runtime
ServerRunner
```

Use it directly for lower-level concurrent execution.

Use `app.runtime()` in normal Cnerium applications.

Always copy request data before scheduling background tasks.

Use `vix::console` for runtime logs.

## Next step

Continue with the App module.

[Open App module](/modules/app)
