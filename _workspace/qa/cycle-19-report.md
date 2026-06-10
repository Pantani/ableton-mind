# QA Report — Cycle 19

**Date:** 2026-06-09
**Verdict:** **PASS** 🎯 **3/3 MCP primitives delivered**

## Summary

MCP Resources subsystem delivered. **Complete MCP trio**: Tools (33) + Prompts (5) + Resources (3). TD-044 closed. Version 0.0.19.

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDING (user) |
| TD-005 | 🟡 PENDING (sandbox) |
| TD-030 | 🟡 PENDING (Push hardware) |
| TD-044 (prompts tests) | ✅ CLOSED — `tests/prompts.test.ts` (16+ cases) |

**3 open — all real-environment. 41 TDs closed in 19 cycles.**

## ADR-0011 — Resources

URI namespace `live://<scope>/<path>`. Each resource is `{uri, name, description, mimeType, read(bridge)}`. `read()` returns `{contents: [{uri, mimeType, text}]}` per MCP spec.

## Resources delivered — 3 seeds

| URI | mimeType | Content |
|---|---|---|
| `live://session/state` | application/json | Deep snapshot via bridge.call("session.snapshot", ...) |
| `live://knowledge/devices` | application/json | Index of 55 devices (id, category, param_count) |
| `live://recipes/index` | application/json | Index of 14 recipes (id, step_count, input_count) |

Phase 9+ adds dynamic URIs (`live://knowledge/device/<id>`, `live://recipes/<id>`) via resource templates.

## Wiring in server bootstrap

`createServer({bridge, tools, prompts, resources, ...})` gains optional `resources`. Each resource registered via `server.resource(name, uri, metadata, readHandler)`. Errors encapsulated in JSON inside the `text` field.

## New tool: `list_resources`

Read-only. Returns `{uri, name, description, mimeType}` × 3 without reading content.

## TD-044 — Prompts tests

`tests/prompts.test.ts` — 16+ cases:
- Registry: 5 unique prompts, all with valid args+description.
- `genreTrackPrompt` — fallback BPM, custom tempo, unknown genre.
- `mixChainPrompt` — drums/master/unknown source.
- `arrangementPrompt` — 3 structures (intro-build-drop-break-outro, aaba, verse-chorus).
- `soundDesignPrompt` — pad/bass/unknown target.
- `vocalChainPrompt` — recipe + track_index substitution.
- `listPromptsTool` — returns 5 prompts with metadata.

## Resources tests

`tests/resources.test.ts` — 10+ cases:
- Registry: 3 unique resources with json mimeType.
- `sessionStateResource` — encode snapshot + encode bridge error + bridge=null hint.
- `knowledgeDevicesResource` — lists 55+ devices, Wavetable >= 60 params.
- `recipesIndexResource` — lists 14+ recipes with step_count.
- `listResourcesTool` — 3 entries URIs `live://*`.

## Total MCP — Cycle 19 final

- **33 tools** (32 + list_resources).
- **5 prompts**.
- **3 resources**.
- **30 JSON-RPC methods in the bridge** (unchanged).
- **55 devices**, **14 recipes**.

## DXT manifest

Only `prompts` in the current manifest. Add `resources` in Cycle 20 (haven't seen the MCPB v0.x spec support this yet — verify). TD-045 (trivial).

## Version: 0.0.19

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Warnings

### W1 — DXT manifest without `resources` (TD-045)
MCPB v0.1 spec does not document the resources field. Investigate whether v0.2 supports. For now, the client reads via MCP runtime (not static in the manifest).

### W2 — `sessionStateResource` errors encapsulated (not thrown)
By design (MCP `resources/read` expects contents, not error). Bridge errors become JSON in `text` — the client parses and decides what to do. Accepted.

### W3 — TD-004 still blocks rc.1
State unchanged.

## Recommendation

**PASS Cycle 19. MCP trio complete.** The system is now full-stack MCP-conformant.

Cycle 20 / Release Window:
- **TD-004 real smoke** ← BLOCKER.
- TD-045 DXT manifest resources field (if MCPB v0.2 supports it).
- Tag `v0.1.0-rc.1` after smoke PASS.
- Eventual final v0.1.0.
