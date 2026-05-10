# Runtime

`cnerium::runtime` provides the concurrent execution layer of Cnerium.

It is responsible for running tasks on worker threads and connecting the server layer to concurrent execution.

In normal applications, you usually access the runtime through `App`:

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

Use the runtime module directly when you need lower-level control over task execution.

## Include

```cpp
#include <cnerium/runtime/runtime.hpp>
```

## Namespace

```cpp
using namespace cnerium::runtime;
```

Or use the fully qualified name:

```cpp
cnerium::runtime::Runtime runtime;
```

## Main types

The runtime module exposes these main types:

```txt
Task
RuntimeConfig
ThreadPool
Executor
Scheduler
Runtime
ServerRunner
```

It also exposes lower-level detail utilities:

```txt
detail::BlockingQueue
detail::TaskQueue
detail::StopToken
detail::ConcurrencyUtils
detail::ThreadName
```

## Basic runtime usage

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
    vix::console.info("task 1");
  });

  runtime.dispatch([]()
  {
    vix::console.info("task 2");
  });

  std::this_thread::sleep_for(std::chrono::milliseconds(200));

  runtime.stop();
  runtime.join();

  vix::console.info("runtime finished");
}
```

## Runtime lifecycle

When using `Runtime` directly, the lifecycle is:

```txt
construct
start
post tasks
stop
join
```

Example:

```cpp
Runtime runtime;

runtime.start();

runtime.post([]()
{
  vix::console.info("background task");
});

runtime.stop();
runtime.join();
```

When using `App`, the app manages the runtime lifecycle for you.

## Task

`Task` is the basic executable unit.

```cpp
using Task = std::function<void()>;
```

A task has this shape:

```cpp
[]()
{
  // work
}
```

Example:

```cpp
Task task = []()
{
  vix::console.info("task executed");
};

task();
```

## Submit tasks

Use `post()` to submit work:

```cpp
runtime.post([]()
{
  vix::console.info("posted task");
});
```

Use `dispatch()` when you want to express explicit runtime dispatch:

```cpp
runtime.dispatch([]()
{
  vix::console.info("dispatched task");
});
```

For most code, prefer:

```cpp
runtime.post(...)
```

## Capturing values

Tasks often capture data.

Good:

```cpp
std::string name = "Cnerium";

runtime.post([name]()
{
  vix::console.info("task for", name);
});
```

Avoid capturing short-lived references:

```cpp
runtime.post([&name]()
{
  vix::console.info(name);
});
```

Capture by value unless you are sure the referenced object outlives the task.

## RuntimeConfig

`RuntimeConfig` configures runtime execution.

```cpp
RuntimeConfig config;

config.thread_count = 4;
config.max_queue_size = 0;

Runtime runtime(config);
```

Fields:

```cpp
std::size_t thread_count;
std::size_t max_queue_size;
```

## `thread_count`

Controls the number of runtime worker threads.

```cpp
config.thread_count = 4;
```

Use a small explicit value for development.

For production, tune based on:

```txt
CPU count
blocking work
expected concurrency
background job load
request workload
```

## `max_queue_size`

Controls the maximum task queue size.

```cpp
config.max_queue_size = 0;
```

A value of `0` means unbounded.

## Validate RuntimeConfig

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

## ThreadPool

`ThreadPool` owns worker threads and executes queued tasks.

Use it directly when you need lower-level control.

```cpp
ThreadPool pool;

pool.start();

pool.post([]()
{
  vix::console.info("task");
});

pool.stop();
pool.join();
```

## ThreadPool example

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
      vix::console.info("thread pool task", i, "running");
      std::this_thread::sleep_for(std::chrono::milliseconds(100));
    });
  }

  std::this_thread::sleep_for(std::chrono::seconds(1));

  pool.stop();
  pool.join();

  vix::console.info("thread pool finished");
}
```

## ThreadPool API

Common operations:

```cpp
pool.start();
pool.post(task);
pool.stop();
pool.join();
```

Use `Runtime` for normal usage.

Use `ThreadPool` when building lower-level runtime integrations.

## Executor

`Executor` is a non-owning task submission interface over a `ThreadPool`.

It does not own the pool.

```cpp
ThreadPool pool;
pool.start();

Executor executor(pool);

executor.post([]()
{
  vix::console.info("executor task");
});
```

