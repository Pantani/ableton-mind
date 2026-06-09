---
name: cross-boundary-qa
description: Como o QA do ableton-mind verifica integridade nas fronteiras entre TS, Python, knowledge e recipes. Checks de parity (tool ↔ handler), contract drift (Zod ↔ dataclass), recipe lint (URIs ↔ knowledge), smoke contra bridge real ou mock, gate de fase. Usar para escrever ou rodar scripts em scripts/qa/ ou compor relatórios em _workspace/qa/.
---

# Cross-Boundary QA — Verificação de integração

Skill consumido pelo `qa-integration`. Define os checks de fronteira e o formato dos relatórios.

## Princípio central

Cada trilha tem testes próprios (vitest no TS, unittest no Python). O bug que escapa não está no interior — está na **fronteira**:

- A tool TS prometeu retornar `{ track: {...} }`, o handler Python retorna `{ track_data: {...} }`.
- Recipe usa URI `Live:Samples:HouseKit:Kick_99` que não existe no knowledge nem no Live.
- Tool `set_device_param_by_name` busca por "Cutoff", knowledge schema tem "Filter Cutoff".
- Tool TS chama `track.move`, handler Python esquece de registrar.
- DXT bundle não inclui `live/AbletonMind/` no `files` do package.json, server crasha ao tentar copiar.

Sua função: **detectar antes do usuário**.

## Os 5 checks centrais

### 1. Parity check (`scripts/qa/check-tool-handler-parity.mjs`)

Lê todos os `defineTool({ name })` em `src/tools/**/*.ts` (via AST ou regex disciplinada) e todos os `@register("...")` em `live/AbletonMind/handlers/**/*.py`. Reporta:

- **Tools sem handler**: TS define `track.move`, Python não tem `@register("track.move")` → BLOCKER (chamada vai dar erro -32601).
- **Handlers sem tool**: Python tem handler que TS nunca chama → MAJOR (código morto, ou superfície oculta).
- **Nomes inconsistentes**: TS usa `set_track_send`, Python usa `track.set_send` → MAJOR (decida em ADR + alinhar).

Convenção decidida em ADR-0003: TS usa `snake_case` direto (`set_track_send`), Python usa namespacing por ponto (`track.set_send`). Parity check tem mapa explícito.

### 2. Contract drift (`scripts/qa/check-contract-drift.mjs`)

Lê schemas Zod em `_workspace/contracts/*.ts` e dataclasses em `live/AbletonMind/schemas.py`. Para cada par:

- Campos: nomes iguais? (`track_index` vs `trackIndex` → BLOCKER, alinhar.)
- Tipos: number vs int/float? string vs str? boolean vs bool? → check coerção.
- Opcionalidade: `z.optional()` ↔ `Optional[X] = None`? Se TS é opcional mas Python exige → MAJOR.
- Ranges: `z.number().min(20).max(999)` vs validação Python? Idealmente Python também valida (ou bridge devolve erro estruturado).

Estratégia: gerar `live/AbletonMind/schemas.py` a partir dos `.ts` via codegen, ou ter testes que comparam via JSON sample.

### 3. Recipe lint (`scripts/qa/lint-recipes.mjs`)

Para cada `recipes/**/*.json`:

- Validate contra `recipes/_schema.json`.
- Cada `step.tool` existe em `src/tools/`? → BLOCKER se não.
- Cada `step.params` tem o shape que `defineTool({input})` espera? → MAJOR se mismatch.
- Cada URI em `params` (sample, uri) existe em `src/knowledge/packs/` ou `src/knowledge/devices/`? → MAJOR.
- `requires.packs` está coerente com URIs usadas? → MINOR.
- Variáveis `$ref` referenciam steps anteriores válidos? → BLOCKER.

### 4. Knowledge consistency (`scripts/qa/check-knowledge.mjs`)

- `src/knowledge/devices/*.json` valida contra `src/knowledge/_schema/device.json`.
- `parameters[].name` único dentro de cada device.
- `parameters[].index` único e sequencial (0..N-1).
- URIs em `presets_default` válidos.
- Não há devices duplicados em URIs.
- `live_min_version` ≤ versão Live testada na CI.

### 5. Smoke handshake (`scripts/qa/smoke.mjs`)

Se Live disponível na máquina:
- Roda `ableton-mind doctor` — todos checks passam.
- Chama 5-10 tools fundamentais ponta a ponta: `set_tempo`, `create_midi_track`, `create_midi_clip`, `add_notes`, `fire_clip`, `stop_playback`.
- Cada chamada → verifica retorno + re-lê estado.
- Aplica 1 recipe pequena (ex: `recipes/racks/utility-test.json`) e verifica steps.

Se Live não disponível (CI sem GUI):
- Roda bridge em modo `FAKE_LIVE=1` que carrega `live/tests/_fakes/live_api.py`.
- Smoke contra bridge mockada. Vale para parity, não para visual.

## Formato de relatório

`_workspace/qa/cycle-{N}-report.md`:

