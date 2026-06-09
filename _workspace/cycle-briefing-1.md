# Cycle 1 — 2026-06-08

**Fase PLAN.md:** Fase 0 — Spike (1ª iteração)
**Objetivo do ciclo:** scaffold completo TS + bridge Python mínima com 5 handlers + 1 tool MCP `play` funcionando ponta a ponta contra o contrato congelado em `_workspace/contracts/`.

## Decisões dependentes (todas em ADR-0001)

Stack/transport/licença/alvo congelados em [decisions/0001-stack-and-transport.md](decisions/0001-stack-and-transport.md). Resumo:
- TypeScript + Node 20+ no server (MCP SDK + Zod + tsup + biome + vitest)
- Python no bridge (Live 12 prioritário, Python 3.11; compat Live 11 / Py 3.7 vem Phase 1)
- TCP NDJSON JSON-RPC 2.0 em `127.0.0.1:9876`
- MIT license, Mac-first, `ableton-mind` como nome

## Contratos congelados

- [contracts/jsonrpc.md](contracts/jsonrpc.md) — envelope, framing, error codes, idempotência.
- [contracts/phase0-methods.md](contracts/phase0-methods.md) — 7 métodos + 1 notification opcional.

Mutações nestes contratos durante este ciclo → reportar imediatamente ao architect e abrir ADR.

## Atribuições

### Trilha A — Bridge (python-bridge-engineer)

Entregar em `live/AbletonMind/`:

1. `__init__.py` — `class AbletonMind(ControlSurface)` (stub mínimo que sobe TCP server em thread).
2. `bridge.py` — TCP server NDJSON em `127.0.0.1:9876`, dispatcher JSON-RPC 2.0, error codes do contrato.
3. `handlers/transport.py` — `play`, `stop`, `set_tempo` (com idempotência verificada).
4. `handlers/track.py` — `list` (read-only).
5. `handlers/clip.py` — `create_midi` (transacional com `begin_undo_step`/`end_undo_step`).
6. `handlers/system.py` — `hello`, `ping`.
7. `schemas.py` — dataclasses I/O matching o contrato.
8. `transactions.py` — helper `with undo_step("name"): ...`.
9. `tests/test_bridge.py` — unittest offline com LiveAPI MOCKED (fixtures em `tests/fixtures/`).
10. README curto em `live/AbletonMind/README.md` com paths de install macOS/Windows.

Estrutura idempotência: cada handler lê estado antes de mutar, retorna `{ changed: bool, before?, after? }`.

Não toca em `src/`. Não toca em `recipes/`. Não toca em `docs/`.

Quando terminar, escrever `_workspace/01_bridge_summary.md`.

### Trilha A — Server (ts-server-engineer)

Entregar em `src/` (mais raiz):

1. `package.json` (Node 20+, `@modelcontextprotocol/sdk`, `zod`, `tsup`, `vitest`, `@biomejs/biome`).
2. `tsconfig.json`, `biome.json`, `vitest.config.ts`.
3. `src/index.ts` — entry MCP server (stdio transport).
4. `src/server/` — bootstrap MCP (register tools/resources/prompts handlers).
5. `src/live-client/tcp-client.ts` — cliente TCP NDJSON, fila de requests pendentes por `id`, reconnect, timeout 5s default.
6. `src/live-client/jsonrpc.ts` — tipos JSON-RPC (request/response/notification/error com Zod).
7. `src/live-client/handshake.ts` — `system.hello` na conexão.
8. `src/tools/transport.ts` — tool MCP `play` (mapeia para `transport.play`).
9. `src/utils/logger.ts` — logger stderr (MCP usa stdout para protocolo).
10. `tests/live-client.test.ts` — vitest contra mock TCP server local que simula bridge.
11. `tests/tools-transport.test.ts` — vitest da tool `play` com `live-client` mocado.
12. README na raiz mínimo (apenas PT-BR; EN é Phase 7).
13. `LICENSE` MIT.
14. `.gitignore` cobrindo `node_modules/`, `dist/`, `.env`.

Estrutura tool MCP:
```ts
export const playTool = {
  name: "play",
  description: "Start playback in Ableton Live.",
  inputSchema: z.object({ from_beginning: z.boolean().optional() }),
  handler: async ({ from_beginning }, ctx) => {
    const result = await ctx.bridge.call("transport.play", { from_beginning });
    return { ok: true, verified: true, ...result };
  },
};
```

Não toca em `live/`. Não toca em `recipes/`. Não toca em `docs/`.

Quando terminar, escrever `_workspace/01_ts_summary.md`.

### Trilha — Docs (architect, inline)

Eu mesmo escrevo `docs/architecture.md` com diagrama das 3 camadas + sequência da call `play`. Sem disparo de agente.

## Dependências entre trilhas

- Bridge e Server compartilham contratos congelados → podem rodar 100% em paralelo.
- Server NÃO faz integration test real contra bridge neste ciclo (precisa Live aberto). Apenas mocks. Smoke real fica para Ciclo 2 ou QA dedicado.
- Distribution / Knowledge / Recipes / QA: **não ativos** neste ciclo (Phase 0 matrix).

## Critérios de gate (architect verifica no Phase 3 deste ciclo)

- [ ] `package.json` instala limpo (`npm install` simulado por dependências válidas).
- [ ] `vitest` roda e passa (mock-only).
- [ ] `python -m unittest live/AbletonMind/tests/` passa offline.
- [ ] Contratos NÃO foram mutados (diff vazio em `_workspace/contracts/`).
- [ ] Sumários `01_ts_summary.md` e `01_bridge_summary.md` existem.
- [ ] Estrutura de arquivos bate com PLAN.md §3.3 (não 100%, mas o que foi tocado).

## Critérios de gate (que o ciclo seguinte irá testar)

- Phase 0 fecha quando Spike rodar contra Live de verdade (Ciclo 2 ou 3) — não neste ciclo.

## Notas

- Auto mode ON: agentes não pedem confirmação para detalhes operacionais. Decisão real abre ADR no `_workspace/decisions/`.
- Qualquer agente que precise mudar contrato: pausa, escreve nota em `_workspace/contracts/PROPOSED-<change>.md`, NÃO muta `jsonrpc.md` nem `phase0-methods.md`.
- Trabalho vai direto para `live/` e raiz/`src/` (não rascunho em `_workspace/`) porque é Spike — código novo, sem risco de quebrar nada.
