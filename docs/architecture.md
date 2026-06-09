# Arquitetura — ableton-mind

> Documento da Fase 0 (Spike). Detalhe técnico mínimo para sustentar o contrato JSON-RPC, o cliente TS e o Remote Script Python. Fases seguintes expandem esta página.

## 1. Visão geral em 3 camadas

```
  ┌──────────────────────────────┐
  │  LLM / IDE                   │
  │  (Claude Desktop, Cursor,    │
  │   Continue, ChatGPT etc.)    │
  └─────────────┬────────────────┘
                │  MCP stdio (JSON-RPC sobre stdin/stdout)
                ▼
  ┌──────────────────────────────┐
  │  ableton-mind server         │   src/
  │  TypeScript + Node 20+       │   - server/  (MCP plumbing)
  │  @modelcontextprotocol/sdk   │   - tools/   (~180 planejadas)
  │  Zod validation              │   - live-client/ (cliente TCP)
  │  Knowledge + Recipes loader  │   - knowledge/ + recipes/
  └─────────────┬────────────────┘
                │  TCP NDJSON JSON-RPC 2.0
                │  127.0.0.1:9876 (default)
                ▼
  ┌──────────────────────────────┐
  │  AbletonMind Remote Script   │   live/AbletonMind/
  │  Python 3.11 (Live 12)       │   - bridge.py (TCP server)
  │  ou Python 3.7 (Live 11)     │   - handlers/{transport,track,…}
  │  rodando DENTRO do Live      │   - listeners.py
  │  Acesso direto à LiveAPI     │   - transactions.py
  └─────────────┬────────────────┘
                │  Live Object Model (LOM) — Python
                ▼
  ┌──────────────────────────────┐
  │  Ableton Live 11 / 12        │
  │  Song / Tracks / Clips / …   │
  └──────────────────────────────┘
```

Detalhes:

| Camada | Roda onde | Linguagem | Stack principal |
|---|---|---|---|
| MCP Server | Processo separado (lançado pelo cliente LLM) | TypeScript | `@modelcontextprotocol/sdk`, `zod`, `tsup`, `vitest`, `biome` |
| Bridge (Remote Script) | DENTRO do Live, como Control Surface | Python 3.7/3.11 | stdlib + LiveAPI (`Live.Application.get_application()`) |
| Knowledge | JSON estático embarcado no pacote npm | — | (sem runtime) |

## 2. Por que esta divisão

1. **TS no server** dá tipagem Zod + ecossistema MCP mais ativo + paridade com `tdmcp`.
2. **Python no bridge** é obrigatório: Remote Script só roda em Python, e LiveAPI só vive dentro do processo do Live.
3. **TCP entre eles** isola crashes: bug no server não derruba o Live. JSON-RPC 2.0 traz tipagem, batching e erros estruturados que OSC raw não dá.

## 3. Protocolo bridge ↔ server

Definido em [`_workspace/contracts/jsonrpc.md`](../_workspace/contracts/jsonrpc.md). Resumo:

- **Transport:** TCP NDJSON. Cada mensagem é UMA linha JSON terminada em `\n`. UTF-8.
- **Envelope:** JSON-RPC 2.0 — `{ jsonrpc, id, method, params }` request; `{ jsonrpc, id, result | error }` response; notification omite `id`.
- **Método naming:** `{domain}.{verb}`. Phase 0 expõe `system.hello`, `system.ping`, `transport.{play,stop,set_tempo}`, `track.list`, `clip.create_midi`.
- **Erros custom:** faixa `-32000..-32099`. `error.data` sempre carrega contexto acionável.
- **Idempotência obrigatória:** toda mutação lê estado, compara, retorna `{ changed: bool, before?, after? }`.
- **Transações:** mutações compostas envolvem `Song.begin_undo_step()` / `end_undo_step()` no lado Python para que o undo do Live seja unitário.

### 3.1 Handshake

Primeira mensagem do server após `connect()`:

```jsonc
→ { "jsonrpc": "2.0", "id": 1, "method": "system.hello",
    "params": { "client": "ableton-mind/ts", "version": "0.0.1" } }
← { "jsonrpc": "2.0", "id": 1, "result": {
    "bridge": "ableton-mind/python", "version": "0.0.1",
    "live_version": "12.0.10", "python_version": "3.11.6",
    "protocol_version": "0.1" } }
```

Versões do protocolo são bumpadas SemVer-style nos contratos.

