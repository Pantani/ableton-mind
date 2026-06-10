# ADR 0001 — Stack, transport, license, target

**Date:** 2026-06-08
**Status:** Accepted
**Author:** architect

## Context

PLAN.md §13 lists 9 open decisions before starting. The user triggered "play the plan" → auto mode. I will consolidate the PLAN.md's own recommendations as defaults and proceed. Any later adjustment generates ADR-N that supersedes this one.

## Decisions

| # | Question | Decision | Reason |
|---|---|---|---|
| 1 | MCP server language | **TypeScript + Node 20+** | Consistency with tdmcp, mature MCP SDK ecosystem in TS, Zod for typed validation. |
| 2 | bridge↔server transport | **TCP socket JSON-RPC 2.0** (default `:9876`). OSC optional via `ABLETON_MIND_TRANSPORT=osc` in Phase 7. | JSON-RPC provides typing, structured errors, batch, bidirectional for listeners. |
| 3 | Minimum Live version | **Live 11+** (with Live 12 priority). Python bridge: 3.7 (Live 11) and 3.11 (Live 12). | Cuts off few users, unlocks take lanes / MPE / probability. |
| 4 | AbletonOSC support | **Coexist** — transport flag, no drop-in replace. | Allows smooth migration of AbletonOSC users. |
| 5 | Name | **`ableton-mind`** | Already the directory. Mirrors "mind" as in tdmcp / TouchDesigner Mind. |
| 6 | License | **MIT** | Aligned with tdmcp and most of the MCP ecosystem. |
| 7 | Windows support | **Mac-first (Phase 0-1), Windows in final Phase 1** | Live is more used on Mac; dev is faster. macOS CI first. |
| 8 | Knowledge devices: extract vs manual | **Hybrid** — `scripts/extract-device-schemas.mjs` script parses `Default.adv` (XML); complete manual curation. | Automatic base capture + human quality. |
| 9 | Preview rendering | **Default JSON snapshot. Real bounce opt-in** (`render_preview`). | Snapshot is fast and sufficient; bounce only when the LLM asks for auditory confirmation. |

## Consequences

- Repo scaffold = TS (`package.json`, `tsconfig.json`, `tsup`, `biome.json`, `vitest`) + Python bridge (`live/AbletonMind/`).
- Phase 0 tests on Live 12 first (Python 3.11). Live 11 (Python 3.7) compat is Phase 1.
- Windows install path documented but Windows tests deferred until Phase 1.
- MIT `LICENSE` added to the scaffold.
- README and root docs are English; localized VitePress pages live under docs/pt.

## How to apply

- Every new tool/handler assumes TCP JSON-RPC 2.0 as the canonical contract.
- Every new dependency enters as devDep in `package.json`; Python bridge with no external dependencies (only stdlib + Live API).
- Any change to this list → ADR-0002+.
