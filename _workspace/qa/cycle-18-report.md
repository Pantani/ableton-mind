# QA Report — Cycle 18

**Data:** 2026-06-09
**Veredito:** **PASS**

## Resumo

MCP Prompts subsystem entregue (5 seed prompts + registry + wiring SDK + `list_prompts` tool + DXT manifest atualizado). Versão 0.0.18. **Total tools MCP: 32** (era 31).

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDENTE (usuário) — BLOQUEIA rc.1 |
| TD-005 | 🟡 PENDENTE (sandbox) |
| TD-030 | 🟡 PENDENTE (Push hardware) |

3 itens abertos, todos não-resolvíveis em sandbox. **Estado idêntico ao Cycle 17 — Cycle 18 foi expansão produtiva, sem alterar tech debt.**

## ADR-0010 — MCP Prompts

Shape decidido: `{name, description, arguments, argsSchema, handler}`. Handler retorna `PromptResult { messages: [...] }` que vira primeira mensagem da conversação no cliente MCP.

## Prompts entregues — 5 seeds

| Prompt | Args |
|---|---|
| `create_genre_track` | genre, tempo?, duration_min? |
| `build_mix_chain` | source, track_index? |
| `build_arrangement` | structure, tempo?, bars_per_section? |
| `sound_design_session` | synth, target, track_index? |
| `process_vocal_take` | track_index, style? |

Cada prompt renderiza orientação estruturada referenciando tools existentes (`apply_recipe`, `device_set_parameter`, `session_snapshot/diff`) e recipes disponíveis. Geometria de incentivo: LLM tende a usar verify loop + knowledge enrichment quando guiado.

## Tool nova: `list_prompts`

Read-only. Fallback discovery para clientes que não expõem `prompts/list` nativamente. Devolve `{name, description, arguments}` × 5.

## Total MCP — Cycle 18 final

- **32 tools** (31 + list_prompts).
- **5 prompts** (subsystem novo).
- **30 métodos JSON-RPC no bridge** (sem mudança — prompts são puramente TS).
- **55 devices** (sem mudança).
- **14 recipes** (sem mudança).

## DXT manifest

`dxt/manifest.json` lista os 5 prompts. Claude Desktop pode renderizar menu /prompts pós-install via `.mcpb`.

## Versão: 0.0.18

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Warnings

### W1 — Prompts não testados (TS unit tests)
Patterns conhecidos — handlers são puros (sem efeito colateral). Próximo ciclo escreve `tests/prompts.test.ts` se houver demanda. TD-044 (baixa).

### W2 — Prompt arguments são todos `string?` no handler
SDK MCP 1.x recebe args como `Record<string, string>`. Coerção numérica (tempo, bars) ficou no handler. Funciona. Sem ação.

### W3 — TD-004 segue bloqueando rc.1
Estado inalterado.

## Recomendação

**PASS Cycle 18.** Sistema agora exibe as 3 primitivas MCP (tools + prompts; resources Phase 8). Próximo:

Cycle 19 / Release Window:
- **TD-004 smoke real** ← BLOQUEIO.
- TD-044 prompts tests (opcional).
- Tag `v0.1.0-rc.1` (após smoke PASS).
