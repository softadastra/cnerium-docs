<template>
  <div class="cb" @mouseenter="hover = true" @mouseleave="hover = false">
    <!-- Header -->
    <div class="cb-head">
      <div class="cb-head-left">
        <span class="cb-dot cb-dot--r"></span>
        <span class="cb-dot cb-dot--y"></span>
        <span class="cb-dot cb-dot--g"></span>
        <span class="cb-title">{{ title || computedTitle }}</span>
        <span v-for="c in chipsToShow" :key="c" class="cb-chip">{{ c }}</span>
      </div>

      <div class="cb-head-right">
        <div class="cb-tabs" v-if="tabs.length > 1">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            class="cb-tab"
            :class="{ 'cb-tab--active': activeTab === t.key }"
            @click="activeTab = t.key"
          >{{ t.label }}</button>
        </div>

        <button
          v-if="activeText"
          type="button"
          class="cb-copy"
          :class="{ 'cb-copy--visible': hover }"
          @click="copy(activeText)"
          :title="copied ? 'Copied!' : 'Copy'"
          aria-label="Copy code"
        >
          <svg v-if="!copied" viewBox="0 0 24 24" fill="none" class="cb-ico">
            <path d="M9 9h10v10H9V9Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
            <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" class="cb-ico">
            <path d="M20 7L10 17l-4-4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="cb-body" :style="{ maxHeight: maxH }" role="region" aria-label="Code">
      <pre class="cb-pre"><code class="cb-code" v-html="activeHtml"></code></pre>
    </div>

    <!-- Footer note -->
    <div v-if="note" class="cb-foot">
      <p class="cb-note">{{ note }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  title:     { type: String, default: "" },
  code:      { type: String, default: "" },
  run:       { type: String, default: "" },
  out:       { type: String, default: "" },
  note:      { type: String, default: "" },
  lang:      { type: String, default: "" },
  chips:     { type: Array,  default: () => [] },
  maxHeight: { type: [Number, String], default: 380 },
});

const copied    = ref(false);
const activeTab = ref("code");
const hover     = ref(false);

const tabs = computed(() => {
  const list = [];
  if (props.code?.trim()) list.push({ key: "code",  label: "Code",   lang: guessLang("code") });
  if (props.run?.trim())  list.push({ key: "run",   label: "Run",    lang: "shell" });
  if (props.out?.trim())  list.push({ key: "out",   label: "Output", lang: "shell" });
  return list;
});

watch(
  () => tabs.value.map(t => t.key).join(","),
  () => {
    if (!tabs.value.find(t => t.key === activeTab.value))
      activeTab.value = tabs.value[0]?.key || "code";
  },
  { immediate: true }
);

const active     = computed(() => tabs.value.find(t => t.key === activeTab.value) || tabs.value[0]);
const activeText = computed(() => {
  if (activeTab.value === "run")  return props.run  || "";
  if (activeTab.value === "out")  return props.out  || "";
  return props.code || "";
});
const activeLang = computed(() => active.value?.lang || guessLang(activeTab.value));

const computedTitle = computed(() => {
  if (activeTab.value === "run") return "Terminal";
  if (activeTab.value === "out") return "Output";
  return activeLang.value === "shell" ? "Shell" : "C++";
});

const chipsToShow = computed(() => (props.chips || []).filter(Boolean));

const maxH = computed(() => {
  const v = props.maxHeight;
  if (typeof v === "number") return `${v}px`;
  return v?.trim() ? v : "380px";
});

function guessLang(tabKey) {
  if (props.lang) return props.lang;
  if (tabKey === "run" || tabKey === "out") return "shell";
  const s = (props.code || "").trim();
  if (s.includes("#include") || s.includes("int main") || s.includes("std::")) return "cpp";
  if (s.startsWith("~$") || s.includes(" vix ") || s.startsWith("$ ")) return "shell";
  return "cpp";
}

