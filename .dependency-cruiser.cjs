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
      name: "server-cannot-depend-on-tools",
      comment:
        "Inversion: tools are injected through `CreateServerOptions.tools`. " +
        "If the server imported tools, it would create a server/tools cycle " +
        "(tools already import server types).",
      severity: "error",
      from: { path: "^src/server/" },
      to: { path: "^src/tools/" },
    },

    // ── R4 ───────────────────────────────────────────────────────────────
    {
      name: "entrypoints-only-import-cli",
      comment:
        "CLI modules are entrypoint concerns. Application modules must not " +
        "depend on them; only src/index.ts can dispatch to CLI commands.",
      severity: "error",
      from: { path: "^src/(?!index\\.ts$)(?!cli/)" },
      to: { path: "^src/cli/" },
    },

    // ── R5 ───────────────────────────────────────────────────────────────
    {
      name: "lower-layers-do-not-import-llm",
      comment:
        "The local LLM copilot is an orchestration layer used by the CLI, " +
        "not a dependency for server/tools/resources/support modules.",
      severity: "error",
      from: {
        path: "^src/(server|tools|resources|prompts|live-client|knowledge|recipes|feedback|utils)/",
      },
      to: { path: "^src/llm/" },
    },

    // ── R6 ───────────────────────────────────────────────────────────────
    {
      name: "live-client-isolated-from-upper-layers",
      comment:
        "Lower layer: live-client may only depend upward on `utils`. Reaching " +
        "server/tools/knowledge/resources/prompts/cli/llm inverts the hierarchy.",
      severity: "error",
      from: { path: "^src/live-client/" },
      to: { path: "^src/(server|tools|knowledge|resources|prompts|cli|llm)/" },
    },

    // ── R7 ───────────────────────────────────────────────────────────────
    {
      name: "utils-must-stay-leaf",
      comment:
        "Logger is a leaf. Importing upward creates guaranteed cycles with " +
        "any module that already consumes it (server, live-client).",
      severity: "error",
      from: { path: "^src/utils/" },
      to: { path: "^src/(tools|resources|prompts|server|live-client|knowledge|cli|llm)/" },
    },

    // ── R8 ───────────────────────────────────────────────────────────────
    {
      name: "knowledge-must-stay-pure",
      comment:
        "Knowledge is pure data embedded in the DXT bundle. It cannot depend " +
        "on logger/server/tools/live-client because that would break embedding.",
      severity: "error",
      from: { path: "^src/knowledge/" },
      to: { path: "^src/(tools|resources|prompts|server|live-client|utils|cli|llm)/" },
    },

    // ── R9 ───────────────────────────────────────────────────────────────
    {
      name: "resources-cannot-import-tools",
      comment:
        "MCP resources expose readable state and indexes; they must not " +
        "execute or depend on tools.",
      severity: "error",
      from: { path: "^src/resources/" },
      to: { path: "^src/tools/" },
    },

    // ── R10 ──────────────────────────────────────────────────────────────
    {
      name: "prompts-are-static",
      comment:
        "Prompt templates must stay independent from runtime entrypoints, " +
        "tools, server and transport layers.",
      severity: "error",
      from: { path: "^src/prompts/" },
      to: { path: "^src/(tools|resources|server|live-client|cli|llm)/" },
    },

    // ── R11 ──────────────────────────────────────────────────────────────
    {
      name: "tools-cannot-import-entrypoints-or-cli",
      comment:
        "MCP tools should remain reusable and must not depend on process " +
        "entrypoints, CLI or LLM orchestration.",
      severity: "error",
      from: { path: "^src/tools/" },
      to: { path: "^src/(index\\.ts$|cli/|llm/)" },
    },

    // ── R12 ──────────────────────────────────────────────────────────────
    {
      name: "no-prod-import-from-tests-or-scripts",
      comment:
        "Production code (src/) must never import tests/ or scripts/. This " +
        "classic inversion leaks tests and tooling into the published bundle.",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^(tests|scripts)/" },
    },

    // ── R13 ──────────────────────────────────────────────────────────────
    {
      name: "tests-cannot-import-dist-or-live-runtime",
      comment:
        "TypeScript tests should validate source modules, not generated " +
        "dist files or the Python Remote Script.",
      severity: "error",
      from: { path: "^tests/" },
      to: { path: "^(dist|live)/" },
    },

    // ── R14 ──────────────────────────────────────────────────────────────
    {
      name: "scripts-cannot-import-src",
      comment:
        "Operational scripts should not become coupled to runtime " +
        "TypeScript internals.",
      severity: "error",
      from: { path: "^scripts/" },
      to: { path: "^src/" },
    },
  ],

  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    includeOnly: "^(src|tests|scripts)/",
    exclude: {
      path: [
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
