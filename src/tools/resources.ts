/**
 * Tool MCP `list_resources` — fallback discovery quando o cliente MCP não
 * lista resources nativamente.
 */

import { z } from "zod";

import { allResources } from "../resources/index.js";
import { defineTool } from "../server/define-tool.js";

const inputSchema = z.object({});

const resourceMetaSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string(),
  mimeType: z.string(),
});

const outputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  resources: z.array(resourceMetaSchema),
  total: z.number().int().nonnegative(),
});

export const listResourcesTool = defineTool({
  name: "list_resources",
  description:
    "List all MCP resources exposed by this server (read-only URIs: live://session/state, live://knowledge/devices, live://recipes/index).",
  input: inputSchema,
  output: outputSchema,
  handler: async () => {
    return {
      ok: true as const,
      verified: true as const,
      resources: allResources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
      total: allResources.length,
    };
  },
});
