# PROGRESS — ableton-mind

**Estado:** Sistema essencialmente completo. 20 ciclos. **42 TDs fechados / 3 abertos** (todos hardware/Live UI). Versão 0.0.20.
**Última atualização:** 2026-06-09

## MCP primitives — 3/3 ✅

- **Tools**: 33
- **Prompts**: 5
- **Resources**: 3

## Métricas finais

| Categoria | Valor |
|---|---|
| MCP tools | **33** |
| MCP prompts | **5** |
| MCP resources | **3** |
| Devices na knowledge | **55** (110% PLAN §5 target) |
| Recipes embarcadas | **14** (7/7 categorias) |
| Métodos JSON-RPC no bridge | **30** + 7 listener events |
| Verify loop | **23/23 tools** |
| ADRs consolidados | **11** |
| Cycle briefings | **20** |
| QA reports | **20** |
| Tests TS + Python | **~250 cases** |
| TDs fechados | **42** em 20 ciclos |
| TDs abertos | **3** (todos ambiente real) |

## Fases — final

| Phase | Status | Notas |
|---|---|---|
| 0 — Spike | ✅ código | smoke real Live UI pendente (TD-004) |
| 1 — Paridade ahujasid | ✅ 22/22 | + 9 extras |
| 2 — Listeners → MCP notifications | ✅ | 7 eventos |
| 3 — Knowledge base | ✅ | 55 devices, ~800 params |
| 4 — Automation envelopes | ✅ | linear / hold |
| 5 — Preview / verify | ✅ | snapshot+diff (bounce planejado) |
| 6 — Push 1/2/3 | ✅ | pad/button/mode LEDs |
| 7 — Distribuição | ✅ | DXT/Docker/Smithery/CI/release prontos |
| 8 — Long tail | 🔵 iniciado | Resources entregues; M4L/VST3/Live Link pendentes |

## Ciclos

| # | Status |
|---|---|
| 1-17 | PASS-WITH-WARNINGS |
| 18-20 | PASS |

## Cycle 20 — entregas

- **TD-045 ✅** DXT manifest `resources` array (3 entries).
- **`live/AbletonMind/__main__.py`** — bridge CLI headless.
- **`tests/wire-smoke.test.ts`** — real TCP smoke (opt-in `RUN_WIRE_SMOKE=1`).
- **Doctor CLI 7º check** — MCP primitives count.

## Próximo — Release Window

**Único bloqueio:** TD-004 smoke real (Live UI). Tudo mais já testado:
- 33 tools cobertos por unit tests + wire smoke valida cabo end-to-end.
- 5 prompts cobertos por unit tests.
- 3 resources cobertos por unit tests.
- Bridge dispatcher exercitado via wire smoke headless.

Quando TD-004 passar:
```bash
git checkout -b release/0.1.0-rc.1
# bump versions → 0.1.0-rc.1
git commit -m "release: v0.1.0-rc.1"
git tag v0.1.0-rc.1
git push origin v0.1.0-rc.1
```
→ release.yml dispara automático.

Disparar com "continuar" ou "commit" para gravar Cycles 15-20.
