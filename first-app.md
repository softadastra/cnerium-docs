# First App

This guide walks through a complete first Cnerium application.

You will build a small HTTP API with:

```txt
GET  /
GET  /health
GET  /users
GET  /users/:id
POST /users
```

You will also use:

```txt
App
AppContext
route parameters
JSON responses
JSON request body parsing
middleware
custom not-found handler
custom error handler
vix::console
```

## Goal

By the end of this guide, you will have a small in-memory users API.

The app will run on:

```txt
http://127.0.0.1:8080
```

## Create the project

Create a new Vix project:

```bash
vix new users-api
cd users-api
```

Add Cnerium:

```bash
vix add cnerium/app
```

## Create the application

Open your main source file and start with the basic includes:

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <optional>
#include <string>
#include <string_view>
#include <vector>
```

Then add the namespaces you need:

```cpp
using cnerium::app::App;
using cnerium::app::AppContext;
using cnerium::json::array;
using cnerium::json::object;
using cnerium::json::value;
```

## Define a simple model

This first app will keep users in memory.

```cpp
struct User
{
  int id{};
  std::string name;
  std::string email;
  bool active{true};
};
```

Now create a small in-memory list:

```cpp
std::vector<User> users = {
    {1, "Alice", "alice@example.com", true},
    {2, "Bob", "bob@example.com", true},
    {3, "Charlie", "charlie@example.com", false},
};

int next_user_id = 4;
```

## Convert users to JSON

Create a helper to convert one user to JSON:

```cpp
value to_json(const User &user)
{
  return object{
      {"id", user.id},
      {"name", user.name},
      {"email", user.email},
      {"active", user.active},
  };
}
```

Create another helper to convert a list of users:

```cpp
value to_json_users(const std::vector<User> &items)
{
  array result;
  result.reserve(items.size());

  for (const auto &user : items)
  {
    result.push_back(to_json(user));
  }

  return value(std::move(result));
}
```

## Find a user by id

Add a helper that returns the index of a user:

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

## Parse route ids

Route parameters are strings, so create a safe parser:

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

Then create a small helper for route parameters:

```cpp
std::optional<int> param_as_int(AppContext &ctx, std::string_view key)
{
  return parse_id(ctx.param(key));
}
```

## Return JSON errors

Create a small helper for consistent error responses:

```cpp
void json_error(AppContext &ctx,
                cnerium::http::Status status,
                std::string message)
{
  ctx.status(status).json({
      {"ok", false},
      {"error", std::move(message)},
  });
}
```

## Create the app

Now create the `main()` function:

```cpp
int main()
{
  App app;

  app.listen("127.0.0.1", 8080);
}
```

This creates the application and starts it.

Now you can add routes before `listen()`.

## Add middleware

Middleware runs before the matched route handler.

Add a simple header middleware:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

This adds the `X-App` header to every response.

## Add the root route

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.json({
      {"ok", true},
      {"name", "Cnerium Users API"},
      {"version", "0.1.0"},
      {"endpoints", array{
                        "GET /",
                        "GET /health",
                        "GET /users",
                        "GET /users/:id",
                        "POST /users",
                    }},
  });
});
```

Test it later with:

```bash
curl http://127.0.0.1:8080/
```

## Add a health route

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.json({
      {"ok", true},
      {"status", "healthy"},
      {"service", "users-api"},
      {"users_count", static_cast<int>(users.size())},
  });
});
```

Test it with:

```bash
curl http://127.0.0.1:8080/health
```

## List users

```cpp
app.get("/users", [](AppContext &ctx)
{
  ctx.json({
      {"ok", true},
      {"count", static_cast<int>(users.size())},
      {"data", to_json_users(users)},
  });
});
```

Test it with:

```bash
curl http://127.0.0.1:8080/users
```

## Get one user

Use a dynamic route parameter:

```cpp
app.get("/users/:id", [](AppContext &ctx)
{
  const auto id = param_as_int(ctx, "id");

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
      {"data", to_json(users[*index])},
  });
});
```

Test it with:

```bash
curl http://127.0.0.1:8080/users/1
curl http://127.0.0.1:8080/users/99
curl http://127.0.0.1:8080/users/abc
```

## Create a user

Now add a `POST` route.

Expected body:

```json
{
  "name": "Gaspard",
  "email": "gaspard@example.com",
  "active": true
}
```

Route:

```cpp
app.post("/users", [](AppContext &ctx)
{
  try
  {
    const value body = ctx.json();

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
        {"data", to_json(user)},
    });
  }
  catch (const std::exception &ex)
  {
    json_error(ctx, cnerium::http::Status::bad_request, ex.what());
  }
});
```

Test it:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com","active":true}'
```

