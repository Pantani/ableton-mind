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
    "Read-only list of MCP prompts bundled with the server for clients that do not expose prompt discovery natively. Use when the user asks what workflows are available; returns prompt names, descriptions, arguments, and total count.",
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
