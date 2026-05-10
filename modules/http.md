# HTTP

`cnerium::http` provides the core HTTP primitives used by Cnerium.

It defines:

```txt
HTTP methods
HTTP status codes
headers
request objects
response objects
JSON request helpers
JSON response helpers
```

The HTTP module does not run a server by itself.

It provides the request and response types used by higher-level modules like:

```txt
cnerium/router
cnerium/middleware
cnerium/server
cnerium/app
```

## Package

```txt
cnerium/http
```

Current version:

```txt
0.7.0
```

Package metadata:

```json
{
  "name": "http",
  "namespace": "cnerium",
  "version": "0.7.0",
  "type": "header-only",
  "include": "include",
  "license": "MIT",
  "description": "HTTP primitives for the Cnerium web framework. Provides methods, status codes, headers, request and response objects.",
  "repository": "https://github.com/cnerium/http",
  "deps": [
    {
      "id": "cnerium/json",
      "version": "0.4.0"
    }
  ]
}
```

## Install

```bash
vix add cnerium/http
```

For normal Cnerium applications, install the app layer instead:

```bash
vix add cnerium/app
```

`cnerium/app` pulls the HTTP module through the framework dependency chain.

## Include

Use the main public header:

```cpp
#include <cnerium/http/http.hpp>
```

This gives access to:

```txt
version.hpp
Method.hpp
Status.hpp
HeaderMap.hpp
Request.hpp
Response.hpp
```

## Namespace

```cpp
using namespace cnerium::http;
```

Or use fully qualified names:

```cpp
cnerium::http::Request req;
cnerium::http::Response res;
```

## Basic request and response

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Request req;
  req.set_method(Method::Post);
  req.set_path("/users");
  req.set_header("Content-Type", "application/json");
  req.set_body(R"({"name":"Gaspard","age":25})");

  vix::print("Request");
  vix::print("method:", to_string(req.method()));
  vix::print("path:", req.path());
  vix::print("type:", req.header("Content-Type"));
  vix::print("body:", req.body());

  auto payload = req.json();

  Response res;
  res.set_status(Status::created);
  res.json({
    {"ok", true},
    {"message", "User created"},
    {"user", {
      {"name", payload["name"]},
      {"age", payload["age"]}
    }}
  }, true);

  vix::print();
  vix::print("Response");
  vix::print("status:", to_int(res.status()), reason_phrase(res.status()));
  vix::print("type:", res.header("Content-Type"));
  vix::print(res.body());
}
```

## HTTP methods

The `Method` enum represents HTTP methods.

Common values:

```cpp
Method::Get
Method::Post
Method::Put
Method::Patch
Method::Delete
Method::Head
Method::Options
Method::Trace
Method::Connect
Method::Unknown
```

## Convert method to string

```cpp
to_string(Method::Get);   // "GET"
to_string(Method::Post);  // "POST"
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  vix::print(to_string(Method::Get));
  vix::print(to_string(Method::Post));
}
```

## Parse method from string

```cpp
method_from_string("GET");   // Method::Get
method_from_string("POST");  // Method::Post
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  auto method = method_from_string("POST");

  if (method == Method::Post)
  {
    vix::print("POST method");
  }
}
```

## Method helpers

The HTTP module provides method classification helpers.

```cpp
is_known(Method::Get);
has_request_body(Method::Post);
is_safe(Method::Get);
is_idempotent(Method::Put);
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  vix::print("GET safe:", is_safe(Method::Get));
  vix::print("POST has body:", has_request_body(Method::Post));
  vix::print("PUT idempotent:", is_idempotent(Method::Put));
}
```

## HTTP status codes

The `Status` enum represents HTTP response status codes.

Common values:

```cpp
Status::ok
Status::created
Status::no_content
Status::bad_request
Status::unauthorized
Status::forbidden
Status::not_found
Status::method_not_allowed
Status::internal_server_error
Status::service_unavailable
```

## Convert status to integer

```cpp
to_int(Status::ok);       // 200
to_int(Status::created);  // 201
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  vix::print(to_int(Status::ok));
  vix::print(to_int(Status::created));
}
```

## Reason phrase

Use `reason_phrase()` to get the standard HTTP reason phrase.

```cpp
reason_phrase(Status::ok);       // "OK"
reason_phrase(Status::created);  // "Created"
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  vix::print(to_int(Status::not_found), reason_phrase(Status::not_found));
}
```

Output:

```txt
404 Not Found
```

## Status classification

The HTTP module provides helpers to classify status codes.

```cpp
is_informational(Status::continue_);
is_success(Status::ok);
is_redirection(Status::moved_permanently);
is_client_error(Status::bad_request);
is_server_error(Status::internal_server_error);
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  vix::print("200 success:", is_success(Status::ok));
  vix::print("404 client error:", is_client_error(Status::not_found));
  vix::print("500 server error:", is_server_error(Status::internal_server_error));
}
```

## Headers

`HeaderMap` stores HTTP headers.

It supports case-insensitive lookup while preserving simple insertion behavior.

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  HeaderMap headers;

  headers.set("Content-Type", "application/json");
  headers.set("X-App", "Cnerium");

  vix::print(headers.get("Content-Type"));
  vix::print(headers.get("content-type"));
  vix::print(headers.get("CONTENT-TYPE"));
}
```

