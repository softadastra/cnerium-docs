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
          >
            {{ t.label }}
          </button>
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
            <path
              d="M9 9h10v10H9V9Z"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linejoin="round"
            />
            <path
              d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" class="cb-ico">
            <path
              d="M20 7L10 17l-4-4"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Body -->
    <div
      class="cb-body"
      :style="{ maxHeight: maxH }"
      role="region"
      aria-label="Code"
    >
      <pre
        class="cb-pre"
      ><code class="cb-code" v-html="activeHtml"></code></pre>
    </div>

    <!-- Footer note -->
    <div v-if="note" class="cb-foot">
      <p class="cb-note">{{ note }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import {
  highlightCpp,
  highlightShell,
  highlightText,
  normalizeLang,
} from "./highlighter";

const props = defineProps({
  title: { type: String, default: "" },
  code: { type: String, default: "" },
  run: { type: String, default: "" },
  out: { type: String, default: "" },
  note: { type: String, default: "" },
  lang: { type: String, default: "" },
  chips: { type: Array, default: () => [] },
  maxHeight: { type: [Number, String], default: 380 },
});

const copied = ref(false);
const activeTab = ref("code");
const hover = ref(false);

const tabs = computed(() => {
  const list = [];
  if (props.code?.trim())
    list.push({ key: "code", label: "Code", lang: guessLang("code") });
  if (props.run?.trim()) list.push({ key: "run", label: "Run", lang: "shell" });
  if (props.out?.trim())
    list.push({ key: "out", label: "Output", lang: "shell" });
  return list;
});

watch(
  () => tabs.value.map((t) => t.key).join(","),
  () => {
    if (!tabs.value.find((t) => t.key === activeTab.value))
      activeTab.value = tabs.value[0]?.key || "code";
  },
  { immediate: true },
);

const active = computed(
  () => tabs.value.find((t) => t.key === activeTab.value) || tabs.value[0],
);

const activeText = computed(() => {
  if (activeTab.value === "run") return props.run || "";
  if (activeTab.value === "out") return props.out || "";
  return props.code || "";
});

const activeLang = computed(
  () => active.value?.lang || guessLang(activeTab.value),
);

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
  if (s.includes("#include") || s.includes("int main") || s.includes("std::"))
    return "cpp";
  if (s.startsWith("~$") || s.includes(" vix ") || s.startsWith("$ "))
    return "shell";
  return "cpp";
}

const activeHtml = computed(() => {
  const text = activeText.value || "";
  const lang = normalizeLang(activeLang.value);

  if (lang === "shell") return highlightShell(text);
  if (lang === "cpp") return highlightCpp(text);
  return highlightText(text);
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
    try {
      document.execCommand("copy");
      copied.value = true;
      clearTimeout(copy._t);
      copy._t = setTimeout(() => (copied.value = false), 1200);
    } finally {
      document.body.removeChild(ta);
    }
  }
}
</script>

<style>
/* ════════════════════════════════════════════════
   CARD
   ════════════════════════════════════════════════ */
.cb {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #0d1117;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

html:not(.dark) .cb {
  border-color: rgba(0, 0, 0, 0.1);
  background: #0d1117;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
}

/* ════════════════════════════════════════════════
   HEADER
   ════════════════════════════════════════════════ */
.cb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  background: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

html:not(.dark) .cb-head {
  background: #161b22;
  border-color: rgba(255, 255, 255, 0.1);
}

.cb-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cb-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cb-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.cb-dot--r {
  background: #f97316;
}
.cb-dot--y {
  background: #facc15;
}
.cb-dot--g {
  background: #22c55e;
}

.cb-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(230, 232, 238, 0.7);
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.cb-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.67rem;
  font-weight: 700;
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.08);
}

/* Tabs */
.cb-tabs {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.cb-tab {
  border: 0;
  background: transparent;
  color: rgba(230, 232, 238, 0.55);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.cb-tab:hover {
  color: rgba(230, 232, 238, 0.88);
}
.cb-tab--active {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}

/* Copy */
.cb-copy {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(230, 232, 238, 0.65);
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  place-items: center;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.14s,
    background 0.12s,
    color 0.12s,
    transform 0.1s;
}
.cb-copy--visible {
  opacity: 1;
  pointer-events: auto;
}
.cb-copy:hover {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.28);
  color: #86efac;
  transform: translateY(-1px);
}
.cb-ico {
  width: 15px;
  height: 15px;
  display: block;
}

/* ════════════════════════════════════════════════
   BODY
   ════════════════════════════════════════════════ */
.cb-body {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  background: #0d1117;
}

html:not(.dark) .cb-body {
  background: #0d1117;
}

.cb-pre {
  margin: 0;
  padding: 14px 16px;
  white-space: pre;
  line-height: 1.7;
  font-size: 0.875rem;
  color: #f8fafc;
  background: transparent;
  min-width: max-content;
}

.cb-code {
  display: inline-block;
  min-width: 100%;
  color: #f8fafc;
}

/* Scrollbars */
.cb-body::-webkit-scrollbar {
  height: 7px;
  width: 7px;
}
.cb-body::-webkit-scrollbar-thumb {
  background: rgba(34, 197, 94, 0.3);
  border-radius: 999px;
}
.cb-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

/* ════════════════════════════════════════════════
   FOOTER
   ════════════════════════════════════════════════ */
.cb-foot {
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.18);
}

