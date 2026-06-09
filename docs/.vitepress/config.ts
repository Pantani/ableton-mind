import { defineConfig } from "vitepress";

const ptSidebar = [
  {
    text: "Guia",
    items: [
      { text: "Visão geral", link: "/" },
      { text: "Começando", link: "/guide/getting-started" },
      { text: "Instalação", link: "/guide/installation" },
      { text: "Smoke test", link: "/smoke-test" },
    ],
  },
  {
    text: "Referência",
    items: [
      { text: "Arquitetura", link: "/architecture" },
      { text: "Tools (21 domínios LOM)", link: "/tools/" },
      { text: "Knowledge base", link: "/knowledge/" },
      { text: "Recipes", link: "/recipes/" },
      { text: "Distribuição", link: "/distribution" },
    ],
  },
  {
    text: "Projeto",
    items: [{ text: "Changelog", link: "/changelog" }],
  },
];

const enSidebar = [
  {
    text: "Guide",
    items: [
      { text: "Overview", link: "/en/" },
      { text: "Getting started", link: "/en/guide/getting-started" },
      { text: "Installation", link: "/en/guide/installation" },
      { text: "Smoke test", link: "/en/smoke-test" },
    ],
  },
  {
    text: "Reference",
    items: [
      { text: "Architecture", link: "/en/architecture" },
      { text: "Tools (21 LOM domains)", link: "/en/tools/" },
      { text: "Knowledge base", link: "/en/knowledge/" },
      { text: "Recipes", link: "/en/recipes/" },
      { text: "Distribution", link: "/en/distribution" },
    ],
  },
  {
    text: "Project",
    items: [{ text: "Changelog", link: "/en/changelog" }],
  },
];

export default defineConfig({
  title: "ableton-mind",
  description:
    "Servidor MCP definitivo para Ableton Live — cobertura completa do LOM, knowledge base embutida e recipes musicais.",
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
      label: "Português",
      lang: "pt-BR",
      title: "ableton-mind",
      description: "Servidor MCP definitivo para Ableton Live.",
      themeConfig: {
        nav: [
          { text: "Guia", link: "/guide/getting-started" },
          { text: "Arquitetura", link: "/architecture" },
          { text: "Tools", link: "/tools/" },
          { text: "Knowledge", link: "/knowledge/" },
          { text: "Recipes", link: "/recipes/" },
          { text: "Distribuição", link: "/distribution" },
          { text: "Changelog", link: "/changelog" },
        ],
        sidebar: ptSidebar,
        outline: { label: "Nesta página" },
        docFooter: { prev: "Anterior", next: "Próximo" },
        lastUpdatedText: "Atualizado em",
        darkModeSwitchLabel: "Tema",
        sidebarMenuLabel: "Menu",
        returnToTopLabel: "Voltar ao topo",
      },
    },
    en: {
      label: "English",
      lang: "en-US",
      link: "/en/",
      title: "ableton-mind",
      description: "Definitive MCP server for Ableton Live.",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/en/guide/getting-started" },
          { text: "Architecture", link: "/en/architecture" },
          { text: "Tools", link: "/en/tools/" },
          { text: "Knowledge", link: "/en/knowledge/" },
          { text: "Recipes", link: "/en/recipes/" },
          { text: "Distribution", link: "/en/distribution" },
          { text: "Changelog", link: "/en/changelog" },
        ],
        sidebar: enSidebar,
      },
    },
  },
});
