<script setup>
import CodeBlock from "./CodeBlock.vue";

const heroCode = `#include <cnerium/app/app.hpp>
#include <vix/console.hpp>
using namespace cnerium::app;

int main(){
  App app;
  app.get("/", [](AppContext &ctx){
    ctx.text("Hello from Cnerium");
  });

  app.listen("127.0.0.1", 8080, [](){
    vix::console.info("Cnerium app is ready");
  });
}`;

const features = [
  {
    title: "App Layer",
    desc: "Build clean C++ web applications with routes, middleware, JSON, and runtime access.",
    icon: "swap",
    href: "/modules/app",
  },
  {
    title: "Routing",
    desc: "Register explicit HTTP routes with path parameters and predictable request handling.",
    icon: "bolt",
    href: "/guide/routing",
  },
  {
    title: "Middleware",
    desc: "Compose logging, headers, auth guards, CORS, timing, and early responses in order.",
    icon: "chip",
    href: "/guide/middleware",
  },
  {
    title: "Runtime",
    desc: "Schedule background tasks and run concurrent work through the Cnerium runtime layer.",
    icon: "p2p",
    href: "/guide/runtime",
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
        A minimal C++ web framework for building clean,
        fast, and explicit HTTP applications.
      </p>

      <p class="vix-docs-body">
        Cnerium is built on top of Vix and gives modern C++ developers
        a simple application layer for routes, JSON APIs, middleware,
        error handling, runtime tasks, and server configuration without
        hidden framework magic.
      </p>

      <div class="actions">
        <a class="primary" href="/quick-start">
          Get started <span class="cta-arrow">→</span>
        </a>
      </div>
    </div>

    <div class="vix-docs-hero__right">
      <div class="vix-hero-annot vix-hint">
        Your first C++ endpoint <br>
        with the Cnerium App API
      </div>

      <CodeBlock
        title="main.cpp"
        lang="cpp"
        :chips="['app', 'http']"
        :code="heroCode"
        :maxHeight="360"
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
