<script setup>
import DefaultTheme from "vitepress/theme";

const { Layout } = DefaultTheme;

const links = [
  { text: "Docs", href: "/" },
  { text: "Guide", href: "/guide" },
  { text: "Modules", href: "/modules" },
  { text: "Examples", href: "/examples" },
  { text: "Reference", href: "/reference" },
  { text: "Releases", href: "/releases" },
];

const social = [
  {
    label: "GitHub",
    href: "https://github.com/cnerium",
    icon: `<path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.54 2.87 8.39 6.84 9.75.5.1.68-.22.68-.48 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.9-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.2 9.2 0 0 1 12 7.07c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.93-2.34 4.79-4.57 5.05.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.84 0 .27.18.59.69.48A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"/>`,
  },
  {
    label: "X / Twitter",
    href: "https://x.com/cnerium",
    icon: `<path d="M18.9 2H22l-6.8 7.8L23 22h-6.7l-5.2-6.8L5.3 22H2l7.3-8.4L1.7 2h6.9l4.7 6.1L18.9 2Zm-1.2 18h1.7L7.7 3.9H5.9L17.7 20Z"/>`,
  },
];
</script>

<template>
  <Layout>
    <template #layout-bottom>
      <footer class="vfb" role="contentinfo">
        <div class="vfb-inner">
          <div class="vfb-brand">
            <svg
              class="vfb-logo"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="cnerium-footer-a"
                  x1="6"
                  y1="5"
                  x2="30"
                  y2="31"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stop-color="#d4fcd4" />
                  <stop offset="48%" stop-color="#4ade80" />
                  <stop offset="100%" stop-color="#16a34a" />
                </linearGradient>

                <linearGradient
                  id="cnerium-footer-b"
                  x1="30"
                  y1="6"
                  x2="8"
                  y2="30"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stop-color="#22c55e" />
                  <stop offset="100%" stop-color="#052e16" />
                </linearGradient>
              </defs>

              <rect
                x="4"
                y="4"
                width="28"
                height="28"
                rx="8"
                fill="url(#cnerium-footer-b)"
                opacity="0.22"
              />

              <path
                d="M24.5 11.5A8.5 8.5 0 1 0 25 24"
                stroke="url(#cnerium-footer-a)"
                stroke-width="3.2"
                stroke-linecap="round"
              />

              <path
                d="M16 18h12"
                stroke="#bbf7d0"
                stroke-width="2.4"
                stroke-linecap="round"
              />

              <path
                d="M23 13l5 5-5 5"
                stroke="#22c55e"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            <span class="vfb-name">
              Cnerium<span class="vfb-name-dim">.dev</span>
            </span>
          </div>

          <nav class="vfb-nav" aria-label="Footer navigation">
            <a
              v-for="l in links"
              :key="l.text"
              class="vfb-link"
              :href="l.href"
            >
              {{ l.text }}
            </a>
          </nav>

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
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="currentColor"
                aria-hidden="true"
              >
                <g v-html="s.icon"></g>
              </svg>
            </a>
          </div>
        </div>

        <div class="vfb-copy">
          <span>Released under the MIT License.</span>
          <span>Copyright © 2026 Cnerium / Softadastra</span>
        </div>
      </footer>
    </template>
  </Layout>
</template>

<style>
.vfb {
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  padding: 0;
  flex-shrink: 0;
}

.vfb-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 14px 20px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 20px;
}

.vfb-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.vfb-logo {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.vfb-name {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
}

.vfb-name-dim {
  font-weight: 400;
  color: var(--vp-c-text-2);
}

.vfb-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.vfb-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.13s;
}

.vfb-link:hover {
  color: var(--vp-c-text-1);
}

.vfb-social {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.vfb-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  color: var(--vp-c-text-2);
  text-decoration: none;
  border-radius: 7px;
  border: 1px solid transparent;
  transition:
    color 0.13s,
    border-color 0.13s,
    background 0.13s;
}

.vfb-icon:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.vfb-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  padding: 8px 20px 12px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.VPFooter {
  display: none !important;
}

@media (max-width: 820px) {
  .vfb-inner {
    grid-template-columns: 1fr 1fr;
  }

  .vfb-nav {
    display: none;
  }
}

@media (max-width: 480px) {
  .vfb-inner {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px 16px;
  }

  .vfb-social {
    justify-content: flex-start;
  }

  .vfb-copy {
    padding: 8px 16px 10px;
    gap: 8px;
    flex-direction: column;
    text-align: center;
  }
}
</style>
