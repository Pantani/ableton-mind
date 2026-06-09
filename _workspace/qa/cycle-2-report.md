# QA Report — Cycle 2 (tech debt + Phase 1 start)

**Data:** 2026-06-08
**Veredito:** **PASS-WITH-WARNINGS**
**QA:** architect inline (mesma justificativa do Cycle 1; volta a dispatch de qa-integration quando trabalho for grande).

## Resumo

Cycle 2 fechou 3 dos 5 débitos técnicos do Cycle 1, expôs 4 tools MCP novas + 1 nova feature (`track.create`), e iniciou trilha de distribuição (DXT manifest, script de install dev). Smoke real continua dependendo de execução manual pelo usuário (TD-004 fica aberto até o usuário rodar o roteiro em `docs/smoke-test.md`).

## Tech debt status

| ID | Status | Onde |
|---|---|---|
| TD-001 (NaN env var) | ✅ FECHADO | `src/live-client/tcp-client.ts` — função `parsePositiveInt()` |
| TD-002 (track.list indexes) | ✅ FECHADO | `live/AbletonMind/handlers/track.py` + ADR-0002 |
| TD-003 (LIVE_API_FAILED naming) | ✅ FECHADO | `live/AbletonMind/errors.py`, `bridge.py` |
| TD-004 (smoke real) | 🟡 DOCUMENTADO | `docs/smoke-test.md` — execução manual pelo usuário |
| TD-005 (npm install não rodou) | 🟡 ACEITO | depende da máquina dev do usuário; sem ação possível em sandbox |

## Parity check (TS ↔ Python)

| Método | Bridge handler | TS tool MCP | Match |
|---|---|---|---|
| `system.hello` | `handlers/system.py` | `live-client/handshake.ts` (cliente) | ✅ |
| `system.ping` | `handlers/system.py` | (cliente direto) | ✅ |
| `transport.play` | `handlers/transport.py` | `tools/transport.ts::playTool` | ✅ |
| `transport.stop` | `handlers/transport.py` | `tools/transport.ts::stopTool` | ✅ NEW |
| `transport.set_tempo` | `handlers/transport.py` | `tools/transport.ts::setTempoTool` | ✅ NEW |
| `track.list` | `handlers/track.py` (shape novo ADR-0002) | `tools/track.ts::trackListTool` | ✅ NEW shape sincronizado |
| `track.create` | `handlers/track.py` NEW | `tools/track.ts::trackCreateTool` NEW | ✅ NEW |
| `clip.create_midi` | `handlers/clip.py` | `tools/clip.ts::createMidiClipTool` | ✅ NEW |

7 tools MCP registradas (era 1 no Cycle 1).

## Contract drift

- `_workspace/contracts/phase0-methods.md` foi **atualizado** para refletir ADR-0002 (track.list shape novo) e adicionar §9 (`track.create`).
- `_workspace/contracts/jsonrpc.md` **intacto**.
- `ADR-0002` registrado em `_workspace/decisions/0002-track-list-shape.md`.

## Error code sync

| Code | TS (`ABLETON_MIND_ERRORS`) | Python (`errors.py`) |
|---|---|---|
| -32000 | LIVE_NOT_RUNNING | LIVE_NOT_RUNNING |
| -32001 | LIVE_API_CALL_FAILED | LIVE_API_CALL_FAILED ✅ (era LIVE_API_FAILED) |
| -32002 | OBJECT_NOT_FOUND | OBJECT_NOT_FOUND |
| -32003 | TYPE_MISMATCH | TYPE_MISMATCH |
| -32004 | OUT_OF_RANGE | OUT_OF_RANGE |
| -32005 | INVALID_STATE | INVALID_STATE |
| -32006 | TRANSACTION_ERROR | TRANSACTION_ERROR |
| -32007 | LISTENER_ERROR | LISTENER_ERROR |
| -32008 | KNOWLEDGE_LOOKUP_FAILED | KNOWLEDGE_LOOKUP_FAILED |

100% match.

## Testes adicionados

Python (em `live/AbletonMind/tests/`):
- `test_handlers_track.py` totalmente reescrito para novo shape + 6 casos de `track.create` (default append, index específico, named, OOR, bad type, undo wrap).

TS (em `tests/`):
- `tools-transport.test.ts` expandido: + 5 casos para `stop` e `set_tempo`.
- `tools-track.test.ts` NEW: 5 casos cobrindo `trackListTool` + `trackCreateTool`.
- `tools-clip.test.ts` NEW: 3 casos para `createMidiClipTool` (incluindo TYPE_MISMATCH propagado).

`tests/live-client.test.ts` continua igual e cobre o transport TCP.

## Warnings (não bloqueiam)

### W1 — Tipos nullable em master_track
Aceito como design. Em testes com FakeSong sem master_track, vira `null`. Em runtime real, `song.master_track` sempre existe. Tools MCP que precisarem assumir master sempre presente devem documentar.

### W2 — Smoke real ainda pendente (TD-004)
Phase 0 só fecha oficialmente quando o usuário rodar `docs/smoke-test.md` e reportar PASS. Nenhum gate automatizado para isso até CI macOS na Phase 7.

### W3 — `track_create` não é idempotente
Decisão intencional (criar track sempre cria). Phase 1+ pode adicionar `track_upsert` se a UX for ruim. Documentado na description da tool.

### W4 — Dev install script só macOS+win32
`linux` levanta erro explícito ("Ableton não roda nativamente"). Documentado. Nenhuma ação.

## Recomendação para o architect

**PASS Cycle 2.** Movendo TD-004 e TD-005 para "carry-over". Próximo ciclo deve:

1. **Usuário roda `docs/smoke-test.md`** → reporta PASS/FAIL. Se PASS, Phase 0 fecha oficialmente.
2. **Phase 1 cont.:** mais ~15 tools do `ahujasid/ableton-mcp` (browser, load_instrument, set_clip_name, add_notes, fire_clip, etc.).
3. **knowledge-curator entra:** primeiro device JSON (Wavetable) como prova de conceito.
4. **distribution-docs cont.:** preparar `npm run build:dxt` que zipa o `.mcpb`.
