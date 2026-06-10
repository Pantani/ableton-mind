# ADR 0011 — MCP Resources

**Date:** 2026-06-09
**Status:** Accepted
**Author:** architect

## Context

MCP defines 3 primitives: **tools**, **prompts**, **resources**. Cycles 1-17 delivered tools. Cycle 18 delivered prompts. **Cycle 19 delivers resources**, completing the trio.

Resources are URIs read by the MCP client (`resources/read`) — unlike tools, they are **pure read-only**, with no side effects, ideal for introspective state ("what is happening in Live right now?", "what's the available knowledge base?", "what recipes exist?").

PLAN.md §3.3 listed `src/resources/`. PLAN.md §4.21 mentioned listeners → notifications + `live://session/state`.

## Decision

### 1. URI namespace

`live://<scope>/<path>`:

| URI | Content | Mime type |
|---|---|---|
| `live://session/state` | Live snapshot (tempo, transport, tracks, clips, devices) | `application/json` |
| `live://session/diff?since=<ts>` | diff since ts (Phase 9 — requires cache) | `application/json` |
| `live://knowledge/devices` | index of all 55 devices with metadata | `application/json` |
| `live://knowledge/device/<id>` | full schema of 1 device | `application/json` |
| `live://knowledge/scales` | scales.json | `application/json` |
| `live://recipes/index` | metadata of all recipes | `application/json` |
| `live://recipes/<category>/<id>` | full recipe | `application/json` |

Cycle 19 delivers: `live://session/state`, `live://knowledge/devices`, `live://recipes/index`. The rest is Phase 9+.

### 2. Shape

Each resource is `{uri, name, description, mimeType, read: () => Promise<{contents: [...]}>}`.

`read()` returns `{contents: [{uri, mimeType, text}]}` per MCP spec.

`live://session/state` calls `bridge.call("session.snapshot", {include_clips: true, include_devices: true})` — behavior identical to the `session_snapshot` tool but exposed via the resource primitive.

### 3. Directory

`src/resources/`:
- `index.ts` — `allResources` registry + `loadResource(uri)`.
- `session-state.ts`, `knowledge-devices.ts`, `recipes-index.ts` — 3 seed resources.

### 4. MCP tool `list_resources`

Analogous to `list_prompts` — returns metadata without reading content. For clients that do not browse resources natively.

### 5. Wiring in the server bootstrap

`createServer({bridge, tools, prompts, resources, ...})` gains optional `resources`. For each resource:

```ts
server.resource(r.name, r.uri, { description: r.description, mimeType: r.mimeType }, r.read);
```

## Consequences

- 3 new files per resource + 1 registry + 1 wiring + 1 listing tool.
- `live://session/state` requires an active bridge. If the bridge is offline, the resource returns a JSON-RPC error encapsulated in `{contents: [{text: '{"error": "..."}'}]}`.
- Knowledge/recipes resources are static reads (FS); independent of Live.

## How to apply

- Cycle 19: implements 3 resources + wiring + `list_resources` tool.
- Cycle 20+: expansion to `live://knowledge/device/<id>` and `live://recipes/<id>` (dynamic paths via SDK resource templates).
