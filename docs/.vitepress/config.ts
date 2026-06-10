import { defineConfig } from "vitepress";

const enSidebar = [
  {
    text: "For artists",
    items: [
      { text: "What is ableton-mind?", link: "/guide/what-is-ableton-mind" },
      {
        text: "Get started",
        items: [
          { text: "Installation", link: "/guide/installation" },
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Your first Live set", link: "/guide/first-live-set" },
          { text: "Prompt cookbook", link: "/guide/prompt-cookbook" },
          { text: "Recipe gallery", link: "/recipes/" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
        ],
      },
    ],
  },
  {
    text: "For developers",
    items: [
      { text: "Architecture", link: "/architecture" },
      { text: "Tools (21 LOM domains)", link: "/tools/" },
      { text: "Knowledge base", link: "/knowledge/" },
      { text: "Recipes", link: "/recipes/" },
      { text: "Distribution", link: "/distribution" },
      { text: "Smoke test", link: "/smoke-test" },
    ],
  },
  {
    text: "Operations",
    items: [{ text: "Changelog", link: "/changelog" }],
  },
];

const ptSidebar = [
  {
    text: "Para artistas",
    items: [
      { text: "O que e ableton-mind?", link: "/pt/guide/what-is-ableton-mind" },
      {
        text: "Comece aqui",
        items: [
          { text: "Instalacao", link: "/pt/guide/installation" },
          { text: "Primeiros passos", link: "/pt/guide/getting-started" },
          { text: "Seu primeiro set no Live", link: "/pt/guide/first-live-set" },
          { text: "Prompt cookbook", link: "/pt/guide/prompt-cookbook" },
          { text: "Galeria de recipes", link: "/pt/recipes/" },
          { text: "Troubleshooting", link: "/pt/guide/troubleshooting" },
        ],
      },
    ],
  },
  {
    text: "Para devs",
    items: [
      { text: "Architecture", link: "/pt/architecture" },
      { text: "Tools (21 LOM domains)", link: "/pt/tools/" },
      { text: "Knowledge base", link: "/pt/knowledge/" },
      { text: "Recipes", link: "/pt/recipes/" },
      { text: "Distribution", link: "/pt/distribution" },
      { text: "Smoke test", link: "/pt/smoke-test" },
    ],
  },
  {
    text: "Operacao",
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
          { text: "Artists", link: "/guide/what-is-ableton-mind" },
          { text: "Cookbook", link: "/guide/prompt-cookbook" },
          { text: "Developers", link: "/architecture" },
          { text: "Tools", link: "/tools/" },
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
          { text: "Artistas", link: "/pt/guide/what-is-ableton-mind" },
          { text: "Cookbook", link: "/pt/guide/prompt-cookbook" },
          { text: "Devs", link: "/pt/architecture" },
          { text: "Tools", link: "/pt/tools/" },
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
