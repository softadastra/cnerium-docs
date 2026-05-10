# AppContext

`cnerium::app::AppContext` is the high-level request/response context used inside Cnerium route handlers.

It gives you access to:

```txt
HTTP method
path
query string
headers
route parameters
request body
JSON body
response status
text responses
HTML responses
JSON responses
raw request object
raw response object
```

Most route handlers receive an `AppContext&`.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello from Cnerium");
});
```

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
cnerium::app::AppContext
```

## Handler signature

A normal app route handler has this shape:

```cpp
[](AppContext &ctx)
{
}
```

Example:

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"}
  });
});
```

## Role of AppContext

`AppContext` wraps the lower-level server context and exposes a cleaner application API.

Instead of writing:

```cpp
ctx.response().text("Hello");
```

you can write:

```cpp
ctx.text("Hello");
```

Instead of manually reading server internals, use direct helpers:

```cpp
ctx.path();
ctx.param("id");
ctx.json();
ctx.status(...).json(...);
```

## Request helpers

Common request helpers:

```cpp
ctx.method();
ctx.path();
ctx.query();
ctx.header("Content-Type");
ctx.param("id");
ctx.has_param("id");
ctx.has_params();
ctx.body();
ctx.json();
ctx.request();
```

## Response helpers

Common response helpers:

```cpp
ctx.status(...);
ctx.text(...);
ctx.html(...);
ctx.json(...);
ctx.ok(...);
ctx.error(...);
ctx.response();
```

## `method()`

Returns the HTTP method of the request.

```cpp
app.get("/inspect", [](AppContext &ctx)
{
  ctx.json({
    {"method", cnerium::http::to_string(ctx.method())}
  });
});
```

For a `GET` request, this returns:

```txt
GET
```

## `path()`

Returns the request path.

```cpp
app.get("/inspect", [](AppContext &ctx)
{
  ctx.json({
    {"path", std::string(ctx.path())}
  });
});
```

For:

```txt
GET /users?page=1
```

The path is:

```txt
/users
```

## `query()`

Returns the query string.

```cpp
app.get("/inspect", [](AppContext &ctx)
{
  ctx.json({
    {"query", std::string(ctx.query())}
  });
});
```

For:

```txt
GET /users?page=1&active=true
```

The query is:

```txt
page=1&active=true
```

Cnerium keeps the query string separate from the route path.

## `header()`

Returns a request header.

```cpp
app.get("/inspect", [](AppContext &ctx)
{
  ctx.json({
    {"user_agent", std::string(ctx.header("User-Agent"))}
  });
});
```

Header lookup is case-insensitive at the HTTP layer.

These should refer to the same header:

```cpp
ctx.header("Content-Type");
ctx.header("content-type");
ctx.header("CONTENT-TYPE");
```

## `body()`

Returns the raw request body.

```cpp
app.post("/echo", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"body", std::string(ctx.body())}
  });
});
```

Test:

```bash
curl -X POST http://127.0.0.1:8080/echo \
  -H "Content-Type: text/plain" \
  -d "hello"
```

Example response:

```json
{"ok":true,"body":"hello"}
```

## `json()`

Parses the request body as JSON.

```cpp
app.post("/users", [](AppContext &ctx)
{
  auto body = ctx.json();

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"name", body["name"]}
  });
});
```

For client input, wrap `ctx.json()` in `try/catch`.

```cpp
app.post("/users", [](AppContext &ctx)
{
  try
  {
    auto body = ctx.json();

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"name", body["name"]}
    });
  }
  catch (const std::exception &ex)
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", "invalid JSON body"},
      {"message", ex.what()}
    });
  }
});
```

## `param()`

Returns a route parameter.

Route:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("User id: " + std::string(ctx.param("id")));
});
```

Request:

```txt
GET /users/42
```

Value:

```txt
id = 42
```

Use:

```cpp
ctx.param("id")
```

## Multiple params

```cpp
app.get("/shops/:shop_id/products/:product_id", [](AppContext &ctx)
{
  ctx.json({
    {"shop_id", std::string(ctx.param("shop_id"))},
    {"product_id", std::string(ctx.param("product_id"))}
  });
});
```

Request:

```txt
GET /shops/10/products/200
```

Response:

```json
{"shop_id":"10","product_id":"200"}
```

## `has_param()`

Checks if a parameter exists.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  if (!ctx.has_param("id"))
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", "missing id"}
    });
    return;
  }

  ctx.json({
    {"ok", true},
    {"id", std::string(ctx.param("id"))}
  });
});
```

This is useful for generic handlers or reusable code.

## `has_params()`

Checks if the current route has any extracted parameters.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"has_params", ctx.has_params()}
  });
});
```

For `/users/42`, this is true.

For a static route like `/health`, this is usually false.

## `request()`

Returns the lower-level HTTP request object.

```cpp
app.get("/inspect", [](AppContext &ctx)
{
  const auto &req = ctx.request();

  ctx.json({
    {"method", cnerium::http::to_string(req.method())},
    {"path", std::string(req.path())}
  });
});
```

