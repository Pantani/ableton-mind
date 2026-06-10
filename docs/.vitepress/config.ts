import { defineConfig } from "vitepress";

const enSidebar = [
  {
    text: "Guide",
    items: [
      { text: "Overview", link: "/" },
      { text: "Getting started", link: "/guide/getting-started" },
      { text: "Installation", link: "/guide/installation" },
      { text: "Smoke test", link: "/smoke-test" },
    ],
  },
  {
    text: "Reference",
    items: [
      { text: "Architecture", link: "/architecture" },
      { text: "Tools (21 LOM domains)", link: "/tools/" },
      { text: "Knowledge base", link: "/knowledge/" },
      { text: "Recipes", link: "/recipes/" },
      { text: "Distribution", link: "/distribution" },
    ],
  },
  {
    text: "Project",
    items: [{ text: "Changelog", link: "/changelog" }],
  },
];

const ptSidebar = [
  {
    text: "Guide",
    items: [
      { text: "Overview", link: "/pt/" },
      { text: "Getting started", link: "/pt/guide/getting-started" },
      { text: "Installation", link: "/pt/guide/installation" },
      { text: "Smoke test", link: "/pt/smoke-test" },
    ],
  },
  {
    text: "Reference",
    items: [
      { text: "Architecture", link: "/pt/architecture" },
      { text: "Tools (21 LOM domains)", link: "/pt/tools/" },
      { text: "Knowledge base", link: "/pt/knowledge/" },
      { text: "Recipes", link: "/pt/recipes/" },
      { text: "Distribution", link: "/pt/distribution" },
    ],
  },
  {
    text: "Project",
    items: [{ text: "Changelog", link: "/pt/changelog" }],
  },
];

export default defineConfig({
  title: "ableton-mind",
  description:
    "Definitive MCP server for Ableton Live — full LOM coverage, embedded knowledge base, music recipes.",
  base: "/ableton-mind/",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  head: [
    ["meta", { name: "theme-color", content: "#8b5cf6" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "ableton-mind" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "MCP server for Ableton Live with full LOM coverage, embedded knowledge base and music recipes.",
      },
    ],
  ],

  themeConfig: {
    search: { provider: "local" },
    socialLinks: [
      { icon: "github", link: "https://github.com/Pantani/ableton-mind" },
      { icon: "npm", link: "https://www.npmjs.com/package/ableton-mind" },
    ],
    footer: {
      message: "MIT License",
      copyright: "Copyright © 2026 ableton-mind contributors",
    },
  },

  locales: {
    root: {
      label: "English",
      lang: "en-US",
      title: "ableton-mind",
      description: "Definitive MCP server for Ableton Live.",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/getting-started" },
          { text: "Architecture", link: "/architecture" },
          { text: "Tools", link: "/tools/" },
          { text: "Knowledge", link: "/knowledge/" },
          { text: "Recipes", link: "/recipes/" },
          { text: "Distribution", link: "/distribution" },
          { text: "Changelog", link: "/changelog" },
        ],
        sidebar: enSidebar,
      },
    },
    pt: {
      label: "pt",
      lang: "pt",
      link: "/pt/",
      title: "ableton-mind",
      description: "Definitive MCP server for Ableton Live.",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/pt/guide/getting-started" },
          { text: "Architecture", link: "/pt/architecture" },
          { text: "Tools", link: "/pt/tools/" },
          { text: "Knowledge", link: "/pt/knowledge/" },
          { text: "Recipes", link: "/pt/recipes/" },
          { text: "Distribution", link: "/pt/distribution" },
          { text: "Changelog", link: "/pt/changelog" },
        ],
        sidebar: ptSidebar,
        outline: { label: "On this page" },
        docFooter: { prev: "Previous", next: "Next" },
        lastUpdatedText: "Updated at",
        darkModeSwitchLabel: "Theme",
        sidebarMenuLabel: "Menu",
        returnToTopLabel: "Return to top",
      },
    },
  },
});
