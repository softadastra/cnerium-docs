# JSON

Cnerium includes a JSON module through `cnerium::json`.

It is used by the framework to parse request bodies, build JSON responses, validate data, and work with structured values.

In most Cnerium applications, you use JSON through `AppContext`:

```cpp
ctx.json({
  {"ok", true},
  {"message", "Hello from Cnerium"}
});
```

And for request bodies:

```cpp
auto body = ctx.json();
```

## Include

For high-level application code, include the app module:

```cpp
#include <cnerium/app/app.hpp>
```

For direct JSON usage, include the JSON module:

```cpp
#include <cnerium/json/json.hpp>
```

Example:

```cpp
#include <cnerium/json/json.hpp>
#include <vix::print.hpp>
```

> In normal Cnerium application examples, prefer `vix::console` for logs and `vix::print` for simple output examples.

## Basic JSON response

```cpp
#include <cnerium/app/app.hpp>
#include <vix/console.hpp>

using namespace cnerium::app;

int main()
{
  App app;

  app.get("/health", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"status", "healthy"},
      {"framework", "Cnerium"}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("JSON guide example is ready");
  });
}
```

Run:

```bash
vix dev
```

Test:

```bash
curl http://127.0.0.1:8080/health
```

Expected response:

```json
{"ok":true,"status":"healthy","framework":"Cnerium"}
```

## JSON values

The main JSON type is:

```cpp
cnerium::json::value
```

You can create values manually:

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value data = {
    {"name", "Gaspard"},
    {"age", 25},
    {"active", true}
  };

  vix::print(data.dump(true));
}
```

`dump()` serializes the JSON value.

```cpp
data.dump();      // compact JSON
data.dump(true);  // pretty JSON
```

## Objects and arrays

Cnerium JSON provides `object` and `array`.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value data = object{
    {"name", "Cnerium"},
    {"features", array{
      "routing",
      "middleware",
      "json",
      "runtime"
    }},
    {"meta", object{
      {"version", "0.1.0"},
      {"active", true}
    }}
  };

  vix::print(data.dump(true));
}
```

Use `object` for JSON objects and `array` for JSON arrays.

## JSON in route handlers

You can build JSON directly inside a route:

```cpp
app.get("/", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"name", "Cnerium API"},
    {"version", "0.1.0"}
  });
});
```

For nested data:

```cpp
app.get("/info", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"app", {
      {"name", "Cnerium"},
      {"version", "0.1.0"}
    }},
    {"features", cnerium::json::array{
      "HTTP",
      "Router",
      "Middleware",
      "Runtime"
    }}
  });
});
```

## Pretty JSON responses

For most APIs, compact JSON is recommended.

For debugging or examples, you may want pretty output.

Depending on the response helper being used, the lower-level response API supports pretty JSON:

```cpp
ctx.response().json({
  {"ok", true},
  {"framework", "Cnerium"}
}, true);
```

This produces formatted JSON.

## Parse JSON strings

Use `parse()` to parse a JSON string:

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  std::string input = R"({"name":"Ada","score":99.5})";

  value data = parse(input);

  vix::print(data["name"].as_string());
  vix::print(data["score"].as_double());
}
```

## Read JSON request body

In an app route, use `ctx.json()`:

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

Parsing invalid JSON can throw.

Use `try/catch` for client input:

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

## Parse errors with line and column

When using the JSON module directly, you can catch `parse_error`:

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  try
  {
    auto data = parse(R"({"x": 1,})");
  }
  catch (const parse_error &e)
  {
    vix::print(
      "Parse error:",
      e.what(),
      "line:",
      e.line,
      "column:",
      e.column
    );
  }
}
```

This is useful for debugging invalid JSON input.

## Typed access

After parsing JSON, use typed accessors:

```cpp
auto name = data["name"].as_string();
auto age = data["age"].as_int();
auto score = data["score"].as_double();
auto active = data["active"].as_bool();
```

