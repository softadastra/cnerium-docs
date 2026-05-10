# vix::print

`vix::print` is a small output helper from Vix.

Cnerium documentation uses it for simple standalone examples instead of `std::cout`.

Use `vix::print` when you want quick readable output in examples, tests, small tools, and learning snippets.

For application logs, prefer:

```cpp
#include <vix/console.hpp>
```

and use:

```cpp
vix::console.info(...);
```

## Include

```cpp
#include <vix/print.hpp>
```

## Basic usage

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print("Hello from Vix");
  vix::print("name:", "Gaspard", "age:", 25);

  return 0;
}
```

Output:

```txt
Hello from Vix
name: Gaspard age: 25
```

## Print an empty line

Call `vix::print()` without arguments.

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print("line 1");
  vix::print();
  vix::print("line 2");

  return 0;
}
```

Output:

```txt
line 1

line 2
```

## Why use vix::print

`vix::print` keeps examples clean.

Instead of writing:

```cpp
std::cout << "name: " << name << " age: " << age << "\n";
```

you can write:

```cpp
vix::print("name:", name, "age:", age);
```

It is useful for:

```txt
small examples
debug snippets
CLI examples
container output
learning docs
simple test programs
```

## Print multiple values

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print("project:", "Cnerium", "version:", "0.5.0");
  vix::print("port:", 8080, "ready:", true);

  return 0;
}
```

`vix::print` separates values with a space by default.

## Custom separator

Use `vix::options`.

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print(
      vix::options{.sep = " | "},
      "red", "green", "blue");

  vix::print(
      vix::options{.sep = " -> "},
      "A", "B", "C");

  return 0;
}
```

Output:

```txt
red | green | blue
A -> B -> C
```

## Custom line ending

By default, `vix::print` ends with a newline.

You can change the ending with `.end`.

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print(
      vix::options{.end = ""},
      "loading...");

  vix::print();

  vix::print(
      vix::options{.end = " <done>\n"},
      "task");

  return 0;
}
```

Output:

```txt
loading...
task <done>
```

## Flush output

Use `.flush = true` when output must be flushed immediately.

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print(
      vix::options{
          .end = "",
          .flush = true},
      "processing...");

  vix::print();
  vix::print("done");

  return 0;
}
```

This is useful for progress output.

## Full options example

```cpp
#include <vix/print.hpp>

int main()
{
  vix::print(
      vix::options{
          .sep = " :: ",
          .end = " <end>\n",
          .flush = true},
      "alpha", "beta", "gamma");

  return 0;
}
```

Output:

```txt
alpha :: beta :: gamma <end>
```

## Print containers

`vix::print` can print common containers.

```cpp
#include <map>
#include <string>
#include <vector>

#include <vix/print.hpp>

int main()
{
  std::vector<int> numbers{1, 2, 3, 4, 5};

  std::map<std::string, int> scores{
      {"alice", 10},
      {"bob", 20},
      {"charlie", 30}};

  vix::print("numbers:", numbers);
  vix::print("scores:", scores);

  return 0;
}
```

This is useful in examples where you want readable container output without writing loops.

## Pretty containers

Use `.compact = false` for multi-line container output.

```cpp
#include <map>
#include <string>
#include <vector>

#include <vix/print.hpp>

int main()
{
  std::map<std::string, std::vector<int>> data{
      {"evens", {2, 4, 6, 8}},
      {"odds", {1, 3, 5, 7}},
      {"primes", {2, 3, 5, 7}}};

  vix::print("compact:");
  vix::print(data);

  vix::print();
  vix::print("pretty:");
  vix::print(
      vix::options{
          .compact = false,
          .indent = "    "},
      data);

  return 0;
}
```

Use compact output for small values.

Use pretty output when nested containers are easier to read across multiple lines.

## Nested containers

```cpp
#include <map>
#include <string>
#include <vector>

#include <vix/print.hpp>

int main()
{
  std::vector<std::map<std::string, int>> nested{
      {{"a", 1}, {"b", 2}},
      {{"x", 10}, {"y", 20}}};

  vix::print(
      vix::options{.compact = false},
      nested);

  vix::print(
      vix::options{
          .sep = " -> ",
          .compact = false},
      "nested containers", nested);

  return 0;
}
```

## Print optional, variant, and tuple

