# AppConfig

`cnerium::app::AppConfig` is the high-level configuration object used by the Cnerium App layer.

It controls both:

```txt
server settings
runtime settings
```

Use it when you want explicit control over host, port, worker threads, request limits, buffer sizes, and timeouts.

## Include

```cpp
#include <cnerium/app/app.hpp>
```

## Namespace

```cpp
using namespace cnerium::app;
```

Or use the fully qualified name:

```cpp
cnerium::app::AppConfig config;
```

## Basic usage

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
    ctx.text("Configured Cnerium app");
  });

  app.listen([]()
  {
    vix::console.info("Cnerium app is ready");
  });
}
```

## Role of AppConfig

`AppConfig` is the user-facing configuration layer.

Internally, Cnerium projects it into lower-level configuration objects:

```txt
AppConfig
  -> cnerium::server::Config
  -> cnerium::runtime::RuntimeConfig
```

This allows the app layer to expose one configuration object instead of forcing users to configure the server and runtime separately.

## Fields overview

```cpp
std::string host;
std::uint16_t port;
std::size_t thread_count;

int backlog;
std::size_t read_buffer_size;
std::size_t max_request_body_size;
std::size_t max_header_size;
std::size_t max_requests_per_connection;

std::uint32_t read_timeout_ms;
std::uint32_t write_timeout_ms;
std::uint32_t keep_alive_timeout_ms;
```

## Default values

Typical defaults:

```txt
host                         127.0.0.1
port                         8080
thread_count                 hardware concurrency

backlog                      128
read_buffer_size             8192
max_request_body_size        1048576
max_header_size              16384
max_requests_per_connection  100

read_timeout_ms              5000
write_timeout_ms             5000
keep_alive_timeout_ms        10000
```

These defaults are suitable for local development and small services.

For production, configure values explicitly.

## `host`

The host address the app binds to.

```cpp
config.host = "127.0.0.1";
```

Common values:

```txt
127.0.0.1  local machine only
0.0.0.0    all network interfaces
```

For local development:

```cpp
config.host = "127.0.0.1";
```

For deployment behind Nginx on the same server:

```cpp
config.host = "127.0.0.1";
```

For container or public binding:

```cpp
config.host = "0.0.0.0";
```

Use `0.0.0.0` only when the app must be reachable from outside the local machine or container.

## `port`

The TCP port the app listens on.

```cpp
config.port = 8080;
```

Common development port:

```txt
8080
```

Example:

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;

App app(config);
```

Test:

```bash
curl http://127.0.0.1:8080/
```

## `thread_count`

The number of runtime worker threads.

```cpp
config.thread_count = 4;
```

This controls the Cnerium runtime used for request execution and background work.

Example:

```cpp
AppConfig config;
config.thread_count = 4;

App app(config);
```

For development, a small value is enough.

For production, choose based on:

```txt
CPU count
expected concurrency
blocking work
runtime tasks
server workload
```

## `backlog`

The maximum number of pending TCP connections in the listen queue.

```cpp
config.backlog = 128;
```

A larger backlog can help when many clients connect at the same time.

Example:

```cpp
config.backlog = 256;
```

## `read_buffer_size`

The size of the buffer used for reading incoming socket data.

```cpp
config.read_buffer_size = 8 * 1024;
```

Default:

```txt
8192 bytes
```

A larger buffer may reduce read calls for larger requests, but uses more memory per connection.

## `max_request_body_size`

The maximum accepted request body size.

```cpp
config.max_request_body_size = 1024 * 1024;
```

Default:

```txt
1048576 bytes
```

That is 1 MB.

Use this to protect the server from very large request bodies.

Example for 2 MB:

```cpp
config.max_request_body_size = 2 * 1024 * 1024;
```

Example for 10 MB:

```cpp
config.max_request_body_size = 10 * 1024 * 1024;
```

## `max_header_size`

The maximum accepted HTTP header block size.

```cpp
config.max_header_size = 16 * 1024;
```

Default:

```txt
16384 bytes
```

This includes the request line and all headers up to the end of the header block.

Use this to limit excessive headers.

## `max_requests_per_connection`

The maximum number of requests processed on one keep-alive connection.

```cpp
config.max_requests_per_connection = 100;
```

This prevents one client connection from being reused forever.

Default:

```txt
100
```

## `read_timeout_ms`

Socket read timeout in milliseconds.

```cpp
config.read_timeout_ms = 5000;
```

Default:

```txt
5000 ms
```

This helps prevent slow clients from holding connections indefinitely while sending data.

## `write_timeout_ms`

Socket write timeout in milliseconds.