Example:

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value data = parse(R"({
    "name": "Ada",
    "age": 20,
    "score": 99.5,
    "active": true
  })");

  vix::print(data["name"].as_string());
  vix::print(data["age"].as_int());
  vix::print(data["score"].as_double());
  vix::print(data["active"].as_bool());
}
```

## Validate required fields

When reading JSON from a client, validate required fields.

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

## Arrays

Use `array` for JSON arrays:

```cpp
app.get("/skills", [](AppContext &ctx)
{
  ctx.json({
    {"ok", true},
    {"skills", cnerium::json::array{
      "C++",
      "Vix",
      "Cnerium"
    }}
  });
});
```

You can also manipulate arrays directly:

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value data = object{
    {"skills", array{"C++", "Rust", "Go"}},
    {"scores", array{10, 20, 30}}
  };

  data["skills"].push_back("Python");

  for (const auto &skill : data["skills"].as_array())
  {
    vix::print(skill.as_string());
  }
}
```

## Convert STL containers to JSON

The JSON module can convert common STL containers.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

#include <map>
#include <string>
#include <vector>

using namespace cnerium::json;

int main()
{
  std::vector<int> numbers = {1, 2, 3};
  value values = from_vector(numbers);

  auto back = to_vector<int>(values);

  for (auto x : back)
  {
    vix::print(x);
  }

  std::map<std::string, int> scores = {
    {"alice", 10},
    {"bob", 20}
  };

  value obj = from_map(scores);

  vix::print(obj.dump(true));
}
```

This is useful when returning collections from services.

## Return a list from a route

Example with users:

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/json/json.hpp>
#include <vix/console.hpp>

#include <string>
#include <vector>

using namespace cnerium::app;

namespace
{
  struct User
  {
    int id{};
    std::string name;
  };

  cnerium::json::value to_json(const User &user)
  {
    return cnerium::json::object{
      {"id", user.id},
      {"name", user.name}
    };
  }

  cnerium::json::value users_to_json(const std::vector<User> &users)
  {
    cnerium::json::array result;

    for (const auto &user : users)
    {
      result.push_back(to_json(user));
    }

    return result;
  }
}

int main()
{
  App app;

  std::vector<User> users = {
    {1, "Alice"},
    {2, "Bob"}
  };

  app.get("/users", [&users](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"count", static_cast<int>(users.size())},
      {"data", users_to_json(users)}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("JSON users example is ready");
  });
}
```

## JSON Pointer

Use `json_pointer()` to access nested values with a JSON Pointer path.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  auto data = parse(R"({
    "user": {
      "addresses": [
        {"city": "Paris"},
        {"city": "Berlin"}
      ]
    }
  })");

  const auto &city = json_pointer(data, "/user/addresses/1/city");

  vix::print(city.as_string());
}
```

Expected output:

```txt
Berlin
```

## Merge Patch

Use `merge_patch()` to apply a JSON Merge Patch.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value dst = parse(R"({"name":"Ada","age":20})");
  value patch = parse(R"({"age":21,"city":"Paris"})");

  merge_patch(dst, patch);

  vix::print(dst.dump(true));
}
```

Result:

```json
{
  "age": 21,
  "city": "Paris",
  "name": "Ada"
}
```

## Diff and patch

Use `diff()` to generate a patch between two values.

Use `apply_patch()` to apply it.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value a = parse(R"({"x":1,"y":2})");
  value b = parse(R"({"x":1,"y":3,"z":4})");

  auto patch = diff(a, b);

  for (const auto &op : patch)
  {
    vix::print(op.dump());
  }

  apply_patch(a, patch);

  vix::print(a.dump(true));
}
```

This is useful when you need to represent changes between two JSON values.

## NDJSON

NDJSON is newline-delimited JSON.

Each line is an independent JSON value.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  std::string input = R"(
{"a":1}
{"b":2}
invalid
{"c":3}
)";

  auto result = parse_ndjson(input);

  for (auto &value : result.values)
  {
    vix::print(value.dump());
  }

  for (auto &[line, error] : result.errors)
  {
    vix::print("Line", line, ":", error);
  }
}
```

NDJSON parsing can keep valid lines while reporting invalid ones.

## Streaming parser

Use `streaming_parser` when JSON arrives in chunks.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

#include <cstring>

using namespace cnerium::json;

int main()
{
  streaming_parser parser;

  const char *part1 = "{\"a\":1";
  const char *part2 = ",\"b\":2}";

  parser.feed(part1, std::strlen(part1));

  auto result = parser.feed(part2, std::strlen(part2));

  if (result)
  {
    vix::print(result->dump(true));
  }
}
```

This is useful for incremental input and streaming protocols.

## Extract JSON body from HTTP text

The JSON module also includes a helper to extract an HTTP body from a raw HTTP response-like string.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  std::string http =
      "HTTP/1.1 200 OK\r\n"
      "Content-Type: application/json\r\n\r\n"
      "{\"status\":\"ok\",\"data\":123}";

  auto body = extract_http_body(http);

  if (body)
  {
    auto data = parse(*body);
    vix::print(data["status"].as_string());
  }
}
```

