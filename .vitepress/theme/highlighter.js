/* ============================================================
   Vix.cpp — Syntax highlighter
   Pure JS, no dependencies, matches CodeBlock.vue palette
   ============================================================ */

/* ── C++ keyword sets ── */
const KW = new Set([
  "alignas",
  "alignof",
  "auto",
  "bool",
  "break",
  "case",
  "catch",
  "char",
  "char8_t",
  "char16_t",
  "char32_t",
  "class",
  "concept",
  "const",
  "consteval",
  "constexpr",
  "constinit",
  "const_cast",
  "continue",
  "co_await",
  "co_return",
  "co_yield",
  "decltype",
  "default",
  "delete",
  "do",
  "double",
  "dynamic_cast",
  "else",
  "enum",
  "explicit",
  "export",
  "extern",
  "false",
  "float",
  "for",
  "friend",
  "goto",
  "if",
  "inline",
  "int",
  "long",
  "mutable",
  "namespace",
  "new",
  "noexcept",
  "nullptr",
  "operator",
  "private",
  "protected",
  "public",
  "register",
  "reinterpret_cast",
  "requires",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "static_assert",
  "static_cast",
  "struct",
  "switch",
  "template",
  "this",
  "thread_local",
  "throw",
  "true",
  "try",
  "typedef",
  "typeid",
  "typename",
  "union",
  "unsigned",
  "using",
  "virtual",
  "void",
  "volatile",
  "wchar_t",
  "while",
  "override",
  "final",
  "import",
  "module",
]);

const CTRL_FLOW = new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "return",
  "goto",
  "throw",
  "try",
  "catch",
  "co_await",
  "co_return",
  "co_yield",
]);

const TYPES = new Set([
  "size_t",
  "ssize_t",
  "ptrdiff_t",
  "intptr_t",
  "uintptr_t",
  "int8_t",
  "int16_t",
  "int32_t",
  "int64_t",
  "uint8_t",
  "uint16_t",
  "uint32_t",
  "uint64_t",
  "string",
  "string_view",
  "wstring",
  "u8string",
  "u16string",
  "u32string",
  "vector",
  "array",
  "deque",
  "list",
  "forward_list",
  "map",
  "multimap",
  "unordered_map",
  "unordered_multimap",
  "set",
  "multiset",
  "unordered_set",
  "unordered_multiset",
  "stack",
  "queue",
  "priority_queue",
  "pair",
  "tuple",
  "optional",
  "variant",
  "any",
  "expected",
  "unique_ptr",
  "shared_ptr",
  "weak_ptr",
  "function",
  "reference_wrapper",
  "initializer_list",
  "span",
  "mdspan",
  "ranges",
  "thread",
  "mutex",
  "lock_guard",
  "unique_lock",
  "shared_lock",
  "condition_variable",
  "future",
  "promise",
  "async",
  "atomic",
  "atomic_ref",
  "istream",
  "ostream",
  "iostream",
  "ifstream",
  "ofstream",
  "fstream",
  "istringstream",
  "ostringstream",
  "stringstream",
  "regex",
  "smatch",
  "cmatch",
  "chrono",
  "filesystem",
  "format",
  "App",
  "Request",
  "Response",
  "Context",
  "Router",
  "Middleware",
  "Server",
  "Client",
  "Socket",
  "Connection",
  "Session",
  "Handler",
  "Config",
  "Logger",
  "Timer",
  "Task",
  "Channel",
  "Buffer",
  "Stream",
  "ThreadPool",
  "Future",
  "Promise",
  "Awaitable",
]);

const NS = new Set([
  "std",
  "vix",
  "asio",
  "net",
  "http",
  "ws",
  "chrono",
  "filesystem",
  "ranges",
  "views",
  "this_thread",
  "literals",
  "placeholders",
  "execution",
  "threadpool",
]);

const BUILTINS = new Set([
  "cout",
  "cerr",
  "clog",
  "cin",
  "endl",
  "flush",
  "move",
  "forward",
  "swap",
  "exchange",
  "make_unique",
  "make_shared",
  "make_pair",
  "make_tuple",
  "make_optional",
  "static_pointer_cast",
  "dynamic_pointer_cast",
  "reinterpret_pointer_cast",
  "begin",
  "end",
  "cbegin",
  "cend",
  "rbegin",
  "rend",
  "size",
  "empty",
  "data",
  "get",
  "holds_alternative",
  "visit",
  "min",
  "max",
  "clamp",
  "abs",
  "sort",
  "find",
  "find_if",
  "for_each",
  "transform",
  "accumulate",
  "reduce",
  "copy",
  "fill",
  "remove",
  "remove_if",
  "replace",
  "reverse",
  "unique",
  "all_of",
  "any_of",
  "none_of",
  "count",
  "count_if",
  "push_back",
  "push_front",
  "pop_back",
  "pop_front",
  "emplace",
  "emplace_back",
  "insert",
  "erase",
  "clear",
  "reserve",
  "resize",
  "shrink_to_fit",
  "front",
  "back",
  "at",
  "substr",
  "append",
  "assign",
  "open",
  "close",
  "read",
  "write",
  "seek",
  "tell",
  "good",
  "eof",
  "fail",
  "lock",
  "unlock",
  "try_lock",
  "notify_one",
  "notify_all",
  "wait",
  "load",
  "store",
  "fetch_add",
  "fetch_sub",
  "compare_exchange_strong",
  "join",
  "detach",
  "joinable",
  "get_id",
  "sleep_for",
  "sleep_until",
  "yield",
  "to_string",
  "stoi",
  "stol",
  "stoll",
  "stof",
  "stod",
  "stold",
  "printf",
  "sprintf",
  "snprintf",
  "fprintf",
  "malloc",
  "calloc",
  "realloc",
  "free",
  "memcpy",
  "memset",
  "memmove",
  "assert",
  "static_assert",
]);