```cpp
#include <map>
#include <optional>
#include <string>
#include <tuple>
#include <variant>
#include <vector>

#include <vix/print.hpp>

int main()
{
  std::optional<int> age = 25;
  std::variant<int, std::string> status = std::string{"active"};
  auto values = std::make_tuple("tuple", 42, true);

  std::vector<std::string> tags{"fast", "stable", "simple"};
  std::map<std::string, int> stats{{"ok", 10}, {"fail", 2}};

  vix::print(age, status, values, tags, stats);

  return 0;
}
```

This makes `vix::print` useful for modern C++ examples.

## Strings and string views

```cpp
#include <string>
#include <string_view>

#include <vix/print.hpp>

int main()
{
  std::string name = "Vix";
  std::string_view mode = "stable";

  vix::print("project:", name, "mode:", mode);

  vix::print(
      vix::options{.raw_strings = false},
      "quoted string example");

  return 0;
}
```

By default, strings are printed naturally.

When `.raw_strings = false`, strings can be rendered with quoting behavior depending on formatter rules.

## Print to stderr

Use `.file = &std::cerr`.

```cpp
#include <iostream>

#include <vix/print.hpp>

int main()
{
  vix::print("normal output");

  vix::print(
      vix::options{.file = &std::cerr},
      "error:", "invalid input");

  return 0;
}
```

Use this for simple error output in small tools.

For real application logs, prefer `vix::console.error()`.

## Custom formatting with vix_format

You can define `vix_format()` for your own type.

```cpp
#include <ostream>
#include <vector>

#include <vix/print.hpp>

struct Point
{
  int x;
  int y;
};

inline void vix_format(std::ostream &os, const Point &point)
{
  os << "Point{x=" << point.x << ", y=" << point.y << "}";
}

int main()
{
  Point point{10, 20};

  std::vector<Point> points{
      {1, 2},
      {3, 4},
      {5, 6}};

  vix::print(point);
  vix::print("points:", points);

  return 0;
}
```

This is simple and works well when the type can be formatted near its definition.

## Custom formatting with formatter specialization

You can also specialize `vix::formatter<T>`.

```cpp
#include <ostream>
#include <string>
#include <vector>

#include <vix/print.hpp>

struct User
{
  std::string name;
  int age;
};

namespace vix
{
  template <>
  struct formatter<User>
  {
    static void format(std::ostream &os, const User &user)
    {
      os << "User{name=\"" << user.name << "\", age=" << user.age << "}";
    }
  };
} // namespace vix

int main()
{
  User user{"Gaspard", 25};

  std::vector<User> users{
      {"Alice", 21},
      {"Bob", 27},
      {"Charlie", 31}};

  vix::print(user);
  vix::print("users:", users);

  return 0;
}
```

Use formatter specialization when you want formatting to live in the `vix` formatting system.

## Custom formatting complete example

```cpp
#include <ostream>
#include <string>
#include <vector>

#include <vix/print.hpp>

struct Point
{
  int x;
  int y;
};

inline void vix_format(std::ostream &os, const Point &point)
{
  os << "Point{x=" << point.x << ", y=" << point.y << "}";
}

struct User
{
  std::string name;
  int age;
};

namespace vix
{
  template <>
  struct formatter<User>
  {
    static void format(std::ostream &os, const User &user)
    {
      os << "User{name=\"" << user.name << "\", age=" << user.age << "}";
    }
  };
} // namespace vix

int main()
{
  Point point{10, 20};
  User user{"Gaspard", 25};

  std::vector<Point> points{
      {1, 2},
      {3, 4},
      {5, 6}};

  std::vector<User> users{
      {"Alice", 21},
      {"Bob", 27},
      {"Charlie", 31}};

  vix::print(point);
  vix::print(user);

  vix::print("point:", point, "user:", user);

  vix::print(
      vix::options{.sep = " | "},
      "points", points,
      "users", users);

  return 0;
}
```

## Cnerium standalone example

Use `vix::print` for module-level examples.

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

For server or app logs, use `vix::console`.