```markdown
# QA Report — Cycle {N}
**Data:** YYYY-MM-DD
**Fase PLAN.md:** Fase 2 — Paridade AbletonOSC
**Status:** PASS | PASS-WITH-WARNINGS | FAIL
**Escopo:** trilhas tocadas, paths cobertos

## Checks rodados
| Check | Resultado | Detalhes |
|---|---|---|
| parity | ✓ PASS | 0 tools sem handler, 0 handlers sem tool |
| contract drift | ✗ FAIL | 2 divergências em track schema |
| recipe lint | ✓ PASS | 12 recipes validadas |
| knowledge consistency | ⚠ WARN | 1 device sem `live_max_version` |
| smoke handshake | ✓ PASS | 8/8 tools ponta a ponta + 1 recipe |

## Achados

### [BLOCKER] contract drift — track.color_index
- **Onde:** _workspace/contracts/track.ts:14 ↔ live/AbletonMind/schemas.py:32
- **Sintoma:** TS `z.number().int().min(0).max(69).optional()` ; Python `color_index: int` (sem optional)
- **Repro:** chamar `create_midi_track {name: "X"}` sem `color_index` → bridge devolve erro "missing color_index".
- **Fix sugerido:** python-bridge-engineer, ajustar dataclass para `Optional[int] = None`.

### [MAJOR] recipe drums/tech-house-pattern usa tool inexistente
- **Onde:** recipes/drums/tech-house-pattern.json:42
- **Sintoma:** step usa `tool: "set_note_probability"` que não está em src/tools/clip.ts
- **Repro:** `apply_recipe drums/tech-house-pattern` → erro -32601.
- **Fix sugerido:** ts-server-engineer adiciona tool (está no PLAN.md Fase 4) OU recipe-designer remove uso até Fase 4.

### [MINOR] knowledge/devices/wavetable.json sem live_max_version
- **Onde:** src/knowledge/devices/wavetable.json:8
- **Sintoma:** field ausente, schema-mestre requer (mesmo que null).
- **Fix sugerido:** knowledge-curator adiciona `"live_max_version": null`.

## Smoke tests detalhe

- `set_tempo 128` → tempo lido = 128.0 ✓
- `create_midi_track {name:"X"}` → criada, verificada ✓
- ... (cada um listado)
- `apply_recipe racks/utility-test` → 4 steps, todos verified ✓

## Decisão de gate

- [ ] Ciclo aprovado para próxima fase
- [x] **Bloqueia próximo ciclo até fix de [BLOCKER]**
- Owner do fix: python-bridge-engineer
- Re-roda check parcial: contract drift apenas, após fix

## Notas de tendência
- Padrão: 3 ciclos seguidos com drift em `Optional` de Python. Proposta: codegen `schemas.py` a partir de `_workspace/contracts/*.ts` (escala em ADR).
```

## Scripts executáveis

Todos em `scripts/qa/`:

- `check-tool-handler-parity.mjs` — usa `glob` + AST mínima.
- `check-contract-drift.mjs` — lê `.ts` e `.py`, normaliza para JSON, compara.
- `lint-recipes.mjs` — Ajv para schema + checks customizados.
- `check-knowledge.mjs` — Ajv para device schema-mestre.
- `smoke.mjs` — Node script chamando o servidor MCP local ou bridge mock.
- `run-all.mjs` — roda os 5 e gera o relatório markdown.

Saída programática: `--json` flag em todos, para CI consumir.

## Gate de fase (decisão)

| Achado mais grave | Decisão |
|---|---|
| Nenhum | PASS — `architect` avança para próxima fase |
| MINOR | PASS-WITH-WARNINGS — `architect` registra em `_workspace/tech-debt.md`, segue |
| MAJOR | PASS-WITH-WARNINGS se isolado; FAIL se 3+ MAJORs na mesma fronteira |
| BLOCKER | FAIL — `architect` força ciclo de fix imediato |

Gate não é definitivo: `architect` pode override BLOCKER com ADR motivado (raríssimo, só quando bug é em código não-crítico para a fase atual).

## Tendências e meta-feedback

Quando você nota:
- Mesmo tipo de drift 3+ vezes em ciclos diferentes → propõe codegen ou lint mais cedo.
- Mesma trilha gerando MAJOR/BLOCKER reincidentes → reporta ao `architect` para revisar protocolo da trilha.
- Tool/handler que ninguém usa há 5+ ciclos → marca como candidato a remoção.

Anota em `_workspace/qa/trends.md` (vivo, edita em vez de acumular relatórios).

## Antipatterns

| ❌ | ✅ |
|---|---|
| "Algo deu errado" | "Field X em arquivo Y:linha N diverge: TS espera number, Python devolve string" |
| Rodar QA só no fim da fase | Rodar a cada ciclo, escopo focado |
| Reportar bug sem owner sugerido | Sempre indica a trilha que deve mexer |
| Marcar tudo BLOCKER | Severidade calibrada — BLOCKER é só o que para integração |
| QA reescreve código | QA reporta. Fix é da trilha dona. |
