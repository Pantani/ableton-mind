# ableton-mind

[![ableton-mind MCP server](https://glama.ai/mcp/servers/Pantani/ableton-mind/badges/score.svg)](https://glama.ai/mcp/servers/Pantani/ableton-mind)

Definitive MCP (Model Context Protocol) server for **Ableton Live**. Exposes the full **Live Object Model** to LLMs (Claude, Cursor, etc.) with an embedded native device knowledge base, declarative music recipes, an integrated verify loop, and reactive listeners.

> Status: **alpha / v0.1.1 published** — core smoke passed against Ableton Live 12.4.1 on macOS and package validation is green. npm, GitHub Release `.mcpb`, and the MCP Registry are live. Glama has a listing, but its hosted release/deploy must be published separately from the Glama admin build flow; Smithery metadata is present and may lag indexing. API unstable. Don't use in production yet.
>
> Phase 8 status: slice 1 delivers read-only Max for Live/plug-in introspection and Link/remote status discovery. Deeper M4L control, VST3 sidecars, remote DAW integration and mobile companion work remain pending.

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
| MCP tools | 22 | ~30 | **36** |
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
| `ABLETON_MIND_MAX_FRAME_BYTES` | `1048576` | Max incoming JSON-RPC frame |
| `ABLETON_MIND_MAX_PENDING_REQUESTS` | `128` | Max in-flight JSON-RPC calls |
| `ABLETON_MIND_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

## Local copilot

Run a local LLM against a curated subset of the same Ableton tools:

```bash
ollama pull qwen2.5:3b      # optional; the UI can pull too
node dist/index.js chat     # opens http://127.0.0.1:4142
node dist/index.js ask "What is in this set?"
```

The default tier is read-only (`safe`). Use `--write` for simple changes or `--creative` for recipes/browser load.

| Var | Default | |
|---|---|---|
| `ABLETON_MIND_LLM_BASE_URL` | `http://127.0.0.1:11434/v1` | OpenAI-compatible endpoint |
| `ABLETON_MIND_LLM_MODEL` | `qwen2.5:3b` | Local model id |
| `ABLETON_MIND_LLM_TIER` | `safe` | `safe` \| `standard` \| `creative` |
| `ABLETON_MIND_CHAT_PORT` | `4142` | Browser UI port |

See [Local copilot](docs/guide/local-copilot.md).

## Doctor CLI

```bash
npx ableton-mind-doctor
```

Checks Node version, Remote Script install, bridge port, knowledge base integrity, recipes.

## Distribution

- **npm:** `npm install -g ableton-mind`.
- **Claude Desktop one-click:** download `ableton-mind-0.1.1.mcpb` from the [v0.1.1 GitHub Release](https://github.com/Pantani/ableton-mind/releases/tag/v0.1.1).
- **MCP Registry:** `io.github.Pantani/ableton-mind` is active in the official registry.
- **Glama:** listed at [glama.ai/mcp/servers/Pantani/ableton-mind](https://glama.ai/mcp/servers/Pantani/ableton-mind); hosted release is separate from the GitHub Release and still requires the Glama admin deploy + Make Release flow.
- **Source:** `npm ci && npm run build && npm run install:remote-script`.
- **Docker:** `docker build -t ableton-mind . && docker run --rm -i --network host ableton-mind`.
- **Smithery:** [`smithery.yaml`](smithery.yaml) is ready for listing/indexing.

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
| 7 — Distribution | ✅ DXT/Docker/Smithery/CI/release ready |
| 8 — Long tail | 🔵 slice 1 delivered: read-only M4L/plug-in introspection + Link/remote status discovery; deeper M4L/VST3/remote DAW/mobile work pending |

## License

[MIT](LICENSE).
