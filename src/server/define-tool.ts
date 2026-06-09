/**
 * `defineTool` — factory tipada para uma tool MCP do ableton-mind.
 *
 * Centraliza:
 * - Schema Zod de input e output.
 * - Handler async com `ctx` injetado (bridge client + logger).
 * - Metadata (name, description, enabled).
 *
 * O server bootstrap (`src/server/index.ts`) consome ToolDefinition[] e
 * registra cada uma no `@modelcontextprotocol/sdk`.
 */

import type { z } from "zod";

import type { ToolContext } from "./context.js";

/**
 * Schema mínimo aceito como input/output: qualquer ZodTypeAny.
 * Forçamos `output` a ser objeto (z.object) para combinar com convenção
 * `{ ok, verified, ... }`. Mas aceitamos ZodTypeAny no tipo para flex.
 */
export interface ToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  /** Nome MCP visível ao LLM (snake_case). */
  name: string;
  /** Descrição clara para o LLM saber quando invocar. */
  description: string;
  /** Schema Zod do input. */
  input: TInput;
  /** Schema Zod do output. */
  output: TOutput;
  /**
   * Handler async. Recebe input já validado pelo Zod e contexto
   * com bridge client. Retorno deve passar pelo `output` schema.
   */
  handler: (input: z.infer<TInput>, ctx: ToolContext) => Promise<z.infer<TOutput>>;
  /**
   * Se `false`, tool é registrada mas marcada como `disabled` no manifest.
   * Phase 0: outras tools além de `play` podem ficar disabled.
   * Default: `true`.
   */
  enabled?: boolean;
}

/**
 * Identidade. Existe só para dar autocomplete + checagem de tipos no
 * call site sem perder a inferência de `TInput` / `TOutput`.
 */
export function defineTool<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
>(def: ToolDefinition<TInput, TOutput>): ToolDefinition<TInput, TOutput> {
  return def;
}