## 4. Fluxo de uma chamada `play` (sequência Phase 0)

```
LLM             MCP Server             TCP Client            Bridge (Python)         Live (LOM)
 │                  │                      │                      │                      │
 │ tools/call: play │                      │                      │                      │
 ├─────────────────▶│                      │                      │                      │
 │                  │ Zod validate input   │                      │                      │
 │                  │ ─┐                   │                      │                      │
 │                  │ ◀┘                   │                      │                      │
 │                  │ bridge.call(         │                      │                      │
 │                  │   "transport.play",  │                      │                      │
 │                  │   { from_beg: false })                      │                      │
 │                  ├─────────────────────▶│                      │                      │
 │                  │                      │ write NDJSON line    │                      │
 │                  │                      ├─────────────────────▶│                      │
 │                  │                      │                      │ dispatch handler     │
 │                  │                      │                      │ ─┐                   │
 │                  │                      │                      │ ◀┘                   │
 │                  │                      │                      │ Song.is_playing?     │
 │                  │                      │                      ├─────────────────────▶│
 │                  │                      │                      │  false               │
 │                  │                      │                      │◀─────────────────────┤
 │                  │                      │                      │ Song.start_playing() │
 │                  │                      │                      ├─────────────────────▶│
 │                  │                      │                      │  ok                  │
 │                  │                      │                      │◀─────────────────────┤
 │                  │                      │ JSON-RPC response    │                      │
 │                  │                      │◀─────────────────────┤                      │
 │                  │ result               │                      │                      │
 │                  │◀─────────────────────┤                      │                      │
 │                  │ format MCP envelope  │                      │                      │
 │                  │ { ok, verified,      │                      │                      │
 │                  │   changed, is_playing │                     │                      │
 │                  │   ... }              │                      │                      │
 │ result           │                      │                      │                      │
 │◀─────────────────┤                      │                      │                      │
```

## 5. Layout de arquivos (estado Phase 0)

```
ableton-mind/
├─ src/                          # MCP server TS
│  ├─ index.ts                   # entry stdio
│  ├─ server/                    # MCP plumbing
│  ├─ live-client/               # TCP NDJSON + handshake
│  ├─ tools/                     # `play` (1ª tool)
│  └─ utils/
├─ live/AbletonMind/             # Remote Script Python
│  ├─ __init__.py                # ControlSurface entry
│  ├─ bridge.py                  # TCP server + dispatcher
│  ├─ handlers/                  # transport, track, clip, system
│  ├─ schemas.py                 # dataclasses I/O
│  ├─ transactions.py            # begin/end_undo_step helper
│  └─ tests/                     # unittest offline (LiveAPI mock)
├─ docs/architecture.md          # este arquivo
├─ _workspace/                   # estado do harness (não distribuído)
└─ PLAN.md                       # fonte da verdade
```

Phase 1 adiciona `knowledge/`, `recipes/`, `scripts/`, `dxt/`, `tests/` E2E.

## 6. Instalação do Remote Script

Caminhos exigidos pelo Live para ele enxergar Control Surfaces personalizados:

- **macOS:** `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- **Windows:** `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

Após copiar (ou symlink em dev):
1. Abra **Preferences → Link, Tempo, MIDI → Control Surface**.
2. Selecione `AbletonMind` na lista.
3. Live carrega o script; bridge sobe TCP em `:9876`.

Phase 7 entrega isso via instalador `.mcpb` e CLI `ableton-mind doctor`.

## 7. Threading no bridge

LiveAPI **só pode ser acessada do main thread do Live**. O TCP server roda em thread separada (daemon). Requests JSON-RPC são empacotados e despachados para o main thread via fila + `Live.Base.Timer.set_timer`/`schedule_message`. Resposta volta na thread de socket via Future.

> Decisão do implementador (`python-bridge-engineer`) está em `_workspace/01_bridge_summary.md`. Se foi adotado dispatch direto na thread do socket por simplicidade, anotar como débito técnico em `_workspace/tech-debt.md`.

## 8. Roadmap a partir daqui

PLAN.md §12. Próximo:
- **Phase 0 — fechamento:** smoke test contra Live real (Ciclo 2 ou 3).
- **Phase 1 — paridade ahujasid:** 22 tools, transações, verify loop, browser tree.
- **Phase 2 — paridade AbletonOSC:** todos getters/setters do LOM, listeners → MCP notifications.

Acompanhar status atual em [`_workspace/PROGRESS.md`](../_workspace/PROGRESS.md).
