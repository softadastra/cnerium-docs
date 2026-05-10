import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "en-US",

  title: "Cnerium Documentation",
  description:
    "Build fast, simple, and reliable C++ web applications with Cnerium.",

  base: "/",

  cleanUrls: true,

  markdown: {
    html: true,
    lineNumbers: true,
  },

  head: [
    ["link", { rel: "icon", href: "/favicon.svg" }],
    ["link", { rel: "apple-touch-icon", href: "/logo.svg" }],

    ["meta", { name: "theme-color", content: "#0b0e14" }],
    ["meta", { name: "mobile-web-app-capable", content: "yes" }],
    ["meta", { name: "apple-mobile-web-app-capable", content: "yes" }],
    [
      "meta",
      {
        name: "apple-mobile-web-app-title",
        content: "Cnerium Docs",
      },
    ],

    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Cnerium Documentation" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Build fast, simple, and reliable C++ web applications with Cnerium.",
      },
    ],
    ["meta", { property: "og:site_name", content: "Cnerium Documentation" }],
    ["meta", { property: "og:image", content: "/og-image.png" }],

    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: "Cnerium Documentation" }],
    [
      "meta",
      {
        name: "twitter:description",
        content:
          "Build fast, simple, and reliable C++ web applications with Cnerium.",
      },
    ],
    ["meta", { name: "twitter:image", content: "/og-image.png" }],
  ],

  vite: {
    optimizeDeps: {
      include: ["mark.js", "minisearch"],
    },

    ssr: {
      noExternal: ["mark.js"],
    },

    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }

            if (id.includes("minisearch")) {
              return "minisearch";
            }

            if (id.includes("mark.js")) {
              return "markjs";
            }

            return "vendor";
          },
        },
      },
    },
  },

  themeConfig: {
    siteTitle: "Cnerium",
    logo: "/logo.svg",

    appearance: true,

    nav: [
      {
        text: "Guide",
        link: "/guide/",
      },
      {
        text: "Modules",
        link: "/modules/",
      },
      {
        text: "Examples",
        link: "/examples/",
      },
      {
        text: "Reference",
        link: "/reference/",
      },
      {
        text: "Registry",
        link: "https://registry.vixcpp.com/",
      },
    ],

    sidebar: [
      {
        text: "Introduction",
        collapsed: false,
        items: [
          {
            text: "Home",
            link: "/",
          },
          {
            text: "What is Cnerium?",
            link: "/what-is-cnerium",
          },
          {
            text: "Installation",
            link: "/installation",
          },
          {
            text: "Quick Start",
            link: "/quick-start",
          },
          {
            text: "First App",
            link: "/first-app",
          },
        ],
      },

      {
        text: "Guide",
        collapsed: false,
        items: [
          {
            text: "Overview",
            link: "/guide/",
          },
          {
            text: "Project Structure",
            link: "/guide/project-structure",
          },
          {
            text: "Routing",
            link: "/guide/routing",
          },
          {
            text: "Route Parameters",
            link: "/guide/route-parameters",
          },
          {
            text: "Request",
            link: "/guide/request",
          },
          {
            text: "Response",
            link: "/guide/response",
          },
          {
            text: "JSON",
            link: "/guide/json",
          },
          {
            text: "Middleware",
            link: "/guide/middleware",
          },
          {
            text: "Error Handling",
            link: "/guide/error-handling",
          },
          {
            text: "Not Found",
            link: "/guide/not-found",
          },
          {
            text: "Runtime",
            link: "/guide/runtime",
          },
          {
            text: "Configuration",
            link: "/guide/configuration",
          },
          {
            text: "Printing with vix::print",
            link: "/guide/printing",
          },
          {
            text: "Deployment",
            link: "/guide/deployment",
          },
        ],
      },

      {
        text: "Modules",
        collapsed: false,
        items: [
          {
            text: "Overview",
            link: "/modules/",
          },
          {
            text: "JSON",
            link: "/modules/json",
          },
          {
            text: "HTTP",
            link: "/modules/http",
          },
          {
            text: "Router",
            link: "/modules/router",
          },
          {
            text: "Middleware",
            link: "/modules/middleware",
          },
          {
            text: "Server",
            link: "/modules/server",
          },
          {
            text: "Runtime",
            link: "/modules/runtime",
          },
          {
            text: "App",
            link: "/modules/app",
          },
        ],
      },

      {
        text: "Examples",
        collapsed: true,
        items: [
          {
            text: "Overview",
            link: "/examples/",
          },
          {
            text: "Hello World",
            link: "/examples/hello-world",
          },
          {
            text: "Basic Routes",
            link: "/examples/basic-routes",
          },
          {
            text: "JSON API",
            link: "/examples/json-api",
          },
          {
            text: "Middleware",
            link: "/examples/middleware",
          },
          {
            text: "Runtime Server",
            link: "/examples/runtime-server",
          },
          {
            text: "REST API",
            link: "/examples/rest-api",
          },
        ],
      },

      {
        text: "Reference",
        collapsed: true,
        items: [
          {
            text: "Overview",
            link: "/reference/",
          },
          {
            text: "App",
            link: "/reference/app",
          },
          {
            text: "AppContext",
            link: "/reference/app-context",
          },
          {
            text: "AppConfig",
            link: "/reference/app-config",
          },
          {
            text: "Server",
            link: "/reference/server",
          },
          {
            text: "Runtime",
            link: "/reference/runtime",
          },
          {
            text: "vix::print",
            link: "/reference/vix-print",
          },
          {
            text: "vix::console",
            link: "/reference/vix-console",
          },
        ],
      },

      {
        text: "Releases",
        collapsed: true,
        items: [
          {
            text: "Overview",
            link: "/releases/",
          },
          {
            text: "0.5.0",
            link: "/releases/0.5.0",
          },
        ],
      },
    ],

    search: {
      provider: "local",
      options: {
        miniSearch: {
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
          },
        },
      },
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/cnerium/app",
      },
      {
        icon: "x",
        link: "https://x.com/softadastra",
      },
    ],

    outline: {
      level: "deep",
      label: "On this page",
    },

    returnToTopLabel: "Back to top",

    lastUpdated: {
      text: "Last updated",
      formatOptions: {
        dateStyle: "medium",
        timeStyle: "short",
      },
    },

    editLink: {
      pattern: "https://github.com/cnerium/docs/edit/main/:path",
      text: "Edit this page on GitHub",
    },

    docFooter: {
      prev: "Previous page",
      next: "Next page",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Cnerium",
    },
  },
});
