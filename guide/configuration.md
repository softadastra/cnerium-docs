# Configuration

Cnerium configuration is controlled through `AppConfig`.

Use it when you need to configure:

```txt
host
port
thread count
connection backlog
read buffer size
request body limit
header size limit
keep-alive limits
read timeout
write timeout
keep-alive timeout
```

For most applications, the default configuration is enough to start.

```cpp
App app;

app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello from Cnerium");
});

app.listen("127.0.0.1", 8080);
```

For explicit configuration, create an `AppConfig`.

## Basic configuration

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
    ctx.text("Hello from configured Cnerium");
  });

  app.listen([]()
  {
    vix::console.info("Configured Cnerium app is ready");
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

## AppConfig

`AppConfig` is the high-level configuration object of the app layer.

It is the user-facing configuration type.

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

App app(config);
```

Internally, Cnerium translates `AppConfig` into lower-level server and runtime configuration.

```txt
AppConfig
  -> server::Config
  -> runtime::RuntimeConfig
```

## Main fields

Common fields:

```cpp
config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;
```

Advanced fields:

```cpp
config.backlog = 128;
config.read_buffer_size = 8 * 1024;
config.max_request_body_size = 1024 * 1024;
config.max_header_size = 16 * 1024;
config.max_requests_per_connection = 100;
config.read_timeout_ms = 5000;
config.write_timeout_ms = 5000;
config.keep_alive_timeout_ms = 10000;
```

## Host

The host controls the address the server binds to.

Local development:

```cpp
config.host = "127.0.0.1";
```

Listen on all interfaces:

```cpp
config.host = "0.0.0.0";
```

Use `127.0.0.1` for local development.

Use `0.0.0.0` when the app should be reachable through a reverse proxy, container, or external network interface.

## Port

The port controls where the app listens.

```cpp
config.port = 8080;
```

Common development ports:

```txt
8080
3000
5000
8000
```

Example:

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;

App app(config);
```

## Thread count

The thread count controls the runtime worker count.

```cpp
config.thread_count = 4;
```

Use this when your application needs background tasks or concurrent connection handling.

Example:

```cpp
AppConfig config;
config.thread_count = 4;

App app(config);
```

For development, a small number is fine.

For production, choose a value based on CPU count and workload.

## Backlog

`backlog` controls the maximum number of pending TCP connections in the listen queue.

```cpp
config.backlog = 128;
```

For most applications, the default is enough.

Increase it only when the app receives many concurrent connection attempts.

## Read buffer size

`read_buffer_size` controls how much data is read per socket read operation.

```cpp
config.read_buffer_size = 8 * 1024;
```

The default is usually enough for normal HTTP APIs.

## Max request body size

`max_request_body_size` limits the size of request bodies.

```cpp
config.max_request_body_size = 1024 * 1024;
```

This example allows request bodies up to 1 MB.

Use this to protect your app from excessively large request bodies.

Example for 5 MB:

```cpp
config.max_request_body_size = 5 * 1024 * 1024;
```

## Max header size

`max_header_size` limits the request line and headers.

```cpp
config.max_header_size = 16 * 1024;
```

This protects the server from very large header blocks.

For most APIs, the default is enough.

## Max requests per connection

`max_requests_per_connection` controls how many HTTP requests can be processed on one keep-alive connection.

```cpp
config.max_requests_per_connection = 100;
```

This prevents one client connection from being reused forever.

## Read timeout

`read_timeout_ms` controls how long the server waits while reading from a client socket.

```cpp
config.read_timeout_ms = 5000;
```

Value is in milliseconds.

This example means:

```txt
5000 ms = 5 seconds
```

## Write timeout

`write_timeout_ms` controls how long the server waits while writing to a client socket.

```cpp
config.write_timeout_ms = 5000;
```

Value is in milliseconds.

## Keep-alive timeout

`keep_alive_timeout_ms` controls how long a persistent connection can stay idle while waiting for the next request.

```cpp
config.keep_alive_timeout_ms = 10000;
```

This example means:

```txt
10000 ms = 10 seconds
```

## Development configuration

Use a simple local configuration during development.

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 2;

App app(config);
```

Full example:

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  AppConfig config;
  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 2;

  App app(config);

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"mode", "development"}
    });
  });

  app.listen([]()
  {
    vix::console.info("Development app is ready");
  });
}
```

## Production-style configuration

For production behind a reverse proxy, bind to all interfaces or to an internal address.

```cpp
AppConfig config;
config.host = "0.0.0.0";
config.port = 8080;
config.thread_count = 4;

config.backlog = 256;
config.max_request_body_size = 2 * 1024 * 1024;
config.max_header_size = 16 * 1024;
config.max_requests_per_connection = 100;

config.read_timeout_ms = 5000;
config.write_timeout_ms = 5000;
config.keep_alive_timeout_ms = 10000;

App app(config);
```

This is a reasonable starting point for a small production service.

## Environment-based configuration

For real applications, you may want to read configuration from environment variables.

Example helper:

```cpp
#include <cstdlib>
#include <string>

std::string env_string(const char *name, std::string fallback)
{
  const char *value = std::getenv(name);
  return value ? std::string(value) : std::move(fallback);
}

int env_int(const char *name, int fallback)
{
  const char *value = std::getenv(name);

  if (!value)
  {
    return fallback;
  }

  try
  {
    return std::stoi(value);
  }
  catch (...)
  {
    return fallback;
  }
}
```

Use it with `AppConfig`:

```cpp
AppConfig config;
config.host = env_string("CNERIUM_HOST", "127.0.0.1");
config.port = static_cast<std::uint16_t>(env_int("CNERIUM_PORT", 8080));
config.thread_count = static_cast<std::size_t>(env_int("CNERIUM_THREADS", 4));

App app(config);
```

Run with custom values:

```bash
CNERIUM_HOST=0.0.0.0 CNERIUM_PORT=8080 CNERIUM_THREADS=4 vix run
```

## Suggested environment variables

A simple convention:

```txt
CNERIUM_HOST
CNERIUM_PORT
CNERIUM_THREADS
CNERIUM_MAX_BODY_SIZE
CNERIUM_READ_TIMEOUT_MS
CNERIUM_WRITE_TIMEOUT_MS
CNERIUM_KEEP_ALIVE_TIMEOUT_MS
```

Cnerium does not force this convention.

It is a clean app-level pattern you can use in your project.

## Configuration helper file

For larger projects, move configuration into a file.

```txt
include/api/config/AppConfig.hpp
```

Example:

```cpp
#pragma once

#include <cnerium/app/app.hpp>

#include <cstdlib>
#include <cstdint>
#include <string>

namespace api::config
{
  inline std::string env_string(const char *name, std::string fallback)
  {
    const char *value = std::getenv(name);
    return value ? std::string(value) : std::move(fallback);
  }

  inline int env_int(const char *name, int fallback)
  {
    const char *value = std::getenv(name);

    if (!value)
    {
      return fallback;
    }

    try
    {
      return std::stoi(value);
    }
    catch (...)
    {
      return fallback;
    }
  }

  inline cnerium::app::AppConfig make_app_config()
  {
    cnerium::app::AppConfig config;

    config.host = env_string("CNERIUM_HOST", "127.0.0.1");
    config.port =
        static_cast<std::uint16_t>(env_int("CNERIUM_PORT", 8080));
    config.thread_count =
        static_cast<std::size_t>(env_int("CNERIUM_THREADS", 4));

    config.max_request_body_size =
        static_cast<std::size_t>(
            env_int("CNERIUM_MAX_BODY_SIZE", 1024 * 1024));

    config.read_timeout_ms =
        static_cast<std::uint32_t>(
            env_int("CNERIUM_READ_TIMEOUT_MS", 5000));

    config.write_timeout_ms =
        static_cast<std::uint32_t>(
            env_int("CNERIUM_WRITE_TIMEOUT_MS", 5000));

    config.keep_alive_timeout_ms =
        static_cast<std::uint32_t>(
            env_int("CNERIUM_KEEP_ALIVE_TIMEOUT_MS", 10000));

    return config;
  }
}
```

Then use it in `main.cpp`:

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

#include <api/config/AppConfig.hpp>

int main()
{
  cnerium::app::App app(api::config::make_app_config());

  app.get("/", [](cnerium::app::AppContext &ctx)
  {
    ctx.text("Configured app");
  });

  app.listen([]()
  {
    vix::console.info("Configured app is ready");
  });
}
```

## Listening with config

When you create `App` with an `AppConfig`, you can use:

```cpp
app.listen();
```

or:

```cpp
app.listen([]()
{
  vix::console.info("App is ready");
});
```

The app uses the host and port from the config.

Example:

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;

App app(config);

app.listen();
```

## Listening with explicit host and port

You can also pass host and port directly:

```cpp
app.listen("127.0.0.1", 8080);
```

Or with a callback:

```cpp
app.listen("127.0.0.1", 8080, []()
{
  vix::console.info("App is ready");
});
```

This is convenient for small examples.

## Config vs listen arguments

Use `AppConfig` when configuration should be centralized.

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;

App app(config);
app.listen();
```

Use direct `listen()` arguments for small examples:

```cpp
App app;
app.listen("127.0.0.1", 8080);
```

For real applications, prefer `AppConfig`.

## Complete example

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

#include <cstdlib>
#include <cstdint>
#include <string>

using namespace cnerium::app;

namespace
{
  std::string env_string(const char *name, std::string fallback)
  {
    const char *value = std::getenv(name);
    return value ? std::string(value) : std::move(fallback);
  }

  int env_int(const char *name, int fallback)
  {
    const char *value = std::getenv(name);

    if (!value)
    {
      return fallback;
    }

    try
    {
      return std::stoi(value);
    }
    catch (...)
    {
      return fallback;
    }
  }

  AppConfig make_config()
  {
    AppConfig config;

    config.host = env_string("CNERIUM_HOST", "127.0.0.1");
    config.port =
        static_cast<std::uint16_t>(env_int("CNERIUM_PORT", 8080));
    config.thread_count =
        static_cast<std::size_t>(env_int("CNERIUM_THREADS", 4));

    config.backlog = env_int("CNERIUM_BACKLOG", 128);

    config.read_buffer_size =
        static_cast<std::size_t>(
            env_int("CNERIUM_READ_BUFFER_SIZE", 8 * 1024));

    config.max_request_body_size =
        static_cast<std::size_t>(
            env_int("CNERIUM_MAX_BODY_SIZE", 1024 * 1024));

    config.max_header_size =
        static_cast<std::size_t>(
            env_int("CNERIUM_MAX_HEADER_SIZE", 16 * 1024));

    config.max_requests_per_connection =
        static_cast<std::size_t>(
            env_int("CNERIUM_MAX_REQUESTS_PER_CONNECTION", 100));

    config.read_timeout_ms =
        static_cast<std::uint32_t>(
            env_int("CNERIUM_READ_TIMEOUT_MS", 5000));

    config.write_timeout_ms =
        static_cast<std::uint32_t>(
            env_int("CNERIUM_WRITE_TIMEOUT_MS", 5000));

    config.keep_alive_timeout_ms =
        static_cast<std::uint32_t>(
            env_int("CNERIUM_KEEP_ALIVE_TIMEOUT_MS", 10000));

    return config;
  }
}

int main()
{
  App app(make_config());

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "Configuration guide example"}
    });
  });

  app.get("/config", [&app](AppContext &ctx)
  {
    const auto &config = app.config();

    ctx.json({
      {"host", config.host},
      {"port", static_cast<int>(config.port)},
      {"thread_count", static_cast<int>(config.thread_count)},
      {"max_request_body_size", static_cast<int>(config.max_request_body_size)},
      {"max_header_size", static_cast<int>(config.max_header_size)},
      {"read_timeout_ms", static_cast<int>(config.read_timeout_ms)},
      {"write_timeout_ms", static_cast<int>(config.write_timeout_ms)},
      {"keep_alive_timeout_ms", static_cast<int>(config.keep_alive_timeout_ms)}
    });
  });

  app.listen([]()
  {
    vix::console.info("Configuration guide example is ready");
  });
}
```

## Test the example

Run with defaults:

```bash
vix dev
```

Test:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/config
```

Run with environment variables:

```bash
CNERIUM_HOST=127.0.0.1 \
CNERIUM_PORT=9090 \
CNERIUM_THREADS=4 \
vix run
```

Test:

```bash
curl http://127.0.0.1:9090/config
```

## Recommended defaults

For local development:

```cpp
config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 2;
config.max_request_body_size = 1024 * 1024;
config.read_timeout_ms = 5000;
config.write_timeout_ms = 5000;
config.keep_alive_timeout_ms = 10000;
```

For small production services:

```cpp
config.host = "0.0.0.0";
config.port = 8080;
config.thread_count = 4;
config.backlog = 256;
config.max_request_body_size = 2 * 1024 * 1024;
config.max_header_size = 16 * 1024;
config.max_requests_per_connection = 100;
config.read_timeout_ms = 5000;
config.write_timeout_ms = 5000;
config.keep_alive_timeout_ms = 10000;
```

## Best practices

### Use `AppConfig` for real applications

Good:

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;

App app(config);
```

### Use direct `listen()` arguments for examples

Good for docs and small demos:

```cpp
App app;
app.listen("127.0.0.1", 8080);
```

### Keep configuration in one place

For growing applications, use:

```txt
include/api/config/AppConfig.hpp
```

### Use environment variables for deployment

This makes deployment easier:

```bash
CNERIUM_HOST=0.0.0.0 CNERIUM_PORT=8080 vix run
```

### Set request limits

Always keep request limits enabled.

```cpp
config.max_request_body_size = 1024 * 1024;
config.max_header_size = 16 * 1024;
```

### Do not expose development settings in production

Avoid production configs that are too permissive:

```cpp
config.max_request_body_size = 1024 * 1024 * 1024;
config.read_timeout_ms = 600000;
```

Use reasonable limits.

### Log startup configuration

Use `vix::console`:

```cpp
vix::console.info("host", config.host, "port", config.port);
```

## Common mistakes

### Binding to `127.0.0.1` when running behind Docker or a reverse proxy

For local-only development:

```cpp
config.host = "127.0.0.1";
```

For external access:

```cpp
config.host = "0.0.0.0";
```

### Forgetting that timeouts are in milliseconds

```cpp
config.read_timeout_ms = 5000; // 5 seconds
```

### Setting thread count to zero

Use at least one worker thread.

```cpp
config.thread_count = 1;
```

### Using huge body limits

Avoid large limits unless your route really needs them.

For file uploads, design the upload path carefully instead of increasing the global body size blindly.

### Spreading configuration across handlers

Avoid this:

```cpp
app.get("/", [](AppContext &ctx)
{
  // random config logic here
});
```

Keep configuration separate from route logic.

## Summary

Use `AppConfig` to configure Cnerium.

The most important fields are:

```cpp
config.host;
config.port;
config.thread_count;
config.max_request_body_size;
config.read_timeout_ms;
config.write_timeout_ms;
config.keep_alive_timeout_ms;
```

Use environment variables for deployment.

Use reasonable limits.

Keep configuration centralized.

## Next step

Continue with printing and logging.

[Open Printing](/guide/printing)
