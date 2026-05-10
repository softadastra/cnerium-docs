# Deployment

This guide explains how to deploy a Cnerium application in production.

Cnerium applications are normal native C++ applications.
A typical deployment uses:

```txt
Cnerium app
  -> systemd service
  -> Nginx reverse proxy
  -> HTTPS with Certbot
```

The recommended production model is simple:

```txt
client
  -> HTTPS
  -> Nginx
  -> Cnerium app on localhost:8080
```

## Build for release

Before deployment, build the application in release mode:

```bash
vix build --preset release
```

You can also validate the project before building:

```bash
vix fmt --check
vix check --tests
vix build --preset release
```

If your project has tests:

```bash
vix tests --preset release
```

## Recommended validation flow

Before deploying:

```bash
vix install
vix fmt --check
vix check --tests
vix build --preset release
```

This ensures dependencies are installed, formatting is valid, checks pass, and the release binary builds correctly.

## Production configuration

For production, use `AppConfig`.

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
  config.max_request_body_size = 2 * 1024 * 1024;
  config.max_header_size = 16 * 1024;
  config.max_requests_per_connection = 100;

  config.read_timeout_ms = 5000;
  config.write_timeout_ms = 5000;
  config.keep_alive_timeout_ms = 10000;

  App app(config);

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"service", "cnerium-api"}
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.listen([]()
  {
    vix::console.info("Cnerium app is ready");
  });
}
```

When running behind Nginx on the same server, bind to:

```cpp
config.host = "127.0.0.1";
```

This keeps the Cnerium app private and exposes it only through Nginx.

## Use environment variables

For deployment, prefer environment-based configuration.

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

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"service", "cnerium-api"}
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.listen([]()
  {
    vix::console.info("Cnerium app is ready");
  });
}
```

Then run:

```bash
CNERIUM_HOST=127.0.0.1 \
CNERIUM_PORT=8080 \
CNERIUM_THREADS=4 \
vix run
```

## Recommended environment variables

```txt
CNERIUM_HOST
CNERIUM_PORT
CNERIUM_THREADS
CNERIUM_BACKLOG
CNERIUM_MAX_BODY_SIZE
CNERIUM_MAX_HEADER_SIZE
CNERIUM_MAX_REQUESTS_PER_CONNECTION
CNERIUM_READ_TIMEOUT_MS
CNERIUM_WRITE_TIMEOUT_MS
CNERIUM_KEEP_ALIVE_TIMEOUT_MS
```

## Run locally before deployment

Before configuring systemd or Nginx, test the app manually.

```bash
vix run
```

Or run the built release binary directly.

Example:

```bash
./build-release/api
```

Then test:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
```

Expected health response:

```json
{"ok":true,"status":"healthy"}
```

## Production directory

A simple production layout:

```txt
/opt/cnerium-api/
├── api
├── .env
└── README.md
```

Where:

```txt
api   -> compiled Cnerium binary
.env  -> environment variables used by systemd
```

Example:

```bash
sudo mkdir -p /opt/cnerium-api
sudo cp ./build-release/api /opt/cnerium-api/api
sudo chmod +x /opt/cnerium-api/api
```

## Environment file

Create:

```bash
sudo nano /opt/cnerium-api/.env
```

Example:

```dotenv
CNERIUM_HOST=127.0.0.1
CNERIUM_PORT=8080
CNERIUM_THREADS=4
CNERIUM_BACKLOG=256
CNERIUM_MAX_BODY_SIZE=2097152
CNERIUM_MAX_HEADER_SIZE=16384
CNERIUM_MAX_REQUESTS_PER_CONNECTION=100
CNERIUM_READ_TIMEOUT_MS=5000
CNERIUM_WRITE_TIMEOUT_MS=5000
CNERIUM_KEEP_ALIVE_TIMEOUT_MS=10000
VIX_CONSOLE_LEVEL=info
```

## Create a systemd service

Create a service file:

```bash
sudo nano /etc/systemd/system/cnerium-api.service
```

Example:

```ini
[Unit]
Description=Cnerium API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/cnerium-api
EnvironmentFile=/opt/cnerium-api/.env
ExecStart=/opt/cnerium-api/api
Restart=always
RestartSec=2
User=www-data
Group=www-data

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Reload systemd:

```bash
sudo systemctl daemon-reload
```

Start the service:

```bash
sudo systemctl start cnerium-api
```

Enable it on boot:

```bash
sudo systemctl enable cnerium-api
```

Check status:

```bash
sudo systemctl status cnerium-api
```

View logs:

```bash
journalctl -u cnerium-api -f
```

## Test the service

Once systemd is running the app:

```bash
curl http://127.0.0.1:8080/health
```

If this works, the Cnerium app is running locally.

The next step is exposing it through Nginx.

## Nginx reverse proxy

Install Nginx:

```bash
sudo apt update
sudo apt install nginx
```

