<script setup>
import DefaultTheme from "vitepress/theme";
const { Layout } = DefaultTheme;

const links = [
  { text: "Docs",     href: "/" },
  { text: "Guides",   href: "/guide" },
  { text: "Registry", href: "https://registry.vixcpp.com" },
  { text: "Examples", href: "/examples" },
  { text: "Blog",     href: "/blog" },
];

const social = [
  {
    label: "GitHub",
    href:  "https://github.com/vixcpp",
    icon: `<path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.54 2.87 8.39 6.84 9.75.5.1.68-.22.68-.48 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.9-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.2 9.2 0 0 1 12 7.07c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.93-2.34 4.79-4.57 5.05.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.84 0 .27.18.59.69.48A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"/>`,
  },
  {
    label: "Discord",
    href:  "https://discord.gg/vixcpp",
    icon: `<path d="M20 4.5a16.3 16.3 0 0 0-4-1.3l-.2.4a15.5 15.5 0 0 1 3 1.2 11.9 11.9 0 0 0-3.7-1.1c-.6.8-1 1.7-1.2 2.1a14.5 14.5 0 0 0-3.8 0c-.2-.4-.6-1.3-1.2-2.1A11.9 11.9 0 0 0 5.2 4.8a15.5 15.5 0 0 1 3-1.2l-.2-.4a16.3 16.3 0 0 0-4 1.3C2.4 7 1.8 9.4 2 12c1.3 2 3.3 3.2 5.6 3.7l.4-.6a9.4 9.4 0 0 1-1.8-.9l.4-.3c1.1.5 2.3.9 3.5 1.1a13 13 0 0 0 4.8 0c1.2-.2 2.4-.6 3.5-1.1l.4.3c-.6.4-1.2.7-1.8.9l.4.6c2.3-.5 4.3-1.7 5.6-3.7.3-2.6-.4-5-2-7.5ZM9.2 12.9c-.7 0-1.3-.6-1.3-1.4s.6-1.4 1.3-1.4 1.3.6 1.3 1.4-.6 1.4-1.3 1.4Zm5.6 0c-.7 0-1.3-.6-1.3-1.4s.6-1.4 1.3-1.4 1.3.6 1.3 1.4-.6 1.4-1.3 1.4Z"/>`,
  },
  {
    label: "X / Twitter",
    href:  "https://x.com/vixcpp",
    icon: `<path d="M18.9 2H22l-6.8 7.8L23 22h-6.7l-5.2-6.8L5.3 22H2l7.3-8.4L1.7 2h6.9l4.7 6.1L18.9 2Zm-1.2 18h1.7L7.7 3.9H5.9L17.7 20Z"/>`,
  },
  {
    label: "YouTube",
    href:  "https://www.youtube.com/@vixcpp",
    icon: `<path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.9 12 4.9 12 4.9s-6 0-7.7.4A2.7 2.7 0 0 0 2.4 7.2 28.3 28.3 0 0 0 2 12a28.3 28.3 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.4 7.7.4 7.7.4s6 0 7.7-.4a2.7 2.7 0 0 0 1.9-1.9A28.3 28.3 0 0 0 22 12a28.3 28.3 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"/>`,
  },
];
</script>

<template>
  <Layout>
    <template #layout-bottom>
      <footer class="vfb" role="contentinfo">
        <div class="vfb-inner">

          <!-- Brand -->
          <div class="vfb-brand">
            <svg class="vfb-logo" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="fbl" x1="5" y1="6" x2="18" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%"   stop-color="#d4fcd4"/>
                  <stop offset="55%"  stop-color="#4ade80"/>
                  <stop offset="100%" stop-color="#22c55e"/>
                </linearGradient>
                <linearGradient id="fbr" x1="31" y1="6" x2="18" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%"   stop-color="#22c55e"/>
                  <stop offset="100%" stop-color="#15803d"/>
                </linearGradient>
              </defs>
              <polygon points="5,6 12,6 18,28 14,28"  fill="url(#fbl)"/>
              <polygon points="31,6 24,6 18,28 22,28" fill="url(#fbr)"/>
              <line x1="9" y1="16" x2="13.5" y2="29" stroke="#bbf7d0" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/>
            </svg>
            <span class="vfb-name">Vix<span class="vfb-name-dim">.cpp</span></span>
          </div>

          <!-- Nav -->
          <nav class="vfb-nav" aria-label="Footer navigation">
            <a v-for="l in links" :key="l.text" class="vfb-link" :href="l.href">
              {{ l.text }}
            </a>
          </nav>

          <!-- Social -->
          <div class="vfb-social" aria-label="Social links">
            <a
              v-for="s in social"
              :key="s.label"
              class="vfb-icon"
              :href="s.href"
              target="_blank"
              rel="noreferrer"
              :aria-label="s.label"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
                <path v-html="s.icon"></path>
              </svg>
            </a>
          </div>

        </div>

        <div class="vfb-copy">
          <span>Released under the MIT License.</span>
          <span>Copyright © 2026 Vix.cpp / Softadastra</span>
        </div>
      </footer>
    </template>
  </Layout>
</template>

<style>
/* ── Footer bar ── */
.vfb {
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  padding: 0;
  flex-shrink: 0;
}

.vfb-inner {
  max-width: 1180px; margin: 0 auto; padding: 14px 20px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 20px;
}

/* Brand */
.vfb-brand {
  display: inline-flex; align-items: center; gap: 8px; text-decoration: none;
}

.vfb-logo { width: 24px; height: 24px; flex-shrink: 0; }

.vfb-name {
  font-size: 15px; font-weight: 800; letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
}
.vfb-name-dim { font-weight: 400; color: var(--vp-c-text-2); }

/* Nav */
.vfb-nav {
  display: flex; align-items: center; justify-content: center;
  gap: 24px; flex-wrap: wrap;
}

.vfb-link {
  font-size: 13px; font-weight: 600;
  color: var(--vp-c-text-2); text-decoration: none;
  transition: color .13s;
}
.vfb-link:hover { color: var(--vp-c-text-1); }

/* Social */
.vfb-social { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }

.vfb-icon {
  width: 30px; height: 30px;
  display: grid; place-items: center;
  color: var(--vp-c-text-2); text-decoration: none;
  border-radius: 7px; border: 1px solid transparent;
  transition: color .13s, border-color .13s, background .13s;
}
.vfb-icon:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

/* Copyright line */
.vfb-copy {
  display: flex; align-items: center; justify-content: center;
  gap: 20px; flex-wrap: wrap;
  padding: 8px 20px 12px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 11.5px; font-weight: 600; color: var(--vp-c-text-2);
}

/* ── Disable VitePress default footer ── */
.VPFooter { display: none !important; }

/* ── Responsive ── */
@media (max-width: 820px) {
  .vfb-inner { grid-template-columns: 1fr 1fr; }
  .vfb-nav   { display: none; }
}

@media (max-width: 480px) {
  .vfb-inner { grid-template-columns: 1fr; gap: 12px; padding: 12px 16px; }
  .vfb-social { justify-content: flex-start; }
  .vfb-copy   { padding: 8px 16px 10px; gap: 8px; flex-direction: column; text-align: center; }
}
</style>
