# ableton-mind

Servidor MCP (Model Context Protocol) para Ableton Live. Expõe o **Live Object Model** completo para LLMs (Claude, Cursor, etc.) com knowledge base embutida de devices nativos, recipes musicais declarativas e verify loop integrado.

> Status: **Phase 0 — Spike** em construção. API instável. Não use em produção.

📚 **Documentação completa:** [pantani.github.io/ableton-mind](https://pantani.github.io/ableton-mind/)

## Arquitetura (3 camadas)

```
Claude/Cursor ──MCP/stdio──▶ ableton-mind (TS, Node 20+) ──TCP NDJSON JSON-RPC──▶ Remote Script (Python, dentro do Live)
```

- **`src/`** — servidor MCP em TypeScript. Tools, resources, prompts, cliente TCP.
- **`live/AbletonMind/`** — Remote Script Python que sobe TCP server local na porta `9876`.
- **`recipes/`**, **`src/knowledge/`** — JSON estático (drum kits, basslines, schemas de devices).

Spec completa em [`PLAN.md`](PLAN.md). Contratos congelados em [`_workspace/contracts/`](_workspace/contracts/).

## Requisitos

- Node 20+
- Ableton Live 12 (prioritário; suporte Live 11 vem em Phase 1)
- macOS (primário; Windows em Phase 1 final)

## Setup (dev)

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

## Instalar o Remote Script (bridge Python)

Modo dev (symlink — edita no repo, Live recarrega):

```bash
node scripts/install-remote-script.mjs           # cria symlink
node scripts/install-remote-script.mjs --check   # só checa estado
node scripts/install-remote-script.mjs --copy    # cópia (CI/snapshot)
```

Modo manual:

- **macOS:** copie `live/AbletonMind/` para `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- **Windows:** copie para `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

Ative em **Live → Preferences → Link/Tempo/MIDI → Control Surface → AbletonMind**.

Smoke test passo-a-passo: [`docs/smoke-test.md`](docs/smoke-test.md).

## Rodar o servidor MCP

```bash
# stdio transport — apontar Claude Desktop / Cursor para este binário
npm run build
node dist/index.js
```

Variáveis de ambiente:

| Variável | Default | Descrição |
|---|---|---|
| `ABLETON_MIND_HOST` | `127.0.0.1` | Host da bridge Python. |
| `ABLETON_MIND_PORT` | `9876` | Porta TCP da bridge. |
| `ABLETON_MIND_TIMEOUT_MS` | `5000` | Timeout default por request JSON-RPC. |
| `ABLETON_MIND_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error`. |

## Estrutura do repo

```
src/
  index.ts            Entry point (MCP stdio transport)
  server/             Bootstrap MCP, registry de tools/resources/prompts
  live-client/        Cliente TCP NDJSON JSON-RPC
  tools/              Tools MCP por domínio (transport, track, clip, ...)
  utils/              Logger, helpers
  feedback/           Verify loop (Phase 1+)
tests/                vitest
live/AbletonMind/     Bridge Python (Remote Script)
_workspace/           Workspace do time multi-agente (contratos, ADRs, progresso)
```

## Tools MCP disponíveis (Cycle 2)

| Tool | Descrição |
|---|---|
| `play` | Start/continue playback (idempotente). |
| `stop` | Stop playback (idempotente). |
| `set_tempo` | Set BPM global (20–999, idempotente em 0.001). |
| `track_list` | Lista tracks (regular, return, master). |
| `track_create` | Cria MIDI ou audio track no index opcional. |
| `create_midi_clip` | Cria MIDI clip vazio num slot (transacional). |

## Instalação 1-click (Claude Desktop)

Phase 7 entrega o `.mcpb`. Manifest base em [`dxt/manifest.json`](dxt/manifest.json). Hoje só dev install.

## Status do roadmap

Veja [`PLAN.md §12`](PLAN.md) e [`_workspace/PROGRESS.md`](_workspace/PROGRESS.md).

| Phase | Status | Escopo |
|---|---|---|
| 0 — Spike | ✅ código | smoke real pendente (TD-004) |
| 1 — Paridade `ahujasid` | ✅ 22/22 | tools mapeadas |
| 2 — Listeners → MCP notifications | ✅ | 7 eventos ativos |
| 3 — Knowledge base | ✅ **55/50+ devices** | 100%+ alvo PLAN §5 |
| 4 — Automation envelopes | ✅ | linear / hold |
| 5 — Preview/verify | ✅ snapshot+diff | bounce mode planejado |
| 6 — Push 1/2/3 | ✅ pad/button/mode | sysex MIDI |
| 7 — Distribuição | ✅ | DXT/Docker/Smithery/CI prontos |
| 8 — Long tail | pendente | release v0.1.0+ |

**31 tools MCP, 55 device schemas (~800 params indexados), 14 recipes em 7/7 categorias, verify loop 23/23, 7 eventos `event.*`.**

## Licença

[MIT](LICENSE).