/* ── Helpers ── */
function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function wrap(cls, text) {
  return `<span class="${cls}">${esc(text)}</span>`;
}

function normalizeShellText(raw) {
  return String(raw ?? "")
    .split("\n")
    .map((line) =>
      line.replace(/^\s*>\s?/, "").replace(/\s*>\s*:(\d{2,5})/g, " :$1"),
    )
    .join("\n");
}

/* ── Comment splitter ── */
function splitComment(line) {
  let inStr = false;
  let inChar = false;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (!inChar && c === '"' && line[i - 1] !== "\\") inStr = !inStr;
    if (!inStr && c === "'" && line[i - 1] !== "\\") inChar = !inChar;
    if (!inStr && !inChar && line[i] === "/" && line[i + 1] === "/") {
      const before = line.slice(0, i);
      if (before.endsWith("http:") || before.endsWith("https:")) continue;
      return { code: before, comment: line.slice(i) };
    }
  }
  return { code: line, comment: "" };
}

/* ── Preprocessor directive ── */
function hlDirective(line) {
  const m = line.match(
    /^(\s*#\s*(?:include|define|pragma|if|ifdef|ifndef|endif|elif|else|undef|error|warning|line)\b)(.*)/,
  );
  if (!m) return null;

  let out = wrap("cb-dir", m[1]);
  const rest = m[2] || "";

  const angle = rest.match(/^(\s*)(<[^>\n]*>)(.*)/);
  if (angle) {
    out += esc(angle[1]) + wrap("cb-inc", angle[2]) + hlInline(angle[3] || "");
    return out;
  }

  const quote = rest.match(/^(\s*)("(?:[^"\\]|\\.)*")(.*)/);
  if (quote) {
    out += esc(quote[1]) + wrap("cb-inc", quote[2]) + hlInline(quote[3] || "");
    return out;
  }

  return out + hlInline(rest);
}

/* ── Inline tokens ── */
function hlInline(s) {
  let out = "";
  let i = 0;
  const isStart = (c) => /[A-Za-z_]/.test(c);
  const isId = (c) => /[A-Za-z0-9_]/.test(c);

  while (i < s.length) {
    const ch = s[i];

    /* Strings */
    if (ch === '"') {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === '"' && s[j - 1] !== "\\") break;
        j++;
      }
      const str = s.slice(i, Math.min(j + 1, s.length));
      out += wrap("cb-str", str);
      i += str.length;
      continue;
    }

    /* Char literals */
    if (ch === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "'" && s[j - 1] !== "\\") break;
        j++;
      }
      const lit = s.slice(i, Math.min(j + 1, s.length));
      out += wrap("cb-char", lit);
      i += lit.length;
      continue;
    }

    /* Numbers */
    if (/[0-9]/.test(ch)) {
      const m = s
        .slice(i)
        .match(
          /^(0[xX][0-9A-Fa-f']+|0[bB][01']+|0[0-7']+|[0-9][0-9']*(?:\.[0-9']+)?(?:[eE][+-]?[0-9']+)?)([uUlLfFzZ]{0,3}\b)?/,
        );
      if (m) {
        out += wrap("cb-num", m[0]);
        i += m[0].length;
        continue;
      }
    }

    /* Identifiers & keywords */
    if (isStart(ch)) {
      let j = i + 1;
      while (j < s.length && isId(s[j])) j++;
      const id = s.slice(i, j);

      const nextNonSp = (() => {
        for (let k = j; k < s.length; k++)
          if (s[k] !== " " && s[k] !== "\t") return s[k];
        return "";
      })();
      const prevNonSp = (() => {
        for (let k = i - 1; k >= 0; k--)
          if (s[k] !== " " && s[k] !== "\t") return s[k];
        return "";
      })();

      if (CTRL_FLOW.has(id)) out += wrap("cb-ctrl", id);
      else if (KW.has(id)) out += wrap("cb-kw", id);
      else if (TYPES.has(id)) out += wrap("cb-type", id);
      else if (NS.has(id)) out += wrap("cb-ns", id);
      else if (BUILTINS.has(id)) out += wrap("cb-blt", id);
      else if (nextNonSp === "(") out += wrap("cb-fn", id);
      else if (nextNonSp === "<" && /^[A-Z]/.test(id))
        out += wrap("cb-type", id);
      else if (prevNonSp === "." || prevNonSp === ">")
        out += wrap("cb-mem", id);
      else if (/^[A-Z][A-Z0-9_]+$/.test(id)) out += wrap("cb-const", id);
      else out += wrap("cb-id", id);

      i = j;
      continue;
    }

    /* Multi-char operators */
    if (s.startsWith("::", i)) {
      out += wrap("cb-op", "::");
      i += 2;
      continue;
    }
    if (s.startsWith("->", i)) {
      out += wrap("cb-arrow", "->");
      i += 2;
      continue;
    }
    if (s.startsWith("<<", i)) {
      out += wrap("cb-op", "<<");
      i += 2;
      continue;
    }
    if (s.startsWith(">>", i)) {
      out += wrap("cb-op", ">>");
      i += 2;
      continue;
    }
    if (s.startsWith("<=", i)) {
      out += wrap("cb-op", "<=");
      i += 2;
      continue;
    }
    if (s.startsWith(">=", i)) {
      out += wrap("cb-op", ">=");
      i += 2;
      continue;
    }
    if (s.startsWith("==", i)) {
      out += wrap("cb-op", "==");
      i += 2;
      continue;
    }
    if (s.startsWith("!=", i)) {
      out += wrap("cb-op", "!=");
      i += 2;
      continue;
    }
    if (s.startsWith("&&", i)) {
      out += wrap("cb-op", "&amp;&amp;");
      i += 2;
      continue;
    }
    if (s.startsWith("||", i)) {
      out += wrap("cb-op", "||");
      i += 2;
      continue;
    }
    if (s.startsWith("+=", i)) {
      out += wrap("cb-op", "+=");
      i += 2;
      continue;
    }
    if (s.startsWith("-=", i)) {
      out += wrap("cb-op", "-=");
      i += 2;
      continue;
    }

    /* Single-char punctuation */
    if (/[\(\)\{\}\[\];\,\.\:\=\+\-\*\/\<\>\!\&\|\?\~\%\^]/.test(ch)) {
      if (ch === "{" || ch === "}") out += wrap("cb-brace", ch);
      else if (ch === "(" || ch === ")") out += wrap("cb-paren", ch);
      else if (ch === "[" || ch === "]") out += wrap("cb-bracket", ch);
      else if (ch === ";") out += wrap("cb-semi", ch);
      else out += wrap("cb-op", ch);
      i++;
      continue;
    }

    out += esc(ch);
    i++;
  }

  return out.replace(/(https?:\/\/[^\s<]+)/g, `<span class="cb-url">$1</span>`);
}

