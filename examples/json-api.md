# JSON API

This example shows how to build a small JSON API with Cnerium.

You will learn how to:

```txt
return JSON responses
read JSON request bodies
set HTTP status codes
validate required fields
return JSON errors
use route parameters
keep response shapes consistent
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
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <optional>
#include <string>
#include <string_view>
#include <vector>

using namespace cnerium::app;

namespace
{
  struct User
  {
    int id{};
    std::string name;
    std::string email;
    bool active{true};
  };

  std::vector<User> users = {
      {1, "Alice", "alice@example.com", true},
      {2, "Bob", "bob@example.com", true},
  };

  int next_user_id = 3;

  cnerium::json::value to_json(const User &user)
  {
    return cnerium::json::object{
        {"id", user.id},
        {"name", user.name},
        {"email", user.email},
        {"active", user.active}};
  }

  cnerium::json::value users_to_json(const std::vector<User> &items)
  {
    cnerium::json::array result;

    for (const auto &user : items)
    {
      result.push_back(to_json(user));
    }

    return result;
  }

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

  std::optional<std::size_t> find_user_index_by_id(int id)
  {
    for (std::size_t i = 0; i < users.size(); ++i)
    {
      if (users[i].id == id)
      {
        return i;
      }
    }

    return std::nullopt;
  }

  void json_error(AppContext &ctx,
                  cnerium::http::Status status,
                  std::string message)
  {
    ctx.status(status).json({
        {"ok", false},
        {"error", std::move(message)}});
  }
}

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
        {"ok", true},
        {"name", "Cnerium JSON API"},
        {"version", "0.1.0"}});
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
        {"ok", true},
        {"status", "healthy"}});
  });

  app.get("/users", [](AppContext &ctx)
  {
    ctx.json({
        {"ok", true},
        {"count", static_cast<int>(users.size())},
        {"data", users_to_json(users)}});
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    const auto id = parse_id(ctx.param("id"));

    if (!id)
    {
      json_error(ctx, cnerium::http::Status::bad_request, "invalid user id");
      return;
    }

    const auto index = find_user_index_by_id(*id);

    if (!index)
    {
      json_error(ctx, cnerium::http::Status::not_found, "user not found");
      return;
    }

    ctx.json({
        {"ok", true},
        {"data", to_json(users[*index])}});
  });

  app.post("/users", [](AppContext &ctx)
  {
    try
    {
      auto body = ctx.json();

      if (!body.is_object())
      {
        json_error(
            ctx,
            cnerium::http::Status::bad_request,
            "request body must be a JSON object");
        return;
      }

      if (!body.contains("name") || !body.contains("email"))
      {
        json_error(
            ctx,
            cnerium::http::Status::bad_request,
            "fields 'name' and 'email' are required");
        return;
      }

      User user;
      user.id = next_user_id++;
      user.name = body["name"].as_string();
      user.email = body["email"].as_string();
      user.active = body.contains("active")
                        ? body["active"].as_bool()
                        : true;

      users.push_back(user);

      ctx.status(cnerium::http::Status::created).json({
          {"ok", true},
          {"message", "user created"},
          {"data", to_json(user)}});
    }
    catch (const std::exception &ex)
    {
      json_error(ctx, cnerium::http::Status::bad_request, ex.what());
    }
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("JSON API example is ready");
  });
}
```

## Run

```bash
vix dev
```

The API listens on:

```txt
http://127.0.0.1:8080
```

## Test the root route

```bash
curl http://127.0.0.1:8080/
```

Expected response:

```json
{"ok":true,"name":"Cnerium JSON API","version":"0.1.0"}
```

## Test the health route

```bash
curl http://127.0.0.1:8080/health
```

Expected response:

```json
{"ok":true,"status":"healthy"}
```

## List users

```bash
curl http://127.0.0.1:8080/users
```

Example response:

```json
{"ok":true,"count":2,"data":[{"active":true,"email":"alice@example.com","id":1,"name":"Alice"},{"active":true,"email":"bob@example.com","id":2,"name":"Bob"}]}
```

## Get one user

```bash
curl http://127.0.0.1:8080/users/1
```

Example response:

```json
{"ok":true,"data":{"active":true,"email":"alice@example.com","id":1,"name":"Alice"}}
```

## Invalid user id

```bash
curl -i http://127.0.0.1:8080/users/abc
```

Expected response:

```json
{"ok":false,"error":"invalid user id"}
```

The route parameter is a string, so the example parses it safely with:

```cpp
parse_id(ctx.param("id"));
```

## Missing user

```bash
curl -i http://127.0.0.1:8080/users/99
```

Expected response:

```json
{"ok":false,"error":"user not found"}
```

