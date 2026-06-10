/**
 * MCP server bootstrap.
 *
 * Receives a ready `BridgeClient` + list of `ToolDefinition` and returns
 * an `McpServer` from the official SDK with everything registered. Doesn't
 * connect transport (stdio lives in `src/index.ts`).
 *
 * Each `ToolDefinition.input` is converted into a ZodRawShape for the
 * `server.tool()` API of `@modelcontextprotocol/sdk`. The return is serialized
 * as JSON text inside the `content: [{ type: "text", ... }]` envelope.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

import type { PromptDefinition } from "../prompts/index.js";
import type { ResourceDefinition } from "../resources/index.js";
import { logger } from "../utils/logger.js";
import type { BridgeClient, ToolContext } from "./context.js";
import { createToolContext } from "./context.js";
import type { ToolDefinition } from "./define-tool.js";

export interface CreateServerOptions {
  bridge: BridgeClient;
  tools: ToolDefinition[];
  prompts?: PromptDefinition[];
  resources?: ResourceDefinition[];
  name?: string;
  version?: string;
}

export interface CreatedServer {
  server: McpServer;
  context: ToolContext;
  registered: string[];
  registeredPrompts: string[];
  registeredResources: string[];
}

/**
 * Creates and populates the `McpServer`. Tools with `enabled === false` are logged but
 * NOT registered (Phase 0 avoids exposing broken/incomplete tools to the LLM).
 */
export function createServer(opts: CreateServerOptions): CreatedServer {
  const server = new McpServer({
    name: opts.name ?? "ableton-mind",
    version: opts.version ?? "0.0.1",
  });

  const ctx = createToolContext(opts.bridge);
  const registered: string[] = [];

  for (const tool of opts.tools) {
    if (tool.enabled === false) {
      logger.info("tool disabled, skipping registration", { tool: tool.name });
      continue;
    }
    registerTool(server, tool, ctx);
    registered.push(tool.name);
  }

  const registeredPrompts: string[] = [];
  for (const p of opts.prompts ?? []) {
    registerPrompt(server, p);
    registeredPrompts.push(p.name);
  }

  const registeredResources: string[] = [];
  for (const r of opts.resources ?? []) {
    registerResource(server, r, ctx);
    registeredResources.push(r.uri);
  }

  logger.info("server ready", {
    tools: registered,
    prompts: registeredPrompts,
    resources: registeredResources,
  });
  return { server, context: ctx, registered, registeredPrompts, registeredResources };
}

function registerResource(server: McpServer, r: ResourceDefinition, ctx: ToolContext): void {
  server.resource(r.name, r.uri, { description: r.description, mimeType: r.mimeType }, async () => {
    const result = await r.read(ctx.bridge ?? null);
    return { contents: result.contents };
  });
}

function registerPrompt(server: McpServer, p: PromptDefinition): void {
  const shape = extractShape(p.argsSchema);
  server.prompt(p.name, p.description, shape, async (args: Record<string, unknown>) => {
    try {
      const result = p.handler(args as Record<string, string | undefined>);
      return {
        messages: result.messages.map((m) => ({
          role: m.role,
          content: { type: "text" as const, text: m.content.text },
        })),
      };
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      logger.error("prompt handler failed", { prompt: p.name, error: message });
      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: `Prompt ${p.name} failed: ${message}` },
          },
        ],
      };
    }
  });
}

function registerTool(server: McpServer, tool: ToolDefinition, ctx: ToolContext): void {
  // The MCP SDK 1.x takes a ZodRawShape (object with shape, not ZodObject).
  // Our tools declare input as ZodObject by convention; we extract `.shape`.
  const shape = extractShape(tool.input);

  server.tool(tool.name, tool.description, shape, async (rawInput: unknown) => {
    try {
      const input = tool.input.parse(rawInput);
      const result = await tool.handler(input, ctx);
      // Output schema is always an obj with `ok`. We re-validate to honor the contract
      // before sending to the MCP client.
      const validated = tool.output.parse(result);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(validated, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      logger.error("tool execution failed", { tool: tool.name, error: message });
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: false, tool: tool.name, error: message }, null, 2),
          },
        ],
      };
    }
  });
}

/**
 * Extracts ZodRawShape from a ZodTypeAny. If not a ZodObject, returns `{}`
 * (a tool with no inputs still registers, but the LLM cannot pass arguments).
 */
function extractShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  const maybeShape = (schema as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape;
  if (maybeShape && typeof maybeShape === "object") return maybeShape;
  return {};
}
