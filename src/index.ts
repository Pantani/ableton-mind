/**
 * Entry point for the ableton-mind MCP server.
 *
 * Flow:
 *  1. Reads env vars (host, port).
 *  2. Creates a `TcpJsonRpcClient` and connects to the Python bridge (Live).
 *  3. Runs `system.hello` to validate protocol version.
 *  4. Creates `McpServer`, registers tools.
 *  5. Connects the stdio transport.
 *  6. Keeps the process alive until SIGTERM/SIGINT.
 *
 * Fatal errors:
 *  - Failure to connect to the bridge → logs, makes MCP tooling respond in
 *    "bridge offline" mode (Phase 1+); for now exits with code 1.
 *  - SIGTERM/SIGINT → graceful close.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { resolveEntrypointAction } from "./cli/entrypoint.js";
import { TcpJsonRpcClient, performHandshake } from "./live-client/index.js";
import { allPrompts } from "./prompts/index.js";
import { allResources } from "./resources/index.js";
import { createBridgeClient } from "./server/context.js";
import { createServer } from "./server/index.js";
import { attachNotificationForwarder, createMcpNotifier } from "./server/notifications.js";
import { allTools } from "./tools/index.js";
import { logger } from "./utils/logger.js";
import { PACKAGE_VERSION } from "./version.js";

async function main(): Promise<void> {
  const action = resolveEntrypointAction(process.argv.slice(2));
  if (action.kind === "print") {
    if (action.stdout) process.stdout.write(action.stdout);
    if (action.stderr) process.stderr.write(action.stderr);
    process.exitCode = action.exitCode;
    return;
  }

  if (action.kind === "chat") {
    const { runChat } = await import("./cli/chat.js");
    await runChat(action.args);
    return;
  }

  if (action.kind === "ask") {
    const { runAsk } = await import("./cli/chat.js");
    await runAsk(action.args);
    return;
  }

  logger.info("ableton-mind starting", {
    version: PACKAGE_VERSION,
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
    version: PACKAGE_VERSION,
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