```cpp
config.write_timeout_ms = 5000;
```

Default:

```txt
5000 ms
```

This helps prevent blocked writes from hanging forever.

## `keep_alive_timeout_ms`

Idle keep-alive timeout in milliseconds.

```cpp
config.keep_alive_timeout_ms = 10000;
```

Default:

```txt
10000 ms
```

This controls how long a persistent connection may stay idle while waiting for the next request.

## Development configuration

A good development configuration:

```cpp
AppConfig config;

config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

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
  config.thread_count = 4;

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

## Production configuration

A more explicit production configuration:

```cpp
AppConfig config;

config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

config.backlog = 256;
config.read_buffer_size = 8 * 1024;
config.max_request_body_size = 2 * 1024 * 1024;
config.max_header_size = 16 * 1024;
config.max_requests_per_connection = 100;

config.read_timeout_ms = 5000;
config.write_timeout_ms = 5000;
config.keep_alive_timeout_ms = 10000;
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
  config.thread_count = 4;

  config.backlog = 256;
  config.read_buffer_size = 8 * 1024;
  config.max_request_body_size = 2 * 1024 * 1024;
  config.max_header_size = 16 * 1024;
  config.max_requests_per_connection = 100;

  config.read_timeout_ms = 5000;
  config.write_timeout_ms = 5000;
  config.keep_alive_timeout_ms = 10000;

  App app(config);

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.listen([]()
  {
    vix::console.info("Production app is ready");
  });
}
```

## Configuration behind Nginx

When running behind Nginx on the same server, use:

```cpp
config.host = "127.0.0.1";
config.port = 8080;
```

Recommended model:

```txt
client
  -> HTTPS
  -> Nginx
  -> Cnerium app on 127.0.0.1:8080
```

This keeps the Cnerium app private.

Nginx is the public entry point.

## Public binding

Use:

```cpp
config.host = "0.0.0.0";
```

only when the app must accept connections directly from outside the machine or container.

Example:

```cpp
AppConfig config;

config.host = "0.0.0.0";
config.port = 8080;

App app(config);
```

When binding publicly, configure firewall and TLS carefully.

## Environment-based configuration

For deployment, prefer reading configuration from environment variables.

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

    config.backlog = env_int("CNERIUM_BACKLOG", 256);

    config.read_buffer_size =
        static_cast<std::size_t>(
            env_int("CNERIUM_READ_BUFFER_SIZE", 8 * 1024));

    config.max_request_body_size =
        static_cast<std::size_t>(
            env_int("CNERIUM_MAX_BODY_SIZE", 2 * 1024 * 1024));

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

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.listen([]()
  {
    vix::console.info("Configured app is ready");
  });
}
```

## Recommended environment variables

```txt
CNERIUM_HOST
CNERIUM_PORT
CNERIUM_THREADS
CNERIUM_BACKLOG
CNERIUM_READ_BUFFER_SIZE
CNERIUM_MAX_BODY_SIZE
CNERIUM_MAX_HEADER_SIZE
CNERIUM_MAX_REQUESTS_PER_CONNECTION
CNERIUM_READ_TIMEOUT_MS
CNERIUM_WRITE_TIMEOUT_MS
CNERIUM_KEEP_ALIVE_TIMEOUT_MS
```

Example:

```bash
CNERIUM_HOST=127.0.0.1 \
CNERIUM_PORT=8080 \
CNERIUM_THREADS=4 \
vix dev
```

## Use with systemd

A production `.env` file can look like this:

```dotenv
CNERIUM_HOST=127.0.0.1
CNERIUM_PORT=8080
CNERIUM_THREADS=4
CNERIUM_BACKLOG=256
CNERIUM_READ_BUFFER_SIZE=8192
CNERIUM_MAX_BODY_SIZE=2097152
CNERIUM_MAX_HEADER_SIZE=16384
CNERIUM_MAX_REQUESTS_PER_CONNECTION=100
CNERIUM_READ_TIMEOUT_MS=5000
CNERIUM_WRITE_TIMEOUT_MS=5000
CNERIUM_KEEP_ALIVE_TIMEOUT_MS=10000
VIX_CONSOLE_LEVEL=info
```

Then a systemd service can load it:

```ini
[Service]
EnvironmentFile=/opt/cnerium-api/.env
ExecStart=/opt/cnerium-api/api
```

## Access config from App

You can inspect config from the app:

```cpp
const auto &config = app.config();

vix::console.info("host", config.host, "port", config.port);
```

