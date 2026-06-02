<script setup>
import CodeBlock from "./CodeBlock.vue";

const heroCode = `#include <vix.hpp>
#include <cnerium/cnerium.hpp>
int main()
{
  vix::App app;
  auto cnerium = cnerium::attach(app);

  cnerium.durable_post("/orders","orders.create",
      [](cnerium::DurableRequest &request){
        return cnerium::created({
            {"ok", true}
      });
  });

  cnerium.start();
  app.run();
}`;
const features = [
  {
    title: "Vix Integration",
    desc: "Keep Vix as the backend owner and attach Cnerium only where retry safety matters.",
    icon: "swap",
    href: "/concepts/cnerium-and-vix",
  },
  {
    title: "Durable Routes",
    desc: "Protect critical POST operations with stored responses, replay safety, and clear execution rules.",
    icon: "bolt",
    href: "/concepts/durable-routes",
  },
  {
    title: "Idempotency",
    desc: "Use Idempotency-Key and request body hashing to distinguish safe retries from unsafe reuse.",
    icon: "chip",
    href: "/concepts/idempotency",
  },
  {
    title: "Realtime Events",
    desc: "Emit application events from durable handlers without duplicating notifications on safe retries.",
    icon: "p2p",
    href: "/concepts/realtime-events",
  },
];

function iconPath(name) {
  if (name === "swap") {
    return "M7 7h11l-2-2m2 2l-2 2M17 17H6l2 2m-2-2l2-2";
  }

  if (name === "bolt") {
    return "M13 2L4 14h7l-1 8 9-12h-7l1-8z";
  }

  if (name === "chip") {
    return "M9 9h6v6H9V9zm-5 3h2m12 0h2M12 4v2m0 12v2M6.5 6.5l1.4 1.4m8.2 8.2l1.4 1.4m0-12.4l-1.4 1.4M7.9 16.1l-1.4 1.4";
  }

  return "M6 12a2 2 0 114 0 2 2 0 01-4 0zm8-6a2 2 0 114 0 2 2 0 01-4 0zm0 12a2 2 0 114 0 2 2 0 01-4 0zM10 12l4-6M10 12l4 6";
}
</script>

<template>
  <div class="vix-docs-hero">
    <div class="vix-docs-hero__left">
      <h1 class="vix-docs-h1">Cnerium Documentation</h1>

      <p class="vix-docs-lead">
        A reliability-first backend layer for Vix applications.
      </p>

      <p class="vix-docs-body">
        Cnerium does not replace Vix. It attaches to an existing Vix backend and
        adds durable route behavior for critical write operations that must stay
        correct under retries, timeouts, lost responses, and unstable networks.
      </p>

      <div class="actions">
        <a class="primary" href="/getting-started/">
          Get started <span class="cta-arrow">→</span>
        </a>
      </div>
    </div>

    <div class="vix-docs-hero__right">
      <div class="vix-hero-annot vix-hint">
        Attach Cnerium to Vix <br />
        and protect critical writes
      </div>

      <CodeBlock
        title="main.cpp"
        lang="cpp"
        :chips="['vix', 'cnerium', 'durable']"
        :code="heroCode"
        :maxHeight="420"
      />
    </div>
  </div>

  <div class="vix-hero-cards">
    <a
      v-for="f in features"
      :key="f.title"
      class="vix-hero-card"
      :href="f.href"
    >
      <div class="vix-hero-card__top">
        <div class="vix-hero-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              :d="iconPath(f.icon)"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <div class="vix-hero-card__arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>

      <div class="vix-hero-card__title">{{ f.title }}</div>
      <div class="vix-hero-card__desc">{{ f.desc }}</div>
    </a>
  </div>
</template>
