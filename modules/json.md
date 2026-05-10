# JSON

`cnerium::json` is the JSON module of Cnerium.

It provides a high-performance, header-only JSON parser and serializer for C++20.

Use it when you need to:

```txt
build JSON values
parse JSON strings
serialize JSON
read typed values
work with arrays and objects
convert STL containers
handle parse errors
use JSON Pointer
apply merge patches
generate and apply patches
parse NDJSON
parse JSON streams
validate JSON with schemas
```

## Package

```txt
cnerium/json
```

Current version:

```txt
0.4.0
```

Package metadata:

```json
{
  "name": "json",
  "namespace": "cnerium",
  "version": "0.4.0",
  "type": "header-only",
  "include": "include",
  "license": "Apache-2.0",
  "description": "High-performance header-only JSON parser and serializer for C++20.",
  "repository": "https://github.com/cnerium/json"
}
```

## Install

```bash
vix add cnerium/json
```

For normal Cnerium applications, you usually install the app layer instead:

```bash
vix add cnerium/app
```

`cnerium/app` pulls the JSON module through the framework dependency chain.

## Include

```cpp
#include <cnerium/json/json.hpp>
```

Most examples in this page also use:

```cpp
#include <vix/print.hpp>
```

for output.

## Namespace

```cpp
using namespace cnerium::json;
```

Or use fully qualified names:

```cpp
cnerium::json::value data;
```

## Basic value

The main JSON type is:

```cpp
cnerium::json::value
```

Example:

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value data = {
      {"name", "Gaspard"},
      {"age", 25},
      {"active", true}};

  vix::print(data.dump(true));
}
```

`dump(true)` prints formatted JSON.

## Serialize JSON

Use `dump()` to serialize a JSON value.

```cpp
value data = {
    {"name", "Gaspard"},
    {"age", 25},
    {"active", true}};

vix::print(data.dump());
vix::print(data.dump(true));
```

Compact output:

```json
{"active":true,"age":25,"name":"Gaspard"}
```

Pretty output:

```json
{
  "active": true,
  "age": 25,
  "name": "Gaspard"
}
```

## Objects

Use `object` to build a JSON object explicitly.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value user = object{
      {"name", "Ada"},
      {"age", 20},
      {"active", true}};

  vix::print(user.dump(true));
}
```

## Arrays

Use `array` to build a JSON array.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value data = object{
      {"skills", array{"C++", "Rust", "Go"}},
      {"scores", array{10, 20, 30}}};

  data["skills"].push_back("Python");

  for (const auto &skill : data["skills"].as_array())
  {
    vix::print(skill.as_string());
  }
}
```

## Nested values

You can nest objects and arrays.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value data = object{
      {"framework", "Cnerium"},
      {"runtime", "Vix"},
      {"features", array{
                       "HTTP",
                       "JSON",
                       "Router",
                       "Middleware"}},
      {"meta", object{
                   {"version", "0.4.0"},
                   {"active", true}}}};

  vix::print(data.dump(true));
}
```

## Parse JSON

Use `parse()` to parse a JSON string.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  std::string json = R"({"name":"Ada","score":99.5})";

  value data = parse(json);

  vix::print(data["name"].as_string());
  vix::print(data["score"].as_double());
}
```

## Typed access

Use typed accessors to read values.

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

  vix::print("name:", data["name"].as_string());
  vix::print("age:", data["age"].as_int());
  vix::print("score:", data["score"].as_double());
  vix::print("active:", data["active"].as_bool());
}
```

## Check object fields

Use `contains()` before reading optional fields.

```cpp
value data = parse(R"({"name":"Ada","age":20})");

if (data.contains("name"))
{
  vix::print(data["name"].as_string());
}
```

This is useful when validating client input.

## Validate object shape manually

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

using namespace cnerium::json;

int main()
{
  value body = parse(R"({"name":"Gaspard","email":"gaspard@example.com"})");

  if (!body.is_object())
  {
    vix::print("body must be an object");
    return 1;
  }

  if (!body.contains("name") || !body.contains("email"))
  {
    vix::print("name and email are required");
    return 1;
  }

  vix::print("valid user:", body["name"].as_string());
}
```

## Parse errors

Invalid JSON throws `parse_error`.

`parse_error` provides the error message, line, and column.

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
        e.column);
  }
}
```

## Use JSON in Cnerium routes

Most applications use JSON through `AppContext`.

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
    vix::console.info("JSON route example is ready");
  });
}
```

## Parse JSON request body

Inside a Cnerium route, use `ctx.json()`.

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

For client input, wrap it in `try/catch`.

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

## STL vector conversion

Use `from_vector()` and `to_vector<T>()`.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

#include <vector>

using namespace cnerium::json;

int main()
{
  std::vector<int> numbers = {1, 2, 3};

  value data = from_vector(numbers);

  auto back = to_vector<int>(data);

  for (auto x : back)
  {
    vix::print(x);
  }
}
```

## STL map conversion

Use `from_map()` for maps.

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

#include <map>
#include <string>

using namespace cnerium::json;

int main()
{
  std::map<std::string, int> scores = {
      {"alice", 10},
      {"bob", 20}};

  value data = from_map(scores);

  vix::print(data.dump(true));
}
```

## Vector and map example

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

#include <map>
#include <string>
#include <vector>

using namespace cnerium::json;

int main()
{
  std::vector<int> vec = {1, 2, 3};
  value v = from_vector(vec);

  auto back = to_vector<int>(v);

  for (auto x : back)
  {
    vix::print(x);
  }

  std::map<std::string, int> m = {{"a", 1}, {"b", 2}};
  value obj = from_map(m);

  vix::print(obj.dump(true));
}
```

