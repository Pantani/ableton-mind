# ableton-mind

Definitive MCP (Model Context Protocol) server for **Ableton Live**. Exposes the full **Live Object Model** to LLMs (Claude, Cursor, etc.) with an embedded native device knowledge base, declarative music recipes, an integrated verify loop, and reactive listeners.

> Status: **alpha** — core smoke passed against Ableton Live 12.4.1 on macOS, but `v0.1.0-rc.1` is still blocked by package validation (TD-048). API unstable. Don't use in production yet.

📚 **Full documentation:** [pantani.github.io/ableton-mind/](https://pantani.github.io/ableton-mind/)

## Architecture (3 layers)

```
Claude/Cursor ──MCP/stdio──▶ ableton-mind (TS, Node 20+) ──TCP NDJSON JSON-RPC──▶ Remote Script (Python, inside Live)
```

- **`src/`** — TypeScript MCP server. Tools, resources, prompts, TCP client, recipe runner, knowledge loader.
- **`live/AbletonMind/`** — Python Remote Script. TCP server on port `9876`, dispatches JSON-RPC to LiveAPI.
- **`recipes/`**, **`src/knowledge/`** — embedded JSON (drum kits, basslines, racks, device schemas).

Full spec in [`PLAN.md`](PLAN.md). Frozen contracts in [`_workspace/contracts/`](_workspace/contracts/).

## Highlights vs. existing MCP/OSC servers

| Capability | ahujasid/ableton-mcp | AbletonOSC + MCP wrapper | **ableton-mind** |
|---|---|---|---|
| MCP tools | 22 | ~30 | **31+** |
| LOM coverage | ~10% | ~95% | **~100%** |
| Knowledge base | none | none | **55 devices, scales, drum kits** |
| Recipes | none | none | **14 across 7 categories** |
| Verify loop | no | no | **yes, integrated (`session_snapshot/diff`)** |
| Render preview | no | no | yes (snapshot now, bounce planned) |
| Reactive listeners → MCP notifications | no | partial (OSC) | **yes (7 events live)** |
| Transactions (undo unitary) | no | no | **yes** |
| Automation envelopes | no | partial | **complete (linear / hold)** |
| Push 1/2/3 control | no | no | **yes (pad/button/mode LEDs)** |
| Docker | no | no | yes |
| `.mcpb` 1-click | no | no | yes |
| Doctor CLI | no | no | yes |

## Requirements

- Node 20+
- Ableton Live 12 (priority; Live 11 supported)
- macOS (primary), Windows (Phase 1 final)

## Setup (source install)

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

## Install Remote Script (Python bridge)

Dev mode (symlink):
```bash
node scripts/install-remote-script.mjs           # creates symlink
node scripts/install-remote-script.mjs --check   # status only
node scripts/install-remote-script.mjs --copy    # full copy (CI / snapshot)
```

Manual:
- **macOS:** copy `live/AbletonMind/` to `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- **Windows:** copy to `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

Then **Live → Preferences → Link/Tempo/MIDI → Control Surface → AbletonMind**.

Smoke test: [`docs/smoke-test.md`](docs/smoke-test.md).

## Run the MCP server

```bash
npm run build
node dist/index.js
```

Env vars:

| Var | Default | |
|---|---|---|
| `ABLETON_MIND_HOST` | `127.0.0.1` | Python bridge host |
| `ABLETON_MIND_PORT` | `9876` | Bridge TCP port |
| `ABLETON_MIND_TIMEOUT_MS` | `5000` | Per-request timeout |
| `ABLETON_MIND_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

## Doctor CLI

```bash
npx ableton-mind-doctor
```

Checks Node version, Remote Script install, bridge port, knowledge base integrity, recipes.

## Distribution

- **Source today:** `npm ci && npm run build && npm run install:remote-script`.
- **Claude Desktop one-click:** `npm run build:dxt` builds `build/ableton-mind-<ver>.mcpb`; public release bundle waits on TD-048.
- **Docker:** `docker build -t ableton-mind . && docker run --rm -i --network host ableton-mind`.
- **Smithery:** [`smithery.yaml`](smithery.yaml) ready for the release path.
- **npm:** not published yet; publish after RC/package gates are green.

## Roadmap

See [`PLAN.md §12`](PLAN.md) and [`_workspace/PROGRESS.md`](_workspace/PROGRESS.md).

| Phase | Status |
|---|---|
| 0 — Spike | ✅ real smoke pass |
| 1 — ahujasid parity | ✅ 22/22 |
| 2 — Listeners | ✅ 7 events |
| 3 — Knowledge | ✅ 55 devices |
| 4 — Automation envelopes | ✅ |
| 5 — Preview/verify | ✅ snapshot+diff (bounce planned) |
| 6 — Push | ✅ pad/button/mode LEDs |
| 7 — Distribution | 🔴 package validation blocker TD-048 |
| 8 — Long tail | pending |

## License

[MIT](LICENSE).
