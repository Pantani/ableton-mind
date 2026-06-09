---
name: mcp-server-development
description: Padrões de implementação para o servidor MCP TypeScript do ableton-mind. Como definir tools com Zod, registrar resources/prompts, implementar verify loop, cliente TCP para a bridge Python, transações undo, idempotência. Usar quando estiver implementando ou revisando código em src/server/, src/tools/, src/resources/, src/prompts/, src/live-client/, src/feedback/.
---

# MCP Server Development — Padrões TS/Node

Skill consumido pelo `ts-server-engineer`. Define como escrever tools/resources/prompts e o cliente da bridge.

## Stack

- TypeScript 5.x estrito (sem `any`, sem `as` evitável).
- Node 20+, ESM, `"type": "module"` no package.json.
- `@modelcontextprotocol/sdk` (servidor MCP).
- `zod` (toda fronteira).
- `tsup` (bundle), `biome` (lint), `vitest` (test).
- TCP via `net` nativo. Sem axios/got/etc.

## Estrutura de uma tool

Tools moram em `src/tools/{domain}.ts`, registradas em `src/server/index.ts`.

```ts
// src/tools/transport.ts
import { z } from "zod";
import { defineTool } from "../server/define-tool.js";

export const setTempo = defineTool({
  name: "set_tempo",
  description:
    "Set the Ableton Live session tempo in BPM. Idempotent. Returns the verified tempo read back from Live.",
  input: z.object({
    bpm: z.number().min(20).max(999),
  }),
  output: z.object({
    ok: z.boolean(),
    verified: z.boolean(),
    tempo: z.number(),
  }),
  handler: async ({ bpm }, ctx) => {
    await ctx.live.song.setTempo(bpm);
    const verified = await ctx.live.song.getTempo();
    return {
      ok: true,
      verified: Math.abs(verified - bpm) < 0.01,
      tempo: verified,
    };
  },
});
```

**Regras:**

1. **Nome em `snake_case`**, alinhado com o handler Python.
2. **`description` clara** — primeira linha explica o quê, segunda explica idempotência/efeitos colaterais.
3. **Input/output sempre Zod**. Sem `z.any()`. Sem `z.unknown()` exceto em sinks de debug.
4. **`handler` é `async`** e recebe `(input, ctx)` onde `ctx.live` é o cliente bridge.
5. **Toda mutação retorna `verified`**: re-leitura confirma o efeito. Se não conseguir reler, devolve `verified: false` — não mente.
6. **Erros viram `McpError`** ou throws normais que o servidor traduz. Nunca `process.exit`.

## Verify loop integrado

```ts
// src/feedback/verify.ts
export async function verify<T>(
  read: () => Promise<T>,
  expected: (snapshot: T) => boolean,
  attempts = 3,
  delayMs = 50,
): Promise<{ ok: boolean; snapshot: T }> {
  for (let i = 0; i < attempts; i++) {
    const snapshot = await read();
    if (expected(snapshot)) return { ok: true, snapshot };
    await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
  }
  const snapshot = await read();
  return { ok: false, snapshot };
}
```

Use em handlers onde mutação LiveAPI tem latência de propagação:
```ts
await ctx.live.track.create();
const v = await verify(
  () => ctx.live.song.numTracks(),
  (n) => n === before + 1,
);
return { ok: true, verified: v.ok, num_tracks: v.snapshot };
```

## Transações com undo

Usa `withUndoStep` quando a operação envolve múltiplas mutações que o usuário deveria desfazer em 1 cmd-z:

```ts
// src/utils/transaction.ts
export async function withUndoStep<T>(
  ctx: ToolContext,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  await ctx.live.song.beginUndoStep();
  try {
    return await fn();
  } finally {
    await ctx.live.song.endUndoStep();
  }
}
```

Uso:
```ts
return withUndoStep(ctx, "create_midi_track", async () => {
  await ctx.live.song.createMidiTrack(idx);
  await ctx.live.track.setName(idx, name);
  await ctx.live.track.setColor(idx, color);
  return { ok: true, ... };
});
```

## Idempotência

Antes de mutar, verifica:

