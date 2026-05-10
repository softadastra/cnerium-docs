<script setup>
import CodeBlock from "./CodeBlock.vue";

const heroCode = `#include <vix.hpp>
using namespace vix;

int main() {
  App app;

  app.get("/", [](Request&, Response& res) {
    res.json({"message", "Hello from Vix.cpp"});
  });

  app.get("/ping", [](Request&, Response& res) {
    res.send("pong");
  });

  app.run(8080);
}`;

const features = [
  {
    title: "HTTP APIs",
    desc: "Clean routing, middleware, and JSON serialization with zero overhead.",
    icon: "swap",
    href: "/api/http",
    tag: "Core",
  },
  {
    title: "WebSockets",
    desc: "Real-time bidirectional communication, built for production workloads.",
    icon: "bolt",
    href: "/api/websocket",
    tag: "Realtime",
  },
  {
    title: "Async Runtime",
    desc: "Timers, background jobs, and concurrent tasks — one unified model.",
    icon: "chip",
    href: "/api/async",
    tag: "Async",
  },
  {
    title: "Local-first",
    desc: "Applications that keep working under unstable networks and failure conditions.",
    icon: "p2p",
    href: "/book/18-offline-first-sync",
    tag: "Sync",
  },
];

function iconPath(name) {
  if (name === "swap")   return "M7 7h11l-2-2m2 2l-2 2M17 17H6l2 2m-2-2l2-2";
  if (name === "bolt")   return "M13 2L4 14h7l-1 8 9-12h-7l1-8z";
  if (name === "chip")   return "M9 9h6v6H9V9zm-5 3h2m12 0h2M12 4v2m0 12v2M6.5 6.5l1.4 1.4m8.2 8.2l1.4 1.4m0-12.4l-1.4 1.4M7.9 16.1l-1.4 1.4";
  return "M6 12a2 2 0 114 0 2 2 0 01-4 0zm8-6a2 2 0 114 0 2 2 0 01-4 0zm0 12a2 2 0 114 0 2 2 0 01-4 0zM10 12l4-6M10 12l4 6";
}
</script>

<template>
  <!-- ── Hero ── -->
  <div class="vdh">
    <div class="vdh-left">
      <div class="vdh-eyebrow">
        <span class="vdh-badge">v2.5.2</span>
        <span class="vdh-sep">·</span>
        <span>MIT · Open source</span>
      </div>

      <h1 class="vdh-h1">
        Build C++ apps<br class="vdh-br"/>
        that ship fast.
      </h1>

      <p class="vdh-lead">
        Learn how to build HTTP APIs, WebSocket services, async tasks,
        and local-first systems with Vix.cpp, a modern C++ runtime focused
        on clarity and predictable performance.
      </p>

      <div class="vdh-actions">
        <a class="vdh-btn vdh-btn--primary" href="/book/01-introduction">
          Get started
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <a class="vdh-btn vdh-btn--ghost" href="https://github.com/vixcpp/vix" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.54 2.87 8.39 6.84 9.75.5.1.68-.22.68-.48 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.9-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.2 9.2 0 0 1 12 7.07c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.93-2.34 4.79-4.57 5.05.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.84 0 .27.18.59.69.48A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"/></svg>
          GitHub
        </a>
      </div>

      <div class="vdh-stats">
        <div class="vdh-stat">
          <div class="vdh-stat-v">135+</div>
          <div class="vdh-stat-l">Registry packages</div>
        </div>
        <div class="vdh-stat-div"></div>
        <div class="vdh-stat">
          <div class="vdh-stat-v">C++17</div>
          <div class="vdh-stat-l">Minimum standard</div>
        </div>
        <div class="vdh-stat-div"></div>
        <div class="vdh-stat">
          <div class="vdh-stat-v">MIT</div>
          <div class="vdh-stat-l">Open source</div>
        </div>
      </div>
    </div>

    <div class="vdh-right">
      <div class="vdh-code-label">Quick start</div>
      <CodeBlock
        title="main.cpp"
        lang="cpp"
        :chips="['http', 'json']"
        :code="heroCode"
        :maxHeight="400"
      />
      <div class="vdh-run">
        <span class="vdh-run-prompt">$</span>
        <span class="vdh-run-cmd">vix run main.cpp</span>
        <span class="vdh-run-comment"># compiles &amp; runs</span>
      </div>
    </div>
  </div>

  <!-- ── Feature cards ── -->
  <div class="vdh-cards">
    <a
      v-for="f in features"
      :key="f.title"
      class="vdh-card"
      :href="f.href"
    >
      <div class="vdh-card-top">
        <div class="vdh-card-icon">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path :d="iconPath(f.icon)" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="vdh-card-tag">{{ f.tag }}</span>
      </div>
      <div class="vdh-card-title">{{ f.title }}</div>
      <div class="vdh-card-desc">{{ f.desc }}</div>
      <div class="vdh-card-arrow">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </a>
  </div>
</template>

<style scoped>
/* ── Tokens ── */
.vdh {
  --accent: #22c55e;
  --accent-d: #16a34a;
  --accent-s: rgba(34, 197, 94, .12);
  --accent-b: rgba(34, 197, 94, .25);

  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 52px;
  align-items: start;
  padding: 20px 0 40px;
}

/* ── Left ── */
.vdh-left { display: flex; flex-direction: column; gap: 0; }

.vdh-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12.5px; font-weight: 600;
  color: var(--vp-c-text-2);
  margin-bottom: 16px;
}