.cb-note {
  margin: 0;
  color: rgba(230, 232, 238, 0.5);
  font-size: 0.82rem;
  line-height: 1.55;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

/* ════════════════════════════════════════════════
   C++ SYNTAX TOKENS
   Palette personnalisée Vix
   ════════════════════════════════════════════════ */

/* Préprocesseur : #include, #define, etc. */
.cb .cb-dir {
  color: #c586c0;
  font-weight: 600;
}

/* Inclusion : <iostream>, "vix.hpp" */
.cb .cb-inc {
  color: #ce9178;
}

/* Contrôle de flux : if, else, for, return, throw, try, catch */
.cb .cb-ctrl {
  color: #c586c0;
  font-weight: 600;
}

/* Autres mots-clés : class, struct, const, static, template */
.cb .cb-kw {
  color: #569cd6;
  font-weight: 600;
}

/* Types : string, vector, optional, App, Request, ThreadPool */
.cb .cb-type {
  color: #4ec9b0;
  font-weight: 600;
}

/* Namespaces : std, vix, chrono */
.cb .cb-ns {
  color: #4fc1ff;
}

/* Appels de fonction : app.get(...), res.json(...) */
.cb .cb-fn {
  color: #dcdcaa;
}

/* Builtins : cout, move, make_unique, push_back */
.cb .cb-blt {
  color: #dcdcaa;
  font-style: italic;
}

/* Membres : .name, ->value */
.cb .cb-mem {
  color: #9cdcfe;
}

/* Identifiants standards */
.cb .cb-id {
  color: #f8fafc;
}

/* Constantes SCREAMING_CASE */
.cb .cb-const {
  color: #4fc1ff;
  font-weight: 600;
}

/* Chaînes de caractères */
.cb .cb-str {
  color: #ce9178;
}

/* Caractères : 'x', '\n' */
.cb .cb-char {
  color: #d7ba7d;
}

/* Nombres */
.cb .cb-num {
  color: #b5cea8;
  font-weight: 500;
}

/* Commentaires */
.cb .cb-cmt {
  color: #6a9955;
  font-style: italic;
}

/* Opérateurs : ::, +, =, <, > */
.cb .cb-op {
  color: rgba(230, 237, 243, 0.5);
}

/* Flèche -> */
.cb .cb-arrow {
  color: rgba(230, 237, 243, 0.65);
}

/* Accolades { } */
.cb .cb-brace {
  color: #ffd700;
}

/* Parenthèses ( ) */
.cb .cb-paren {
  color: rgba(230, 237, 243, 0.55);
}

/* Crochets [ ] */
.cb .cb-bracket {
  color: #da70d6;
}

/* Point-virgule ; */
.cb .cb-semi {
  color: rgba(230, 237, 243, 0.82);
}

/* URLs dans le code */
.cb .cb-url {
  color: #4fc1ff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ════════════════════════════════════════════════
   SHELL TOKENS
   ════════════════════════════════════════════════ */
.cb .cb-sh-prompt {
  color: #22c55e;
  font-weight: 800;
}
.cb .cb-sh-cmd {
  color: #38bdf8;
  font-weight: 700;
}
.cb .cb-sh-flag {
  color: #fb923c;
}
.cb .cb-sh-path {
  color: #a5b4fc;
}
.cb .cb-sh-url {
  color: #38bdf8;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.cb .cb-sh-port {
  color: #b5cea8;
}
.cb .cb-sh-http {
  color: #dcdcaa;
  font-weight: 700;
}
.cb .cb-sh-comment {
  color: #6a9955;
  font-style: italic;
}
.cb .cb-blt {
  color: #dcdcaa;
  font-style: normal;
}

.cb .cb-cmt {
  color: #6a9955;
  font-style: normal;
}

.cb .cb-sh-comment {
  color: #6a9955;
  font-style: normal;
}
.cb,
.cb * {
  font-style: normal !important;
}
.cb {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #0d1117;
  box-shadow: none;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

html:not(.dark) .cb {
  border-color: rgba(0, 0, 0, 0.1);
  background: #0d1117;
  box-shadow: none;
}
/* ════════════════════════════════════════════════
   RESPONSIVE
   ════════════════════════════════════════════════ */
@media (max-width: 640px) {
  .cb-pre {
    font-size: 0.82rem;
    padding: 12px 12px;
  }
  .cb-title {
    max-width: 28vw;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