In normal Cnerium apps, request parsing is handled by the server layer.
This helper is useful for lower-level examples or tools.

## Schema validation

You can define a simple schema and validate a JSON value.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value data = parse(R"({"name":"Ada","age":20})");

  schema_node schema = schema_node::object_node(true);
  schema.children = {
    {"name", schema_node::string_node(true)},
    {"age", schema_node::integer_node(true)}
  };

  auto error = validate(data, schema);

  if (error.empty())
  {
    vix::print("Valid");
  }
  else
  {
    vix::print("Error:", error);
  }
}
```

This is useful for validating structured input.

## Complete example

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
    {2, "Bob", "bob@example.com", true}
  };

  int next_user_id = 3;

  cnerium::json::value to_json(const User &user)
  {
    return cnerium::json::object{
      {"id", user.id},
      {"name", user.name},
      {"email", user.email},
      {"active", user.active}
    };
  }

  cnerium::json::value to_json_users(const std::vector<User> &items)
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

  void json_error(AppContext &ctx,
                  cnerium::http::Status status,
                  std::string message)
  {
    ctx.status(status).json({
      {"ok", false},
      {"error", std::move(message)}
    });
  }
}

int main()
{
  App app;

  app.get("/", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"message", "JSON guide example"}
    });
  });

  app.get("/users", [](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"count", static_cast<int>(users.size())},
      {"data", to_json_users(users)}
    });
  });

  app.get("/users/:id", [](AppContext &ctx)
  {
    const auto id = parse_id(ctx.param("id"));

    if (!id)
    {
      json_error(ctx, cnerium::http::Status::bad_request, "invalid user id");
      return;
    }

    for (const auto &user : users)
    {
      if (user.id == *id)
      {
        ctx.json({
          {"ok", true},
          {"data", to_json(user)}
        });
        return;
      }
    }

    json_error(ctx, cnerium::http::Status::not_found, "user not found");
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
          "request body must be a JSON object"
        );
        return;
      }

      if (!body.contains("name") || !body.contains("email"))
      {
        json_error(
          ctx,
          cnerium::http::Status::bad_request,
          "fields 'name' and 'email' are required"
        );
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
        {"data", to_json(user)}
      });
    }
    catch (const std::exception &ex)
    {
      json_error(ctx, cnerium::http::Status::bad_request, ex.what());
    }
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("JSON guide example is ready");
  });
}
```

## Test the example

```bash
curl http://127.0.0.1:8080/

curl http://127.0.0.1:8080/users

curl http://127.0.0.1:8080/users/1

curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com","active":true}'
```

Invalid JSON:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":}'
```

Missing fields:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard"}'
```

## Best practices

### Use JSON for APIs

For API routes, return JSON consistently:

```cpp
ctx.json({
  {"ok", true},
  {"data", data}
});
```

For errors:

```cpp
ctx.status(cnerium::http::Status::bad_request).json({
  {"ok", false},
  {"error", "invalid request"}
});
```

### Validate client input

Never assume a request body contains valid JSON or required fields.

Always check:

```cpp
body.is_object()
body.contains("name")
```

### Catch parsing errors

Use `try/catch` when reading JSON from clients:

```cpp
try
{
  auto body = ctx.json();
}
catch (const std::exception &ex)
{
  // return 400
}
```

### Keep JSON conversion helpers separate

For larger apps, create helpers like:

```cpp
to_json(user)
to_json_users(users)
```

This keeps route handlers clean.

### Convert route parameters explicitly

When returning route parameters in JSON:

```cpp
{"id", std::string(ctx.param("id"))}
```

### Prefer compact JSON for APIs

Use pretty JSON for examples, debugging, or tools.

Use compact JSON for normal API responses.

## Summary

Cnerium uses `cnerium::json` for JSON support.

Use `ctx.json()` to return JSON responses.

Use `ctx.json()` to parse JSON request bodies.

Use `cnerium::json::value`, `object`, and `array` for direct JSON construction.

Use `parse()` when parsing strings manually.

Use `try/catch` and validation for client input.

## Next step

Continue with middleware.

[Open Middleware](/guide/middleware)
