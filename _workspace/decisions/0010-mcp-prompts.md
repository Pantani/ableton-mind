# ADR 0010 — MCP Prompts

**Data:** 2026-06-09
**Status:** Aceito
**Autor:** architect

## Contexto

MCP define **3 primitivas**: tools (function calls), resources (URIs lidos pelo cliente), **prompts** (templates pré-canned que o usuário/LLM pode invocar para iniciar uma conversa estruturada).

PLAN.md §3.3 listou `src/prompts/` como parte do layout esperado, mas até Cycle 17 só implementamos tools. Resources estão fora do escopo até Phase 8. **Prompts são valor imediato e baratos** — capturam workflows recorrentes ("crie uma track tech-house", "monte uma chain de mixing pra vocal") como entrada estruturada.

## Decisão

### 1. Shape de uma prompt

Espelha a API `McpServer.prompt(name, description, argsSchema, handler)` do SDK:

```ts
{
  name: "create_genre_track",
  description: "Compose a complete track in a specified genre with kit + bassline + chords.",
  arguments: [
    { name: "genre", description: "techno | tech-house | jungle | lofi | dnb | neo-soul", required: true },
    { name: "tempo", description: "BPM (auto se omitido)", required: false },
    { name: "duration_min", description: "Minutos (default 7)", required: false }
  ],
  handler: ({ genre, tempo, duration_min }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: "<rendered template with vars>" }
    }]
  })
}
```

### 2. Diretório

`src/prompts/`:
- `index.ts` — registry `allPrompts` + `loadPrompt(name)`.
- `genre-track.ts`, `mix-chain.ts`, `arrangement.ts`, `sound-design.ts`, `vocal-chain.ts` — 5 seed prompts.
- Cada prompt é um objeto `PromptDefinition` registrado no MCP server.

### 3. Renderização

Prompts retornam **texto que vira primeira mensagem da conversação**. Tipicamente:

> Use as ferramentas `track.upsert`, `clip.create_midi`, `clip.add_notes`, `device.set_parameter` (e `apply_recipe` quando possível) para construir uma track em `{{genre}}` a {{tempo}} BPM:
>
> 1. Set tempo
> 2. Listar recipes da categoria `drums` filtrando por tag `{{genre}}` (`list_recipes`)
> 3. Aplicar recipe selecionada
> 4. (continuar com bass, chords, mixing...)

Templates podem mencionar recipes existentes para reuso.

### 4. Wiring no server bootstrap

`src/server/index.ts` ganha `registerPrompts(server, allPrompts)` análogo a `registerTool`. SDK 1.x:

```ts
server.prompt(p.name, p.description, argsShapeFromZod, p.handler);
```

### 5. Listagem via tool MCP

Adicionar tool `list_prompts` (análogo a `list_recipes`) que devolve metadata. Útil para LLMs explorando o server sem depender do client expor prompts nativamente.

## Consequências

- 2 novos arquivos por prompt + 1 registry + 1 wiring + 1 tool listing.
- Sem dependência adicional (já temos Zod, MCP SDK, recipes).
- Cliente MCP que suporta prompts (Claude Desktop, Cursor) mostra menu /prompts.
- Cliente que NÃO suporta prompts ainda pode invocar via `list_prompts` + copiar texto.

## Como aplicar

- Cycle 18: implementa + 5 seed prompts.
- Cycles futuros: 10-20 prompts por gênero/workflow.
