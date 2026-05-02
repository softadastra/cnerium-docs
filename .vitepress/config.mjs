export default {
  title: "Cnerium",
  description: "The fast, minimalist web framework for Vix.",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ["meta", { name: "theme-color", content: "#0f172a" }],
    ["meta", { property: "og:title", content: "Cnerium Documentation" }],
    [
      "meta",
      {
        property: "og:description",
        content: "The fast, minimalist web framework for Vix.",
      },
    ],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:url", content: "https://docs.cnerium.dev" }],
  ],

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/app" },
      { text: "Examples", link: "/examples/basic-server" },
      { text: "Cnerium.dev", link: "https://cnerium.dev" },
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "What is Cnerium?", link: "/" },
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Installation", link: "/guide/installation" },
        ],
      },
      {
        text: "Core Concepts",
        items: [
          { text: "Application", link: "/guide/application" },
          { text: "Routing", link: "/guide/routing" },
          { text: "Middleware", link: "/guide/middleware" },
          { text: "Requests", link: "/guide/requests" },
          { text: "Responses", link: "/guide/responses" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "App", link: "/api/app" },
          { text: "Request", link: "/api/request" },
          { text: "Response", link: "/api/response" },
          { text: "Middleware", link: "/api/middleware" },
        ],
      },
      {
        text: "Examples",
        items: [
          { text: "Basic Server", link: "/examples/basic-server" },
          { text: "JSON API", link: "/examples/json-api" },
          { text: "Middleware", link: "/examples/middleware" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/cnerium" }],

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Cnerium",
    },
  },
};
