/**
 * dependency-cruiser config — Dependency Analysis para ableton-mind.
 *
 * Escopo: TypeScript (src/, tests/, scripts/). A bridge Python em
 * `live/AbletonMind/` NÃO é coberta por esta ferramenta (dep-cruiser
 * só parseia JS/TS/CoffeeScript).
 *
 * As regras petrificam o grafo real observado em src/, não uma
 * arquitetura aspiracional. Cada regra tem comentário com a justificativa.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── R1 ───────────────────────────────────────────────────────────────
    {
      name: "no-circular",
      comment:
        "Nenhum ciclo entre módulos. Ciclos quebram tree-shaking, " +
        "tornam ordem de import significativa e indicam violação de camada.",
      severity: "error",
      from: { pathNot: "^(node_modules)" },
      to: { circular: true },
    },

    // ── R2 ───────────────────────────────────────────────────────────────
    {
      name: "tools-cannot-touch-live-client",
      comment:
        "Tools (camada de domínio MCP) devem falar com a bridge somente " +
        "via `ctx.bridge` (BridgeClient), nunca importar o TcpJsonRpcClient " +
        "direto. Atalho quebra mock em testes e o contrato Phase 0.",
      severity: "error",
      from: { path: "^src/tools/" },
      to: { path: "^src/live-client/" },
    },

    // ── R3 ───────────────────────────────────────────────────────────────
    {
      name: "tools-cannot-touch-knowledge",
      comment:
        "Knowledge faz I/O de filesystem; tools devem recebê-lo via `ctx` " +
        "(plano Phase 1+). Hoje nenhuma tool importa knowledge — esta " +
        "regra petrifica o limite antes que apareça atalho.",
      severity: "error",
      from: { path: "^src/tools/" },
      to: { path: "^src/knowledge/" },
    },

    // ── R4 ───────────────────────────────────────────────────────────────
    {
      name: "server-cannot-depend-on-tools",
      comment:
        "Inversão: tools são injetadas via `CreateServerOptions.tools`. " +
        "Se server importasse tools, surgiria ciclo server ↔ tools " +
        "(tools já importam types do server).",
      severity: "error",
      from: { path: "^src/server/" },
      to: { path: "^src/tools/" },
    },

    // ── R5 ───────────────────────────────────────────────────────────────
    {
      name: "live-client-isolated-from-upper-layers",
      comment:
        "Camada inferior: live-client só pode subir até `utils`. Subir até " +
        "server/tools/knowledge inverte a hierarquia e cria ciclos.",
      severity: "error",
      from: { path: "^src/live-client/" },
      to: { path: "^src/(server|tools|knowledge)/" },
    },

    // ── R6 ───────────────────────────────────────────────────────────────
    {
      name: "utils-must-stay-leaf",
      comment:
        "Logger é folha. Importar para cima cria ciclos garantidos com " +
        "qualquer módulo que já o consome (server, live-client).",
      severity: "error",
      from: { path: "^src/utils/" },
      to: { path: "^src/(tools|server|live-client|knowledge)/" },
    },

    // ── R7 ───────────────────────────────────────────────────────────────
    {
      name: "knowledge-must-stay-pure",
      comment:
        "Knowledge é dado puro embarcado no bundle DXT. Não pode depender " +
        "de logger/server/tools/live-client — quebraria embutibilidade.",
      severity: "error",
      from: { path: "^src/knowledge/" },
      to: { path: "^src/(tools|server|live-client|utils)/" },
    },

    // ── R8 ───────────────────────────────────────────────────────────────
    {
      name: "no-prod-import-from-tests-or-scripts",
      comment:
        "Código de produção (src/) jamais pode importar tests/ ou scripts/. " +
        "Inversão clássica que vaza testes e tooling no bundle publicado.",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^(tests|scripts)/" },
    },

    // ── R9 ───────────────────────────────────────────────────────────────
    {
      name: "no-orphans",
      comment:
        "Módulo sem ninguém importando: provavelmente esquecido em refactor. " +
        "Warn (não error) porque entry points e barrels podem ser falso-positivos " +
        "durante o crescimento do projeto (Phases 1-7).",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|cts|mts|json)$", // dot-files
          "\\.d\\.ts$",
          "(^|/)tsconfig\\.json$",
          "(^|/)(babel|webpack|tsup|vitest|biome)\\.config\\.(js|cjs|mjs|ts)$",
          "^src/index\\.ts$", // entry point
        ],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: true,
    includeOnly: "^(src|tests|scripts)/",
    exclude: {
      path: [
        "\\.test\\.ts$", // testes não entram no grafo de produção
        "^node_modules/",
        "^dist/",
        "^coverage/",
        "^_workspace/",
        "^live/", // Python — fora do escopo
      ],
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["main", "types"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