## Executor example

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
    vix::console.info("executor post");
  });

  executor.dispatch([]()
  {
    vix::console.info("executor dispatch");
  });

  std::this_thread::sleep_for(std::chrono::milliseconds(200));

  pool.stop();
  pool.join();
}
```

## Executor API

```cpp
Executor executor;
Executor executor(pool);

executor.bind(pool);
executor.reset();

executor.valid();
static_cast<bool>(executor);

executor.pool();

executor.post(task);
executor.dispatch(task);
```

`post()` returns `true` when the task was submitted.

It returns `false` when the executor is not bound to a pool.

## Scheduler

`Scheduler` is a lightweight scheduling facade above `Executor`.

For now, it forwards tasks to the executor.

```cpp
Scheduler scheduler(executor);

scheduler.schedule(task);
scheduler.post(task);
scheduler.dispatch(task);
```

## Scheduler example

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
    vix::console.info("scheduled task");
  });

  scheduler.post([]()
  {
    vix::console.info("posted through scheduler");
  });

  scheduler.dispatch([]()
  {
    vix::console.info("dispatched through scheduler");
  });

  std::this_thread::sleep_for(std::chrono::milliseconds(200));

  pool.stop();
  pool.join();
}
```

## Scheduler API

```cpp
Scheduler scheduler;
Scheduler scheduler(executor);

scheduler.bind(executor);
scheduler.reset();

scheduler.valid();
static_cast<bool>(scheduler);

scheduler.executor();

scheduler.schedule(task);
scheduler.post(task);
scheduler.dispatch(task);
```

Future versions may add scheduling strategies such as:

```txt
delayed tasks
priorities
worker affinity
round-robin dispatch
task categories
```

## Runtime

`Runtime` is the high-level runtime facade.

It is usually the best direct runtime API.

```cpp
Runtime runtime;

runtime.start();

runtime.post(task);

runtime.stop();
runtime.join();
```

## Runtime API

```cpp
Runtime runtime;
Runtime runtime(config);

runtime.start();

runtime.post(task);
runtime.dispatch(task);

runtime.stop();
runtime.join();

runtime.executor();
runtime.scheduler();
```

## Runtime example

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

## Runtime from App

In normal Cnerium applications, access the runtime through `App`.

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
    vix::console.info("background task");
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("app is ready");
  });
}
```

This is the recommended application-level pattern.

## Background task from a route

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::app;

int main()
{
  App app;

  app.post("/jobs", [&app](AppContext &ctx)
  {
    std::string path(ctx.path());

    app.runtime().post([path]()
    {
      vix::console.info("background job from", path);
    });

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "job scheduled"}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("runtime route example is ready");
  });
}
```

## Copy request data before scheduling

Do not capture `AppContext&` inside a runtime task.

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
    vix::console.info(path);
  });

  ctx.json({{"ok", true}});
});
```

The request context belongs to the current request lifecycle.

The background task may run after that lifecycle ends.

## Thread-safe shared state

Runtime tasks may run on different threads.

Use thread-safe state when tasks share data.

Good:

```cpp
std::atomic<int> counter{0};

app.runtime().post([&counter]()
{
  ++counter;
});
```

Avoid:

```cpp
int counter = 0;

app.runtime().post([&counter]()
{
  ++counter;
});
```

For complex shared data, use a mutex or a proper storage layer.

## ServerRunner

`ServerRunner` connects a `Runtime` and a `Server`.

It starts the runtime, starts the server listener, accepts connections, and dispatches connection processing to runtime workers.

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

Most application code should not use `ServerRunner` directly.

Use `App` instead.

## Detail namespace

The runtime module exposes some internal utilities under:

```cpp
cnerium::runtime::detail
```

These are useful for framework work, tests, or advanced lower-level control.

Normal application code should prefer:

```cpp
Runtime
app.runtime()
```

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

API:

```cpp
token.request_stop();
token.stop_requested();
token.reset();
```

## BlockingQueue

`BlockingQueue<T>` is a thread-safe FIFO queue.

It supports blocking and non-blocking pop operations.

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

API:

```cpp
queue.push(value);

queue.try_pop(out);
queue.wait_and_pop(out);

queue.stop();
queue.stopped();

queue.size();
queue.empty();
```

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

API:

```cpp
queue.push(task);

queue.try_pop(task);
queue.wait_and_pop(task);

queue.stop();
queue.stopped();

queue.size();
queue.empty();
```

## Concurrency utilities

The runtime provides helpers for thread count normalization.

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
hardware_threads();
clamp_thread_count(n);
normalize_thread_count(n);
compute_worker_count(requested);
cpu_relax();
```

