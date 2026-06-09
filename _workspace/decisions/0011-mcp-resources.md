# ADR 0011 — MCP Resources

**Data:** 2026-06-09
**Status:** Aceito
**Autor:** architect

## Contexto

MCP define 3 primitivas: **tools**, **prompts**, **resources**. Cycles 1-17 entregaram tools. Cycle 18 entregou prompts. **Cycle 19 entrega resources**, completando o trio.

Resources são URIs lidos pelo cliente MCP (`resources/read`) — diferente de tools, são **read-only puros**, sem side effects, ideais para estado introspectivo ("o que está acontecendo no Live agora?", "qual a knowledge base disponível?", "que recipes existem?").

PLAN.md §3.3 listou `src/resources/`. PLAN.md §4.21 mencionou listeners → notifications + `live://session/state`.

## Decisão

### 1. URI namespace

`live://<scope>/<path>`:

| URI | Conteúdo | Mime type |
|---|---|---|
| `live://session/state` | snapshot do Live (tempo, transport, tracks, clips, devices) | `application/json` |
| `live://session/diff?since=<ts>` | diff desde ts (Phase 9 — exige cache) | `application/json` |
| `live://knowledge/devices` | índice de todos os 55 devices com metadata | `application/json` |
| `live://knowledge/device/<id>` | schema completo de 1 device | `application/json` |
| `live://knowledge/scales` | scales.json | `application/json` |
| `live://recipes/index` | metadata de todas as recipes | `application/json` |
| `live://recipes/<category>/<id>` | recipe completa | `application/json` |

Cycle 19 entrega: `live://session/state`, `live://knowledge/devices`, `live://recipes/index`. Resto é Phase 9+.

### 2. Shape

Cada resource é `{uri, name, description, mimeType, read: () => Promise<{contents: [...]}>}`.

`read()` retorna `{contents: [{uri, mimeType, text}]}` per spec MCP.

`live://session/state` chama `bridge.call("session.snapshot", {include_clips: true, include_devices: true})` — comportamento idêntico ao tool `session_snapshot` mas exposto via primitiva resource.

### 3. Diretório

`src/resources/`:
- `index.ts` — registry `allResources` + `loadResource(uri)`.
- `session-state.ts`, `knowledge-devices.ts`, `recipes-index.ts` — 3 resources seed.

### 4. Tool MCP `list_resources`

Análogo a `list_prompts` — devolve metadata sem ler conteúdo. Para clientes que não navegam resources nativamente.

### 5. Wiring no server bootstrap

`createServer({bridge, tools, prompts, resources, ...})` ganha `resources` opcional. Para cada resource:

```ts
server.resource(r.name, r.uri, { description: r.description, mimeType: r.mimeType }, r.read);
```

## Consequências

- 3 novos arquivos por resource + 1 registry + 1 wiring + 1 tool listing.
- `live://session/state` exige bridge ativo. Se bridge offline, resource retorna erro JSON-RPC encapsulado em `{contents: [{text: '{"error": "..."}'}]}`.
- Knowledge/recipes resources são static reads (FS); independem de Live.

## Como aplicar

- Cycle 19: implementa 3 resources + wiring + `list_resources` tool.
- Cycle 20+: expansion para `live://knowledge/device/<id>` e `live://recipes/<id>` (paths dinâmicos via resource templates do SDK).
