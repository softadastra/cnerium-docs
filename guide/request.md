# Request

A request represents the data sent by the client to your Cnerium application.

In most applications, you access request data through `AppContext`.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  auto method = ctx.method();
  auto path = ctx.path();
  auto id = ctx.param("id");

  ctx.text("User id: " + std::string(id));
});
```

## What you can read

From `AppContext`, you can read:

```txt
HTTP method
path
query string
headers
route parameters
raw body
JSON body
```

The most common helpers are:

```cpp
ctx.method();
ctx.path();
ctx.query();
ctx.header("Content-Type");
ctx.param("id");
ctx.body();
ctx.json();
ctx.request();
```

## Basic example

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"method", "GET"},
      {"path", std::string(ctx.path())},
      {"query", std::string(ctx.query())}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Request example is ready");
  });
}
```

Run:

```bash
vix dev
```

Test:

```bash
curl "http://127.0.0.1:8080/?page=1"
```

Example response:

```json
{"method":"GET","path":"/","query":"page=1"}
```

## Read the HTTP method

Use `ctx.method()`:

```cpp
app.get("/", [](AppContext &ctx)
{
  auto method = ctx.method();

  ctx.json({
    {"ok", true},
    {"method", cnerium::http::to_string(method)}
  });
});
```

For most applications, you do not need to manually check the method because the route helper already does it:

```cpp
app.get("/", handler);
app.post("/users", handler);
app.put("/users/:id", handler);
app.delete_("/users/:id", handler);
```

## Read the path

Use `ctx.path()`:

```cpp
app.get("/profile", [](AppContext &ctx)
{
  ctx.json({
    {"path", std::string(ctx.path())}
  });
});
```

For this request:

```txt
/profile?tab=settings
```

The path is:

```txt
/profile
```

The query string is separate.

## Read the query string

Use `ctx.query()`:

```cpp
app.get("/search", [](AppContext &ctx)
{
  ctx.json({
    {"path", std::string(ctx.path())},
    {"query", std::string(ctx.query())}
  });
});
```

Test:

```bash
curl "http://127.0.0.1:8080/search?q=cnerium&page=1"
```

Example response:

```json
{"path":"/search","query":"q=cnerium&page=1"}
```

`ctx.query()` returns the raw query string.

Cnerium keeps this simple at the framework level. You can parse the query string in your own helper when needed.

## Read route parameters

Route parameters come from dynamic route segments.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"id", std::string(ctx.param("id"))}
  });
});
```

Test:

```bash
curl http://127.0.0.1:8080/users/42
```

Response:

```json
{"id":"42"}
```

Use `ctx.has_param()` when you want to check if a parameter exists:

```cpp
if (ctx.has_param("id"))
{
  auto id = ctx.param("id");
}
```

Use `ctx.has_params()` to check if the route has any extracted parameters:

```cpp
if (ctx.has_params())
{
  // at least one route parameter exists
}
```

## Read a header

Use `ctx.header(name)`:

```cpp
app.get("/headers", [](AppContext &ctx)
{
  ctx.json({
    {"user_agent", std::string(ctx.header("User-Agent"))},
    {"content_type", std::string(ctx.header("Content-Type"))}
  });
});
```

Test:

```bash
curl http://127.0.0.1:8080/headers \
  -H "Content-Type: application/json"
```

Header lookup is case-insensitive at the HTTP layer, so these should refer to the same header:

```cpp
ctx.header("Content-Type");
ctx.header("content-type");
ctx.header("CONTENT-TYPE");
```

## Read authorization header

A common pattern is reading `Authorization`:

```cpp
app.get("/me", [](AppContext &ctx)
{
  const auto auth = ctx.header("Authorization");

  if (auth.empty())
  {
    ctx.status(cnerium::http::Status::unauthorized).json({
      {"ok", false},
      {"error", "missing authorization header"}
    });
    return;
  }

  ctx.json({
    {"ok", true},
    {"authorization", std::string(auth)}
  });
});
```

Test:

```bash
curl http://127.0.0.1:8080/me \
  -H "Authorization: Bearer demo-token"
```

## Read the raw body

Use `ctx.body()`:

```cpp
app.post("/echo", [](AppContext &ctx)
{
  ctx.text(std::string(ctx.body()));
});
```

Test:

```bash
curl -X POST http://127.0.0.1:8080/echo \
  -H "Content-Type: text/plain" \
  -d "Hello Cnerium"