## JSON Pointer

Use `json_pointer()` to access nested data with a pointer path.

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

Use `diff()` to generate a patch between two JSON values.

Use `apply_patch()` to apply the patch.

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

This is useful when you need to represent changes between two JSON documents.

## NDJSON

NDJSON means newline-delimited JSON.

Each line is parsed as an independent JSON value.

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

This allows valid lines to be kept while invalid lines are reported.

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

This is useful for incremental input, sockets, streams, and protocols where data arrives in pieces.

## Extract HTTP body

The JSON module includes `extract_http_body()`.

It extracts the body from a raw HTTP-like message.

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

Use this helper for lower-level tools or examples.

## Schema validation

Use `schema_node` and `validate()` for simple schema validation.

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
      {"age", schema_node::integer_node(true)}};

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

## Complete standalone example

```cpp
#include <cnerium/json/json.hpp>
#include <vix/print.hpp>

#include <map>
#include <string>
#include <vector>

using namespace cnerium::json;

int main()
{
  value user = object{
      {"name", "Gaspard"},
      {"age", 25},
      {"active", true},
      {"skills", array{"C++", "Vix", "Cnerium"}}};

  vix::print("user:");
  vix::print(user.dump(true));

  std::vector<int> numbers = {1, 2, 3};
  value list = from_vector(numbers);

  vix::print("numbers:");
  vix::print(list.dump());

  std::map<std::string, int> scores = {
      {"alice", 10},
      {"bob", 20}};

  value score_object = from_map(scores);

  vix::print("scores:");
  vix::print(score_object.dump(true));

  auto parsed = parse(R"({"user":{"city":"Kampala"}})");
  vix::print(json_pointer(parsed, "/user/city").as_string());

  return 0;
}
```

## Complete Cnerium route example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
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
    std::string email;
  };

  cnerium::json::value to_json(const User &user)
  {
    return cnerium::json::object{
        {"id", user.id},
        {"name", user.name},
        {"email", user.email}};
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
      {1, "Alice", "alice@example.com"},
      {2, "Bob", "bob@example.com"}};

  app.get("/users", [&users](AppContext &ctx)
  {
    ctx.json({
      {"ok", true},
      {"count", static_cast<int>(users.size())},
      {"data", users_to_json(users)}
    });
  });

  app.post("/users", [&users](AppContext &ctx)
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

      User user;
      user.id = static_cast<int>(users.size()) + 1;
      user.name = body["name"].as_string();
      user.email = body["email"].as_string();

      users.push_back(user);

      ctx.status(cnerium::http::Status::created).json({
        {"ok", true},
        {"message", "user created"},
        {"data", to_json(user)}
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
    vix::console.info("JSON module route example is ready");
  });
}
```

## Test the route example

```bash
curl http://127.0.0.1:8080/users
```

Create a user:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaspard","email":"gaspard@example.com"}'
```

Invalid JSON:

```bash
curl -X POST http://127.0.0.1:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":}'
```

## API overview

Common types and functions:

```cpp
value
object
array

parse()
parse_ndjson()

json_pointer()

merge_patch()
diff()
apply_patch()

from_vector()
to_vector<T>()
from_map()

schema_node
validate()

streaming_parser

extract_http_body()
```

Common value methods:

```cpp
dump()
dump(true)

is_object()
is_array()
contains()

as_string()
as_int()
as_double()
as_bool()
as_array()

operator[]
push_back()
```

## Best practices

### Use `ctx.json()` in app routes

For route handlers, prefer:

```cpp
ctx.json({{"ok", true}});
```

and:

```cpp
auto body = ctx.json();
```

### Catch parsing errors from clients

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

### Validate required fields

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

### Keep conversion helpers separate

Good:

```cpp
to_json(user)
users_to_json(users)
```

This keeps handlers small.

### Prefer compact JSON for APIs

Use compact JSON for normal API responses.

Use pretty JSON for examples, logs, or debugging tools.

### Convert route parameters explicitly

```cpp
{"id", std::string(ctx.param("id"))}
```

## Common mistakes

### Reading missing fields without validation

Avoid:

```cpp
auto name = body["name"].as_string();
```

before checking that `name` exists.

Prefer:

```cpp
if (!body.contains("name"))
{
  // return 400
}
```

### Assuming client JSON is always valid

Always use `try/catch` around request body parsing.

### Mixing business logic with JSON conversion

Keep JSON conversion small and focused.

Business logic should live in services.

### Returning inconsistent JSON shapes

Prefer consistent API shapes:

```json
{"ok":true,"data":{}}
```

and:

```json
{"ok":false,"error":"message"}
```

## Summary

`cnerium::json` is the JSON foundation of Cnerium.

It provides:

```txt
JSON values
objects
arrays
parsing
serialization
typed access
STL conversion
JSON Pointer
merge patch
diff/patch
NDJSON
streaming parser
schema validation
```

Use it directly when needed.

In normal apps, use it through `AppContext`:

```cpp
ctx.json(...)
auto body = ctx.json()
```

## Next step

Continue with the HTTP module.

[Open HTTP module](/modules/http)