```ts
const existing = await ctx.live.track.findByName(name);
if (existing) {
  return { ok: true, verified: true, track: existing, created: false };
}
// ... cria
```

Não silencia conflitos. Se o usuário passou index ocupado, retorna erro estruturado, não sobrescreve.

## Cliente live (TCP JSON-RPC)

```ts
// src/live-client/client.ts
import net from "node:net";

export class LiveClient {
  private socket?: net.Socket;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private buffer = "";
  private nextId = 1;

  async connect(host = "127.0.0.1", port = 9876): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host, port }, () => {
        this.socket = sock;
        resolve();
      });
      sock.on("data", (chunk) => this.onData(chunk.toString("utf8")));
      sock.on("error", reject);
      sock.on("close", () => this.onClose());
    });
  }

  async call(method: string, params: unknown, timeoutMs = 5000): Promise<unknown> {
    if (!this.socket) throw new Error("not connected");
    const id = this.nextId++;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`bridge timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.socket!.write(msg);
    });
  }

  private onData(text: string): void {
    this.buffer += text;
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) reject(Object.assign(new Error(msg.error.message), msg.error));
        else resolve(msg.result);
      } else if (msg.method) {
        this.handleNotification(msg.method, msg.params);
      }
    }
  }

  // ... reconnect com backoff, notificações via EventEmitter
}
```

## Resources MCP

Resources expõem estado vivo do Live. Use para snapshots que o LLM consulta sem disparar tool.

```ts
// src/resources/session.ts
export const sessionStateResource = defineResource({
  uri: "live://session/state",
  name: "Live Session State",
  mimeType: "application/json",
  description: "Full snapshot of current Live session.",
  read: async (ctx) => {
    const tracks = await ctx.live.song.listTracks();
    const scenes = await ctx.live.song.listScenes();
    const transport = await ctx.live.song.transport();
    return JSON.stringify({ tracks, scenes, transport }, null, 2);
  },
});
```

Resources grandes (200 tracks) viram paginados via query: `live://session/state?tracks=0-20`.

## Prompts MCP

Prompts são templates curtos que aparecem como slash-commands no client. Não substitui doc; é atalho.

```ts
export const composeTrackPrompt = definePrompt({
  name: "compose_track",
  description: "Componha um track no estilo {gênero} com {N} bars.",
  arguments: [
    { name: "genre", required: true },
    { name: "bars", required: false },
  ],
  build: ({ genre, bars = 64 }) => ({
    messages: [
      { role: "user", content: `Componha um track de ${genre} com ${bars} bars usando o ableton-mind. Use recipes quando possível. Gere drums, bass, harmonias, FX. Aplique sidechain. Adicione locators no arrangement.` },
    ],
  }),
});
```

## Testes

```ts
// tests/tools/transport.test.ts
import { describe, it, expect } from "vitest";
import { setTempo } from "../../src/tools/transport.js";
import { createMockLiveClient } from "../helpers/mock-live.js";

describe("set_tempo", () => {
  it("sets and verifies", async () => {
    const live = createMockLiveClient({
      song: { tempo: 120 },
    });
    const r = await setTempo.handler({ bpm: 128 }, { live });
    expect(r.ok).toBe(true);
    expect(r.verified).toBe(true);
    expect(r.tempo).toBe(128);
  });

  it("rejects out-of-range", async () => {
    await expect(setTempo.input.parseAsync({ bpm: 5 })).rejects.toThrow();
  });
});
```

Cada tool tem **no mínimo 1 happy path + 1 erro validado por Zod**. Integration tests usam bridge real quando disponível.

## Antipatterns

| ❌ Faça assim NÃO | ✅ Faça assim |
|---|---|
| `handler: async (input: any) => { ... }` | `input: z.object({...}); handler: async (input, ctx) => { ... }` |
| Devolve `{ ok: true }` sem reler | `const v = await verify(...); return { ok: true, verified: v.ok }` |
| `throw "oops"` | `throw new McpError("invalid_track_index", { num_tracks })` |
| Reconnect com `while(true)` | Backoff exponencial limitado |
| `console.log` para debug | `logger.debug(...)` estruturado, redirecionado |
| Schema duplicado em N tools | Schema compartilhado em `_workspace/contracts/` |