The route exists, but the requested resource does not exist.

That is why the handler returns:

```cpp
cnerium::http::Status::not_found
```

## Create a user

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com","active":true}'
```

Expected response:

```json
{"ok":true,"message":"user created","data":{"active":true,"email":"gaspard@example.com","id":3,"name":"Gaspard"}}
```

The route returns:

```txt
201 Created
```

because it uses:

```cpp
ctx.status(cnerium::http::Status::created)
```

## Invalid JSON body

```bash
curl -i -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":}'
```

Expected response:

```json
{"ok":false,"error":"..."}
```

The exact error message depends on the JSON parser error.

The important part is that invalid JSON returns a `400 Bad Request` response instead of crashing the app.

## Missing required fields

```bash
curl -i -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'
```

Expected response:

```json
{"ok":false,"error":"fields 'name' and 'email' are required"}
```

## Response shape

This example uses a consistent API shape.

Success responses:

```json
{
  "ok": true,
  "data": {}
}
```

Error responses:

```json
{
  "ok": false,
  "error": "message"
}
```

This makes the API easier to consume.

## JSON helper

The example uses a helper to convert `User` to JSON.

```cpp
cnerium::json::value to_json(const User &user)
{
  return cnerium::json::object{
      {"id", user.id},
      {"name", user.name},
      {"email", user.email},
      {"active", user.active}};
}
```

This keeps route handlers clean.

Instead of writing JSON conversion everywhere, handlers can call:

```cpp
to_json(user)
```

## JSON list helper

The list route uses:

```cpp
cnerium::json::value users_to_json(const std::vector<User> &items)
{
  cnerium::json::array result;

  for (const auto &user : items)
  {
    result.push_back(to_json(user));
  }

  return result;
}
```

This converts a `std::vector<User>` into a JSON array.

## Error helper

The example uses one helper for JSON errors:

```cpp
void json_error(AppContext &ctx,
                cnerium::http::Status status,
                std::string message)
{
  ctx.status(status).json({
      {"ok", false},
      {"error", std::move(message)}});
}
```

This avoids repeating the same error shape in every route.

## Parse route ids safely

Route parameters are strings.

This helper converts a route parameter into an integer:

```cpp
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

Use it like this:

```cpp
const auto id = parse_id(ctx.param("id"));

if (!id)
{
  json_error(ctx, cnerium::http::Status::bad_request, "invalid user id");
  return;
}
```

## Find a user

The example stores users in memory.

```cpp
std::optional<std::size_t> find_user_index_by_id(int id)
{
  for (std::size_t i = 0; i < users.size(); ++i)
  {
    if (users[i].id == id)
    {
      return i;
    }
  }

  return std::nullopt;
}
```

This is only for the example.

In a real app, this logic would usually live in a repository or service.

## JSON request body

The create route reads JSON with:

```cpp
auto body = ctx.json();
```

Then it validates the input:

```cpp
if (!body.is_object())
{
  json_error(ctx, cnerium::http::Status::bad_request, "request body must be a JSON object");
  return;
}

if (!body.contains("name") || !body.contains("email"))
{
  json_error(ctx, cnerium::http::Status::bad_request, "fields 'name' and 'email' are required");
  return;
}
```

Only after validation does it read fields:

```cpp
user.name = body["name"].as_string();
user.email = body["email"].as_string();
```

## Full test flow

Start the app:

```bash
vix dev
```

Run:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/users
curl http://127.0.0.1:8080/users/1
curl -i http://127.0.0.1:8080/users/99
curl -i http://127.0.0.1:8080/users/abc
```

Create a user:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com","active":true}'
```

List again:

```bash
curl http://127.0.0.1:8080/users
```

Test invalid body:

```bash
curl -i -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":}'
```

Test missing field:

```bash
curl -i -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Only Name"}'
```

## Add a not-found handler

You can make missing routes return JSON too.

Add this before `app.listen()`:

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

Then test:

```bash
curl -i http://127.0.0.1:8080/missing
```

## Add an error handler

You can also catch unexpected exceptions globally.

Add this before `app.listen()`:

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

For production, log the real error and return a safe message to the client.

## Extended final example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <optional>
#include <string>
#include <string_view>
#include <vector>

using namespace cnerium::app;

namespace
{
  struct User
  {
    int id{};
    std::string name;
    std::string email;
    bool active{true};
  };

  std::vector<User> users = {
      {1, "Alice", "alice@example.com", true},
      {2, "Bob", "bob@example.com", true},
  };

  int next_user_id = 3;

  cnerium::json::value to_json(const User &user)
  {
    return cnerium::json::object{
        {"id", user.id},
        {"name", user.name},
        {"email", user.email},
        {"active", user.active}};
  }

