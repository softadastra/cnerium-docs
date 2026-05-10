# Printing and Logging

Cnerium documentation uses Vix utilities for output and logs.

Use:

```txt
vix::print    -> simple output
vix::console  -> application logs
```

Avoid `std::cout` in normal Cnerium examples.

## Why Cnerium uses Vix output helpers

Cnerium is part of the Vix ecosystem.

Instead of writing verbose console code like this:

```cpp
std::cout << "Server started" << std::endl;
```

Use:

```cpp
vix::console.info("Server started");
```

For simple values:

```cpp
vix::print("Hello from Cnerium");
```

This keeps examples clean, readable, and consistent.

## Quick rule

Use this rule:

```txt
Use vix::print for simple output.
Use vix::console for application logs.
```

Examples:

```cpp
vix::print("Hello from Cnerium");
vix::console.info("Cnerium app is ready");
```

## `vix::print`

`vix::print` is useful when you only want to print values.

Include it with:

```cpp
#include <vix/print.hpp>
```

Basic example:

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print("Hello from Vix");
  vix::print("name:", "Gaspard", "age:", 25);

  return 0;
}
```

Output:

```txt
Hello from Vix
name: Gaspard age: 25
```

## Empty line

Call `vix::print()` with no arguments to print an empty line.

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print("line 1");
  vix::print();
  vix::print("line 2");

  return 0;
}
```

## Custom separator

Use `vix::options` to customize the separator.

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print(
      vix::options{.sep = " | "},
      "red", "green", "blue");

  vix::print(
      vix::options{.sep = " -> "},
      "A", "B", "C");

  return 0;
}
```

Output:

```txt
red | green | blue
A -> B -> C
```

## Custom end

By default, `vix::print` ends with a newline.

You can change that with `.end`.

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print(
      vix::options{.end = ""},
      "loading...");

  vix::print();

  vix::print(
      vix::options{.end = " <done>\n"},
      "task");

  return 0;
}
```

## Flush output

Use `.flush = true` when the output should be flushed immediately.

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print(
      vix::options{
          .end = "",
          .flush = true},
      "processing...");

  vix::print();
  vix::print("done");

  return 0;
}
```

## Print to stderr

Use `.file = &std::cerr` to print to standard error.

```cpp
#include <iostream>
#include <vix/print.hpp>

int main()
{
  vix::print("normal output");

  vix::print(
      vix::options{.file = &std::cerr},
      "error:", "invalid input");

  return 0;
}
```

Use this for small demos.

For real app errors, prefer:

```cpp
vix::console.error("invalid input");
```

## Containers

`vix::print` can print common STL containers.

```cpp
#include <map>
#include <string>
#include <vector>

#include <vix/print.hpp>

int main()
{
  std::vector<int> numbers{1, 2, 3, 4, 5};

  std::map<std::string, int> scores{
      {"alice", 10},
      {"bob", 20},
      {"charlie", 30}};

  vix::print("numbers:", numbers);
  vix::print("scores:", scores);

  return 0;
}
```

## Pretty containers

Use `.compact = false` for more readable nested containers.

```cpp
#include <map>
#include <string>
#include <vector>

#include <vix/print.hpp>

int main()
{
  std::map<std::string, std::vector<int>> data{
      {"evens", {2, 4, 6, 8}},
      {"odds", {1, 3, 5, 7}},
      {"primes", {2, 3, 5, 7}}};

  vix::print("compact:");
  vix::print(data);

  vix::print();
  vix::print("pretty:");
  vix::print(
      vix::options{
          .compact = false,
          .indent = "    "},
      data);

  return 0;
}
```

## Optional, variant, and tuple

`vix::print` can print common standard library types.

```cpp
#include <map>
#include <optional>
#include <string>
#include <tuple>
#include <variant>
#include <vector>

#include <vix/print.hpp>

int main()
{
  std::optional<int> age = 25;
  std::variant<int, std::string> status = std::string{"active"};
  auto values = std::make_tuple("tuple", 42, true);

  std::vector<std::string> tags{"fast", "stable", "simple"};
  std::map<std::string, int> stats{ {"ok", 10}, {"fail", 2} };

  vix::print(age, status, values, tags, stats);

  return 0;
}
```

## Strings

`vix::print` works with `std::string` and `std::string_view`.

```cpp
#include <string>
#include <string_view>

#include <vix/print.hpp>

int main()
{
  std::string name = "Vix";
  std::string_view mode = "stable";

  vix::print("project:", name, "mode:", mode);

  vix::print(
      vix::options{.raw_strings = false},
      "quoted string example");

  return 0;
}
```

## Custom types

There are two clean ways to support custom types.

### `vix_format`

Define a `vix_format()` function:

```cpp
#include <ostream>
#include <vix/print.hpp>

struct Point
{
  int x;
  int y;
};

inline void vix_format(std::ostream &os, const Point &point)
{
  os << "Point{x=" << point.x << ", y=" << point.y << "}";
}

int main()
{
  Point point{10, 20};

  vix::print(point);
  vix::print("point:", point);

  return 0;
}
```

### `vix::formatter<T>`

Specialize `vix::formatter<T>`:

```cpp
#include <ostream>
#include <string>
#include <vix/print.hpp>

struct User
{
  std::string name;
  int age;
};

namespace vix
{
  template <>
  struct formatter<User>
  {
    static void format(std::ostream &os, const User &user)
    {
      os << "User{name=\"" << user.name << "\", age=" << user.age << "}";
    }
  };
}

