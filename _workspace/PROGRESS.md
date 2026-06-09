# PROGRESS — ableton-mind

**Estado:** 🎯 **TD-004 SMOKE PASS contra Live 12.4.1 real**. Phase 0 oficialmente fechada. Sistema pronto para tag `v0.1.0-rc.1`.
**Última atualização:** 2026-06-09

## 🎉 Smoke real PASS — Cycle 21

8 RPC calls + 6 notifications executados contra Ableton Live 12.4.1 macOS rodando:
- ✅ `system.hello` handshake (protocol_version 0.1, python 3.11.6)
- ✅ `system.ping` round-trip
- ✅ `session.get_info` (4 tracks, 2 returns, master, 120 BPM, C Major scale)
- ✅ `transport.play` + listener notification
- ✅ `transport.stop` + listener notification
- ✅ `transport.set_tempo` (120→126→120) verify + 2 notifications
- ✅ `track.list` ADR-0002 shape exata (4 + 2 + master = 7 total)
- ✅ `track.set_name` roundtrip rename + verify diff + 2 notifications

Detalhe em [qa/cycle-21-smoke-pass.md](qa/cycle-21-smoke-pass.md).

## MCP primitives — 3/3 ✅

- **Tools**: 33 (32 + list_prompts + list_resources)
- **Prompts**: 5 (genre, mix, arrangement, sound design, vocal)
- **Resources**: 3 (session/state, knowledge/devices, recipes/index)

## Métricas finais

| Categoria | Valor |
|---|---|
| MCP tools | **33** |
| MCP prompts | **5** |
| MCP resources | **3** |
| Devices na knowledge | **55** (110% PLAN §5) |
| Recipes embarcadas | **14** (7/7 categorias) |
| Métodos JSON-RPC no bridge | **30** + 7 listener events |
| Verify loop | **23/23 tools** |
| ADRs consolidados | **11** |
| Cycles | **21** |
| QA reports | **21** |
| Tests TS + Python | **~250 cases** + wire smoke + **smoke real PASS** |
| TDs fechados | **43** (TD-004 fechado em Cycle 21) |
| TDs abertos | **4** (2 ambiente + 2 trivial pós-smoke) |

## Fases — final

| Phase | Status |
|---|---|
| 0 — Spike | ✅ **SMOKE PASS** (Cycle 21) |
| 1 — Paridade ahujasid | ✅ 22/22 |
| 2 — Listeners → MCP notifications | ✅ **confirmado live em Cycle 21** |
| 3 — Knowledge base | ✅ 55 devices |
| 4 — Automation envelopes | ✅ linear / hold |
| 5 — Preview / verify | ✅ snapshot+diff |
| 6 — Push | ✅ pad/button/mode LEDs (hardware test pendente TD-030) |
| 7 — Distribuição | ✅ DXT/Docker/Smithery/CI/release prontos |
| 8 — Long tail | 🔵 Resources entregues; M4L/VST3/Live Link pendentes |

## Bugs descobertos no smoke real

- **TD-046** — `system.hello version: "0.0.1"` hardcoded.
- **TD-047** — `system.hello live_version: "0.0.0"` stub.

Ambos triviais — fix em Cycle 22 antes do rc.1 tag.

## Próximo passo

```bash
# Fix TD-046/TD-047 trivials, então:
git checkout -b release/0.1.0-rc.1
# bump versão 0.1.0-rc.1
git commit -m "release: v0.1.0-rc.1 (TD-004 smoke PASS)"
git tag v0.1.0-rc.1
git push origin main v0.1.0-rc.1
```

→ release.yml automático: ghcr.io push + GitHub Release + .mcpb attached.