All three lookups refer to the same header.

## Header operations

Common operations:

```cpp
headers.set("Content-Type", "application/json");
headers.get("Content-Type");
headers.contains("Content-Type");
headers.erase("Content-Type");
headers.clear();
headers.empty();
headers.size();
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  HeaderMap headers;

  headers.set("Content-Type", "application/json");
  headers.set("X-App", "Cnerium");

  if (headers.contains("content-type"))
  {
    vix::print("content type:", headers.get("CONTENT-TYPE"));
  }

  headers.erase("X-App");

  vix::print("header count:", headers.size());
}
```

## Iterate headers

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  HeaderMap headers;

  headers.set("Content-Type", "application/json");
  headers.set("X-App", "Cnerium");

  for (const auto &[name, value] : headers)
  {
    vix::print(name, "=", value);
  }
}
```

## Request

`Request` represents an HTTP request.

It stores:

```txt
method
path
query
headers
body
```

Example:

```cpp
Request req;

req.set_method(Method::Post);
req.set_path("/users");
req.set_query("active=true");
req.set_header("Content-Type", "application/json");
req.set_body(R"({"name":"Gaspard"})");
```

## Request method

```cpp
req.set_method(Method::Post);
auto method = req.method();
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Request req;

  req.set_method(Method::Post);

  vix::print(to_string(req.method()));
}
```

## Request path

```cpp
req.set_path("/users");
auto path = req.path();
```

Example:

```cpp
Request req;
req.set_path("/users");

vix::print(req.path());
```

## Request query

```cpp
req.set_query("page=1&active=true");
auto query = req.query();
```

Example:

```cpp
Request req;

req.set_path("/users");
req.set_query("page=1");

vix::print(req.path());
vix::print(req.query());
```

## Request target

The target combines path and query.

```cpp
Request req;

req.set_path("/users");
req.set_query("page=1");

vix::print(req.target());
```

Expected:

```txt
/users?page=1
```

If there is no query, target is just the path.

## Request headers

```cpp
req.set_header("Content-Type", "application/json");
auto type = req.header("Content-Type");
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Request req;

  req.set_header("Content-Type", "application/json");

  vix::print(req.header("content-type"));
}
```

## Request body

```cpp
req.set_body(R"({"name":"Gaspard"})");
auto body = req.body();
```

Example:

```cpp
Request req;

req.set_body("Hello");

vix::print(req.body());
```

## Parse request body as JSON

`Request::json()` parses the body with `cnerium::json`.

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Request req;

  req.set_header("Content-Type", "application/json");
  req.set_body(R"({"name":"Gaspard","age":25})");

  auto body = req.json();

  vix::print(body["name"].as_string());
  vix::print(body["age"].as_int());
}
```

Invalid JSON can throw, so use `try/catch` for client input.

```cpp
try
{
  auto body = req.json();
}
catch (const std::exception &ex)
{
  vix::print("invalid JSON:", ex.what());
}
```

