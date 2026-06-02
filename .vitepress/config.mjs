import { defineConfig } from "vitepress";

const nav = [
  {
    text: "Vix.cpp",
    link: "https://vixcpp.com",
  },
  {
    text: "Vix Docs",
    link: "https://docs.vixcpp.com",
  },
  {
    text: "Softadastra",
    link: "https://softadastra.com",
  },
];

const gettingStarted = {
  text: "Getting Started",
  collapsed: false,
  items: [
    {
      text: "Introduction",
      link: "/getting-started/",
    },
    {
      text: "What is Cnerium?",
      link: "/getting-started/what-is-cnerium",
    },
    {
      text: "Why Cnerium Exists",
      link: "/getting-started/why-cnerium-exists",
    },
    {
      text: "Install",
      link: "/getting-started/install",
    },
    {
      text: "Your First Durable Route",
      link: "/getting-started/first-durable-route",
    },
  ],
};

const coreConcepts = {
  text: "Core Concepts",
  collapsed: false,
  items: [
    {
      text: "Cnerium and Vix",
      link: "/concepts/cnerium-and-vix",
    },
    {
      text: "Attach Model",
      link: "/concepts/attach-model",
    },
    {
      text: "Durable Routes",
      link: "/concepts/durable-routes",
    },
    {
      text: "Idempotency",
      link: "/concepts/idempotency",
    },
    {
      text: "Replay Protection",
      link: "/concepts/replay-protection",
    },
    {
      text: "Stored Responses",
      link: "/concepts/stored-responses",
    },
    {
      text: "Realtime Events",
      link: "/concepts/realtime-events",
    },
  ],
};

const guides = {
  text: "Guides",
  collapsed: false,
  items: [
    {
      text: "Add Cnerium to a Vix Backend",
      link: "/guides/add-to-vix-backend",
    },
    {
      text: "Create a Durable POST Route",
      link: "/guides/create-durable-post-route",
    },
    {
      text: "Use Idempotency-Key",
      link: "/guides/use-idempotency-key",
    },
    {
      text: "Emit Realtime Events",
      link: "/guides/emit-realtime-events",
    },
    {
      text: "Handle Unsafe Retries",
      link: "/guides/handle-unsafe-retries",
    },
    {
      text: "Configure Storage",
      link: "/guides/configure-storage",
    },
    {
      text: "Test Durable Behavior",
      link: "/guides/test-durable-behavior",
    },
  ],
};

const examples = {
  text: "Examples",
  collapsed: true,
  items: [
    {
      text: "Overview",
      link: "/examples/",
    },
    {
      text: "Durable Orders",
      link: "/examples/durable-orders",
    },
    {
      text: "Durable Orders with Realtime",
      link: "/examples/durable-orders-realtime",
    },
    {
      text: "Payments",
      link: "/examples/payments",
    },
    {
      text: "Registration",
      link: "/examples/registration",
    },
  ],
};

const reference = {
  text: "Reference",
  collapsed: true,
  items: [
    {
      text: "Overview",
      link: "/reference/",
    },
    {
      text: "attach",
      link: "/reference/attach",
    },
    {
      text: "AttachedApp",
      link: "/reference/attached-app",
    },
    {
      text: "AppConfig",
      link: "/reference/app-config",
    },
    {
      text: "DurableRequest",
      link: "/reference/durable-request",
    },
    {
      text: "DurableResponse",
      link: "/reference/durable-response",
    },
    {
      text: "DurableRoute",
      link: "/reference/durable-route",
    },
    {
      text: "Idempotency",
      link: "/reference/idempotency",
    },
    {
      text: "Store",
      link: "/reference/store",
    },
    {
      text: "Realtime",
      link: "/reference/realtime",
    },
  ],
};

const internals = {
  text: "Internals",
  collapsed: true,
  items: [
    {
      text: "Architecture",
      link: "/internals/architecture",
    },
    {
      text: "Vix Integration",
      link: "/internals/vix-integration",
    },
    {
      text: "Softadastra SDK Integration",
      link: "/internals/softadastra-sdk-integration",
    },
    {
      text: "Request Lifecycle",
      link: "/internals/request-lifecycle",
    },
    {
      text: "Storage Keys",
      link: "/internals/storage-keys",
    },
    {
      text: "Design Boundaries",
      link: "/internals/design-boundaries",
    },
  ],
};

const community = {
  text: "Community",
  collapsed: true,
  items: [
    {
      text: "Contributing",
      link: "/contributing",
    },
    {
      text: "Security",
      link: "/security",
    },
    {
      text: "Code of Conduct",
      link: "/code-of-conduct",
    },
  ],
};

const sidebar = [
  gettingStarted,
  coreConcepts,
  guides,
  examples,
  reference,
  internals,
  community,
];

export default defineConfig({
  lang: "en-US",

  title: "Cnerium Documentation",
  description:
    "Cnerium is the reliability layer for Vix backends. It attaches to vix::App and adds durable, idempotent, retry-safe routes powered by the Softadastra SDK.",

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
          "Cnerium is the reliability layer for Vix backends. It attaches to vix::App and adds durable, idempotent, retry-safe routes powered by the Softadastra SDK.",
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
          "Cnerium is the reliability layer for Vix backends. It attaches to vix::App and adds durable, idempotent, retry-safe routes powered by the Softadastra SDK.",
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

    nav,

    sidebar,

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
        link: "https://github.com/softadastra/cnerium",
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
      pattern: "https://github.com/softadastra/cnerium/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    docFooter: {
      prev: "Previous page",
      next: "Next page",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Softadastra",
    },
  },
});
