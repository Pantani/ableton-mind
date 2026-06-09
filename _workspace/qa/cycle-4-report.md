# QA Report — Cycle 4

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Resumo

Cycle 4 fechou 4 dos 7 débitos abertos (TD-008, TD-009, TD-010, TD-011), adicionou 3 tools (`track_get_info`, `scene_fire`, `clip_set_loop`), entregou verify loop foundation com testes próprios. Paridade ahujasid agora em **~82%** (18/22 tools mapeadas).

## Tech debt status

| ID | Status | Onde |
|---|---|---|
| TD-004 (smoke real) | 🟡 PENDENTE | depende de execução manual via `docs/smoke-test.md` |
| TD-005 (npm install) | 🟡 PENDENTE | depende de máquina real |
| TD-008 (contract doc) | ✅ FECHADO | `_workspace/contracts/phase0-methods.md` §10..§20 |
| TD-009 (Python tests) | ✅ FECHADO | `live/AbletonMind/tests/test_handlers_cycle3_4.py` |
| TD-010 (TS tests) | ✅ FECHADO | `tests/tools-cycle3-4.test.ts` + `tests/feedback-verify.test.ts` |
| TD-011 (real .adv parser) | ✅ FECHADO | `scripts/extract-device-schemas.mjs` (gunzip + sax-lite regex) |
| TD-012 (Wavetable completo) | 🟡 PENDENTE | curadoria pós-extract — Cycle 5 |

5 fechados em 4 ciclos. 3 carry-over (todos não-bloqueantes).

## Parity check (TS ↔ Python)

**18 tools MCP registradas / 20 métodos JSON-RPC totais no bridge** (18 expostos + 2 system).

Tools novas Cycle 4:
| Método | Handler | Tool |
|---|---|---|
| `track.get_info` | `handlers/track.py::TrackGetInfoHandler` | `trackGetInfoTool` |
| `scene.fire` | `handlers/scene.py::SceneFireHandler` NEW file | `sceneFireTool` |
| `clip.set_loop` | `handlers/clip.py::ClipSetLoopHandler` | `clipSetLoopTool` |

Registry smoke test em `tools-cycle3-4.test.ts` verifica que `allTools.length === 18` com os nomes esperados. Python test `test_handlers_cycle3_4.py::TestRegistry` valida que REGISTRY tem as 20 entradas certas.

## Contract drift

- `phase0-methods.md` agora documenta §1..§20 (todos os métodos correntes).
- ADR-0003 (note format) e ADR-0004 (volume scale) já existiam (Cycle 3).
- Nenhum ADR novo neste ciclo — todos os novos métodos seguem padrões existentes.

## Knowledge

- `extract-device-schemas.mjs` agora real:
  - `gunzipSync` para descomprimir `.adv`.
  - Sax-lite por regex: caça blocos `<TagName>...<Manual Value="X"/>...</TagName>` que não estão na lista de GENERIC_TAGS.
  - Output em `src/knowledge/devices/_extracted/<id>.json` com `completeness: partial` + `source: "extracted-from-default-adv (sha256:...)"`.
  - Flags: `--inventory`, `--dry-run`, `--device <Name>`.
  - **Limitação conhecida:** sem introspecção LiveAPI, só captura defaults — `min/max/unit` precisam de curadoria manual. PLAN.md §5 já previa esse híbrido.

## Verify loop

- `src/feedback/verify.ts` — primitivos `verifyField(intent, actual, opts)`, `verifyAll(...)`, sentinela `UNVERIFIABLE`.
- 9 testes em `tests/feedback-verify.test.ts` (numbers com tolerância, strings, booleans, combinadores).
- **Ainda não integrado nas tools existentes** — Cycle 5 migra `track_set_volume` e `set_tempo` como primeiros adopters reais. Registrar como TD-013.

## Testes

Python (em `live/AbletonMind/tests/`):
- `test_handlers_cycle3_4.py` adicionado — 11 classes de teste, ~30 casos cobrindo todos os 11 handlers de Cycle 3-4 + smoke do REGISTRY.
- `_fakes/live_api.py` expandido: `FakeScene` + `song.scenes`, `FakeClip.loop_*`.

TS (em `tests/`):
- `tools-cycle3-4.test.ts` — 18+ casos cobrindo as 12 tools que não tinham teste, + registry smoke.
- `feedback-verify.test.ts` — 9 casos cobrindo o verify loop.

Total estimado: **80+ test cases** acumulados em ambos os lados (não contado mas significativamente acima do Cycle 3).

## Warnings

### W1 — TD-013 (novo): verify loop não integrado
`src/feedback/verify.ts` é só foundation. Tools ainda retornam `verified: true` literal. Cycle 5 migra. Severidade: baixa (não muda contrato).

### W2 — TD-012 carry-over
`wavetable.json` continua parcial (17/~60 params). Esperando extract real ou curadoria. Baixa.

### W3 — TD-004 + TD-005 não resolvíveis em sandbox
Esperando execução real pelo usuário. Estável desde Cycle 1.

### W4 — `.adv` parser é heurístico (regex, não AST)
Funciona para os defaults típicos do Live, mas `.adv` complexos (nested params, racks profundos) podem perder entries. Por isso `_extracted/` é separado de `devices/` — curadoria humana ainda passa por cima.

## Recomendação para o architect

**PASS Cycle 4.** Próximo:

1. Smoke real (TD-004) → fecha Phase 0 oficialmente.
2. Cycle 5 fecha paridade ahujasid:
   - `load_browser_item` / `load_instrument`
   - `get_device_parameters` + `set_device_parameter` knowledge-aware (usa Wavetable.json e _extracted/*)
   - Verify loop integration em N tools (TD-013).
3. Curador completa Wavetable + roda extract contra Operator/EQ Eight/Compressor/Reverb se disponível (TD-012).
4. Phase 2 começa: listeners no bridge (transport, track, clip) → MCP notifications.