## Response

`Response` represents an HTTP response.

It stores:

```txt
status
headers
body
```

Example:

```cpp
Response res;

res.set_status(Status::created);
res.set_header("X-App", "Cnerium");
res.text("Created");
```

## Response status

```cpp
res.set_status(Status::created);
auto status = res.status();
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Response res;

  res.set_status(Status::created);

  vix::print(to_int(res.status()), reason_phrase(res.status()));
}
```

## Response headers

```cpp
res.set_header("X-App", "Cnerium");
auto value = res.header("X-App");
```

Example:

```cpp
Response res;

res.set_header("X-App", "Cnerium");

vix::print(res.header("x-app"));
```

## Text response

Use `text()` to build a plain text response.

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Response res;

  res.text("Hello from Cnerium");

  vix::print(res.header("Content-Type"));
  vix::print(res.body());
}
```

## HTML response

Use `html()` to build an HTML response.

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Response res;

  res.html("<h1>Hello from Cnerium</h1>");

  vix::print(res.header("Content-Type"));
  vix::print(res.body());
}
```

## JSON response

Use `json()` to build a JSON response.

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Response res;

  res.json({
    {"ok", true},
    {"framework", "Cnerium"}
  });

  vix::print(res.header("Content-Type"));
  vix::print(res.body());
}
```

JSON responses set the content type to:

```txt
application/json; charset=utf-8
```

## Pretty JSON response

Pass `true` to generate pretty JSON.

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Response res;

  res.json({
    {"ok", true},
    {"framework", "Cnerium"}
  }, true);

  vix::print(res.body());
}
```

## Success response

Use `ok()` for a simple success response.

```cpp
Response res;

res.ok("created");
```

This is useful for small examples or simple success messages.

## Error response

Use `error()` to build an error response.

```cpp
Response res;

res.error(Status::bad_request, "invalid request");
```

Example:

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Response res;

  res.error(Status::bad_request, "invalid request");

  vix::print(to_int(res.status()), reason_phrase(res.status()));
  vix::print(res.body());
}
```

## Empty response

Use `empty()` for responses with no body.

```cpp
Response res;

res.empty(Status::no_content);
```

This is useful for `204 No Content`.

## Complete standalone example

```cpp
#include <cnerium/http/http.hpp>
#include <vix/print.hpp>

using namespace cnerium::http;

int main()
{
  Request req;

  req.set_method(Method::Post);
  req.set_path("/users");
  req.set_query("notify=true");
  req.set_header("Content-Type", "application/json");
  req.set_body(R"({"name":"Gaspard","age":25})");

  auto body = req.json();

  Response res;

  res.set_status(Status::created);
  res.set_header("X-App", "Cnerium");
  res.json({
    {"ok", true},
    {"message", "user created"},
    {"target", std::string(req.target())},
    {"user", {
      {"name", body["name"]},
      {"age", body["age"]}
    }}
  }, true);

  vix::print("method:", to_string(req.method()));
  vix::print("target:", req.target());
  vix::print("status:", to_int(res.status()), reason_phrase(res.status()));
  vix::print("type:", res.header("Content-Type"));
  vix::print(res.body());
}
```

## Use HTTP in Cnerium App

In high-level app code, HTTP types appear through `AppContext`.

Example:

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
    auto body = ctx.json();

    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"name", body["name"]}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("HTTP module app example is ready");
  });
}
```

## Request helpers in AppContext

`AppContext` wraps lower-level HTTP request access.

```cpp
ctx.method();
ctx.path();
ctx.query();
ctx.header("Content-Type");
ctx.body();
ctx.json();
ctx.request();
```

Example:

```cpp
app.get("/inspect", [](AppContext &ctx)
{
  ctx.json({
    {"method", cnerium::http::to_string(ctx.method())},
    {"path", std::string(ctx.path())},
    {"query", std::string(ctx.query())},
    {"user_agent", std::string(ctx.header("User-Agent"))}
  });
});
```

## Response helpers in AppContext

`AppContext` also wraps lower-level HTTP response access.

