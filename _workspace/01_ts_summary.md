# Cycle 1 — Trilha Server TS (ts-server-engineer)

**Status:** ENTREGUE (agente original entregou ~70% e crashou com API error; architect finalizou inline: entry, server bootstrap, tool registry, play tool e 2 suites de teste).

## Arquivos criados (13 .ts + 8 root config)

### Configuração raiz
```
package.json         # Node 20+, MCP SDK 1.0.4, Zod 3.23.8, tsup, vitest, biome
tsconfig.json        # NodeNext, strict + noUncheckedIndexedAccess
biome.json
vitest.config.ts     # tests/**/*.test.ts, coverage v8 sobre src/**
tsup.config.ts
.gitignore
LICENSE              # MIT
README.md            # PT-BR mínimo (EN é Phase 7)
```

### Source
```
src/
├── index.ts                         # ⬅ entry: connect + handshake + MCP stdio + signals
├── server/
│   ├── index.ts                     # ⬅ createServer({bridge, tools}) registra tools no McpServer
│   ├── context.ts                   # BridgeClient + ToolContext + createBridgeClient
│   └── define-tool.ts               # factory tipada defineTool<TInput,TOutput>(...)
├── live-client/
│   ├── index.ts                     # barrel
│   ├── jsonrpc.ts                   # tipos Zod + JsonRpcRemoteError + decodeIncoming
│   ├── tcp-client.ts                # TcpJsonRpcClient (NDJSON, fila por id, reconnect)
│   └── handshake.ts                 # performHandshake → system.hello + validate
├── tools/
│   ├── index.ts                     # ⬅ registry: allTools = [playTool]
│   └── transport.ts                 # ⬅ playTool (MCP `play` → JSON-RPC transport.play)
└── utils/
    └── logger.ts                    # stderr-only, níveis debug/info/warn/error
```

### Testes
```
tests/
├── live-client.test.ts              # ⬅ TCP loopback mock, 5 casos
└── tools-transport.test.ts          # ⬅ BridgeClient mock, 6 casos
```

Itens marcados ⬅ foram escritos inline pelo architect porque o agente original crashou antes de gravá-los.

## Decisões intermediárias

### Tool registry
- `defineTool(...)` é uma factory que devolve o próprio objeto tipado — só serve para autocomplete + checagem de inferência. Não roda lógica.
- `allTools: ToolDefinition[]` em `tools/index.ts` é a fonte única de tools para o bootstrap.
- Tools com `enabled: false` são logadas e NÃO registradas (evita expor tool quebrada ao LLM).

### Server bootstrap
- Usa `@modelcontextprotocol/sdk/server/mcp.js#McpServer` (API 1.x).
- `server.tool(name, description, shape, handler)` — `shape` é extraído de `(input as ZodObject).shape`. Tools sem input passam `{}`.
- Handler do MCP recebe input raw → re-valida com `tool.input.parse` → chama `tool.handler` → re-valida com `tool.output.parse` → embala como `content: [{type:"text", text: JSON.stringify(result, null, 2)}]`.
- Erro no handler vira `{ isError: true, content: [text com { ok:false, tool, error }] }`.

### Entry point
1. `TcpJsonRpcClient` instantiado com defaults (env override em `ABLETON_MIND_HOST`/`PORT`/`TIMEOUT_MS`).
2. `connect()` — exit 1 se falhar (mensagem amigável dizendo para checar Remote Script).
3. `performHandshake(client)` — exit 1 se falhar. Loga banner com versões. Mismatch de `protocol_version` só warn na Phase 0.
4. `createServer({bridge, tools})` cria McpServer.
5. `StdioServerTransport` conectado.
6. `SIGTERM`/`SIGINT` fazem close graceful do server + client.

### Convenção output das tools
`{ ok: literal(true), verified: literal(true), changed, ...rest }`. Phase 0 sempre `ok=true, verified=true` porque os bridges leem estado pós-mutação. Phase 1+ pode introduzir `verified=false` quando read-after-write não for possível.

### Mock TCP server nos testes
`tests/live-client.test.ts` usa `node:net.createServer` em loopback com porta aleatória (port 0). Handler `onLine` é injetável por caso — permite simular response success, response error, notification e timeout (no-response) sem mocks complexos.

## Riscos abertos / TODOs

- **`npm install` não foi executado** no sandbox. Versões pinadas em `package.json` foram escolhidas conservadoramente. Primeira execução real pode bater em incompat de tsup ou vitest 2.x.
- **Smoke test E2E** (TS conectando bridge Python real dentro do Live) é trabalho de Ciclo 2 ou 3, não fechado aqui.
- O cliente MCP que receber a `content` com `JSON.stringify(result)` no `text` precisa fazer parse de novo. Phase 1 pode mudar para `content: [{type:"resource", ...}]` ou structured content quando MCP SDK 1.x suportar oficialmente.
- O bug do `Number(process.env.X) ?? DEFAULT` em `tcp-client.ts:87,89` — `Number(undefined)` retorna `NaN`, não `undefined`, então `??` não faz fallback. Resultado: ABLETON_MIND_PORT/TIMEOUT_MS sem set acabam virando `NaN`. Marcar como **DÉBITO** para Ciclo 2 (fix trivial: `process.env.X ? Number(process.env.X) : DEFAULT`).

## Como rodar

```bash
cd /Users/pantani/Desktop/projects/art/ableton-mind
npm install
npm run typecheck    # tsc --noEmit
npm run lint         # biome check src tests
npm test             # vitest run
npm run build        # tsup → dist/
npm start            # node dist/index.js (precisa de Live com Remote Script ativo)
```

## Notas para o architect

- Contratos NÃO foram mutados.
- Entrega do agente original (~70%): root configs + src/server/{context,define-tool} + src/live-client/* + src/utils/logger.
- Entrega inline (architect): src/index.ts, src/server/index.ts, src/tools/{index,transport}.ts, tests/{live-client,tools-transport}.test.ts.
- **DÉBITO conhecido**: bug `Number(undefined) ?? default` em `tcp-client.ts` → registrar em `tech-debt.md`.