Use this when the high-level helper is not enough.

For normal route code, prefer direct helpers like:

```cpp
ctx.method();
ctx.path();
ctx.header("Content-Type");
```

## `response()`

Returns the lower-level HTTP response object.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.response().set_header("X-App", "Cnerium");
  ctx.response().text("Hello");
});
```

Use this when you need lower-level response control.

For normal responses, prefer:

```cpp
ctx.text(...);
ctx.json(...);
ctx.status(...);
```

## `status()`

Sets the response status and returns the context for chaining.

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true},
  {"message", "created"}
});
```

Common statuses:

```cpp
cnerium::http::Status::ok
cnerium::http::Status::created
cnerium::http::Status::no_content
cnerium::http::Status::bad_request
cnerium::http::Status::unauthorized
cnerium::http::Status::forbidden
cnerium::http::Status::not_found
cnerium::http::Status::internal_server_error
```

## `text()`

Sends a plain text response.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("Hello from Cnerium");
});
```

Expected response:

```txt
Hello from Cnerium
```

## `html()`

Sends an HTML response.

```cpp
app.get("/page", [](AppContext &ctx)
{
  ctx.html("<h1>Hello from Cnerium</h1>");
});
```

Use this for simple HTML responses.

For JSON APIs, prefer `ctx.json()`.

## `json()`

Sends a JSON response.

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"status", "healthy"}
  });
});
```

Expected response:

```json
{"ok":true,"status":"healthy"}
```

## JSON with status

Use chaining:

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true},
  {"message", "user created"}
});
```

This returns:

```txt
201 Created
```

with a JSON body.

## `ok()`

Sends a simple success response.

```cpp
app.get("/done", [](AppContext &ctx)
{
  ctx.ok("done");
});
```

Use this for small examples.

For APIs, prefer explicit JSON shapes:

```cpp
ctx.json({
  {"ok", true},
  {"message", "done"}
});
```

## `error()`

Sends an error response.

```cpp
app.get("/bad", [](AppContext &ctx)
{
  ctx.error(cnerium::http::Status::bad_request, "invalid request");
});
```

For APIs, you can also use explicit JSON:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "invalid request"}
});
```

## No content response

For `204 No Content`, use the lower-level response object:

```cpp
app.delete_("/users/:id", [](AppContext &ctx)
{
  ctx.response().empty(cnerium::http::Status::no_content);
});
```

Do not send a body with `204 No Content`.

## Inspect request example

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/inspect/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"method", cnerium::http::to_string(ctx.method())},
      {"path", std::string(ctx.path())},
      {"query", std::string(ctx.query())},
      {"id", std::string(ctx.param("id"))},
      {"user_agent", std::string(ctx.header("User-Agent"))}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("AppContext inspect example is ready");
  });
}
```

Test:

```bash
curl "http://127.0.0.1:8080/inspect/42?page=1" \
  -H "User-Agent: Cnerium-Test"
```

Example response:

```json
{"method":"GET","path":"/inspect/42","query":"page=1","id":"42","user_agent":"Cnerium-Test"}
```

## JSON body example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.post("/users", [](AppContext &ctx)
  {
    try
    {
      auto body = ctx.json();

      if (!body.contains("name"))
      {
        ctx.status(cnerium::http::Status::bad_request).json({
          {"ok", false},
          {"error", "name is required"}
        });
        return;
      }

      ctx.status(cnerium::http::Status::created).json({
        {"ok", true},
        {"name", body["name"]}
      });
    }
    catch (const std::exception &ex)
    {
      ctx.status(cnerium::http::Status::bad_request).json({
        {"ok", false},
        {"error", "invalid JSON body"},
        {"message", ex.what()}
      });
    }
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("AppContext JSON body example is ready");
  });
}
```

Test:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'
```

## Route parameter parsing

Route parameters are strings.

If you need an integer, parse it explicitly.

```cpp
#include <optional>
#include <string>
#include <string_view>

std::optional<int> parse_id(std::string_view raw)
{
  try
  {
    return std::stoi(std::string(raw));
  }
  catch (...)
  {
    return std::nullopt;
  }
}
```

Use:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  const auto id = parse_id(ctx.param("id"));

  if (!id)
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", "invalid user id"}
    });
    return;
  }

  ctx.json({
    {"ok", true},
    {"id", *id}
  });
});
```

## Complete example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <optional>
#include <string>
#include <string_view>

using namespace cnerium::app;

namespace
{
  std::optional<int> parse_id(std::string_view raw)
  {
    try
    {
      return std::stoi(std::string(raw));
    }
    catch (...)
    {
      return std::nullopt;
    }
  }
}

