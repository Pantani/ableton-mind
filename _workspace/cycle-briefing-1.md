# Cycle 1 — 2026-06-08

**PLAN.md Phase:** Phase 0 — Spike (1st iteration)
**Cycle goal:** complete TS scaffold + minimal Python bridge with 5 handlers + 1 MCP `play` tool working end-to-end against the contract frozen in `_workspace/contracts/`.

## Dependent decisions (all in ADR-0001)

Stack/transport/license/target frozen in [decisions/0001-stack-and-transport.md](decisions/0001-stack-and-transport.md). Summary:
- TypeScript + Node 20+ on the server (MCP SDK + Zod + tsup + biome + vitest)
- Python on the bridge (Live 12 priority, Python 3.11; Live 11 / Py 3.7 compat comes Phase 1)
- TCP NDJSON JSON-RPC 2.0 on `127.0.0.1:9876`
- MIT license, Mac-first, `ableton-mind` as the name

## Frozen contracts

- [contracts/jsonrpc.md](contracts/jsonrpc.md) — envelope, framing, error codes, idempotency.
- [contracts/phase0-methods.md](contracts/phase0-methods.md) — 7 methods + 1 optional notification.

Mutations to these contracts during this cycle → report to the architect immediately and open an ADR.

## Assignments

### Track A — Bridge (python-bridge-engineer)

Deliver in `live/AbletonMind/`:

1. `__init__.py` — `class AbletonMind(ControlSurface)` (minimal stub that brings up a TCP server in a thread).
2. `bridge.py` — TCP NDJSON server on `127.0.0.1:9876`, JSON-RPC 2.0 dispatcher, contract error codes.
3. `handlers/transport.py` — `play`, `stop`, `set_tempo` (with verified idempotency).
4. `handlers/track.py` — `list` (read-only).
5. `handlers/clip.py` — `create_midi` (transactional with `begin_undo_step`/`end_undo_step`).
6. `handlers/system.py` — `hello`, `ping`.
7. `schemas.py` — I/O dataclasses matching the contract.
8. `transactions.py` — `with undo_step("name"): ...` helper.
9. `tests/test_bridge.py` — offline unittest with MOCKED LiveAPI (fixtures in `tests/fixtures/`).
10. Short README in `live/AbletonMind/README.md` with macOS/Windows install paths.

Idempotency structure: each handler reads state before mutating, returns `{ changed: bool, before?, after? }`.

Does not touch `src/`. Does not touch `recipes/`. Does not touch `docs/`.

When done, write `_workspace/01_bridge_summary.md`.

### Track A — Server (ts-server-engineer)

Deliver in `src/` (plus root):

1. `package.json` (Node 20+, `@modelcontextprotocol/sdk`, `zod`, `tsup`, `vitest`, `@biomejs/biome`).
2. `tsconfig.json`, `biome.json`, `vitest.config.ts`.
3. `src/index.ts` — MCP server entry (stdio transport).
4. `src/server/` — MCP bootstrap (register tools/resources/prompts handlers).
5. `src/live-client/tcp-client.ts` — NDJSON TCP client, pending request queue by `id`, reconnect, 5s default timeout.
6. `src/live-client/jsonrpc.ts` — JSON-RPC types (request/response/notification/error with Zod).
7. `src/live-client/handshake.ts` — `system.hello` on connection.
8. `src/tools/transport.ts` — MCP `play` tool (maps to `transport.play`).
9. `src/utils/logger.ts` — stderr logger (MCP uses stdout for protocol).
10. `tests/live-client.test.ts` — vitest against local mock TCP server simulating the bridge.
11. `tests/tools-transport.test.ts` — vitest of the `play` tool with mocked `live-client`.
12. Minimal root README (English root; localized docs live under docs/pt).
13. MIT `LICENSE`.
14. `.gitignore` covering `node_modules/`, `dist/`, `.env`.

MCP tool structure:
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

Does not touch `live/`. Does not touch `recipes/`. Does not touch `docs/`.

When done, write `_workspace/01_ts_summary.md`.

### Track — Docs (architect, inline)

I myself write `docs/architecture.md` with the 3-layer diagram + `play` call sequence. No agent dispatch.

## Cross-track dependencies

- Bridge and Server share frozen contracts → can run 100% in parallel.
- The Server does NOT run a real integration test against the bridge this cycle (requires Live open). Mocks only. Real smoke deferred to Cycle 2 or dedicated QA.
- Distribution / Knowledge / Recipes / QA: **not active** this cycle (Phase 0 matrix).

## Gate criteria (architect verifies in Phase 3 of this cycle)

- [ ] `package.json` installs cleanly (`npm install` simulated by valid deps).
- [ ] `vitest` runs and passes (mock-only).
- [ ] `python -m unittest live/AbletonMind/tests/` passes offline.
- [ ] Contracts were NOT mutated (empty diff in `_workspace/contracts/`).
- [ ] Summaries `01_ts_summary.md` and `01_bridge_summary.md` exist.
- [ ] File structure matches PLAN.md §3.3 (not 100%, but what was touched).

## Gate criteria (that the next cycle will test)

- Phase 0 closes when the Spike runs against a real Live (Cycle 2 or 3) — not this cycle.

## Notes

- Auto mode ON: agents do not ask for confirmation on operational details. A real decision opens an ADR in `_workspace/decisions/`.
- Any agent that needs to change a contract: pause, write a note in `_workspace/contracts/PROPOSED-<change>.md`, do NOT mutate `jsonrpc.md` or `phase0-methods.md`.
- Work goes directly into `live/` and root/`src/` (not drafted in `_workspace/`) because it is a Spike — new code, no risk of breaking anything.