Example:

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

  const auto &active = app.config();

  vix::console.info(
    "configured",
    active.host,
    active.port
  );

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("config reference");
  });

  app.listen();
}
```

## AppConfig and listen

When using explicit listen arguments:

```cpp
App app;

app.listen("127.0.0.1", 8080);
```

The listen call provides host and port.

When using `AppConfig`:

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;

App app(config);

app.listen();
```

The app uses the configured host and port.

## Direct listen vs AppConfig

Use direct listen for small examples:

```cpp
App app;

app.listen("127.0.0.1", 8080);
```

Use `AppConfig` for real applications:

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

App app(config);

app.listen();
```

## Complete reference example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
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

    config.backlog = env_int("CNERIUM_BACKLOG", 256);

    config.read_buffer_size =
        static_cast<std::size_t>(
            env_int("CNERIUM_READ_BUFFER_SIZE", 8 * 1024));

    config.max_request_body_size =
        static_cast<std::size_t>(
            env_int("CNERIUM_MAX_BODY_SIZE", 2 * 1024 * 1024));

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

  app.use([](auto &ctx, auto next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    next();
  });

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "AppConfig reference example"}
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
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

  const auto &config = app.config();

  vix::console.info(
    "starting Cnerium app on",
    "http://" + config.host + ":" + std::to_string(config.port)
  );

  app.listen([]()
  {
    vix::console.info("AppConfig reference example is ready");
  });
}
```

## Test the example

Run:

```bash
CNERIUM_HOST=127.0.0.1 \
CNERIUM_PORT=8080 \
CNERIUM_THREADS=4 \
vix dev
```

Test:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/missing
```

## API overview

```cpp
struct AppConfig
{
  std::string host;
  std::uint16_t port;
  std::size_t thread_count;

  int backlog;
  std::size_t read_buffer_size;
  std::size_t max_request_body_size;
  std::size_t max_header_size;
  std::size_t max_requests_per_connection;

  std::uint32_t read_timeout_ms;
  std::uint32_t write_timeout_ms;
  std::uint32_t keep_alive_timeout_ms;
};
```

## Field summary

| Field | Purpose |
|------|---------|
| `host` | Address to bind the app to |
| `port` | TCP port to listen on |
| `thread_count` | Runtime worker thread count |
| `backlog` | TCP listen queue size |
| `read_buffer_size` | Socket read buffer size |
| `max_request_body_size` | Maximum accepted request body size |
| `max_header_size` | Maximum accepted HTTP header block size |
| `max_requests_per_connection` | Maximum requests per keep-alive connection |
| `read_timeout_ms` | Socket read timeout |
| `write_timeout_ms` | Socket write timeout |
| `keep_alive_timeout_ms` | Idle keep-alive timeout |

## Best practices

### Use AppConfig for real apps

Good:

```cpp
AppConfig config;
config.host = "127.0.0.1";
config.port = 8080;
config.thread_count = 4;

App app(config);
```

### Keep Cnerium private behind Nginx

Behind Nginx:

```cpp
config.host = "127.0.0.1";
```

Expose Nginx publicly, not the app port.

### Configure request limits

Set body and header limits explicitly:

```cpp
config.max_request_body_size = 2 * 1024 * 1024;
config.max_header_size = 16 * 1024;
```

### Configure timeouts

Set timeouts explicitly in production:

```cpp
config.read_timeout_ms = 5000;
config.write_timeout_ms = 5000;
config.keep_alive_timeout_ms = 10000;
```

### Use environment variables in deployment

Keep production config outside the binary.

```bash
CNERIUM_PORT=8080 ./api
```

### Keep thread count explicit

```cpp
config.thread_count = 4;
```

Tune later based on workload.

## Common mistakes

### Binding publicly by accident

Avoid this behind Nginx:

```cpp
config.host = "0.0.0.0";
```

Prefer:

```cpp
config.host = "127.0.0.1";
```

### Forgetting to use `app.listen()` with config

When using `AppConfig`:

```cpp
App app(config);
app.listen();
```

### Setting request body size too high

Do not allow huge bodies unless your app needs them.

### Setting timeouts to zero

Timeouts should stay positive.

### Assuming thread count means database safety

More worker threads can execute more tasks concurrently.

Shared state must still be thread-safe.

## Summary

`AppConfig` configures the Cnerium App layer.

It controls:

```txt
host
port
runtime threads
connection backlog
read buffer size
request body limit
header limit
keep-alive request limit
read/write/keep-alive timeouts
```

Use direct `listen(host, port)` for small examples.

Use `AppConfig` for real applications and deployment.

## Next step

Continue with the Server reference.

[Open Server reference](/reference/server)