## Add a custom not-found handler

Cnerium has a default `404` response, but you can customize it:

```cpp
app.set_not_found_handler([](cnerium::server::Context &ctx)
{
  ctx.status(cnerium::http::Status::not_found)
      .json({
          {"ok", false},
          {"error", "route not found"},
          {"path", std::string(ctx.path())},
      });
});
```

Test it:

```bash
curl -i http://127.0.0.1:8080/missing
```

## Add a custom error handler

Use a custom error handler to convert exceptions into JSON responses:

```cpp
app.set_error_handler([](cnerium::server::Context &ctx,
                         const std::exception &ex)
{
  ctx.status(cnerium::http::Status::internal_server_error)
      .json({
          {"ok", false},
          {"error", "internal server error"},
          {"message", ex.what()},
      });
});
```

## Complete first app

Here is the complete file:

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <optional>
#include <string>
#include <string_view>
#include <vector>

using cnerium::app::App;
using cnerium::app::AppContext;
using cnerium::json::array;
using cnerium::json::object;
using cnerium::json::value;

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

  value to_json(const User &user)
  {
    return object{
        {"id", user.id},
        {"name", user.name},
        {"email", user.email},
        {"active", user.active},
    };
  }

  value to_json_users(const std::vector<User> &items)
  {
    array result;
    result.reserve(items.size());

    for (const auto &user : items)
    {
      result.push_back(to_json(user));
    }

    return value(std::move(result));
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

  std::optional<int> param_as_int(AppContext &ctx, std::string_view key)
  {
    return parse_id(ctx.param(key));
  }

  void json_error(AppContext &ctx,
                  cnerium::http::Status status,
                  std::string message)
  {
    ctx.status(status).json({
        {"ok", false},
        {"error", std::move(message)},
    });
  }

} // namespace

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
        {"name", "Cnerium Users API"},
        {"version", "0.1.0"},
        {"endpoints", array{
                          "GET /",
                          "GET /health",
                          "GET /users",
                          "GET /users/:id",
                          "POST /users",
                      }},
    });
  });

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
        {"ok", true},
        {"status", "healthy"},
        {"service", "users-api"},
        {"users_count", static_cast<int>(users.size())},
    });
  });

  app.get("/users", [](AppContext &ctx)
  {
    ctx.json({
        {"ok", true},
        {"count", static_cast<int>(users.size())},
        {"data", to_json_users(users)},
    });
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    const auto id = param_as_int(ctx, "id");

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
        {"data", to_json(users[*index])},
    });
  });

  app.post("/users", [](AppContext &ctx)
  {
    try
    {
      const value body = ctx.json();

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
          {"data", to_json(user)},
      });
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
            {"path", std::string(ctx.path())},
        });
  });

  app.set_error_handler([](cnerium::server::Context &ctx,
                           const std::exception &ex)
  {
    ctx.status(cnerium::http::Status::internal_server_error)
        .json({
            {"ok", false},
            {"error", "internal server error"},
            {"message", ex.what()},
        });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("Users API is ready");
  });
}
```

## Run the app

Start development mode:

```bash
vix dev
```

Or run manually:

```bash
vix run
```

## Test the app

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

Create a user:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com","active":true}'
```

Missing route:

```bash
curl -i http://127.0.0.1:8080/missing
```

## What happened

This app uses `App` as the high-level entry point.

```cpp
App app;
```

It registers routes:

```cpp
app.get("/", handler);
app.get("/users/:id", handler);
app.post("/users", handler);
```

It reads route parameters:

```cpp
ctx.param("id");
```

It returns JSON:

```cpp
ctx.json({
  {"ok", true}
});
```

It parses JSON request bodies:

```cpp
auto body = ctx.json();
```

It sets HTTP status codes:

```cpp
ctx.status(cnerium::http::Status::created);
```

It adds middleware:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

And it starts the server:

```cpp
app.listen("127.0.0.1", 8080);
```

## Next step

Continue with the guide section.

[Open the Project Structure guide](/guide/project-structure)