int main()
{
  User user{"Gaspard", 25};

  vix::print(user);
  vix::print("user:", user);

  return 0;
}
```

This is one of the rare places where `std::ostream` appears in the docs, because custom formatting uses stream output internally.

## `vix::console`

Use `vix::console` for application logs.

Include it with:

```cpp
#include <vix/console.hpp>
```

Basic example:

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

## Console levels

`vix::console` provides:

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
vix::console.info("server started");
vix::console.warn("slow request");
vix::console.error("request failed");
```

## Set log level in code

You can change the active log level:

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

## Console environment variables

You can control console behavior from the environment.

```bash
VIX_CONSOLE_LEVEL=debug ./your_app
VIX_COLOR=always ./your_app
NO_COLOR=1 ./your_app
```

Meaning:

```txt
VIX_CONSOLE_LEVEL=debug   enable debug logs
VIX_COLOR=always          force colored output
NO_COLOR=1                disable colored output
```

Example:

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

## Thread-safe logs

Use `vix::console` for threaded output.

```cpp
#include <thread>
#include <vector>

#include <vix/console.hpp>

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

Use this style in Cnerium runtime examples, worker examples, and server examples.

## Supported values

`vix::console` accepts many common values:

```cpp
#include <string>
#include <string_view>

#include <vix/console.hpp>

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

## Use `vix::console` in Cnerium apps

For server startup:

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

For request logs:

```cpp
app.use([](auto &ctx, auto next)
{
  vix::console.info(
    "request",
    cnerium::http::to_string(ctx.request().method()),
    ctx.request().path()
  );

  next();
});
```

For errors:

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

For runtime tasks:

```cpp
app.runtime().post([]()
{
  vix::console.info("background task executed");
});
```

## When to use `vix::print`

Use `vix::print` for:

```txt
small examples
scripts
simple demos
printing computed values
showing container output
debugging standalone snippets
```

Example:

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print("Hello from Cnerium");
  return 0;
}
```

## When to use `vix::console`

Use `vix::console` for:

```txt
application startup
server logs
request logs
warnings
errors
runtime tasks
worker logs
debug diagnostics
```

Example:

```cpp
#include <vix/console.hpp>

vix::console.info("Cnerium app is ready");
vix::console.warn("Using development configuration");
vix::console.error("Failed to start app");
```

## Documentation rule

Cnerium docs follow this rule:

```txt
Use vix::print for simple output examples.
Use vix::console for application logs.
Avoid std::cout in normal documentation examples.
```

Use `std::ostream` only when demonstrating custom formatting hooks such as:

```cpp
vix_format(std::ostream &os, const T &value)
vix::formatter<T>
```

## Complete example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>
#include <vix/print.hpp>

#include <map>
#include <string>
#include <vector>

using namespace cnerium::app;

int main()
{
  vix::print("Starting Cnerium demo");

  std::vector<std::string> features{
      "routing",
      "middleware",
      "json",
      "runtime"};

  std::map<std::string, int> stats{
      {"routes", 3},
      {"middleware", 1}};

  vix::print("features:", features);
  vix::print("stats:", stats);

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
    ctx.text("Printing guide example");
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.get("/error", [](AppContext &ctx)
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", "demo error"}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Printing guide example is ready");
  });
}
```

## Test the example

Run:

```bash
vix dev
```

Test:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/error
```

Enable debug logs:

```bash
VIX_CONSOLE_LEVEL=debug vix run
```

Force color:

```bash
VIX_COLOR=always vix run
```

Disable color:

```bash
NO_COLOR=1 vix run
```

## Best practices

### Use `vix::console` for app logs

Good:

```cpp
vix::console.info("Cnerium app is ready");
```

Avoid:

```cpp
std::cout << "Cnerium app is ready\n";
```

### Use `vix::print` for simple output

Good:

```cpp
vix::print("result:", value);
```

### Use log levels correctly

Use:

```txt
debug  -> internal details
info   -> normal app events
warn   -> unusual but recoverable situations
error  -> failed operations
```

### Do not log sensitive data

Avoid logging:

```txt
passwords
tokens
private keys
authorization headers
session cookies
```

### Keep logs short

Good:

```cpp
vix::console.info("request", method, path);
```

Avoid huge logs in hot paths.

### Copy request data before background logs

If logging inside a background task, copy request data first.

Good:

```cpp
std::string path(ctx.path());

app.runtime().post([path]()
{
  vix::console.info("background job from", path);
});
```

Avoid:

```cpp
app.runtime().post([&ctx]()
{
  vix::console.info(ctx.path());
});
```

## Common mistakes

### Using `std::cout` in documentation examples

Prefer:

```cpp
vix::print("Hello");
```

or:

```cpp
vix::console.info("App is ready");
```

### Using `vix::print` for application logs

For real app logs, prefer:

```cpp
vix::console.info("server started");
```

### Logging too much inside hot loops

Avoid noisy logs in performance-sensitive loops.

```cpp
for (int i = 0; i < 1000; ++i)
{
  vix::console.log("hot loop message", i);
}
```

Warnings and errors should remain visible, but normal log spam should be avoided.

### Exposing internal errors to users

Log internal details server-side:

```cpp
vix::console.error("unhandled exception:", ex.what());
```

Return a safe response to the client:

```cpp
ctx.status(cnerium::http::Status::internal_server_error).json({
  {"ok", false},
  {"error", "internal server error"}
});
```

## Summary

Use `vix::print` for simple output.

Use `vix::console` for application logs.

Use `vix::console.info()` for startup and normal events.

Use `vix::console.warn()` for warnings.

Use `vix::console.error()` for failures.

Avoid `std::cout` in normal Cnerium examples.

Keep logs useful, short, and safe.

## Next step

Continue with deployment.

[Open Deployment](/guide/deployment)
