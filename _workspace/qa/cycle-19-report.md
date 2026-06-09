# QA Report — Cycle 19

**Data:** 2026-06-09
**Veredito:** **PASS** 🎯 **3/3 primitivas MCP entregues**

## Resumo

MCP Resources subsystem entregue. **Trio MCP completo**: Tools (33) + Prompts (5) + Resources (3). TD-044 fechado. Versão 0.0.19.

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDENTE (usuário) |
| TD-005 | 🟡 PENDENTE (sandbox) |
| TD-030 | 🟡 PENDENTE (Push hardware) |
| TD-044 (prompts tests) | ✅ FECHADO — `tests/prompts.test.ts` (16+ casos) |

**3 abertos — todos ambiente real. 41 TDs fechados em 19 ciclos.**

## ADR-0011 — Resources

URI namespace `live://<scope>/<path>`. Cada resource é `{uri, name, description, mimeType, read(bridge)}`. `read()` retorna `{contents: [{uri, mimeType, text}]}` per spec MCP.

## Resources entregues — 3 seeds

| URI | mimeType | Content |
|---|---|---|
| `live://session/state` | application/json | Deep snapshot via bridge.call("session.snapshot", ...) |
| `live://knowledge/devices` | application/json | Índice de 55 devices (id, category, param_count) |
| `live://recipes/index` | application/json | Índice de 14 recipes (id, step_count, input_count) |

Phase 9+ adiciona URIs dinâmicos (`live://knowledge/device/<id>`, `live://recipes/<id>`) via resource templates.

## Wiring no server bootstrap

`createServer({bridge, tools, prompts, resources, ...})` ganha `resources` opcional. Cada resource registrado via `server.resource(name, uri, metadata, readHandler)`. Erros encapsulados em JSON dentro do `text` field.

## Tool nova: `list_resources`

Read-only. Devolve `{uri, name, description, mimeType}` × 3 sem ler conteúdo.

## TD-044 — Prompts tests

`tests/prompts.test.ts` — 16+ casos:
- Registry: 5 prompts únicos, todos com args+description válidos.
- `genreTrackPrompt` — fallback BPM, custom tempo, unknown genre.
- `mixChainPrompt` — drums/master/unknown source.
- `arrangementPrompt` — 3 estruturas (intro-build-drop-break-outro, aaba, verse-chorus).
- `soundDesignPrompt` — pad/bass/unknown target.
- `vocalChainPrompt` — recipe + track_index substituição.
- `listPromptsTool` — devolve 5 prompts com metadata.

## Resources tests

`tests/resources.test.ts` — 10+ casos:
- Registry: 3 resources únicos com mimeType json.
- `sessionStateResource` — encode snapshot + encode bridge error + bridge=null hint.
- `knowledgeDevicesResource` — lista 55+ devices, Wavetable >= 60 params.
- `recipesIndexResource` — lista 14+ recipes com step_count.
- `listResourcesTool` — 3 entries URIs `live://*`.

## Total MCP — Cycle 19 final

- **33 tools** (32 + list_resources).
- **5 prompts**.
- **3 resources**.
- **30 métodos JSON-RPC no bridge** (sem mudança).
- **55 devices**, **14 recipes**.

## DXT manifest

Apenas `prompts` no manifest atual. Adicionar `resources` em Cycle 20 (não vi spec do MCPB v0.x suportar isso ainda — verificar). TD-045 (trivial).

## Versão: 0.0.19

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Warnings

### W1 — DXT manifest sem `resources` (TD-045)
MCPB v0.1 spec não documenta resources field. Investigar se v0.2 suporta. Por enquanto cliente lê via MCP runtime (não estático no manifest).

### W2 — `sessionStateResource` errors encapsulados (não thrown)
Por design (MCP `resources/read` espera contents, não erro). Bridge errors viram JSON em `text` — cliente parse e decide o que fazer. Aceito.

### W3 — TD-004 segue bloqueando rc.1
Estado inalterado.

## Recomendação

**PASS Cycle 19. Trio MCP completo.** Sistema agora full-stack MCP-conformant.

Cycle 20 / Release Window:
- **TD-004 smoke real** ← BLOQUEIO.
- TD-045 DXT manifest resources field (se MCPB v0.2 suportar).
- Tag `v0.1.0-rc.1` após smoke PASS.
- Eventual v0.1.0 final.
