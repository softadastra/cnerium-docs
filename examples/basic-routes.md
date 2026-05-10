# Basic Routes

This example shows how to register multiple routes in a Cnerium app.

You will learn how to use:

```txt
GET routes
POST routes
PUT routes
DELETE routes
route parameters
JSON responses
status codes
```

## Code

Create or replace:

```txt
src/main.cpp
```

with:

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
    ctx.text("home");
  });

  app.get("/about", [](AppContext &ctx)
  {
    ctx.text("about Cnerium");
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    ctx.text("user id: " + std::string(ctx.param("id")));
  });

  app.post("/users", [](AppContext &ctx)
  {
    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "user created"}
    });
  });

  app.put("/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "user updated"},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.delete_("/users/:id", [](AppContext &ctx)
  {
    ctx.response().empty(cnerium::http::Status::no_content);
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Basic routes example is ready");
  });
}
```

## Run

```bash
vix dev
```

The app listens on:

```txt
http://127.0.0.1:8080
```

## Test the home route

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```txt
home
```

## Test another static route

```bash
curl http://127.0.0.1:8080/about
```

Expected response:

```txt
about Cnerium
```

## Test JSON route

```bash
curl http://127.0.0.1:8080/health
```

Expected response:

```json
{"ok":true,"status":"healthy"}
```

## Static routes

A static route has a fixed path.

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.text("home");
});

app.get("/about", [](AppContext &ctx)
{
  ctx.text("about Cnerium");
});
```

These routes match exactly:

```txt
GET /
GET /about
```

## Dynamic routes

A dynamic route uses `:name` to capture a value from the URL.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("user id: " + std::string(ctx.param("id")));
});
```

Test:

```bash
curl http://127.0.0.1:8080/users/42
```

Expected response:

```txt
user id: 42
```

In this route:

```txt
/users/:id
```

Cnerium extracts:

```txt
id = 42
```

You read it with:

```cpp
ctx.param("id")
```

## Multiple route parameters

You can capture several values.

```cpp
app.get("/shops/:shop_id/products/:product_id", [](AppContext &ctx)
{
  ctx.json({
    {"shop_id", std::string(ctx.param("shop_id"))},
    {"product_id", std::string(ctx.param("product_id"))}
  });
});
```

Add this route:

```cpp
app.get("/shops/:shop_id/products/:product_id", [](AppContext &ctx)
{
  ctx.json({
    {"shop_id", std::string(ctx.param("shop_id"))},
    {"product_id", std::string(ctx.param("product_id"))}
  });
});
```

Test:

```bash
curl http://127.0.0.1:8080/shops/10/products/200
```

Expected response:

```json
{"shop_id":"10","product_id":"200"}
```

## GET routes

Use `app.get()` for routes that read data.

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"id", std::string(ctx.param("id"))}
  });
});
```

A `GET` route should normally not modify data.

## POST routes

Use `app.post()` for routes that create data.

```cpp
app.post("/users", [](AppContext &ctx)
{
  ctx.status(cnerium::http::Status::created).json({
    {"ok", true},
    {"message", "user created"}
  });
});
```

Test:

```bash
curl -X POST http://127.0.0.1:8080/users
```

Expected response:

```json
{"ok":true,"message":"user created"}
```

The route returns:

```txt
201 Created
```

because it uses:

```cpp
ctx.status(cnerium::http::Status::created)
```

## PUT routes

Use `app.put()` for routes that update data.

```cpp
app.put("/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"message", "user updated"},
    {"id", std::string(ctx.param("id"))}
  });
});
```

Test:

```bash
curl -X PUT http://127.0.0.1:8080/users/42
```

Expected response:

```json
{"ok":true,"message":"user updated","id":"42"}
```

## DELETE routes

Use `app.delete_()` for routes that delete data.

```cpp
app.delete_("/users/:id", [](AppContext &ctx)
{
  ctx.response().empty(cnerium::http::Status::no_content);
});
```

The method is named `delete_()` because `delete` is a reserved keyword in C++.

Test:

```bash
curl -i -X DELETE http://127.0.0.1:8080/users/42
```

Expected status:

```txt
204 No Content
```

## Explicit method routes

If you need a method helper that is not exposed directly, use `app.route()`.

```cpp
#include <cnerium/http/Method.hpp>
```

```cpp
app.route(cnerium::http::Method::Patch, "/users/:id", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"message", "user patched"},
    {"id", std::string(ctx.param("id"))}
  });
});
```

Test:

```bash
curl -X PATCH http://127.0.0.1:8080/users/42
```

