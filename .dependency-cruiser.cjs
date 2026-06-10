/**
 * dependency-cruiser config — dependency analysis for ableton-mind.
 *
 * Scope: TypeScript (src/, tests/, scripts/). The Python bridge in
 * `live/AbletonMind/` is not covered by this tool because dep-cruiser only
 * parses JS/TS/CoffeeScript.
 *
 * These rules freeze the real graph observed in src/, not an aspirational
 * architecture. Each rule includes a comment explaining the reason.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── R1 ───────────────────────────────────────────────────────────────
    {
      name: "no-circular",
      comment:
        "No cycles between modules. Cycles break tree-shaking, " +
        "make import order meaningful and indicate a layer violation.",
      severity: "error",
      from: { pathNot: "^(node_modules)" },
      to: { circular: true },
    },

    // ── R2 ───────────────────────────────────────────────────────────────
    {
      name: "tools-cannot-touch-live-client",
      comment:
        "Tools (MCP domain layer) must talk to the bridge only through " +
        "`ctx.bridge` (BridgeClient), never by importing TcpJsonRpcClient " +
        "directly. Shortcuts break test mocks and the Phase 0 contract.",
      severity: "error",
      from: { path: "^src/tools/" },
      to: { path: "^src/live-client/" },
    },

    // ── R3 ───────────────────────────────────────────────────────────────
    {
      name: "tools-cannot-touch-knowledge",
      comment:
        "Knowledge performs filesystem I/O; tools must receive it through " +
        "`ctx` (Phase 1+ plan). Today no tool imports knowledge; this rule " +
        "freezes that boundary before shortcuts appear.",
      severity: "error",
      from: { path: "^src/tools/" },
      to: { path: "^src/knowledge/" },
    },

    // ── R4 ───────────────────────────────────────────────────────────────
    {
      name: "server-cannot-depend-on-tools",
      comment:
        "Inversion: tools are injected through `CreateServerOptions.tools`. " +
        "If the server imported tools, it would create a server/tools cycle " +
        "(tools already import server types).",
      severity: "error",
      from: { path: "^src/server/" },
      to: { path: "^src/tools/" },
    },

    // ── R5 ───────────────────────────────────────────────────────────────
    {
      name: "live-client-isolated-from-upper-layers",
      comment:
        "Lower layer: live-client may only depend upward on `utils`. Reaching " +
        "server/tools/knowledge inverts the hierarchy and creates cycles.",
      severity: "error",
      from: { path: "^src/live-client/" },
      to: { path: "^src/(server|tools|knowledge)/" },
    },

    // ── R6 ───────────────────────────────────────────────────────────────
    {
      name: "utils-must-stay-leaf",
      comment:
        "Logger is a leaf. Importing upward creates guaranteed cycles with " +
        "any module that already consumes it (server, live-client).",
      severity: "error",
      from: { path: "^src/utils/" },
      to: { path: "^src/(tools|server|live-client|knowledge)/" },
    },

    // ── R7 ───────────────────────────────────────────────────────────────
    {
      name: "knowledge-must-stay-pure",
      comment:
        "Knowledge is pure data embedded in the DXT bundle. It cannot depend " +
        "on logger/server/tools/live-client because that would break embedding.",
      severity: "error",
      from: { path: "^src/knowledge/" },
      to: { path: "^src/(tools|server|live-client|utils)/" },
    },

    // ── R8 ───────────────────────────────────────────────────────────────
    {
      name: "no-prod-import-from-tests-or-scripts",
      comment:
        "Production code (src/) must never import tests/ or scripts/. This " +
        "classic inversion leaks tests and tooling into the published bundle.",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^(tests|scripts)/" },
    },

    // ── R9 ───────────────────────────────────────────────────────────────
    {
      name: "no-orphans",
      comment:
        "Module imported by nobody: probably forgotten during a refactor. " +
        "Warn (not error) because entry points and barrels can be false " +
        "positives while the project grows (Phases 1-7).",
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
        "\\.test\\.ts$", // tests are not part of the production graph
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