/* ── Syntax highlight ── */
function esc(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function normalizeShellText(raw) {
  return String(raw ?? "")
    .split("\n")
    .map(line => line
      .replace(/^\s*>\s?/, "")
      .replace(/\s*>\s*:(\d{2,5})/g, " :$1")
    )
    .join("\n");
}

/* ── C++ keyword sets ── */
const KW = new Set([
  "alignas","alignof","auto","bool","break","case","catch","char","char8_t","char16_t","char32_t",
  "class","concept","const","consteval","constexpr","constinit","const_cast","continue",
  "co_await","co_return","co_yield","decltype","default","delete","do","double","dynamic_cast",
  "else","enum","explicit","export","extern","false","float","for","friend","goto","if","inline",
  "int","long","mutable","namespace","new","noexcept","nullptr","operator","private","protected",
  "public","register","reinterpret_cast","requires","return","short","signed","sizeof","static",
  "static_assert","static_cast","struct","switch","template","this","thread_local","throw","true",
  "try","typedef","typeid","typename","union","unsigned","using","virtual","void","volatile",
  "wchar_t","while","override","final","import","module"
]);

const CTRL_FLOW = new Set([
  "if","else","for","while","do","switch","case","default","break","continue",
  "return","goto","throw","try","catch","co_await","co_return","co_yield"
]);

const TYPES = new Set([
  "size_t","ssize_t","ptrdiff_t","intptr_t","uintptr_t",
  "int8_t","int16_t","int32_t","int64_t","uint8_t","uint16_t","uint32_t","uint64_t",
  "string","string_view","wstring","u8string","u16string","u32string",
  "vector","array","deque","list","forward_list",
  "map","multimap","unordered_map","unordered_multimap",
  "set","multiset","unordered_set","unordered_multiset",
  "stack","queue","priority_queue",
  "pair","tuple","optional","variant","any","expected",
  "unique_ptr","shared_ptr","weak_ptr",
  "function","reference_wrapper","initializer_list",
  "span","mdspan","ranges",
  "thread","mutex","lock_guard","unique_lock","shared_lock",
  "condition_variable","future","promise","async",
  "atomic","atomic_ref",
  "istream","ostream","iostream","ifstream","ofstream","fstream",
  "istringstream","ostringstream","stringstream",
  "regex","smatch","cmatch",
  "chrono","filesystem","format",
  "App","Request","Response","Context","Router","Middleware",
  "Server","Client","Socket","Connection","Session","Handler",
  "Config","Logger","Timer","Task","Channel","Buffer","Stream"
]);

const NS = new Set([
  "std","vix","asio","net","http","ws","chrono","filesystem","ranges",
  "views","this_thread","literals","placeholders","execution"
]);

const BUILTINS = new Set([
  "cout","cerr","clog","cin","endl","flush",
  "move","forward","swap","exchange",
  "make_unique","make_shared","make_pair","make_tuple","make_optional",
  "static_pointer_cast","dynamic_pointer_cast","reinterpret_pointer_cast",
  "begin","end","cbegin","cend","rbegin","rend",
  "size","empty","data",
  "get","holds_alternative","visit",
  "min","max","clamp","abs",
  "sort","find","find_if","for_each","transform","accumulate","reduce",
  "copy","fill","remove","remove_if","replace","reverse","unique",
  "all_of","any_of","none_of","count","count_if",
  "push_back","push_front","pop_back","pop_front","emplace","emplace_back",
  "insert","erase","clear","reserve","resize","shrink_to_fit",
  "front","back","at","substr","append","assign",
  "open","close","read","write","seek","tell","good","eof","fail",
  "lock","unlock","try_lock","notify_one","notify_all","wait",
  "load","store","fetch_add","fetch_sub","compare_exchange_strong",
  "join","detach","joinable","get_id","sleep_for","sleep_until","yield",
  "to_string","stoi","stol","stoll","stof","stod","stold",
  "printf","sprintf","snprintf","fprintf",
  "malloc","calloc","realloc","free","memcpy","memset","memmove",
  "assert","static_assert"
]);

function wrap(cls, text) { return `<span class="${cls}">${esc(text)}</span>`; }

function splitComment(line) {
  let inStr = false, inChar = false;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (!inChar && c === '"' && line[i-1] !== "\\") inStr = !inStr;
    if (!inStr  && c === "'" && line[i-1] !== "\\") inChar = !inChar;
    if (!inStr && !inChar && line[i] === "/" && line[i+1] === "/") {
      const before = line.slice(0, i);
      if (before.endsWith("http:") || before.endsWith("https:")) continue;
      return { code: before, comment: line.slice(i) };
    }
  }
  return { code: line, comment: "" };
}

