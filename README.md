# Cnerium Docs

Official documentation website for Cnerium.

Cnerium is a fast, minimal web framework for Vix and modern C++ applications.

It provides a clean application layer for building HTTP APIs with:

```txt
routing
route parameters
JSON responses
JSON request bodies
middleware
error handling
runtime tasks
server configuration
```

The recommended Cnerium entry point is:

```cpp
#include <cnerium/app/app.hpp>
```

## Website

```txt
https://docs.cnerium.dev
```

## Role of this repository

This repository contains the documentation website for Cnerium.

It explains:

```txt
what Cnerium is
how to install it
how to build a first app
how routing works
how JSON APIs work
how middleware works
how the runtime works
how each module is structured
how to use the reference API
```

This repository is only for documentation.

The framework modules live in their own repositories:

```txt
cnerium/json
cnerium/http
cnerium/router
cnerium/middleware
cnerium/server
cnerium/runtime
cnerium/app
```

## Documentation structure

```txt
docs/
├── index.md
├── what-is-cnerium.md
├── installation.md
├── quick-start.md
├── first-app.md
│
├── guide/
│   ├── index.md
│   ├── project-structure.md
│   ├── routing.md
│   ├── route-parameters.md
│   ├── request.md
│   ├── response.md
│   ├── json.md
│   ├── middleware.md
│   ├── error-handling.md
│   ├── not-found.md
│   ├── runtime.md
│   ├── configuration.md
│   ├── printing.md
│   └── deployment.md
│
├── modules/
│   ├── index.md
│   ├── json.md
│   ├── http.md
│   ├── router.md
│   ├── middleware.md
│   ├── server.md
│   ├── runtime.md
│   └── app.md
│
├── examples/
│   ├── index.md
│   ├── hello-world.md
│   ├── basic-routes.md
│   ├── json-api.md
│   ├── middleware.md
│   ├── runtime-server.md
│   └── rest-api.md
│
├── reference/
│   ├── index.md
│   ├── app.md
│   ├── app-context.md
│   ├── app-config.md
│   ├── server.md
│   ├── runtime.md
│   ├── vix-print.md
│   └── vix-console.md
│
├── releases/
│   ├── index.md
│   └── 0.5.0.md
│
└── .vitepress/
    ├── config.mjs
    └── theme/
```

## Tech stack

This documentation site uses:

```txt
VitePress
Markdown
Vue components
Plain CSS
Vercel
```

## Local development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build the site:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## VitePress commands

Common commands:

```bash
npm run dev
npm run build
npm run preview
```

Expected local dev URL:

```txt
http://localhost:5173
```

## Deployment

The site is deployed with Vercel.

The expected Vercel output directory is:

```txt
.vitepress/dist
```

Recommended `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".vitepress/dist",
  "installCommand": "npm install"
}
```

## Public assets

Static files live in:

```txt
public/
```

Current public assets:

```txt
public/favicon.svg
public/logo.svg
public/og-image.png
```

## Main documentation order

The docs should be read in this order:

```txt
1. What is Cnerium?
2. Installation
3. Quick Start
4. First App
5. Guide
6. Modules
7. Examples
8. Reference
9. Releases
```

## Writing style

The documentation should stay:

```txt
clear
direct
practical
beginner-friendly
code-first
C++ focused
Vix aligned
```

Prefer short explanations followed by working examples.

Avoid abstract marketing language.

## Code style

Cnerium docs examples should prefer:

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>
```

Use `vix::console` for application logs:

```cpp
vix::console.info("App is ready");
```

Use `vix::print` for standalone module examples:

```cpp
vix::print("value:", value);
```

Avoid `std::cout` in normal documentation examples.

## Minimal Cnerium example

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

Run:

```bash
vix dev
```

Test:

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```txt
Hello from Cnerium
```

## Package installation

For most applications:

```bash
vix add cnerium/app
```

The app package pulls the framework stack:

```txt
cnerium/app
  -> cnerium/runtime
    -> cnerium/server
      -> cnerium/middleware
      -> cnerium/router
      -> cnerium/http
      -> cnerium/json
```

## Current documented versions

```txt
cnerium/json        0.4.0
cnerium/http        0.7.0
cnerium/router      0.6.0
cnerium/middleware  0.3.0
cnerium/server      0.5.0
cnerium/runtime     0.4.0
cnerium/app         0.5.0
```

## Sidebar generation

The repository includes:

```txt
scripts/generate-sidebar.js
```

Use it to help generate or maintain the VitePress sidebar if needed.

Run with:

```bash
node scripts/generate-sidebar.js
```

## Recommended content rules

When adding a new page:

```txt
start with a short purpose
show installation or include when useful
show a minimal example
explain the important concepts
show a complete example
add best practices
add common mistakes
link to the next page
```

## Recommended page ending

Most pages should end with:

```md
## Summary

...

## Next step

[Open next page](/path)
```

This keeps the documentation easy to follow.

## Repository files

Important root files:

```txt
LICENSE
README.md
package.json
package-lock.json
vercel.json
```

Important documentation folders:

```txt
guide/
modules/
examples/
reference/
releases/
.vitepress/
public/
scripts/
```

## License

This documentation repository is released under the license included in:

```txt
LICENSE
```

Check the root `LICENSE` file for the exact license text.

## Summary

This repository powers:

```txt
docs.cnerium.dev
```

It documents the Cnerium framework, its modules, examples, and reference APIs.

Use it to keep Cnerium documentation simple, practical, and easy to maintain.