Create a site config:

```bash
sudo nano /etc/nginx/sites-available/cnerium-api
```

Example:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Connection "";

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/cnerium-api \
  /etc/nginx/sites-enabled/cnerium-api
```

Test Nginx config:

```bash
sudo nginx -t
```

Reload Nginx:

```bash
sudo systemctl reload nginx
```

Test through Nginx:

```bash
curl http://example.com/health
```

## HTTPS with Certbot

Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

Request a certificate:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

Now test HTTPS:

```bash
curl https://example.com/health
```

## Firewall

If you use UFW, allow HTTP and HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
sudo ufw status
```

Do not expose the internal Cnerium port publicly if Nginx is the public entry point.

Keep Cnerium bound to:

```txt
127.0.0.1:8080
```

## Deploy updates

A simple update flow:

```bash
vix install
vix fmt --check
vix check --tests
vix build --preset release

sudo systemctl stop cnerium-api
sudo cp ./build-release/api /opt/cnerium-api/api
sudo chmod +x /opt/cnerium-api/api
sudo systemctl start cnerium-api
sudo systemctl status cnerium-api
```

Test:

```bash
curl http://127.0.0.1:8080/health
curl https://example.com/health
```

## Safer restart flow

Instead of stopping first, you can replace the binary and restart.

```bash
vix build --preset release

sudo cp ./build-release/api /opt/cnerium-api/api
sudo chmod +x /opt/cnerium-api/api
sudo systemctl restart cnerium-api
sudo systemctl status cnerium-api
```

Then check logs:

```bash
journalctl -u cnerium-api -f
```

## Rollback

Keep a backup before replacing the binary.

```bash
sudo cp /opt/cnerium-api/api /opt/cnerium-api/api.bak
sudo cp ./build-release/api /opt/cnerium-api/api
sudo systemctl restart cnerium-api
```

If something fails:

```bash
sudo cp /opt/cnerium-api/api.bak /opt/cnerium-api/api
sudo systemctl restart cnerium-api
```

## Health route

Every production Cnerium app should expose a health route.

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"}
  });
});
```

Use it for:

```txt
manual checks
Nginx troubleshooting
monitoring
deployment verification
```

## Logging

Use `vix::console` for production logs.

```cpp
vix::console.info("app started");
vix::console.warn("slow request");
vix::console.error("unhandled exception:", ex.what());
```

Set log level with:

```bash
VIX_CONSOLE_LEVEL=info
```

For debugging:

```bash
VIX_CONSOLE_LEVEL=debug
```

With systemd, logs go to journald:

```bash
journalctl -u cnerium-api -f
```

## Error handler for production

Use a safe error handler in production.

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

Log the real exception server-side.

Return a safe response to the client.

## Not-found handler for production

Use a consistent JSON 404 response.

```cpp
app.set_not_found_handler([](cnerium::server::Context &ctx)
{
  ctx.status(cnerium::http::Status::not_found)
      .json({
        {"ok", false},
        {"error", "route not found"},
        {"path", std::string(ctx.path())}
      });
});
```

## Recommended production app skeleton

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
      {"service", "cnerium-api"}
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

  app.listen([]()
  {
    vix::console.info("Cnerium production app is ready");
  });
}
```

## Deployment checklist

Before deploying:

```txt
vix install passes
format check passes
project checks pass
tests pass if available
release build succeeds
health route exists
production error handler exists
production not-found handler exists
app binds to 127.0.0.1 behind Nginx
systemd service starts
Nginx proxy works
HTTPS works
logs are visible with journalctl
```

## Common mistakes

### Binding to the wrong host

Behind Nginx on the same server, prefer:

```txt
127.0.0.1
```

Use:

```txt
0.0.0.0
```

only when the app must be reachable from outside the machine or from another container/network namespace.

### Exposing the app port publicly

If Nginx is the public entry point, do not expose `8080` to the public internet.

Expose only:

```txt
80
443
```

### Forgetting to restart systemd after copying the binary

After replacing the binary:

```bash
sudo systemctl restart cnerium-api
```

### Forgetting executable permission

```bash
sudo chmod +x /opt/cnerium-api/api
```

### Returning internal errors to users

Log the real error:

```cpp
vix::console.error("unhandled exception:", ex.what());
```

Return a safe response:

```json
{"ok":false,"error":"internal server error"}
```

### Missing health route

Always keep:

```txt
GET /health
```

It makes deployment verification much easier.

## Summary

Deploy Cnerium as a native C++ binary.

Recommended production stack:

```txt
systemd
Nginx
Certbot HTTPS
Cnerium bound to 127.0.0.1:8080
```

Build with:

```bash
vix build --preset release
```

Run with systemd.

Expose through Nginx.

Use `vix::console` for logs.

Keep a `/health` route.

Use safe production error responses.

## Next step

Continue with module documentation.

[Open Modules](/modules/)