function hlDirective(line) {
  const m = line.match(/^(\s*#\s*(?:include|define|pragma|if|ifdef|ifndef|endif|elif|else|undef|error|warning|line)\b)(.*)/);
  if (!m) return null;
  let out = wrap("cb-dir", m[1]);
  const rest = m[2] || "";
  const angle = rest.match(/^(\s*)(<[^>\n]*>)(.*)/);
  if (angle) { out += esc(angle[1]) + wrap("cb-inc", angle[2]) + hlInline(angle[3]||""); return out; }
  const quote = rest.match(/^(\s*)("(?:[^"\\]|\\.)*")(.*)/);
  if (quote) { out += esc(quote[1]) + wrap("cb-inc", quote[2]) + hlInline(quote[3]||""); return out; }
  return out + hlInline(rest);
}

function hlInline(s) {
  let out = "", i = 0;
  const isStart = c => /[A-Za-z_]/.test(c);
  const isId    = c => /[A-Za-z0-9_]/.test(c);

  while (i < s.length) {
    const ch = s[i];

    /* Strings */
    if (ch === '"') {
      let j = i+1;
      while (j < s.length) { if (s[j] === '"' && s[j-1] !== "\\") break; j++; }
      const str = s.slice(i, Math.min(j+1, s.length));
      out += wrap("cb-str", str); i += str.length; continue;
    }

    /* Char literals */
    if (ch === "'") {
      let j = i+1;
      while (j < s.length) { if (s[j] === "'" && s[j-1] !== "\\") break; j++; }
      const lit = s.slice(i, Math.min(j+1, s.length));
      out += wrap("cb-char", lit); i += lit.length; continue;
    }

    /* Numbers */
    if (/[0-9]/.test(ch)) {
      const m = s.slice(i).match(/^(0[xX][0-9A-Fa-f']+|0[bB][01']+|0[0-7']+|[0-9][0-9']*(?:\.[0-9']+)?(?:[eE][+-]?[0-9']+)?)([uUlLfFzZ]{0,3}\b)?/);
      if (m) { out += wrap("cb-num", m[0]); i += m[0].length; continue; }
    }

    /* Identifiers & keywords */
    if (isStart(ch)) {
      let j = i+1;
      while (j < s.length && isId(s[j])) j++;
      const id = s.slice(i, j);
      const nextNonSp = (() => { for (let k=j; k<s.length; k++) if (s[k]!==" "&&s[k]!=="\t") return s[k]; return ""; })();
      const prevNonSp = (() => { for (let k=i-1; k>=0; k--) if (s[k]!==" "&&s[k]!=="\t") return s[k]; return ""; })();

      if (CTRL_FLOW.has(id))     out += wrap("cb-ctrl", id);
      else if (KW.has(id))       out += wrap("cb-kw",   id);
      else if (TYPES.has(id))    out += wrap("cb-type", id);
      else if (NS.has(id))       out += wrap("cb-ns",   id);
      else if (BUILTINS.has(id)) out += wrap("cb-blt",  id);
      else if (nextNonSp === "(") out += wrap("cb-fn",  id);
      else if (nextNonSp === "<" && /^[A-Z]/.test(id)) out += wrap("cb-type", id);
      else if (prevNonSp === "." || prevNonSp === ">") out += wrap("cb-mem", id);
      else if (/^[A-Z][A-Z0-9_]+$/.test(id)) out += wrap("cb-const", id);
      else                        out += wrap("cb-id",  id);
      i = j; continue;
    }

    /* Operators */
    if (s.startsWith("::", i))  { out += wrap("cb-op", "::"); i+=2; continue; }
    if (s.startsWith("->", i))  { out += wrap("cb-arrow", "->"); i+=2; continue; }
    if (s.startsWith("<<", i))  { out += wrap("cb-op", "&lt;&lt;"); i+=2; continue; }
    if (s.startsWith(">>", i))  { out += wrap("cb-op", "&gt;&gt;"); i+=2; continue; }
    if (s.startsWith("<=", i))  { out += wrap("cb-op", "&lt;="); i+=2; continue; }
    if (s.startsWith(">=", i))  { out += wrap("cb-op", "&gt;="); i+=2; continue; }
    if (s.startsWith("==", i))  { out += wrap("cb-op", "=="); i+=2; continue; }
    if (s.startsWith("!=", i))  { out += wrap("cb-op", "!="); i+=2; continue; }
    if (s.startsWith("&&", i))  { out += wrap("cb-op", "&amp;&amp;"); i+=2; continue; }
    if (s.startsWith("||", i))  { out += wrap("cb-op", "||"); i+=2; continue; }
    if (s.startsWith("+=", i))  { out += wrap("cb-op", "+="); i+=2; continue; }
    if (s.startsWith("-=", i))  { out += wrap("cb-op", "-="); i+=2; continue; }
    if (/[\(\)\{\}\[\];\,\.\:\=\+\-\*\/\<\>\!\&\|\?\~\%\^]/.test(ch)) {
      /* Braces get special class */
      if (ch === '{' || ch === '}') { out += wrap("cb-brace", ch); }
      else if (ch === '(' || ch === ')') { out += wrap("cb-paren", ch); }
      else if (ch === '[' || ch === ']') { out += wrap("cb-bracket", ch); }
      else if (ch === ';') { out += wrap("cb-semi", ch); }
      else { out += wrap("cb-op", esc(ch)); }
      i++; continue;
    }
    out += esc(ch); i++;
  }
  return out.replace(/(https?:\/\/[^\s<]+)/g, `<span class="cb-url">$1</span>`);
}

function highlightCpp(raw) {
  return String(raw ?? "").split("\n").map(line => {
    const { code, comment } = splitComment(line);
    const dir = hlDirective(code);
    return (dir ?? hlInline(code)) + (comment ? wrap("cb-cmt", comment) : "");
  }).join("\n");
}

function highlightShell(raw) {
  let s = esc(normalizeShellText(raw));
  s = s.replace(/^(\s*(?:~|\/[^$]*)?\s*\$)/gm,      `<span class="cb-sh-prompt">$1</span>`);
  s = s.replace(/(^\s*(?:<span[^>]*>.*?<\/span>\s*)?)([a-zA-Z0-9_.\/-]+)(\s+)/gm, `$1<span class="cb-sh-cmd">$2</span>$3`);
  s = s.replace(/(\s--?[a-zA-Z0-9_-]+(?:=[^\s]+)?)/g, `<span class="cb-sh-flag">$1</span>`);
  s = s.replace(/(https?:\/\/[^\s]+)/g,              `<span class="cb-sh-url">$1</span>`);
  s = s.replace(/(\s(?:\.{0,2}\/[^\s]+))/g,          `<span class="cb-sh-path">$1</span>`);
  s = s.replace(/(:\d{2,5}\b)/g,                     `<span class="cb-sh-port">$1</span>`);
  s = s.replace(/^(HTTP\/\d\.\d\s+\d+\s+.*)$/gm,     `<span class="cb-sh-http">$1</span>`);
  s = s.replace(/#([^\n]*)/g,                         `<span class="cb-sh-comment">#$1</span>`);
  return s;
}

const activeHtml = computed(() => {
  const text = activeText.value || "";
  return activeLang.value === "shell" ? highlightShell(text) : highlightCpp(text);
});

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    clearTimeout(copy._t);
    copy._t = setTimeout(() => (copied.value = false), 1200);
  } catch {
    const ta = Object.assign(document.createElement("textarea"), {
      value: text,
      style: "position:fixed;opacity:0;left:-9999px",
    });
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); copied.value = true; clearTimeout(copy._t); copy._t = setTimeout(() => (copied.value = false), 1200); }
    finally { document.body.removeChild(ta); }
  }
}
</script>

