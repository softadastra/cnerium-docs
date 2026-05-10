# Installation

This page shows how to install Cnerium in a Vix project.

Cnerium is distributed as Vix packages.
The recommended way to use it is through the Vix registry.

## Requirements

Before installing Cnerium, make sure you have:

```txt
C++20 compiler
CMake
Vix CLI
```

Cnerium is designed for the Vix ecosystem, so the cleanest workflow is:

```bash
vix new api
cd api
vix add cnerium/app
vix dev
```

## Install Cnerium in a new project

Create a new project:

```bash
vix new api
cd api
```

Add the Cnerium app package:

```bash
vix add cnerium/app
```

Then start the project:

```bash
vix dev
```

`cnerium/app` is the high-level application layer.
It pulls the lower-level Cnerium modules needed by the framework.

## What `vix add` does

When you run:

```bash
vix add cnerium/app
```

Vix resolves the package from the registry and updates your project dependency files.

It updates:

```txt
vix.json
vix.lock
.vix/
```

`vix.json` stores the declared dependency:

```json
{
  "dependencies": {
    "cnerium/app": "^0.5.0"
  }
}
```

`vix.lock` stores the exact resolved version for reproducible installs.

## Install a specific version

To install the current app version directly:

```bash
vix add cnerium/app@0.5.0
```

You can also use a version range:

```bash
vix add cnerium/app@^0.5.0
```

## Install individual modules

Most applications should install:

```bash
vix add cnerium/app
```

But Cnerium is modular, so you can also install modules individually.

```bash
vix add cnerium/json
vix add cnerium/http
vix add cnerium/router
vix add cnerium/middleware
vix add cnerium/server
vix add cnerium/runtime
vix add cnerium/app
```

The normal dependency chain is:

```txt
cnerium/json
cnerium/http
cnerium/router
cnerium/middleware
cnerium/server
cnerium/runtime
cnerium/app
```

For a complete web application, use `cnerium/app`.

## Package versions

Current module versions:

```txt
cnerium/json        0.4.0
cnerium/http        0.7.0
cnerium/router      0.6.0
cnerium/middleware  0.3.0
cnerium/server      0.5.0
cnerium/runtime     0.4.0
cnerium/app         0.5.0
```

## If the package is not found

Refresh the local registry index:

```bash
vix registry sync
```

Then add the package again:

```bash
vix add cnerium/app
```

This is useful when a package was recently published or updated.

## Install dependencies after cloning

If you cloned an existing Cnerium project, do not run `vix add` again.

Use:

```bash
vix install
```

Example:

```bash
git clone https://github.com/example/api.git
cd api
vix install
vix dev
```

`vix install` reads the exact versions from `vix.lock`.

## Difference between `vix add` and `vix install`

| Command | Purpose |
|---------|---------|
| `vix add cnerium/app` | Add Cnerium to the current project |
| `vix install` | Install dependencies already pinned in `vix.lock` |

Use `vix add` when adding a new dependency.

Use `vix install` after cloning a project or restoring dependencies.

## Verify the installation

Create or edit a source file with a minimal Cnerium app:

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

Run the project:

```bash
vix dev
```

Then test it:

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```txt
Hello from Cnerium
```

## Build the project

To compile the project without development reload:

```bash
vix build
```

To build in release mode:

```bash
vix build --preset release
```

## Run the project manually

```bash
vix run
```

Or run with debug logs:

```bash
vix run --log-level debug
```

## Validate the project

Before committing changes:

```bash
vix fmt --check
vix check --tests
```

If the project has tests:

```bash
vix tests
```

## Recommended workflow

For a new Cnerium project:

```bash
vix new api
cd api
vix add cnerium/app
vix dev
```

For an existing Cnerium project:

```bash
vix install
vix dev
```

Before committing:

```bash
vix fmt --check
vix check --tests
```

For release builds:

```bash
vix build --preset release
```

## Common mistakes

### Running `vix dev` outside the project

Wrong:

```bash
vix new api
vix dev
```

Correct:

```bash
vix new api
cd api
vix dev
```

### Using `vix install` before adding Cnerium

If the project does not already have Cnerium in `vix.json`, use:

```bash
vix add cnerium/app
```

Then:

```bash
vix dev
```

### Forgetting to sync the registry

If Cnerium is not found:

```bash
vix registry sync
vix add cnerium/app
```

### Installing low-level modules first

For most users, this is unnecessary:

```bash
vix add cnerium/json
vix add cnerium/http
vix add cnerium/router
```

Prefer:

```bash
vix add cnerium/app
```

The app module is the main entry point.

## Next step

Continue with the quick start.

[Open the Quick Start guide](/quick-start)