## ThreadName

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

On unsupported platforms, it becomes a no-op.

## Complete App + Runtime example

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
      {"message", "Runtime reference example"}
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
    vix::console.info("Runtime reference example is ready");
  });
}
```

## Test the complete example

Run:

```bash
vix dev
```

Test:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/jobs

curl -X POST http://127.0.0.1:8080/jobs
curl -X POST http://127.0.0.1:8080/jobs

curl http://127.0.0.1:8080/jobs
```

## API overview

Task:

```cpp
using Task = std::function<void()>;
```

RuntimeConfig:

```cpp
struct RuntimeConfig
{
  std::size_t thread_count;
  std::size_t max_queue_size;

  bool valid() const noexcept;
  void reset() noexcept;
};
```

ThreadPool:

```cpp
pool.start();
pool.post(task);
pool.stop();
pool.join();
```

Executor:

```cpp
executor.bind(pool);
executor.reset();

executor.valid();
executor.pool();

executor.post(task);
executor.dispatch(task);
```

Scheduler:

```cpp
scheduler.bind(executor);
scheduler.reset();

scheduler.valid();
scheduler.executor();

scheduler.schedule(task);
scheduler.post(task);
scheduler.dispatch(task);
```

Runtime:

```cpp
runtime.start();

runtime.post(task);
runtime.dispatch(task);

runtime.stop();
runtime.join();

runtime.executor();
runtime.scheduler();
```

ServerRunner:

```cpp
ServerRunner runner(runtime, server);

runner.run();
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

## Common patterns

Post background work:

```cpp
app.runtime().post([]()
{
  vix::console.info("background task");
});
```

Post work with copied data:

```cpp
std::string path(ctx.path());

app.runtime().post([path]()
{
  vix::console.info("job from", path);
});
```

Count completed jobs:

```cpp
std::atomic<int> completed{0};

app.runtime().post([&completed]()
{
  ++completed;
});
```

Use direct runtime:

```cpp
Runtime runtime;

runtime.start();
runtime.post(task);
runtime.stop();
runtime.join();
```

## Best practices

### Use `app.runtime()` in applications

For normal Cnerium apps:

```cpp
app.runtime().post(...)
```

### Use `Runtime` directly for lower-level work

```cpp
Runtime runtime;
```

Use direct runtime only when you manage its lifecycle yourself.

### Always start direct Runtime

```cpp
runtime.start();
```

before posting tasks.

### Stop and join direct Runtime

```cpp
runtime.stop();
runtime.join();
```

when you are done.

### Do not capture request context

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

### Use thread-safe shared state

Use atomics, mutexes, or proper storage for data shared between tasks.

### Keep background tasks focused

Good tasks:

```txt
send notification
write audit log
warm cache
run small job
cleanup temporary data
```

For durable production workflows, use a persistent queue or storage-backed job system.

### Use `vix::console` for runtime logs

```cpp
vix::console.info("job started");
vix::console.warn("job slow");
vix::console.error("job failed");
```

## Common mistakes

### Posting before starting direct Runtime

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

### Forgetting shutdown

When using direct runtime:

```cpp
runtime.stop();
runtime.join();
```

### Capturing stack references unsafely

Wrong:

```cpp
std::string value = "hello";

runtime.post([&value]()
{
  vix::console.info(value);
});
```

Prefer:

```cpp
std::string value = "hello";

runtime.post([value]()
{
  vix::console.info(value);
});
```

### Using non-thread-safe shared state

Wrong:

```cpp
int counter = 0;

runtime.post([&counter]()
{
  ++counter;
});
```

Correct:

```cpp
std::atomic<int> counter{0};

runtime.post([&counter]()
{
  ++counter;
});
```

### Manually stopping App runtime

When using `App`, do not stop the runtime manually during normal startup.

The app owns the lifecycle.

### Using ServerRunner in normal app code

Prefer:

```cpp
App app;
```

over manually wiring:

```cpp
Runtime runtime;
Server server;
ServerRunner runner(runtime, server);
```

## Summary

`cnerium::runtime` is the concurrent execution layer of Cnerium.

It provides:

```txt
Task
RuntimeConfig
ThreadPool
Executor
Scheduler
Runtime
ServerRunner
```

Use `app.runtime()` for normal applications.

Use `Runtime` directly when you need lower-level control.

Always copy request data before scheduling background tasks.

Use thread-safe state when tasks share data.

## Next step

Continue with vix::print.

[Open vix::print reference](/reference/vix-print)