<style>
/* ── Card ── */
.cb {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.10);
  background: #0d1117;
  box-shadow: 0 8px 28px rgba(0,0,0,.40);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

html:not(.dark) .cb {
  border-color: rgba(0,0,0,.10);
  background: #1a1e26;
  box-shadow: 0 4px 18px rgba(0,0,0,.18);
}

/* ── Header ── */
.cb-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 12px;
  background: #161b22;
  border-bottom: 1px solid rgba(255,255,255,.08);
}

html:not(.dark) .cb-head {
  background: #21262d;
  border-color: rgba(255,255,255,.10);
}

.cb-head-left  { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cb-head-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.cb-dot { width: 10px; height: 10px; border-radius: 50%; }
.cb-dot--r { background: #f97316; }
.cb-dot--y { background: #facc15; }
.cb-dot--g { background: #22c55e; }

.cb-title {
  font-size: .78rem; font-weight: 600; color: rgba(230,232,238,.70);
  white-space: nowrap; letter-spacing: .01em;
}

.cb-chip {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 999px;
  font-size: .67rem; font-weight: 700;
  color: #4ade80;
  border: 1px solid rgba(34,197,94,.25);
  background: rgba(34,197,94,.08);
}

/* Tabs */
.cb-tabs {
  display: flex; align-items: center; gap: 3px;
  padding: 3px; border-radius: 999px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
}

.cb-tab {
  border: 0; background: transparent;
  color: rgba(230,232,238,.55); font-size: .72rem; font-weight: 600;
  padding: 4px 10px; border-radius: 999px; cursor: pointer;
  transition: background .12s, color .12s;
}
.cb-tab:hover { color: rgba(230,232,238,.88); }
.cb-tab--active { background: rgba(34,197,94,.15); color: #86efac; }

/* Copy */
.cb-copy {
  width: 30px; height: 30px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  color: rgba(230,232,238,.65);
  border-radius: 8px; cursor: pointer;
  display: grid; place-items: center;
  opacity: 0; pointer-events: none;
  transition: opacity .14s, background .12s, color .12s, transform .1s;
}
.cb-copy--visible { opacity: 1; pointer-events: auto; }
.cb-copy:hover { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.28); color: #86efac; transform: translateY(-1px); }
.cb-ico { width: 15px; height: 15px; display: block; }

/* ── Body ── */
.cb-body {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  background: #0d1117;
}

html:not(.dark) .cb-body { background: #1a1e26; }

.cb-pre {
  margin: 0; padding: 14px 16px;
  white-space: pre; line-height: 1.7;
  font-size: .875rem; color: #e6edf3;
  background: transparent;
  min-width: max-content;
}

.cb-code { display: inline-block; min-width: 100%; }

/* Scrollbars */
.cb-body::-webkit-scrollbar { height: 7px; width: 7px; }
.cb-body::-webkit-scrollbar-thumb { background: rgba(34,197,94,.30); border-radius: 999px; }
.cb-body::-webkit-scrollbar-track { background: rgba(0,0,0,.20); }

/* ── Footer ── */
.cb-foot { border-top: 1px solid rgba(255,255,255,.07); padding: 10px 14px; background: rgba(0,0,0,.18); }
.cb-note { margin: 0; color: rgba(230,232,238,.50); font-size: .82rem; line-height: 1.55; font-family: system-ui,-apple-system,sans-serif; }

/* ═══════════════════════════════════════════════════
   C++ SYNTAX TOKENS — High-contrast palette
   Inspired by One Dark Pro / GitHub Dark High Contrast
   ═══════════════════════════════════════════════════ */

/* Preprocessor directives: #include, #define, etc. */
.cb-dir      { color: #c586c0; font-weight: 600; }

/* Include paths: <vix.hpp> or "file.h" */
.cb-inc      { color: #ce9178; }

/* Control flow: if, else, for, while, return, throw, etc. */
.cb-ctrl     { color: #c586c0; font-weight: 600; }

/* Other keywords: class, struct, const, static, template, etc. */
.cb-kw       { color: #569cd6; font-weight: 600; }

/* Types: string, vector, optional, App, Request, Response, etc. */
.cb-type     { color: #4ec9b0; font-weight: 600; }

/* Namespaces: std, vix, chrono, etc. */
.cb-ns       { color: #4fc1ff; }

/* Function calls: app.get(...), res.json(...), etc. */
.cb-fn       { color: #dcdcaa; }

/* Builtin functions: cout, move, make_unique, push_back, etc. */
.cb-blt      { color: #dcdcaa; font-style: italic; }

/* Member access: .name, ->value, etc. */
.cb-mem      { color: #9cdcfe; }

/* Regular identifiers / variables */
.cb-id       { color: #e6edf3; }

/* SCREAMING_CASE constants */
.cb-const    { color: #4fc1ff; font-weight: 600; }

/* String literals */
.cb-str      { color: #ce9178; }

/* Char literals */
.cb-char     { color: #d7ba7d; }

/* Numeric literals */
.cb-num      { color: #b5cea8; font-weight: 500; }

/* Comments */
.cb-cmt      { color: #6a9955; font-style: italic; }

/* Operators: ::, +, =, <, >, etc. */
.cb-op       { color: rgba(230,237,243,.50); }

/* Arrow operator -> (slightly brighter) */
.cb-arrow    { color: rgba(230,237,243,.65); }

/* Braces {} */
.cb-brace    { color: #ffd700; }

/* Parentheses () */
.cb-paren    { color: rgba(230,237,243,.55); }

/* Brackets [] */
.cb-bracket  { color: #da70d6; }

/* Semicolons */
.cb-semi     { color: rgba(230,237,243,.30); }

/* URLs in code */
.cb-url      { color: #4fc1ff; text-decoration: underline; text-underline-offset: 2px; }


/* ═══════════════════════════
   Shell tokens
   ═══════════════════════════ */
.cb-sh-prompt  { color: #22c55e; font-weight: 800; }
.cb-sh-cmd     { color: #38bdf8; font-weight: 700; }
.cb-sh-flag    { color: #fb923c; }
.cb-sh-path    { color: #a5b4fc; }
.cb-sh-url     { color: #38bdf8; text-decoration: underline; text-underline-offset: 2px; }
.cb-sh-port    { color: #b5cea8; }
.cb-sh-http    { color: #dcdcaa; font-weight: 700; }
.cb-sh-comment { color: #6a9955; font-style: italic; }

@media (max-width: 640px) {
  .cb-pre { font-size: .82rem; padding: 12px 12px; }
  .cb-title { max-width: 28vw; overflow: hidden; text-overflow: ellipsis; }
}
</style>
