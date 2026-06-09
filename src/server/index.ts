/**
 * Bootstrap do servidor MCP.
 *
 * Recebe um `BridgeClient` pronto + lista de `ToolDefinition` e devolve
 * um `McpServer` do SDK oficial com tudo registrado. Não conecta transport
 * (stdio fica em `src/index.ts`).
 *
 * Cada `ToolDefinition.input` é convertido em ZodRawShape para a API
 * `server.tool()` do `@modelcontextprotocol/sdk`. O retorno é serializado
 * em texto JSON dentro do envelope `content: [{ type: "text", ... }]`.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

import { logger } from "../utils/logger.js";
import type { BridgeClient, ToolContext } from "./context.js";
import { createToolContext } from "./context.js";
import type { ToolDefinition } from "./define-tool.js";

export interface CreateServerOptions {
  bridge: BridgeClient;
  tools: ToolDefinition[];
  name?: string;
  version?: string;
}

export interface CreatedServer {
  server: McpServer;
  context: ToolContext;
  registered: string[];
}

/**
 * Cria e popula o `McpServer`. Tools com `enabled === false` são logadas mas
 * NÃO registradas (Phase 0 evita expor tools quebradas/incompletas ao LLM).
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

  logger.info("server ready", { tools: registered });
  return { server, context: ctx, registered };
}

function registerTool(server: McpServer, tool: ToolDefinition, ctx: ToolContext): void {
  // O SDK MCP 1.x recebe um ZodRawShape (object com shape, não ZodObject).
  // Nossas tools declaram input como ZodObject por convenção; extraímos `.shape`.
  const shape = extractShape(tool.input);

  server.tool(tool.name, tool.description, shape, async (rawInput: unknown) => {
    try {
      const input = tool.input.parse(rawInput);
      const result = await tool.handler(input, ctx);
      // Output schema é sempre obj com `ok`. Re-validamos pra cumprir contrato
      // antes de mandar pro cliente MCP.
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
 * Extrai ZodRawShape de uma ZodTypeAny. Se não for ZodObject, devolve `{}`
 * (tool sem inputs ainda registra, mas LLM não pode passar argumentos).
 */
function extractShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  const maybeShape = (schema as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape;
  if (maybeShape && typeof maybeShape === "object") return maybeShape;
  return {};
}
