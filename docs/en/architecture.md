# Architecture

See [Portuguese version](../architecture) for the full breakdown. English translation pending — contributions welcome.

## 3 layers — TL;DR

```
LLM / IDE ──MCP stdio──▶ ableton-mind (TS, Node 20+) ──TCP NDJSON JSON-RPC──▶ AbletonMind Remote Script (Python, inside Live)
```

- **TypeScript MCP server** — tools, resources, prompts, TCP client to the bridge.
- **Python Remote Script** — runs inside Live, hosts TCP JSON-RPC at `127.0.0.1:9876`, dispatches to LiveAPI, pushes listener events.
- **Knowledge + recipes** — static JSON shipped with the package.

Design invariants per tool (from [PLAN.md §2](https://github.com/Pantani/ableton-mind/blob/main/PLAN.md)):

1. **Idempotent** — same args → same end state.
2. **Transactional** — wrap in `Song.begin_undo_step()` / `end_undo_step()`.
3. **Reversible** — snapshot before destructive ops.
4. **Read-before-write** — verify before mutating.
5. **Schema-aware** — device params by name, not raw index.
6. Returns `{ ok, verified, diff }`.