## Cnerium request inspection example

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

  vix::print("method:", to_string(req.method()));
  vix::print("path:", req.path());
  vix::print("type:", req.header("Content-Type"));
  vix::print("body:", req.body());
}
```

## When to use vix::print

Use `vix::print` for:

```txt
simple examples
small CLI snippets
standalone module demos
debug output
container inspection
formatted values
learning docs
```

## When to use vix::console

Use `vix::console` for application logs:

```cpp
vix::console.info("Application started");
vix::console.warn("Unauthorized request");
vix::console.error("Unhandled exception");
```

Good rule:

```txt
vix::print    -> example output
vix::console  -> application logs
```

## Options overview

Common options:

```cpp
vix::options{
  .sep = " ",
  .end = "\n",
  .flush = false,
  .compact = true,
  .indent = "  ",
  .raw_strings = true,
  .file = &std::cout
}
```

Use only the options you need.

Examples:

```cpp
vix::print(vix::options{.sep = " | "}, "a", "b", "c");

vix::print(vix::options{.end = ""}, "loading...");

vix::print(vix::options{.flush = true}, "now");

vix::print(vix::options{.compact = false}, container);

vix::print(vix::options{.file = &std::cerr}, "error");
```

## API overview

Basic print:

```cpp
vix::print();
vix::print(values...);
```

Print with options:

```cpp
vix::print(vix::options{...}, values...);
```

Common formatting extension points:

```cpp
void vix_format(std::ostream &os, const T &value);

namespace vix
{
  template <>
  struct formatter<T>
  {
    static void format(std::ostream &os, const T &value);
  };
}
```

## Complete example

```cpp
#include <map>
#include <optional>
#include <ostream>
#include <string>
#include <string_view>
#include <tuple>
#include <variant>
#include <vector>

#include <vix/print.hpp>

struct Point
{
  int x;
  int y;
};

inline void vix_format(std::ostream &os, const Point &point)
{
  os << "Point{x=" << point.x << ", y=" << point.y << "}";
}

int main()
{
  std::string name = "Cnerium";
  std::string_view mode = "docs";

  std::vector<int> numbers{1, 2, 3};
  std::map<std::string, int> scores{
      {"alice", 10},
      {"bob", 20}};

  std::optional<int> age = 25;
  std::variant<int, std::string> status = std::string{"active"};
  auto tuple = std::make_tuple("build", 42, true);

  Point point{10, 20};

  vix::print("project:", name, "mode:", mode);
  vix::print("numbers:", numbers);
  vix::print("scores:", scores);
  vix::print("modern:", age, status, tuple);
  vix::print("point:", point);

  vix::print();

  vix::print(
      vix::options{
          .sep = " | ",
          .compact = false},
      "pretty scores",
      scores);

  vix::print(
      vix::options{.file = &std::cerr},
      "done");

  return 0;
}
```

## Best practices

### Use vix::print in small examples

Good:

```cpp
vix::print("value:", value);
```

### Use vix::console in applications

Good:

```cpp
vix::console.info("server started");
```

### Keep example output simple

Avoid complex formatting in beginner examples.

Good:

```cpp
vix::print("id:", id);
```

### Use options only when needed

Good:

```cpp
vix::print(vix::options{.sep = " | "}, "a", "b", "c");
```

### Prefer custom formatters for domain types

Good:

```cpp
inline void vix_format(std::ostream &os, const Point &point)
{
  os << "Point{x=" << point.x << ", y=" << point.y << "}";
}
```

### Use pretty output for nested containers

```cpp
vix::print(vix::options{.compact = false}, nested);
```

## Common mistakes

### Using std::cout in docs examples

Prefer:

```cpp
vix::print("Hello");
```

instead of:

```cpp
std::cout << "Hello\n";
```

### Using vix::print for application logs

Prefer:

```cpp
vix::console.info("App is ready");
```

for app logs.

### Forgetting the include

```cpp
#include <vix/print.hpp>
```

### Expecting print to be a logger

`vix::print` prints values.

It does not provide log levels.

Use `vix::console` for:

```txt
debug
info
warn
error
log levels
colors
thread-safe logs
```

### Capturing output formatting in business logic

Keep `vix::print` in examples, tools, and diagnostics.

Avoid mixing print output with core business logic.

## Summary

`vix::print` is a simple, expressive output helper.

It supports:

```txt
multiple values
empty lines
custom separators
custom endings
flush
stderr output
containers
nested containers
optional
variant
tuple
custom formatters
```

Use it for examples and standalone snippets.

Use `vix::console` for application logs.

## Next step

Continue with vix::console.

[Open vix::console reference](/reference/vix-console)
