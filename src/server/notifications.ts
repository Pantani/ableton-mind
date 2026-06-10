/**
 * Notification forwarder bridge → MCP (TD-015).
 *
 * The `TcpJsonRpcClient` emits `notification` (method, params) whenever it
 * receives a JSON-RPC message without `id`. We forward to the MCP client per
 * ADR-0005:
 *
 * - Only methods with the `event.` prefix are forwarded.
 * - The rest is logged and discarded (protection against drift).
 * - Errors from MCP `sendNotification` are logged and swallowed — they don't
 *   tear down the connection with the bridge.
 *
 * MCP SDK 1.x exposes `server.server.notification(...)` (the `.server`
 * property is the underlying `Server` instance). We use this because `McpServer`
 * (the `1.x` facade) doesn't yet expose `sendNotification` publicly at the top level.
 *
 * If the API breaks between SDK versions, we isolate the call in an adapter
 * (`sendNotification(method, params)`) — tests mock only that adapter.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { logger } from "../utils/logger.js";
import { getServerNotifier } from "./_mcp-internals.js";

const EVENT_PREFIX = "event.";

/**
 * Small function that knows how to send a notification via the MCP SDK. Change
 * here if the SDK evolves. Injectable for tests.
 */
export type McpNotifier = (method: string, params: unknown) => Promise<void> | void;

/** Default notifier that delegates to the SDK internals adapter (TD-019). */
export function createMcpNotifier(server: McpServer): McpNotifier {
  // Centralizes internals access in a dedicated module (`_mcp-internals.ts`).
  return getServerNotifier(server);
}

/**
 * Receives `(method, params)` from the bridge. Forwards if `event.*`,
 * discards otherwise.
 *
 * Returns `true` if forwarded, `false` if ignored.
 */
export async function forwardNotification(
  notifier: McpNotifier,
  method: string,
  params: unknown,
): Promise<boolean> {
  if (!method.startsWith(EVENT_PREFIX)) {
    logger.warn("dropping notification with non-event method", { method });
    return false;
  }
  try {
    // For MCP client integration, we map `event.foo_bar_changed` →
    // `notifications/event.foo_bar_changed` (MCP spec uses the
    // `notifications/*` namespace). But since the underlying `Server.notification`
    // accepts any method string, we let the caller decide whether to add a prefix
    // if useful. For now we forward the original method — MCP clients
    // see `event.foo_bar_changed` directly.
    await notifier(method, params);
    return true;
  } catch (err) {
    logger.warn("MCP notification failed", {
      method,
      error: (err as Error).message,
    });
    return false;
  }
}

/**
 * Wire helper: anexa o forwarder ao client TCP.
 *
 * Returns a `dispose()` function to remove the listener (useful at shutdown or
 * in tests).
 */
export function attachNotificationForwarder(
  client: {
    on: (event: "notification", handler: (m: string, p: unknown) => void) => void;
    off?: (event: "notification", handler: (m: string, p: unknown) => void) => void;
  },
  notifier: McpNotifier,
): () => void {
  const handler = (method: string, params: unknown): void => {
    void forwardNotification(notifier, method, params);
  };
  client.on("notification", handler);
  return () => {
    if (typeof client.off === "function") {
      client.off("notification", handler);
    }
  };
}