```

Expected response:

```txt
Hello Cnerium
```

## Read JSON body

Use `ctx.json()`:

```cpp
app.post("/users", [](AppContext &ctx)
{
  auto body = ctx.json();

  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"name", body["name"]},
    {"email", body["email"]}
  });
});
```

Test:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com"}'
```

Expected response:

```json
{"ok":true,"name":"Gaspard","email":"gaspard@example.com"}
```

## Handle invalid JSON

`ctx.json()` can throw if the body is not valid JSON.

Use `try/catch` when reading user input:

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

Test invalid JSON:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":}'
```

## Validate required fields

After parsing JSON, validate the fields you need:

```cpp
app.post("/users", [](AppContext &ctx)
{
  try
  {
    auto body = ctx.json();

    if (!body.is_object())
    {
      ctx.status(cnerium::http::Status::bad_request).json({
        {"ok", false},
        {"error", "request body must be a JSON object"}
      });
      return;
    }

    if (!body.contains("name") || !body.contains("email"))
    {
      ctx.status(cnerium::http::Status::bad_request).json({
        {"ok", false},
        {"error", "fields 'name' and 'email' are required"}
      });
      return;
    }

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "user created"},
      {"name", body["name"]},
      {"email", body["email"]}
    });
  }
  catch (const std::exception &ex)
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", ex.what()}
    });
  }
});
```

## Use the raw request object

For lower-level access, use `ctx.request()`:

```cpp
app.get("/raw", [](AppContext &ctx)
{
  auto &req = ctx.request();

  ctx.json({
    {"path", std::string(req.path())},
    {"body", std::string(req.body())}
  });
});
```

Most applications should use the `AppContext` helpers first.

Use `ctx.request()` only when you need direct access to the underlying request object.

## Request data overview

| Data | Helper |
|------|--------|
| HTTP method | `ctx.method()` |
| Path | `ctx.path()` |
| Query string | `ctx.query()` |
| Header | `ctx.header("Name")` |
| Route parameter | `ctx.param("id")` |
| Has parameter | `ctx.has_param("id")` |
| Raw body | `ctx.body()` |
| JSON body | `ctx.json()` |
| Raw request | `ctx.request()` |

## Complete example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "Request guide example"}
    });
  });

  app.get("/inspect/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"method", cnerium::http::to_string(ctx.method())},
      {"path", std::string(ctx.path())},
      {"query", std::string(ctx.query())},
      {"id", std::string(ctx.param("id"))},
      {"user_agent", std::string(ctx.header("User-Agent"))}
    });
  });

  app.post("/echo", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"content_type", std::string(ctx.header("Content-Type"))},
      {"body", std::string(ctx.body())}
    });
  });

  app.post("/json", [](AppContext &ctx)
  {
    try
    {
      auto body = ctx.json();

      ctx.json({
        {"ok", true},
        {"received", body}
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
    vix::console.info("Request guide example is ready");
  });
}
```

## Test the example

```bash
curl "http://127.0.0.1:8080/inspect/42?page=1" \
  -H "User-Agent: Cnerium-Test"

curl -X POST http://127.0.0.1:8080/echo \
  -H "Content-Type: text/plain" \
  -d "hello"

curl -X POST http://127.0.0.1:8080/json \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","active":true}'
```

## Best practices

### Use route parameters for resource identity

Good:

```txt
/users/:id
/orders/:id
/shops/:shop_id/products/:product_id
```

### Use query strings for filtering

Good:

```txt
/products?category=books&page=1
/users?active=true
```

### Use JSON body for data

Good:

```json
{
  "name": "Gaspard",
  "email": "gaspard@example.com"
}
```

### Validate user input

Never assume JSON fields are present or valid.

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

### Catch JSON parsing errors

Use `try/catch` around `ctx.json()` when the request body comes from a client.

### Keep request logic small

For large apps, move validation and business logic into services.

The route handler should read the request, call a service, and write a response.

## Summary

Use `AppContext` to read request data:

```cpp
ctx.method();
ctx.path();
ctx.query();
ctx.header("Content-Type");
ctx.param("id");
ctx.body();
ctx.json();
```

Use `ctx.json()` for JSON request bodies.

Use `ctx.body()` for raw text bodies.

Use `ctx.request()` only when you need the lower-level HTTP request object.

## Next step

Continue with responses.

[Open Response](/guide/response)
