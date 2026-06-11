/**
 * MCP tool `list_resources` — fallback discovery when the MCP client doesn't
 * list resources natively.
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
    "Read-only list of MCP resources exposed by the server for clients that do not expose resource discovery natively. Use when the user asks what context URIs are available; returns resource URI, name, description, MIME type, and total count.",
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