int main()
{
  App app;

  app.use([](auto &ctx, auto next)
  {
    ctx.response().set_header("X-App", "Cnerium");
    next();
  });

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("AppContext reference example");
  });

  app.get("/inspect/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"method", cnerium::http::to_string(ctx.method())},
      {"path", std::string(ctx.path())},
      {"query", std::string(ctx.query())},
      {"id", std::string(ctx.param("id"))},
      {"has_params", ctx.has_params()}
    });
  });

  app.post("/echo", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"body", std::string(ctx.body())}
    });
  });

  app.post("/json", [](AppContext &ctx)
  {
    try
    {
      auto body = ctx.json();

      ctx.status(cnerium::http::Status::created).json({
        {"ok", true},
        {"data", body}
      });
    }
    catch (const std::exception &ex)
    {
      ctx.status(cnerium::http::Status::bad_request).json({
        {"ok", false},
        {"error", "invalid JSON body"},
        {"message", ex.what()}
      });
    }
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    const auto id = parse_id(ctx.param("id"));

    if (!id)
    {
      ctx.status(cnerium::http::Status::bad_request).json({
        {"ok", false},
        {"error", "invalid user id"}
      });
      return;
    }

    ctx.json({
      {"ok", true},
      {"id", *id}
    });
  });

  app.delete_("/users/:id", [](AppContext &ctx)
  {
    ctx.response().empty(cnerium::http::Status::no_content);
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("AppContext reference example is ready");
  });
}
```

## Test the complete example

```bash
curl http://127.0.0.1:8080/

curl "http://127.0.0.1:8080/inspect/42?page=1"

curl -X POST http://127.0.0.1:8080/echo \
  -H "Content-Type: text/plain" \
  -d "hello"

curl -X POST http://127.0.0.1:8080/json \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'

curl http://127.0.0.1:8080/users/42
curl -i http://127.0.0.1:8080/users/abc

curl -i -X DELETE http://127.0.0.1:8080/users/42
```

## API overview

Request helpers:

```cpp
ctx.method();
ctx.path();
ctx.query();
ctx.header(name);
ctx.param(name);
ctx.has_param(name);
ctx.has_params();
ctx.body();
ctx.json();
ctx.request();
```

Response helpers:

```cpp
ctx.status(status);
ctx.text(body);
ctx.html(body);
ctx.json(value);
ctx.ok(body);
ctx.error(status, message);
ctx.response();
```

## Common patterns

JSON success:

```cpp
ctx.json({
  {"ok", true},
  {"data", data}
});
```

Created response:

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true},
  {"message", "created"}
});
```

Validation error:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "invalid request"}
});
```

Missing resource:

```cpp
ctx.status(cnerium::http::Status::not_found).json({
  {"ok", false},
  {"error", "not found"}
});
```

No content:

```cpp
ctx.response().empty(cnerium::http::Status::no_content);
```

## Best practices

### Use high-level helpers first

Prefer:

```cpp
ctx.text("Hello");
ctx.json({{"ok", true}});
ctx.status(cnerium::http::Status::created);
```

Use `ctx.request()` and `ctx.response()` only when you need lower-level access.

### Validate JSON before reading fields

Good:

```cpp
if (!body.contains("name"))
{
  ctx.status(cnerium::http::Status::bad_request).json({
    {"ok", false},
    {"error", "name is required"}
  });
  return;
}
```

### Catch JSON parse errors

Client JSON can be invalid.

Use:

```cpp
try
{
  auto body = ctx.json();
}
catch (const std::exception &ex)
{
  ctx.status(cnerium::http::Status::bad_request).json({
    {"ok", false},
    {"error", "invalid JSON body"}
  });
}
```

### Convert route parameters explicitly

Route parameters are strings.

```cpp
std::string id(ctx.param("id"));
```

For numbers, parse safely.

### Use consistent JSON shapes

Success:

```json
{"ok":true,"data":{}}
```

Error:

```json
{"ok":false,"error":"message"}
```

### Do not store AppContext for later

`AppContext` belongs to the current request lifecycle.

Do not store it in globals, background tasks, or long-lived objects.

Copy the data you need:

```cpp
std::string path(ctx.path());
```

## Common mistakes

### Capturing AppContext in runtime tasks

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

### Reading missing JSON fields

Wrong:

```cpp
auto name = body["name"].as_string();
```

Correct:

```cpp
if (!body.contains("name"))
{
  // return 400
}
```

### Returning a body with 204

Wrong:

```cpp
ctx.status(cnerium::http::Status::no_content).json({
  {"ok", true}
});
```

Correct:

```cpp
ctx.response().empty(cnerium::http::Status::no_content);
```

### Treating query as path

For:

```txt
/users?page=1
```

Path:

```txt
/users
```

Query:

```txt
page=1
```

Use:

```cpp
ctx.path();
ctx.query();
```

## Summary

`AppContext` is the main object used inside Cnerium route handlers.

It gives access to request data and response helpers.

Use it to:

```txt
read method, path, query, headers, body
read route parameters
parse JSON bodies
send text, HTML, JSON, errors, and status codes
access lower-level request/response objects
```

For most handlers, this is enough:

```cpp
ctx.param(...)
ctx.json()
ctx.status(...).json(...)
ctx.text(...)
```

## Next step

Continue with AppConfig.

[Open AppConfig reference](/reference/app-config)
