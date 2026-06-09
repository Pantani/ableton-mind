/**
 * Entry point do servidor MCP ableton-mind.
 *
 * Fluxo:
 *  1. Lê env vars (host, port).
 *  2. Cria `TcpJsonRpcClient` e conecta no bridge Python (Live).
 *  3. Roda `system.hello` para validar versão de protocolo.
 *  4. Cria `McpServer`, registra tools.
 *  5. Conecta transport stdio.
 *  6. Mantém processo vivo até SIGTERM/SIGINT.
 *
 * Erros fatais:
 *  - Falha em conectar no bridge → loga, faz tooling MCP responder em modo
 *    "bridge offline" (Phase 1+); por enquanto sai com exit 1.
 *  - SIGTERM/SIGINT → close graceful.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TcpJsonRpcClient, performHandshake } from "./live-client/index.js";
import { allPrompts } from "./prompts/index.js";
import { allResources } from "./resources/index.js";
import { createBridgeClient } from "./server/context.js";
import { createServer } from "./server/index.js";
import { attachNotificationForwarder, createMcpNotifier } from "./server/notifications.js";
import { allTools } from "./tools/index.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("ableton-mind starting", {
    version: "0.0.1",
    node: process.versions.node,
  });

  const client = new TcpJsonRpcClient();

  try {
    await client.connect();
  } catch (err) {
    logger.error("failed to connect to bridge — is Live running with AbletonMind Remote Script?", {
      error: (err as Error).message,
    });
    process.exit(1);
  }

  try {
    await performHandshake(client);
  } catch (err) {
    logger.error("handshake failed", { error: (err as Error).message });
    await client.close();
    process.exit(1);
  }

  const bridge = createBridgeClient(client);
  const { server, registered, registeredPrompts, registeredResources } = createServer({
    bridge,
    tools: allTools,
    prompts: allPrompts,
    resources: allResources,
    name: "ableton-mind",
    version: "0.0.19",
  });
  logger.info("prompts registered", { count: registeredPrompts.length });
  logger.info("resources registered", { count: registeredResources.length });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // TD-015: repassa notifications do bridge → MCP client
  const notifier = createMcpNotifier(server);
  const detachForwarder = attachNotificationForwarder(client, notifier);

  logger.info("MCP server listening on stdio", { tools: registered });

  // graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info("shutting down", { signal });
    try {
      detachForwarder();
    } catch (err) {
      logger.warn("error detaching notification forwarder", { error: (err as Error).message });
    }
    try {
      await server.close();
    } catch (err) {
      logger.warn("error closing MCP server", { error: (err as Error).message });
    }
    try {
      await client.close();
    } catch (err) {
      logger.warn("error closing bridge client", { error: (err as Error).message });
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("fatal error in main", {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  process.exit(1);
});