Expected response:

```json
{"ok":true,"message":"user patched","id":"42"}
```

## Route order matters

Cnerium matches routes in registration order.

The first matching route wins.

Register specific routes before dynamic routes.

Good:

```cpp
app.get("/users/me", [](AppContext &ctx)
{
  ctx.text("current user");
});

app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("user id: " + std::string(ctx.param("id")));
});
```

Avoid:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  ctx.text("user id: " + std::string(ctx.param("id")));
});

app.get("/users/me", [](AppContext &ctx)
{
  ctx.text("current user");
});
```

If the dynamic route comes first, `/users/me` may match as:

```txt
id = me
```

## Complete example with specific route order

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Method.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.text("home");
  });

  app.get("/about", [](AppContext &ctx)
  {
    ctx.text("about Cnerium");
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"}
    });
  });

  app.get("/users/me", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"user", "current"}
    });
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.get("/shops/:shop_id/products/:product_id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"shop_id", std::string(ctx.param("shop_id"))},
      {"product_id", std::string(ctx.param("product_id"))}
    });
  });

  app.post("/users", [](AppContext &ctx)
  {
    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "user created"}
    });
  });

  app.put("/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "user updated"},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.delete_("/users/:id", [](AppContext &ctx)
  {
    ctx.response().empty(cnerium::http::Status::no_content);
  });

  app.route(cnerium::http::Method::Patch, "/users/:id", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "user patched"},
      {"id", std::string(ctx.param("id"))}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Basic routes example is ready");
  });
}
```

## Test all routes

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/about
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/users/me
curl http://127.0.0.1:8080/users/42
curl http://127.0.0.1:8080/shops/10/products/200

curl -X POST http://127.0.0.1:8080/users
curl -X PUT http://127.0.0.1:8080/users/42
curl -X PATCH http://127.0.0.1:8080/users/42
curl -i -X DELETE http://127.0.0.1:8080/users/42
```

## Expected behavior

| Request | Result |
|--------|--------|
| `GET /` | `home` |
| `GET /about` | `about Cnerium` |
| `GET /health` | JSON health response |
| `GET /users/me` | current user response |
| `GET /users/42` | user id response |
| `GET /shops/10/products/200` | shop and product ids |
| `POST /users` | `201 Created` |
| `PUT /users/42` | update response |
| `PATCH /users/42` | patch response |
| `DELETE /users/42` | `204 No Content` |

## Best practices

### Keep route paths simple

Good:

```txt
/users
/users/:id
/shops/:shop_id/products/:product_id
```

Avoid:

```txt
/do-user-action
/getUserById
/user_get
```

### Use nouns for resources

Good:

```txt
/users
/products
/orders
```

### Use HTTP methods for actions

Good:

```txt
GET /users
POST /users
PUT /users/:id
DELETE /users/:id
```

Avoid:

```txt
POST /create-user
POST /delete-user
GET /update-user
```

### Register specific routes first

Good:

```cpp
app.get("/users/me", current_user);
app.get("/users/:id", show_user);
```

### Convert route parameters explicitly

Good:

```cpp
std::string(ctx.param("id"))
```

### Use status codes intentionally

For created resources:

```cpp
ctx.status(cnerium::http::Status::created)
```

For deleted resources without response body:

```cpp
ctx.response().empty(cnerium::http::Status::no_content)
```

## Common mistakes

### Using `delete` instead of `delete_`

Wrong:

```cpp
app.delete("/users/:id", handler);
```

Correct:

```cpp
app.delete_("/users/:id", handler);
```

### Forgetting that route order matters

Wrong:

```cpp
app.get("/users/:id", show_user);
app.get("/users/me", current_user);
```

Correct:

```cpp
app.get("/users/me", current_user);
app.get("/users/:id", show_user);
```

### Testing the wrong method

If you register:

```cpp
app.post("/users", handler);
```

Then test with:

```bash
curl -X POST http://127.0.0.1:8080/users
```

Not:

```bash
curl http://127.0.0.1:8080/users
```

### Forgetting the server is running on port 8080

Most examples use:

```txt
127.0.0.1:8080
```

## Summary

Cnerium routes connect HTTP methods and paths to handlers.

Use:

```cpp
app.get()
app.post()
app.put()
app.delete_()
app.route()
```

Use `:name` for dynamic route parameters:

```txt
/users/:id
```

Read route parameters with:

```cpp
ctx.param("id")
```

Register specific routes before dynamic routes.

## Next step

Continue with JSON API.

[Open JSON API](/examples/json-api)
