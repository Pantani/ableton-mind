# ADR 0010 — MCP Prompts

**Date:** 2026-06-09
**Status:** Accepted
**Author:** architect

## Context

MCP defines **3 primitives**: tools (function calls), resources (URIs read by the client), **prompts** (pre-canned templates that the user/LLM can invoke to start a structured conversation).

PLAN.md §3.3 listed `src/prompts/` as part of the expected layout, but until Cycle 17 we only implemented tools. Resources are out of scope until Phase 8. **Prompts are immediate and cheap value** — they capture recurring workflows ("create a tech-house track", "build a mixing chain for vocal") as structured input.

## Decision

### 1. Prompt shape

Mirrors the SDK's `McpServer.prompt(name, description, argsSchema, handler)` API:

```ts
{
  name: "create_genre_track",
  description: "Compose a complete track in a specified genre with kit + bassline + chords.",
  arguments: [
    { name: "genre", description: "techno | tech-house | jungle | lofi | dnb | neo-soul", required: true },
    { name: "tempo", description: "BPM (auto if omitted)", required: false },
    { name: "duration_min", description: "Minutes (default 7)", required: false }
  ],
  handler: ({ genre, tempo, duration_min }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: "<rendered template with vars>" }
    }]
  })
}
```

### 2. Directory

`src/prompts/`:
- `index.ts` — `allPrompts` registry + `loadPrompt(name)`.
- `genre-track.ts`, `mix-chain.ts`, `arrangement.ts`, `sound-design.ts`, `vocal-chain.ts` — 5 seed prompts.
- Each prompt is a `PromptDefinition` object registered on the MCP server.

### 3. Rendering

Prompts return **text that becomes the conversation's first message**. Typically:

> Use the tools `track.upsert`, `clip.create_midi`, `clip.add_notes`, `device.set_parameter` (and `apply_recipe` when possible) to build a track in `{{genre}}` at {{tempo}} BPM:
>
> 1. Set tempo
> 2. List recipes in the `drums` category filtering by tag `{{genre}}` (`list_recipes`)
> 3. Apply selected recipe
> 4. (continue with bass, chords, mixing...)

Templates may mention existing recipes for reuse.

### 4. Wiring in the server bootstrap

`src/server/index.ts` gets `registerPrompts(server, allPrompts)` analogous to `registerTool`. SDK 1.x:

```ts
server.prompt(p.name, p.description, argsShapeFromZod, p.handler);
```

### 5. Listing via MCP tool

Add a `list_prompts` tool (analogous to `list_recipes`) that returns metadata. Useful for LLMs exploring the server without depending on the client to expose prompts natively.

## Consequences

- 2 new files per prompt + 1 registry + 1 wiring + 1 listing tool.
- No additional dependency (we already have Zod, MCP SDK, recipes).
- An MCP client that supports prompts (Claude Desktop, Cursor) shows a /prompts menu.
- A client that does NOT support prompts can still invoke via `list_prompts` + copying text.

## How to apply

- Cycle 18: implements + 5 seed prompts.
- Future cycles: 10-20 prompts per genre/workflow.