/* ── Public: C++ highlighter ── */
export function highlightCpp(raw) {
  return String(raw ?? "")
    .split("\n")
    .map((line) => {
      const { code, comment } = splitComment(line);
      const dir = hlDirective(code);
      return (dir ?? hlInline(code)) + (comment ? wrap("cb-cmt", comment) : "");
    })
    .join("\n");
}

/* ── Public: Shell highlighter ── */
export function highlightShell(raw) {
  let s = esc(normalizeShellText(raw));

  // Prompt: $, ~$, /path$
  s = s.replace(
    /^(\s*(?:~|\/[^$]*)?\s*\$)/gm,
    `<span class="cb-sh-prompt">$1</span>`,
  );

  // First command on each line
  s = s.replace(
    /(^\s*(?:<span[^>]*>.*?<\/span>\s*)?)([a-zA-Z0-9_.\/-]+)(\s+)/gm,
    `$1<span class="cb-sh-cmd">$2</span>$3`,
  );

  // Flags: --foo, -x, --key=value
  s = s.replace(
    /(\s--?[a-zA-Z0-9_-]+(?:=[^\s]+)?)/g,
    `<span class="cb-sh-flag">$1</span>`,
  );

  // URLs
  s = s.replace(/(https?:\/\/[^\s]+)/g, `<span class="cb-sh-url">$1</span>`);

  // Paths
  s = s.replace(
    /(\s(?:\.{0,2}\/[^\s]+))/g,
    `<span class="cb-sh-path">$1</span>`,
  );

  // Ports like :8080
  s = s.replace(/(:\d{2,5}\b)/g, `<span class="cb-sh-port">$1</span>`);

  // HTTP response lines
  s = s.replace(
    /^(HTTP\/\d\.\d\s+\d+\s+.*)$/gm,
    `<span class="cb-sh-http">$1</span>`,
  );

  // Shell comments
  s = s.replace(/#([^\n]*)/g, `<span class="cb-sh-comment">#$1</span>`);

  return s;
}

/* ── Public: plain text passthrough ── */
export function highlightText(raw) {
  return esc(raw ?? "");
}

/* ── Public: language alias normalizer ── */
export function normalizeLang(lang) {
  const l = String(lang || "")
    .toLowerCase()
    .trim();

  if (["sh", "bash", "zsh", "shell", "console", "terminal"].includes(l)) {
    return "shell";
  }
  if (["cpp", "c++", "cc", "cxx", "hpp", "hxx", "h"].includes(l)) {
    return "cpp";
  }
  if (["txt", "text", "plain", "plaintext"].includes(l)) {
    return "text";
  }

  return l || "text";
}
