---
name: ableton-mind-build
description: Orquestra o time de 7 agentes para construir, estender ou manter o ableton-mind (MCP definitivo para Ableton Live). USAR sempre que o usuário pedir para executar fase do PLAN.md, scaffold do repo, implementar tools/handlers/recipes/devices, "começar a fase X", "rodar o ciclo", "tocar o plano", "executar paralelo", "monta time pro plano", continuar implementação, retomar trabalho, ciclo novo, sync entre trilhas, gate de fase, ou qualquer pedido relacionado a desenvolvimento concreto do ableton-mind. Também ativa para "atualizar progresso", "ver status do time", "próximo passo", "o que tá rolando", "reexecutar fase", "refazer ciclo", "consertar trilha X".
---

# ableton-mind-build — Orquestrador do time

Você está orquestrando 7 agentes especializados para construir o ableton-mind seguindo `PLAN.md`. O time roda em **paralelo por trilhas** com `architect` como líder.

## Time (7 agentes)

| Trilha | Agente | Domínio |
|---|---|---|
| Liderança | `architect` | Plano mestre, ADRs, integração, gate |
| A — Server | `ts-server-engineer` | TS/Node MCP server, tools, resources, prompts |
| A — Bridge | `python-bridge-engineer` | Remote Script Python, LiveAPI, TCP JSON-RPC |
| B — Knowledge | `knowledge-curator` | Schemas de devices, packs, escalas, MIDI |
| C — Recipes | `recipe-designer` | Recipes musicais JSON |
| D — Distribuição | `distribution-docs-engineer` | DXT, npm, Docker, docs, CI, CLI |
| E — QA | `qa-integration` | Contratos cruzados, smoke, gate |

Todos `model: opus`.

## Phase 0 — Contexto (sempre executa primeiro)

Antes de fazer qualquer coisa, descobre em que estado está:

1. Lê `PLAN.md` (fonte da verdade do escopo).
2. Lê `_workspace/PROGRESS.md` se existir.
3. Lista `_workspace/decisions/` e `_workspace/qa/` para ver ADRs e relatórios pendentes.
4. Lista `_workspace/cycle-briefing-*.md` para ver memória recente.
5. Decide o modo de execução:

| Modo | Quando | O que faz |
|---|---|---|
| **Inicial** | `PROGRESS.md` não existe | Cria `PROGRESS.md`, escreve cycle-briefing-1, dispara time para Fase 0 (Spike) do PLAN.md |
| **Continuar** | `PROGRESS.md` aponta para fase em andamento | Lê estado, escreve cycle-briefing-{N+1}, dispara time para próximas tarefas |
| **Refazer fase** | Usuário pede "refazer X" | Move `_workspace/` atual para `_workspace_prev_{ts}/`, recria com escopo pedido |
| **Gate de fase** | `qa/cycle-N-report.md` existe sem PROGRESS atualizado | Lê veredito, atualiza PROGRESS, decide próximo ciclo |
| **Sync only** | Usuário pede "status" | Reporta estado sem disparar trilhas |

## Phase 1 — Planejamento do ciclo

Após Phase 0, o `architect` (você no papel de líder) escreve `_workspace/cycle-briefing-{N}.md`:

```markdown
# Cycle N — {data}
**Fase PLAN.md:** {ex: Fase 2 — Paridade AbletonOSC}
**Objetivo do ciclo:** {1 frase}

## Atribuições
- ts-server-engineer: {tarefas concretas, com referência a tools/arquivos}
- python-bridge-engineer: {handlers a entregar}
- knowledge-curator: {devices/packs prioritários}
- recipe-designer: {recipes prioritários}
- distribution-docs-engineer: {docs/setup tocados}
- qa-integration: {fronteiras a testar}

## Contratos novos/alterados neste ciclo
- {ref a _workspace/contracts/}

## Dependências entre trilhas
- ts-server depende de python-bridge para handler X
- recipes dependem de knowledge para device Y
- (sequenciar ou paralelizar conforme dependência)

## Critérios de gate
- QA rodou parity check, contract drift, recipe lint, smoke
- Veredito: PASS, PASS-WITH-WARNINGS, FAIL+bloqueia próximo
```