```cpp
ctx.text("Hello");
ctx.html("<h1>Hello</h1>");
ctx.json({{"ok", true}});
ctx.status(cnerium::http::Status::created);
ctx.response();
```

Example:

```cpp
app.get("/health", [](AppContext &ctx)
{
  ctx.status(cnerium::http::Status::ok).json({
    {"ok", true},
    {"status", "healthy"}
  });
});
```

## Complete app example

```cpp
#include <cnerium/app/app.hpp>
#include <cnerium/http/Status.hpp>
#include <vix/console.hpp>

#include <string>

using namespace cnerium::app;

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
    ctx.text("HTTP module app example");
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
    ctx.status(cnerium::http::Status::created).json({
      {"ok", true},
      {"content_type", std::string(ctx.header("Content-Type"))},
      {"body", std::string(ctx.body())}
    });
  });

  app.get("/error", [](AppContext &ctx)
  {
    ctx.status(cnerium::http::Status::bad_request).json({
      {"ok", false},
      {"error", "demo error"}
    });
  });

  app.listen("127.0.0.1", 8080, []()
  {
    vix::console.info("HTTP module app example is ready");
  });
}
```

## Test the app example

```bash
curl http://127.0.0.1:8080/

curl "http://127.0.0.1:8080/inspect/42?page=1" \
  -H "User-Agent: Cnerium-Test"

curl -X POST http://127.0.0.1:8080/echo \
  -H "Content-Type: text/plain" \
  -d "hello"

curl -i http://127.0.0.1:8080/error
```

## API overview

HTTP method API:

```cpp
Method
to_string()
method_from_string()
is_known()
has_request_body()
is_safe()
is_idempotent()
```

HTTP status API:

```cpp
Status
to_int()
reason_phrase()
is_informational()
is_success()
is_redirection()
is_client_error()
is_server_error()
```

Header API:

```cpp
HeaderMap
set()
get()
contains()
erase()
clear()
empty()
size()
```

Request API:

```cpp
Request
set_method()
method()
set_path()
path()
set_query()
query()
target()
set_header()
header()
headers()
set_body()
body()
json()
```

Response API:

```cpp
Response
set_status()
status()
set_header()
header()
headers()
set_body()
body()
text()
html()
json()
ok()
error()
empty()
```

## Best practices

### Use AppContext in normal applications

For most app code, prefer:

```cpp
ctx.method();
ctx.path();
ctx.header("Content-Type");
ctx.json();
ctx.text("Hello");
ctx.status(Status::created).json(...);
```

Use `Request` and `Response` directly when building lower-level utilities, tests, or framework internals.

### Use correct status codes

Good:

```cpp
ctx.status(cnerium::http::Status::created).json({
  {"ok", true}
});
```

Avoid returning `200 OK` for errors.

### Use JSON for API responses

Good success shape:

```json
{"ok":true,"data":{}}
```

Good error shape:

```json
{"ok":false,"error":"message"}
```

### Set global headers in middleware

Instead of repeating headers in every route:

```cpp
app.use([](auto &ctx, auto next)
{
  ctx.response().set_header("X-App", "Cnerium");
  next();
});
```

### Catch JSON parsing errors

When parsing client bodies:

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

## Common mistakes

### Confusing path and query

For:

```txt
/users?page=1
```

The path is:

```txt
/users
```

The query is:

```txt
page=1
```

### Forgetting that header lookup is case-insensitive

These should refer to the same header:

```cpp
header("Content-Type")
header("content-type")
header("CONTENT-TYPE")
```

### Returning a body with `204 No Content`

For no-body responses, use:

```cpp
ctx.response().empty(cnerium::http::Status::no_content);
```

### Using low-level `Request` and `Response` everywhere

In normal apps, use `AppContext`.

Low-level HTTP objects are mainly useful for modules, tests, and advanced control.

## Summary

`cnerium::http` provides the HTTP foundation of Cnerium.

It includes:

```txt
Method
Status
HeaderMap
Request
Response
```

Use it directly for low-level HTTP work.

Use it through `AppContext` in normal Cnerium applications.

## Next step

Continue with the Router module.

[Open Router module](/modules/router)
