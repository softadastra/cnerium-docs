# REST API

This example builds a small REST-style JSON API with Cnerium.

It combines the main concepts from the previous examples:

```txt
routes
route parameters
JSON responses
JSON request bodies
validation
status codes
middleware
not-found handling
error handling
runtime background jobs
```

The API manages users in memory.

This is not a database example.
It is a clean starting point for understanding how a Cnerium API should be structured.

## Routes

This example exposes:

```txt
GET     /
GET     /health
GET     /users
GET     /users/:id
POST    /users
PUT     /users/:id
DELETE  /users/:id
POST    /jobs
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

#include <atomic>
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
      {3, "Charlie", "charlie@example.com", false},
  };

  int next_user_id = 4;
  std::atomic<int> scheduled_jobs{0};

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

  bool has_required_user_fields(const cnerium::json::value &body)
  {
    return body.is_object() &&
           body.contains("name") &&
           body.contains("email");
  }

  User make_user_from_json(const cnerium::json::value &body)
  {
    User user;

    user.id = next_user_id++;
    user.name = body["name"].as_string();
    user.email = body["email"].as_string();
    user.active = body.contains("active")
                      ? body["active"].as_bool()
                      : true;

    return user;
  }

  void register_middleware(App &app)
  {
    app.use([](auto &ctx, auto next)
    {
      ctx.response().set_header("X-App", "Cnerium");
      ctx.response().set_header("X-Powered-By", "Cnerium");
      next();
    });

    app.use([](auto &ctx, auto next)
    {
      vix::console.info(
        "request",
        cnerium::http::to_string(ctx.request().method()),
        ctx.request().path()
      );

      next();
    });
  }

  void register_routes(App &app)
  {
    app.get("/", [](AppContext &ctx)
    {
      ctx.json({
          {"ok", true},
          {"name", "Cnerium REST API"},
          {"version", "0.1.0"}});
    });

    app.get("/health", [](AppContext &ctx)
    {
      ctx.json({
          {"ok", true},
          {"status", "healthy"},
          {"users_count", static_cast<int>(users.size())},
          {"scheduled_jobs", scheduled_jobs.load()}});
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

        if (!has_required_user_fields(body))
        {
          json_error(
              ctx,
              cnerium::http::Status::bad_request,
              "fields 'name' and 'email' are required");
          return;
        }

        User user = make_user_from_json(body);
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

    app.put("/users/:id", [](AppContext &ctx)
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

      try
      {
        auto body = ctx.json();

        if (!has_required_user_fields(body))
        {
          json_error(
              ctx,
              cnerium::http::Status::bad_request,
              "fields 'name' and 'email' are required");
          return;
        }

        User &user = users[*index];

        user.name = body["name"].as_string();
        user.email = body["email"].as_string();

        if (body.contains("active"))
        {
          user.active = body["active"].as_bool();
        }

        ctx.json({
            {"ok", true},
            {"message", "user updated"},
            {"data", to_json(user)}});
      }
      catch (const std::exception &ex)
      {
        json_error(ctx, cnerium::http::Status::bad_request, ex.what());
      }
    });

    app.delete_("/users/:id", [](AppContext &ctx)
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

      users.erase(users.begin() + static_cast<std::ptrdiff_t>(*index));

      ctx.response().empty(cnerium::http::Status::no_content);
    });

    app.post("/jobs", [&app](AppContext &ctx)
    {
      const int job_id = ++scheduled_jobs;
      std::string path(ctx.path());

      app.runtime().post([job_id, path]()
      {
        vix::console.info("background job", job_id, "from", path);
      });

      ctx.status(cnerium::http::Status::created).json({
          {"ok", true},
          {"message", "job scheduled"},
          {"job_id", job_id}});
    });
  }

  void register_error_handlers(App &app)
  {
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
  }
}

int main()
{
  AppConfig config;

  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 4;

  App app(config);

  register_middleware(app);
  register_routes(app);
  register_error_handlers(app);

  app.listen([]()
  {
    vix::console.info("REST API example is ready");
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

## Test the API

Root route:

```bash
curl http://127.0.0.1:8080/
```

Health route:

```bash
curl http://127.0.0.1:8080/health
```

List users:

```bash
curl http://127.0.0.1:8080/users
```

Get one user:

```bash
curl http://127.0.0.1:8080/users/1
```

Missing user:

```bash
curl -i http://127.0.0.1:8080/users/99
```

Invalid id:

```bash
curl -i http://127.0.0.1:8080/users/abc
```

## Create a user

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com","active":true}'
```

Expected response:

