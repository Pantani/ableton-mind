/**
 * MCP tool `list_prompts` — fallback discovery when the MCP client doesn't
 * expose prompts natively.
 */

import { z } from "zod";

import { allPrompts } from "../prompts/index.js";
import { defineTool } from "../server/define-tool.js";

const inputSchema = z.object({});

const promptMetaSchema = z.object({
  name: z.string(),
  description: z.string(),
  arguments: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      required: z.boolean(),
    }),
  ),
});

const outputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  prompts: z.array(promptMetaSchema),
  total: z.number().int().nonnegative(),
});

export const listPromptsTool = defineTool({
  name: "list_prompts",
  description:
    "List all MCP prompts available on this server (workflow templates: create_genre_track, build_mix_chain, build_arrangement, sound_design_session, process_vocal_take).",
  input: inputSchema,
  output: outputSchema,
  handler: async () => {
    return {
      ok: true as const,
      verified: true as const,
      prompts: allPrompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      })),
      total: allPrompts.length,
    };
  },
});
