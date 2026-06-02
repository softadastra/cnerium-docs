# Install

Cnerium is used as a dependency inside a Vix backend project.

It is not installed as a separate backend runtime. The normal workflow is to install Vix, make sure the Softadastra SDK is available, then add Cnerium to a Vix project. Vix remains the build and development workflow. Cnerium is linked into the application as the reliability layer for durable routes.

This page describes the expected installation model for application developers and for local Cnerium development.

## Requirements

A Cnerium application needs:

```txt
Vix.cpp
Softadastra SDK
Cnerium
C++20 compiler
```

Vix provides the application runtime, HTTP server, routing, middleware, WebSocket integration, build workflow, and developer commands.

The Softadastra SDK provides the durable storage foundation used by Cnerium to store request hashes, stored responses, and framework metadata.

Cnerium provides the reliability layer that attaches to `vix::App`.

## Install Vix

Install the Vix SDK first.

```bash
curl -fsSL https://vixcpp.com/install.sh | VIX_INSTALL_KIND=sdk sh
```

After installation, check that the CLI is available:

```bash
vix --version
```

You should also be able to build a normal Vix project:

```bash
vix new hello --app
cd hello
vix build
vix run
```

If a normal Vix project does not build, fix the Vix installation before adding Cnerium.

## Install the Softadastra SDK

Cnerium uses the public Softadastra SDK.

The SDK must expose the public C++ headers and CMake package needed by Cnerium. At minimum, Cnerium expects the SDK client API to be available through:

```cpp
#include <softadastra/sdk/Client.hpp>
```

A typical local installation should make this header discoverable under a normal include prefix such as:

```txt
~/.local/include/softadastra/sdk/Client.hpp
```

or:

```txt
~/.softadastra/sdk/include/softadastra/sdk/Client.hpp
```

You can verify the header with:

```bash
find "$HOME/.local" "$HOME/.softadastra" \
  -path "*softadastra/sdk/Client.hpp" 2>/dev/null
```

If the command prints no result, the Softadastra SDK is not installed in a location visible to the build.

## Add Cnerium to a Vix project

For registry-based usage, a Vix backend should add Cnerium as a dependency.

```bash
vix add softadastra/cnerium
vix install
```

Then include Cnerium in your application:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>
```

A minimal project should link both Vix and Cnerium through the normal Vix dependency workflow.

The application code still starts with `vix::App`:

```cpp
vix::App app;

auto cnerium = cnerium::attach(app);
```

This is the expected usage. Do not replace the Vix app with a separate Cnerium application object.

## Local development installation

When working on Cnerium itself, clone the repository and build it as a normal C++ project.

```bash
git clone https://github.com/softadastra/cnerium.git
cd cnerium
```

Build everything:

```bash
vix build --build-target all -v
```

Run tests:

```bash
vix tests
```

Build examples when enabled:

```bash
vix build --build-target all -v -- -DCNERIUM_BUILD_EXAMPLES=ON
```

If tests pass, the local Cnerium build is usable.

## CMake package discovery

Cnerium expects Vix and the Softadastra SDK to be discoverable as development packages.

In a standard local setup, the project searches common prefixes such as:

```txt
~/.local
~/.softadastra/sdk
~/.softadastra
```

If your dependencies are installed somewhere else, pass `CMAKE_PREFIX_PATH` through the Vix build command:

```bash
vix build --build-target all -v -- \
  -DCMAKE_PREFIX_PATH="$HOME/.local;$HOME/.softadastra/sdk"
```

Use this only when your installation is outside the default search locations.

## Editor setup

If the project builds but VS Code shows include errors, the issue is usually IntelliSense, not CMake.

A common error looks like this:

```txt
cannot open source file "softadastra/sdk/Client.hpp"
```

For CMake-based development, prefer `compile_commands.json`.

Make sure the project exports compile commands:

```cmake
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
```

Then configure VS Code to read them:

```json
{
  "configurations": [
    {
      "name": "Linux",
      "compileCommands": "${workspaceFolder}/build-ninja/compile_commands.json",
      "includePath": [
        "${workspaceFolder}/include",
        "${workspaceFolder}/src",
        "${workspaceFolder}/examples",
        "${workspaceFolder}/tests",
        "${env:HOME}/.local/include",
        "${env:HOME}/.softadastra/sdk/include",
        "${env:HOME}/.softadastra/include"
      ],
      "compilerPath": "/usr/local/bin/clang++",
      "cStandard": "c17",
      "cppStandard": "c++20",
      "intelliSenseMode": "linux-clang-x64"
    }
  ],
  "version": 4
}
```

After changing IntelliSense settings, reset the C/C++ database and reload the editor.

The important point is that the build system is the source of truth. If `vix build` succeeds and the editor still shows missing includes, fix the editor configuration instead of changing Cnerium includes.

## Verify the example

After building Cnerium with examples enabled, run the durable orders example:

```bash
./build-ninja/cnerium_durable_orders_realtime
```

In another terminal, send a durable request:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected response:

```txt
HTTP/1.1 201 Created
```

Retry the same request with the same key and body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p1","quantity":2}'
```

Expected behavior:

```txt
The same response is returned.
The durable handler is not executed again.
```

Reuse the same key with a different body:

```bash
curl -i -X POST http://127.0.0.1:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{"product_id":"p2","quantity":1}'
```

Expected response:

```txt
HTTP/1.1 409 Conflict
```

This confirms that Cnerium is attached to the Vix backend and that durable route behavior is working.

## Minimal application after installation

Once Vix, the Softadastra SDK, and Cnerium are available, the simplest usage looks like this:

```cpp
#include <vix.hpp>
#include <cnerium/cnerium.hpp>

int main()
{
  vix::App app;

  auto cnerium = cnerium::attach(app);

  app.get("/health", [](vix::Request &req, vix::Response &res)
  {
    (void)req;

    res.json({
        {"ok", true}
    });
  });

  cnerium.durable_post(
      "/orders",
      "orders.create",
      [](cnerium::DurableRequest &request)
      {
        return cnerium::created({
            {"ok", true}
        });
      });

  if (!cnerium.start())
  {
    return 1;
  }

  app.run();

  return 0;
}
```

The structure is intentional.

Vix owns the backend application. Cnerium attaches to it. The Softadastra SDK works behind Cnerium to persist durable route metadata.

## Troubleshooting

If Cnerium cannot find Vix, verify that the Vix SDK is installed and that its CMake package is discoverable.

```bash
find "$HOME/.local" -name "VixConfig.cmake" 2>/dev/null
```

If Cnerium cannot find the Softadastra SDK, verify the SDK header and package files.

```bash
find "$HOME/.local" "$HOME/.softadastra" \
  -path "*softadastra/sdk/Client.hpp" 2>/dev/null
```

If the application builds but durable route behavior does not persist between retries, check the configured Cnerium data directory and make sure the process can write to it.

If the editor shows missing includes but the project builds successfully, configure `compile_commands.json` for your editor.

## Next step

Continue with [Your First Durable Route](/getting-started/first-durable-route) to build a small Vix backend and attach Cnerium to protect a critical `POST` route.
