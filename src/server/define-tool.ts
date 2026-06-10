/**
 * `defineTool` — typed factory for an ableton-mind MCP tool.
 *
 * Centralizes:
 * - Zod input and output schemas.
 * - Async handler with injected `ctx` (bridge client + logger).
 * - Metadata (name, description, enabled).
 *
 * The server bootstrap (`src/server/index.ts`) consumes ToolDefinition[] and
 * registers each one with `@modelcontextprotocol/sdk`.
 */

import type { z } from "zod";

import type { ToolContext } from "./context.js";

/**
 * Minimum schema accepted as input/output: any ZodTypeAny.
 * We force `output` to be an object (z.object) to match the
 * `{ ok, verified, ... }` convention. But we accept ZodTypeAny in the type for flexibility.
 */
export interface ToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  /** MCP name visible to the LLM (snake_case). */
  name: string;
  /** Clear description so the LLM knows when to invoke. */
  description: string;
  /** Zod input schema. */
  input: TInput;
  /** Zod output schema. */
  output: TOutput;
  /**
   * Async handler. Receives Zod-validated input and a context
   * with bridge client. Return must pass the `output` schema.
   */
  handler: (input: z.infer<TInput>, ctx: ToolContext) => Promise<z.infer<TOutput>>;
  /**
   * If `false`, tool is registered but marked as `disabled` in the manifest.
   * Phase 0: tools other than `play` may stay disabled.
   * Default: `true`.
   */
  enabled?: boolean;
}

/**
 * Identity function. Exists only to give autocomplete + type checking at the
 * call site without losing inference of `TInput` / `TOutput`.
 */
export function defineTool<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
  def: ToolDefinition<TInput, TOutput>,
): ToolDefinition<TInput, TOutput> {
  return def;
}