.vdh-badge {
  display: inline-flex; align-items: center;
  padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700;
  background: var(--accent-s);
  border: 1px solid var(--accent-b);
  color: var(--accent);
}

.vdh-sep { color: var(--vp-c-divider); }

.vdh-h1 {
  margin: 0 0 18px;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.06;
  letter-spacing: -0.03em;
  font-weight: 900;
  color: var(--vp-c-text-1);
}

.vdh-br { display: block; }

.vdh-lead {
  margin: 0 0 24px;
  font-size: 15.5px;
  line-height: 1.72;
  color: var(--vp-c-text-2);
  max-width: 46ch;
}

/* CTAs */
.vdh-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 28px; }

.vdh-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 16px; border-radius: 10px;
  font-size: 13.5px; font-weight: 700; text-decoration: none;
  transition: all .14s ease;
}

.vdh-btn--primary {
  background: var(--accent);
  color: #052e16;
  box-shadow: 0 4px 14px rgba(34,197,94,.30);
}
.vdh-btn--primary:hover {
  background: #4ade80;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(34,197,94,.40);
}

.vdh-btn--ghost {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}
.vdh-btn--ghost:hover {
  border-color: var(--accent-b);
  background: var(--accent-s);
}

/* Stats */
.vdh-stats {
  display: flex; align-items: center; gap: 20px;
  flex-wrap: wrap;
}

.vdh-stat { display: flex; flex-direction: column; gap: 3px; }
.vdh-stat-v { font-size: 17px; font-weight: 900; color: var(--vp-c-text-1); letter-spacing: -0.02em; }
.vdh-stat-l { font-size: 11.5px; font-weight: 600; color: var(--vp-c-text-2); }
.vdh-stat-div { width: 1px; height: 28px; background: var(--vp-c-divider); }

/* ── Right ── */
.vdh-right { display: flex; flex-direction: column; gap: 10px; }

.vdh-code-label {
  font-size: 11.5px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: var(--vp-c-text-2);
}

.vdh-run {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 13px;
}

.vdh-run-prompt { color: var(--accent); font-weight: 800; }
.vdh-run-cmd    { color: var(--vp-c-text-1); font-weight: 700; }
.vdh-run-comment{ color: var(--vp-c-text-2); font-size: 12px; margin-left: auto; }

/* ── Feature cards ── */
.vdh-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  padding-bottom: 8px;
}

.vdh-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px; border-radius: 14px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  text-decoration: none;
  color: var(--vp-c-text-1);
  transition: border-color .14s, transform .14s, background .14s;
  position: relative;
}

.vdh-card:hover {
  border-color: var(--accent-b);
  background: var(--accent-s);
  transform: translateY(-2px);
}

.vdh-card-top {
  display: flex; align-items: center;
  justify-content: space-between; gap: 8px;
  margin-bottom: 4px;
}

.vdh-card-icon {
  width: 34px; height: 34px; border-radius: 10px;
  display: grid; place-items: center;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  transition: border-color .14s, color .14s;
}
.vdh-card:hover .vdh-card-icon {
  border-color: var(--accent-b);
  color: var(--accent);
}

.vdh-card-tag {
  font-size: 10.5px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: var(--accent);
  background: var(--accent-s); border: 1px solid var(--accent-b);
  padding: 2px 8px; border-radius: 999px;
  opacity: 0; transition: opacity .14s;
}
.vdh-card:hover .vdh-card-tag { opacity: 1; }

.vdh-card-title {
  font-size: 14px; font-weight: 800; color: var(--vp-c-text-1);
  line-height: 1.2;
}

.vdh-card-desc {
  font-size: 12.5px; line-height: 1.6; color: var(--vp-c-text-2);
  flex: 1;
}

.vdh-card-arrow {
  display: flex; align-items: center;
  color: var(--vp-c-text-2);
  opacity: 0; transform: translateX(-4px);
  transition: opacity .14s, transform .14s;
}
.vdh-card:hover .vdh-card-arrow {
  opacity: 1; transform: translateX(0);
  color: var(--accent);
}

/* ── Responsive ── */
@media (max-width: 1100px) {
  .vdh-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 960px) {
  .vdh {
    grid-template-columns: 1fr;
    gap: 28px;
    padding-top: 12px;
  }
  .vdh-h1 { font-size: 2.2rem; }
  .vdh-br { display: none; }
  .vdh-lead { max-width: 100%; }
  .vdh-run-comment { display: none; }
}

@media (max-width: 640px) {
  .vdh-h1 { font-size: 1.85rem; }
  .vdh-lead { font-size: 14.5px; }
  .vdh-cards { grid-template-columns: 1fr; gap: 10px; }
  .vdh-stats { gap: 14px; }
  .vdh-stat-div { display: none; }
  .vdh-card-tag { opacity: 1; }
  .vdh-card-arrow { opacity: 1; transform: translateX(0); }
}

@media (max-width: 640px) {
  .vdh {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  .vdh-left,
  .vdh-right {
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .vdh-right :deep(.code-block),
  .vdh-right :deep(.vix-code-block),
  .vdh-right :deep(pre),
  .vdh-right :deep(code) {
    max-width: 100%;
    min-width: 0;
  }

  .vdh-right :deep(pre) {
    overflow-x: auto;
  }

  .vdh-run {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    white-space: nowrap;
  }
}
.vdh-btn--primary {
  background: var(--accent);
  color: #052e16;
  box-shadow: 0 4px 14px rgba(34,197,94,.30);
}

.vdh-btn--primary:hover {
  background: #4ade80;
  color: #052e16;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(34,197,94,.40);
}
</style>