## Phase 2 — Execução paralela

Dispara as trilhas **em paralelo** quando não há dependência sequencial entre elas.

### Estratégia paralela por fase do PLAN.md

| Fase PLAN | Trilhas ativas em paralelo |
|---|---|
| **Fase 0 — Spike** | architect + ts-server + python-bridge (sequencial: contrato → bridge → server → integração) |
| **Fase 1 — Paridade ahujasid** | ts-server ‖ python-bridge ‖ qa-integration (contínuo) |
| **Fase 2 — Paridade AbletonOSC** | ts-server ‖ python-bridge ‖ knowledge ‖ qa |
| **Fase 3 — Knowledge & Recipes** | knowledge ‖ recipes ‖ qa ‖ (ts-server tocando schema-aware tools) |
| **Fase 4 — Coberturas avançadas** | ts-server ‖ python-bridge ‖ knowledge (continua) ‖ qa |
| **Fase 5 — Preview & Feedback** | ts-server (preview tools) ‖ python-bridge (render) ‖ qa |
| **Fase 6 — Push & Move** | ts-server ‖ python-bridge ‖ knowledge ‖ qa |
| **Fase 7 — Distribuição & Docs** | distribution-docs (driver) ‖ todos os outros (suporte) |

**Disparo paralelo:** envia uma única mensagem com múltiplas tool calls de `Agent` (uma por trilha), `model: "opus"`, `run_in_background: true`.

Exemplo de disparo Fase 2:
```
Agent({subagent_type: "general-purpose", model: "opus", run_in_background: true,
       prompt: "Você é ts-server-engineer. Leia _workspace/cycle-briefing-3.md e execute suas atribuições..."})
Agent({subagent_type: "general-purpose", model: "opus", run_in_background: true,
       prompt: "Você é python-bridge-engineer. ..."})
Agent({subagent_type: "general-purpose", model: "opus", run_in_background: true,
       prompt: "Você é knowledge-curator. ..."})
Agent({subagent_type: "general-purpose", model: "opus", run_in_background: true,
       prompt: "Você é qa-integration. Aguarde sinal dos outros via _workspace/{ciclo}_*_summary.md..."})
```

Cada agente lê sua definição em `.claude/agents/{name}.md` antes de começar (isso vem no prompt).

## Phase 3 — Coleta e integração

Quando todos os agentes em background terminarem (você é notificado):

1. Lê `_workspace/{ciclo}_*_summary.md` de cada trilha.
2. Lê `_workspace/qa/cycle-{N}-report.md`.
3. Compara com `cycle-briefing-{N}.md`: o que foi entregue, o que ficou.
4. Se houver gaps ou novos ADRs necessários → cria/atualiza.
5. Atualiza `_workspace/PROGRESS.md` (resumo do ciclo, próximo ciclo).
6. Reporta ao usuário em < 200 palavras: o que ficou pronto, próximo ciclo, decisões pendentes.

## Phase 4 — Gate de fase

A cada N ciclos (típico: 3-5), ou quando o briefing diz "fim de fase":

1. QA escreve relatório final da fase.
2. `architect` lê e decide:
   - **PASS** → marca fase como completa em `PROGRESS.md`, escreve próximo cycle-briefing apontando para próxima fase.
   - **PASS-WITH-WARNINGS** → completa fase, registra débito técnico em `_workspace/tech-debt.md`.
   - **FAIL** → não avança, escreve cycle-briefing focado em remediar bloqueios.
3. Reporta ao usuário com o veredito.

## Regras invioláveis

