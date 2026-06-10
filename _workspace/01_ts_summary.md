# Cycle 1 — TS Server Track (ts-server-engineer)

**Status:** DELIVERED (the original agent delivered ~70% and crashed with an API error; the architect finished inline: entry, server bootstrap, tool registry, play tool and 2 test suites).

## Files created (13 .ts + 8 root config)

### Root configuration
```
package.json         # Node 20+, MCP SDK 1.0.4, Zod 3.23.8, tsup, vitest, biome
tsconfig.json        # NodeNext, strict + noUncheckedIndexedAccess
biome.json
vitest.config.ts     # tests/**/*.test.ts, coverage v8 over src/**
tsup.config.ts
.gitignore
LICENSE              # MIT
README.md            # minimal English root README
```

### Source
```
src/
├── index.ts                         # ⬅ entry: connect + handshake + MCP stdio + signals
├── server/
│   ├── index.ts                     # ⬅ createServer({bridge, tools}) registers tools on McpServer
│   ├── context.ts                   # BridgeClient + ToolContext + createBridgeClient
│   └── define-tool.ts               # typed factory defineTool<TInput,TOutput>(...)
├── live-client/
│   ├── index.ts                     # barrel
│   ├── jsonrpc.ts                   # Zod types + JsonRpcRemoteError + decodeIncoming
│   ├── tcp-client.ts                # TcpJsonRpcClient (NDJSON, per-id queue, reconnect)
│   └── handshake.ts                 # performHandshake → system.hello + validate
├── tools/
│   ├── index.ts                     # ⬅ registry: allTools = [playTool]
│   └── transport.ts                 # ⬅ playTool (MCP `play` → JSON-RPC transport.play)
└── utils/
    └── logger.ts                    # stderr-only, levels debug/info/warn/error
```

### Tests
```
tests/
├── live-client.test.ts              # ⬅ TCP loopback mock, 5 cases
└── tools-transport.test.ts          # ⬅ BridgeClient mock, 6 cases
```

Items marked ⬅ were written inline by the architect because the original agent crashed before saving them.

## Intermediate decisions

### Tool registry
- `defineTool(...)` is a factory that returns the typed object itself — it only serves for autocomplete + inference checking. It does not run logic.
- `allTools: ToolDefinition[]` in `tools/index.ts` is the single source of tools for the bootstrap.
- Tools with `enabled: false` are logged and NOT registered (avoids exposing a broken tool to the LLM).

### Server bootstrap
- Uses `@modelcontextprotocol/sdk/server/mcp.js#McpServer` (API 1.x).
- `server.tool(name, description, shape, handler)` — `shape` is extracted from `(input as ZodObject).shape`. Tools without input pass `{}`.
- The MCP handler receives raw input → re-validates with `tool.input.parse` → calls `tool.handler` → re-validates with `tool.output.parse` → wraps as `content: [{type:"text", text: JSON.stringify(result, null, 2)}]`.
- Error in the handler becomes `{ isError: true, content: [text with { ok:false, tool, error }] }`.

### Entry point
1. `TcpJsonRpcClient` instantiated with defaults (env override via `ABLETON_MIND_HOST`/`PORT`/`TIMEOUT_MS`).
2. `connect()` — exit 1 on failure (friendly message saying to check the Remote Script).
3. `performHandshake(client)` — exit 1 on failure. Logs banner with versions. `protocol_version` mismatch is only a warning in Phase 0.
4. `createServer({bridge, tools})` creates McpServer.
5. `StdioServerTransport` connected.
6. `SIGTERM`/`SIGINT` perform graceful close of the server + client.

### Tool output convention
`{ ok: literal(true), verified: literal(true), changed, ...rest }`. Phase 0 is always `ok=true, verified=true` because the bridges read post-mutation state. Phase 1+ may introduce `verified=false` when read-after-write is not possible.

### Mock TCP server in tests
`tests/live-client.test.ts` uses `node:net.createServer` on loopback with a random port (port 0). The `onLine` handler is injectable per case — it allows simulating response success, response error, notification, and timeout (no-response) without complex mocks.

## Open risks / TODOs

- **`npm install` was not executed** in the sandbox. Pinned versions in `package.json` were chosen conservatively. First real run may hit tsup or vitest 2.x incompatibility.
- **E2E smoke test** (TS connecting to the real Python bridge inside Live) is work for Cycle 2 or 3, not closed here.
- The MCP client that receives `content` with `JSON.stringify(result)` in `text` needs to parse it again. Phase 1 may switch to `content: [{type:"resource", ...}]` or structured content when MCP SDK 1.x officially supports it.
- The `Number(process.env.X) ?? DEFAULT` bug in `tcp-client.ts:87,89` — `Number(undefined)` returns `NaN`, not `undefined`, so `??` does not fall back. Result: ABLETON_MIND_PORT/TIMEOUT_MS without set end up as `NaN`. Mark as **DEBT** for Cycle 2 (trivial fix: `process.env.X ? Number(process.env.X) : DEFAULT`).

## How to run

```bash
cd /Users/pantani/Desktop/projects/art/ableton-mind
npm install
npm run typecheck    # tsc --noEmit
npm run lint         # biome check src tests
npm test             # vitest run
npm run build        # tsup → dist/
npm start            # node dist/index.js (requires Live with active Remote Script)
```

## Notes for the architect

- Contracts were NOT mutated.
- Original agent delivery (~70%): root configs + src/server/{context,define-tool} + src/live-client/* + src/utils/logger.
- Inline delivery (architect): src/index.ts, src/server/index.ts, src/tools/{index,transport}.ts, tests/{live-client,tools-transport}.test.ts.
- **Known DEBT**: `Number(undefined) ?? default` bug in `tcp-client.ts` → register in `tech-debt.md`.