  cnerium::json::value users_to_json(const std::vector<User> &items)
  {
    cnerium::json::array result;

    for (const auto &user : items)
    {
      result.push_back(to_json(user));
    }

    return result;
  }

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

  std::optional<std::size_t> find_user_index_by_id(int id)
  {
    for (std::size_t i = 0; i < users.size(); ++i)
    {
      if (users[i].id == id)
      {
        return i;
      }
    }

    return std::nullopt;
  }

  void json_error(AppContext &ctx,
                  cnerium::http::Status status,
                  std::string message)
  {
    ctx.status(status).json({
        {"ok", false},
        {"error", std::move(message)}});
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
    ctx.json({
        {"ok", true},
        {"name", "Cnerium JSON API"},
        {"version", "0.1.0"}});
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
        {"ok", true},
        {"status", "healthy"},
        {"users_count", static_cast<int>(users.size())}});
  });

  app.get("/users", [](AppContext &ctx)
  {
    ctx.json({
        {"ok", true},
        {"count", static_cast<int>(users.size())},
        {"data", users_to_json(users)}});
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    const auto id = parse_id(ctx.param("id"));

    if (!id)
    {
      json_error(ctx, cnerium::http::Status::bad_request, "invalid user id");
      return;
    }

    const auto index = find_user_index_by_id(*id);

    if (!index)
    {
      json_error(ctx, cnerium::http::Status::not_found, "user not found");
      return;
    }

    ctx.json({
        {"ok", true},
        {"data", to_json(users[*index])}});
  });

  app.post("/users", [](AppContext &ctx)
  {
    try
    {
      auto body = ctx.json();

      if (!body.is_object())
      {
        json_error(
            ctx,
            cnerium::http::Status::bad_request,
            "request body must be a JSON object");
        return;
      }

      if (!body.contains("name") || !body.contains("email"))
      {
        json_error(
            ctx,
            cnerium::http::Status::bad_request,
            "fields 'name' and 'email' are required");
        return;
      }

      User user;
      user.id = next_user_id++;
      user.name = body["name"].as_string();
      user.email = body["email"].as_string();
      user.active = body.contains("active")
                        ? body["active"].as_bool()
                        : true;

      users.push_back(user);

      ctx.status(cnerium::http::Status::created).json({
          {"ok", true},
          {"message", "user created"},
          {"data", to_json(user)}});
    }
    catch (const std::exception &ex)
    {
      json_error(ctx, cnerium::http::Status::bad_request, ex.what());
    }
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

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("JSON API example is ready");
  });
}
```

## Best practices

### Use JSON consistently

Good success response:

```json
{"ok":true,"data":{}}
```

Good error response:

```json
{"ok":false,"error":"message"}
```

### Validate before reading fields

Good:

```cpp
if (!body.contains("name"))
{
  json_error(ctx, cnerium::http::Status::bad_request, "name is required");
  return;
}
```

Avoid:

```cpp
auto name = body["name"].as_string();
```

before checking if `name` exists.

### Catch JSON parsing errors

Client input can be invalid.

Use:

```cpp
try
{
  auto body = ctx.json();
}
catch (const std::exception &ex)
{
  json_error(ctx, cnerium::http::Status::bad_request, ex.what());
}
```

### Use helper functions

Keep route handlers readable with helpers:

```cpp
to_json(user)
users_to_json(users)
json_error(ctx, status, message)
parse_id(ctx.param("id"))
```

### Use correct status codes

Use:

```txt
200 OK                 successful read
201 Created            successful create
400 Bad Request        invalid input
404 Not Found          missing resource
500 Internal Server Error unexpected server failure
```

### Keep storage simple in examples

This example uses a global `std::vector<User>`.

That is fine for learning.

In a real app, use a repository, database, or service layer.

## Common mistakes

### Forgetting `Content-Type`

When sending JSON with curl, include:

```bash
-H "Content-Type: application/json"
```

### Returning `200 OK` for validation errors

Use:

```cpp
ctx.status(cnerium::http::Status::bad_request)
```

### Returning raw parser errors in production

During development, `ex.what()` is useful.

In production, prefer a safer message:

```json
{"ok":false,"error":"invalid JSON body"}
```

### Mixing response shapes

Avoid returning different shapes for every route.

Keep responses predictable.

## Summary

This example builds a small JSON API with Cnerium.

It includes:

```txt
GET /
GET /health
GET /users
GET /users/:id
POST /users
JSON validation
JSON errors
status codes
not-found handler
error handler
```

Use this pattern as the base for small APIs.

## Next step

Continue with middleware examples.

[Open Middleware Example](/examples/middleware)
