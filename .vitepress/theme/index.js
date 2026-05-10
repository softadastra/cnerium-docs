import DefaultTheme from "vitepress/theme";
import "./custom.css";
import "./style.css";

import Layout from "./Layout.vue";
import DocsHomeHero from "./DocsHomeHero.vue";
import CodeTabs from "./CodeTabs.vue";

export default {
  ...DefaultTheme,
  Layout,

  enhanceApp(ctx) {
    DefaultTheme.enhanceApp?.(ctx);

    const { app } = ctx;

    app.component("DocsHomeHero", DocsHomeHero);
    app.component("CodeTabs", CodeTabs);

    if (typeof window === "undefined") {
      return;
    }

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    window.addEventListener("load", () => {
      window.scrollTo(0, 0);
    });

    const updateLocalNavState = () => {
      const nav = document.querySelector(".VPNavBar");
      const localNav = document.querySelector(".VPLocalNav");

      if (!nav || !localNav) {
        return;
      }

      const navHeight = nav.getBoundingClientRect().height;
      const shouldFix = window.scrollY > navHeight;

      document.body.classList.toggle("vix-local-nav-fixed", shouldFix);
    };

    window.addEventListener("scroll", updateLocalNavState, { passive: true });
    window.addEventListener("resize", updateLocalNavState);
    window.requestAnimationFrame(updateLocalNavState);
  },
};