```json
{
  "ok": true,
  "message": "user created",
  "data": {
    "id": 4,
    "name": "Gaspard",
    "email": "gaspard@example.com",
    "active": true
  }
}
```

## Update a user

```bash
curl -X PUT http://127.0.0.1:8080/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated","email":"alice.updated@example.com","active":true}'
```

Expected response:

```json
{
  "ok": true,
  "message": "user updated",
  "data": {
    "id": 1,
    "name": "Alice Updated",
    "email": "alice.updated@example.com",
    "active": true
  }
}
```

## Delete a user

```bash
curl -i -X DELETE http://127.0.0.1:8080/users/1
```

Expected status:

```txt
204 No Content
```

Then check:

```bash
curl -i http://127.0.0.1:8080/users/1
```

Expected response:

```json
{"ok":false,"error":"user not found"}
```

## Schedule a background job

```bash
curl -X POST http://127.0.0.1:8080/jobs
```

Expected response:

```json
{"ok":true,"message":"job scheduled","job_id":1}
```

The terminal should show a runtime log similar to:

```txt
background job 1 from /jobs
```

## Missing route

```bash
curl -i http://127.0.0.1:8080/missing
```

Expected response:

```json
{"ok":false,"error":"route not found","path":"/missing"}
```

## Invalid JSON body

```bash
curl -i -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":}'
```

Expected behavior:

```txt
400 Bad Request
```

With a JSON error body.

## Missing fields

```bash
curl -i -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Only Name"}'
```

Expected response:

```json
{"ok":false,"error":"fields 'name' and 'email' are required"}
```

## How the example is organized

The file is divided into small pieces:

```txt
User model
in-memory storage
JSON conversion helpers
validation helpers
route helpers
middleware registration
route registration
error handler registration
main()
```

This keeps `main()` small:

```cpp
int main()
{
  AppConfig config;

  config.host = "127.0.0.1";
  config.port = 8080;
  config.thread_count = 4;

  App app(config);

  register_middleware(app);
  register_routes(app);
  register_error_handlers(app);

  app.listen([]()
  {
    vix::console.info("REST API example is ready");
  });
}
```

## User model

The example uses a simple `User` struct.

```cpp
struct User
{
  int id{};
  std::string name;
  std::string email;
  bool active{true};
};
```

This represents one user resource.

## In-memory storage

The example stores users in a vector:

```cpp
std::vector<User> users = {
    {1, "Alice", "alice@example.com", true},
    {2, "Bob", "bob@example.com", true},
    {3, "Charlie", "charlie@example.com", false},
};
```

This is enough for learning.

In a real application, replace this with a database or repository.

## JSON conversion

The `to_json()` helper converts one `User` into JSON.

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

The `users_to_json()` helper converts a list of users.

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

This keeps handlers clean.

## Error helper

All API errors use the same shape:

```json
{"ok":false,"error":"message"}
```

The helper:

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

Use it from handlers:

```cpp
json_error(ctx, cnerium::http::Status::bad_request, "invalid user id");
```

## Route id parsing

Route parameters are strings.

The example parses ids safely:

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

If parsing fails, return:

```txt
400 Bad Request
```

## Find user helper

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

If no user exists, return:

```txt
404 Not Found
```

## Create route

```cpp
app.post("/users", [](AppContext &ctx)
{
  try
  {
    auto body = ctx.json();

    if (!has_required_user_fields(body))
    {
      json_error(
          ctx,
          cnerium::http::Status::bad_request,
          "fields 'name' and 'email' are required");
      return;
    }

    User user = make_user_from_json(body);
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
```

Important parts:

```txt
parse JSON body
validate required fields
create user
push into storage
return 201 Created
```

## Update route

```cpp
app.put("/users/:id", [](AppContext &ctx)
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

  try
  {
    auto body = ctx.json();

    if (!has_required_user_fields(body))
    {
      json_error(
          ctx,
          cnerium::http::Status::bad_request,
          "fields 'name' and 'email' are required");
      return;
    }

    User &user = users[*index];

    user.name = body["name"].as_string();
    user.email = body["email"].as_string();

    if (body.contains("active"))
    {
      user.active = body["active"].as_bool();
    }

    ctx.json({
        {"ok", true},
        {"message", "user updated"},
        {"data", to_json(user)}});
  }
  catch (const std::exception &ex)
  {
    json_error(ctx, cnerium::http::Status::bad_request, ex.what());
  }
});
```

Important parts:

```txt
parse id
find user
parse JSON body
validate fields
update user
return updated JSON
```

## Delete route

