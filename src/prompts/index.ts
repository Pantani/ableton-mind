/**
 * MCP Prompts registry (ADR-0010).
 *
 * Prompts are pre-canned templates that the MCP client (Claude Desktop, Cursor, etc.)
 * exposes to the user via a menu. Each prompt accepts typed arguments and renders
 * a first message that guides the LLM to use the server's tools.
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
  /** Zod schema mirroring arguments — used for validation in the MCP handler. */
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

/** Lookup by name — used by the `list_prompts` tool. */
export function loadPrompt(name: string): PromptDefinition | null {
  return allPrompts.find((p) => p.name === name) ?? null;
}
