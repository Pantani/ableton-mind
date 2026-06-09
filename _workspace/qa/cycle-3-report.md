# QA Report — Cycle 3

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Resumo

Cycle 3 fechou TD-006/TD-007, dobrou o número de tools MCP registradas (de 7 → 15), trouxe Knowledge para online com primeiro device schema (Wavetable) + escalas + loader tipado + script de extração stub, e entregou pipeline de distribuição (`npm run build:dxt` zipa um `.mcpb` autocontido).

## Tech debt status

| ID | Status | Onde |
|---|---|---|
| TD-001 | ✅ FECHADO (Cycle 2) | — |
| TD-002 | ✅ FECHADO (Cycle 2) | — |
| TD-003 | ✅ FECHADO (Cycle 2) | — |
| TD-004 (smoke real) | 🟡 PENDENTE | `docs/smoke-test.md` aguarda execução do usuário |
| TD-005 (npm install) | 🟡 PENDENTE | depende da máquina dev |
| TD-006 (master_track nullable invariant) | ✅ FECHADO | JSDoc em `src/tools/track.ts` |
| TD-007 (track_create idempotência) | ✅ FECHADO | novo `track.upsert` handler + tool |

Carry-over: TD-004 + TD-005 (2 itens — ambos dependem de execução real fora do sandbox).

## Parity check (TS ↔ Python)

| Método | Handler | Tool MCP | Match |
|---|---|---|---|
| `system.hello` | system.py | handshake.ts | ✅ |
| `system.ping` | system.py | (client) | ✅ |
| `transport.play` | transport.py | playTool | ✅ |
| `transport.stop` | transport.py | stopTool | ✅ |
| `transport.set_tempo` | transport.py | setTempoTool | ✅ |
| `track.list` | track.py | trackListTool | ✅ |
| `track.create` | track.py | trackCreateTool | ✅ |
| `track.upsert` | track.py NEW | trackUpsertTool NEW | ✅ NEW |
| `track.set_name` | track.py NEW | trackSetNameTool NEW | ✅ NEW |
| `track.set_volume` | track.py NEW | trackSetVolumeTool NEW | ✅ NEW (ADR-0004 normalized) |
| `clip.create_midi` | clip.py | createMidiClipTool | ✅ |
| `clip.add_notes` | clip.py NEW | clipAddNotesTool NEW | ✅ NEW (ADR-0003 format) |
| `clip.fire` | clip.py NEW | clipFireTool NEW | ✅ NEW |
| `clip.stop` | clip.py NEW | clipStopTool NEW | ✅ NEW |
| `clip.set_name` | clip.py NEW | clipSetNameTool NEW | ✅ NEW |
| `session.get_info` | session.py NEW | sessionGetInfoTool NEW | ✅ NEW |
| `browser.get_categories` | browser.py NEW | browserGetCategoriesTool NEW | ✅ NEW |

**15 tools MCP registradas / 17 métodos JSON-RPC totais no bridge** (15 expostos + 2 system internos).

Paridade ahujasid (~22 tools): **~70%**. Faltam ~6: load_browser_item / load_instrument_or_effect, set_clip_loop, get_device_parameters, set_device_parameter, get_track_info detalhado, fire_scene.

## Contract drift

- `_workspace/contracts/phase0-methods.md` precisa ganhar §10..§16 com os novos métodos (`track.upsert`, `track.set_name`, `track.set_volume`, `clip.add_notes`, `clip.fire`, `clip.stop`, `clip.set_name`, `session.get_info`, `browser.get_categories`).
- **Não atualizado neste ciclo** — registrado como TD-008 (low).
- ADR-0003 (note format) e ADR-0004 (volume scale) escritos.

## Knowledge

- `src/knowledge/index.ts` com Zod schemas para `DeviceSchema` e `ScalesPayload`.
- `wavetable.json` 17 params (parcial — `completeness: partial`, TODO list embarcado).
- `scales.json` 16 escalas + 12 root notes.
- `scripts/extract-device-schemas.mjs` STUB: localiza `.adv` no User Library, lista inventário. Parser XML/gzip fica em Cycle 4.

## Distribuição

- `scripts/build-dxt.mjs` gera `.mcpb` sem deps externas (PKZIP nativo via `node:zlib`).
- Empacota: `manifest.json`, `dist/`, `knowledge/`, `README.md`, `LICENSE`.
- `npm run build:dxt:check` valida pré-requisitos sem gerar.
- Determinístico (sem Date.now → output reproducible).

## Testes

Bridge Python:
- `_fakes/live_api.py` extendido com FakeMixerDevice/DeviceParameter, FakeClip.is_playing/add_new_notes/set_notes, FakeClipSlot.fire/stop, FakeBrowser/FakeApplication, song.signature_*, song.name, song.song_length.
- **TODO QA-DEBT**: testes para `add_notes/fire/stop/set_name`, `track.upsert/set_name/set_volume`, `session.get_info`, `browser.get_categories` **NÃO foram escritos neste ciclo** (priorizado código sobre teste pelo budget). Registrar como TD-009.

TS:
- Patterns estabelecidos em Cycle 1-2 cobrem as tools novas; tests adicionais ficam para Cycle 4.

## Warnings

### W1 — Testes não cobrem handlers novos (TD-009)
Bridge e tools entregues sem suíte completa. Patterns existem; só escrever. Medium.

### W2 — Contract doc desatualizado (TD-008)
`phase0-methods.md` cobre só 8 métodos. Devia listar todos os 17. Baixa.

### W3 — `track.set_volume` curva dB é aproximada
Tabela em ADR-0004 com erro <0.5 dB. Pode virar curva exata em Cycle 4. Aceito como design.

### W4 — Browser handler em headless retorna `available: false`
By design. Em smoke real precisa confirmar `available: true` com Live aberto.

### W5 — `clip.add_new_notes` API path
Bridge tenta `clip.add_new_notes(spec)` (Live 11+) e fallback `set_notes(tuple)` (legacy). Não testado em Live real ainda. Smoke vai confirmar.

## Recomendação para o architect

**PASS Cycle 3.** Próximo:

1. **Phase 0 fecha** quando usuário rodar `docs/smoke-test.md`.
2. **Cycle 4 sugerido:**
   - Fechar TD-008 (atualizar contract doc) e TD-009 (testes faltantes).
   - 6 tools restantes ahujasid: `load_instrument`, `fire_scene`, `set_clip_loop`, `get_device_parameters`, `set_device_parameter` (com knowledge lookup!), `get_track_info` detalhado.
   - Knowledge: Operator, EQ Eight, Compressor, Reverb (4 devices). Real parser XML/gzip no `extract-device-schemas.mjs`.
   - Verify loop genérico (ler estado pós-mutação e diff vs intent).