```cpp
app.delete_("/users/:id", [](AppContext &ctx)
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

  users.erase(users.begin() + static_cast<std::ptrdiff_t>(*index));

  ctx.response().empty(cnerium::http::Status::no_content);
});
```

The route returns:

```txt
204 No Content
```

because delete succeeded and no response body is needed.

## Background job route

```cpp
app.post("/jobs", [&app](AppContext &ctx)
{
  const int job_id = ++scheduled_jobs;
  std::string path(ctx.path());

  app.runtime().post([job_id, path]()
  {
    vix::console.info("background job", job_id, "from", path);
  });

  ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"message", "job scheduled"},
      {"job_id", job_id}});
});
```

Important detail:

```cpp
std::string path(ctx.path());
```

The request path is copied before the background task is scheduled.

Do not capture `ctx` by reference inside runtime tasks.

## Middleware

The example uses middleware for global headers and request logs.

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  ctx.response().set_header("X-Powered-By", "Cnerium");
  next();
});
```

```cpp
app.use([](auto &ctx, auto next)
{
  vix::console.info(
    "request",
    cnerium::http::to_string(ctx.request().method()),
    ctx.request().path()
  );

  next();
});
```

## Error handlers

The not-found handler returns JSON for missing routes.

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

The error handler catches unexpected exceptions.

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

## Recommended response shapes

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Created:

```json
{
  "ok": true,
  "message": "user created",
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": "message"
}
```

## Full test flow

Start the app:

```bash
vix dev
```

Check root and health:

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
```

List users:

```bash
curl http://127.0.0.1:8080/users
```

Create user:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com","active":true}'
```

List again:

```bash
curl http://127.0.0.1:8080/users
```

Update user:

```bash
curl -X PUT http://127.0.0.1:8080/users/4 \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard Updated","email":"gaspard.updated@example.com","active":true}'
```

Read user:

```bash
curl http://127.0.0.1:8080/users/4
```

Delete user:

```bash
curl -i -X DELETE http://127.0.0.1:8080/users/4
```

Check missing user:

```bash
curl -i http://127.0.0.1:8080/users/4
```

Schedule job:

```bash
curl -X POST http://127.0.0.1:8080/jobs
```

Missing route:

```bash
curl -i http://127.0.0.1:8080/missing
```

## Best practices

### Keep `main()` small

Good:

```cpp
register_middleware(app);
register_routes(app);
register_error_handlers(app);
```

### Use helpers for repeated logic

Good helpers:

```txt
to_json()
users_to_json()
json_error()
parse_id()
find_user_index_by_id()
```

### Validate request bodies

Always validate JSON before reading fields.

```cpp
if (!body.contains("name"))
{
  json_error(ctx, cnerium::http::Status::bad_request, "name is required");
  return;
}
```

### Use correct HTTP status codes

Use:

```txt
200 OK                 successful read or update
201 Created            successful create or job schedule
204 No Content         successful delete
400 Bad Request        invalid input
404 Not Found          missing resource or route
500 Internal Server Error unexpected failure
```

### Use middleware for cross-cutting behavior

Good middleware:

```txt
headers
logging
auth
CORS
timing
maintenance mode
```

### Copy data before background tasks

Good:

```cpp
std::string path(ctx.path());

app.runtime().post([path]()
{
  vix::console.info(path);
});
```

Avoid:

```cpp
app.runtime().post([&ctx]()
{
  vix::console.info(ctx.path());
});
```

### Replace in-memory storage later

This example uses:

```cpp
std::vector<User>
```

For production, replace it with:

```txt
repository
database
service layer
```

## Common mistakes

### Forgetting `Content-Type`

When sending JSON:

```bash
-H "Content-Type: application/json"
```

### Returning `200 OK` for created resources

Use:

```cpp
ctx.status(cnerium::http::Status::created)
```

### Returning a body with `204 No Content`

For delete success, use:

```cpp
ctx.response().empty(cnerium::http::Status::no_content);
```

### Capturing request context in runtime jobs

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

### Exposing internal errors in production

Log the exception:

```cpp
vix::console.error("unhandled exception:", ex.what());
```

Return a safe error:

```json
{"ok":false,"error":"internal server error"}
```

## Summary

This example builds a complete small REST-style API with Cnerium.

It includes:

```txt
GET list
GET by id
POST create
PUT update
DELETE remove
JSON validation
middleware
not-found handler
error handler
runtime background job
```

Use this as a clean starting point for small APIs.

For production, replace the in-memory vector with a repository and database.

## Next step

Continue with reference documentation.

[Open Reference](/reference/)
