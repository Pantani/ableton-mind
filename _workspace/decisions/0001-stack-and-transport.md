# ADR 0001 — Stack, transport, licença, alvo

**Data:** 2026-06-08
**Status:** Aceito
**Autor:** architect

## Contexto

PLAN.md §13 lista 9 decisões abertas antes de começar. O usuário disparou "tocar o plano" → modo auto. Vou consolidar as recomendações do próprio PLAN.md como defaults e seguir. Qualquer ajuste posterior gera ADR-N que substitui este.

## Decisões

| # | Pergunta | Decisão | Motivo |
|---|---|---|---|
| 1 | Linguagem MCP server | **TypeScript + Node 20+** | Coerência com tdmcp, ecossistema MCP SDK maduro em TS, Zod para validação tipada. |
| 2 | Transport bridge↔server | **TCP socket JSON-RPC 2.0** (default `:9876`). OSC opcional via `ABLETON_MIND_TRANSPORT=osc` na Fase 7. | JSON-RPC dá tipagem, erros estruturados, batch, bi-direcional para listeners. |
| 3 | Versão mínima do Live | **Live 11+** (com prioridade Live 12). Bridge Python: 3.7 (Live 11) e 3.11 (Live 12). | Corta poucos usuários, libera take lanes / MPE / probability. |
| 4 | Suporte AbletonOSC | **Coexistir** — flag transport, sem drop-in replace. | Permite migração suave de usuários AbletonOSC. |
| 5 | Nome | **`ableton-mind`** | Já é o diretório. Espelha "mind" como tdmcp / TouchDesigner Mind. |
| 6 | Licença | **MIT** | Alinhado com tdmcp e maioria do ecossistema MCP. |
| 7 | Suporte Windows | **Mac-first (Phase 0-1), Windows na Fase 1 final** | Live é mais usado em Mac; dev mais rápido. CI macOS primeiro. |
| 8 | Knowledge devices: extract vs manual | **Híbrido** — script `scripts/extract-device-schemas.mjs` parseia `Default.adv` (XML); curadoria manual completa. | Captura base automática + qualidade humana. |
| 9 | Renderização preview | **Default snapshot JSON. Bounce real opt-in** (`render_preview`). | Snapshot é rápido e suficiente; bounce só quando LLM pede confirmação auditiva. |

## Consequências

- Repo scaffold = TS (`package.json`, `tsconfig.json`, `tsup`, `biome.json`, `vitest`) + Python bridge (`live/AbletonMind/`).
- Phase 0 testa em Live 12 primeiro (Python 3.11). Compat Live 11 (Python 3.7) é Phase 1.
- Windows install path documentado mas testes Windows ficam pendentes até Phase 1.
- Licença `LICENSE` MIT adicionado no scaffold.
- README e docs nascem em PT-BR; tradução EN do README é Phase 7.

## Como aplicar

- Toda nova tool/handler assume TCP JSON-RPC 2.0 como contrato canônico.
- Toda dependência nova entra como devDep no `package.json`; bridge Python sem dependências externas (só stdlib + Live API).
- Qualquer mudança nesta lista → ADR-0002+.