| Regra | Por quê |
|---|---|
| **Todo agente usa `model: "opus"`** | Qualidade do hardware → qualidade do output. |
| **Toda chamada `Agent` recebe arquivo de definição via referência** | Agentes consultam `.claude/agents/{name}.md` para regras de protocolo. |
| **Nada toca produção sem passar pelo `_workspace/`** | Artefatos intermediários sempre em _workspace; só promove para `src/`, `live/`, `recipes/`, `docs/` após QA. |
| **Toda mutação de contrato gera ADR** | Mudou `_workspace/contracts/*.ts` → tem que ter ADR antes ou simultâneo. |
| **QA é gate, não veto** | QA reporta; architect decide. Se QA marcou FAIL e architect quer avançar com débito, escreve ADR com motivo. |
| **Sem trabalho paralelo em arquivos do mesmo dono** | Não disparo 2 instâncias do `ts-server-engineer` no mesmo ciclo. Uma de cada vez. |
| **Notificação assíncrona** | Background agents avisam ao terminar — você NÃO faz poll, NÃO usa sleep loop. Deixa o runtime notificar. |

## Estado a manter em `_workspace/`

```
_workspace/
├─ PROGRESS.md                    # estado atual (fase, ciclo, próximos passos)
├─ tech-debt.md                   # débitos aceitos
├─ backlog.md                     # ideias fora do PLAN.md
├─ contracts/                     # schemas TS compartilhados TS↔Python
│  ├─ track.ts
│  ├─ clip.ts
│  └─ ...
├─ decisions/                     # ADRs
│  ├─ 0001-typescript-server.md
│  ├─ 0002-tcp-jsonrpc.md
│  └─ ...
├─ cycle-briefing-1.md            # planejamento por ciclo
├─ cycle-briefing-2.md
├─ 01_ts_summary.md               # entregas por ciclo+trilha
├─ 01_bridge_summary.md
├─ 01_knowledge_summary.md
├─ 01_recipes_summary.md
├─ 01_distribution_summary.md
└─ qa/
   ├─ cycle-1-report.md
   ├─ cycle-2-report.md
   └─ ...
```

## Cenário de teste — fluxo normal

1. Usuário: "começar a Fase 2"
2. Você lê PROGRESS.md → Fase 1 completa, gate PASS
3. Escreve `cycle-briefing-4.md` para Fase 2, atribui:
   - ts-server: tools de Clip getters/setters
   - python-bridge: handlers correspondentes + listeners
   - knowledge: 5 primeiros devices (Wavetable, Operator, EQ Eight, Glue Comp, Reverb)
   - qa: parity + smoke
4. Dispara 4 agentes em paralelo (`run_in_background: true`)
5. Quando todos terminam, lê summaries, atualiza PROGRESS.md
6. Reporta ao usuário: "ciclo 4 entregou X tools, Y handlers, Z devices. QA PASS-WITH-WARNINGS (2 minor). Próximo ciclo: Device tools + 5 devices restantes da Wave 1."

## Cenário de teste — fluxo de erro

1. Usuário: "rodar próximo ciclo"
2. Você lê PROGRESS.md → último QA marcou BLOCKER em shape mismatch entre `set_track_send` (TS) e handler.
3. Escreve `cycle-briefing-N.md` focado em remediar: ts-server-engineer fix tool, python-bridge-engineer fix handler, qa-integration revalidates.
4. Dispara apenas as 3 trilhas necessárias.
5. Quando volta, QA reverifica. PASS → avança. FAIL → outro ciclo de fix.

## Notas

- A `architect` no .claude/agents/ é a **persona** que o orchestrator encarna. Você não dispara `architect` como subagente em background — você É o architect quando está nesse fluxo.
- `qa-integration` pode rodar em paralelo às outras trilhas (checa o que já está em `src/`/`live/`) ou após (checa o ciclo recém-entregue). O briefing decide.
- Quando o usuário não diz qual fase, vá pela `PROGRESS.md`. Se for inicial, Phase 0 do PLAN.md (Spike).
