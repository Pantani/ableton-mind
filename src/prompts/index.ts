/**
 * MCP Prompts registry (ADR-0010).
 *
 * Prompts são templates pré-canned que o cliente MCP (Claude Desktop, Cursor, etc.)
 * expõe ao usuário via menu. Cada prompt aceita argumentos tipados e renderiza
 * uma primeira mensagem que orienta o LLM a usar as tools do servidor.
 */

import type { z } from "zod";

import { arrangementPrompt } from "./arrangement.js";
import { genreTrackPrompt } from "./genre-track.js";
import { mixChainPrompt } from "./mix-chain.js";
import { soundDesignPrompt } from "./sound-design.js";
import { vocalChainPrompt } from "./vocal-chain.js";

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

export interface PromptResult {
  messages: PromptMessage[];
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
  /** Zod schema espelhando arguments — usado para validation no handler MCP. */
  argsSchema: z.ZodTypeAny;
  handler: (args: Record<string, string | undefined>) => PromptResult;
}

export { arrangementPrompt, genreTrackPrompt, mixChainPrompt, soundDesignPrompt, vocalChainPrompt };

export const allPrompts: PromptDefinition[] = [
  genreTrackPrompt,
  mixChainPrompt,
  arrangementPrompt,
  soundDesignPrompt,
  vocalChainPrompt,
];

/** Lookup por nome — usado pelo tool `list_prompts`. */
export function loadPrompt(name: string): PromptDefinition | null {
  return allPrompts.find((p) => p.name === name) ?? null;
}
