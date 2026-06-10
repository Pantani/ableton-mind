/**
 * MCP SDK internals adapter (TD-019).
 *
 * Centralizes ALL access to non-public properties of
 * `@modelcontextprotocol/sdk`. If the SDK shape changes between versions
 * (1.x → 2.x), only this file needs updating.
 *
 * Everything that accesses via cast here must have a matching test (see
 * `tests/server-notifications.test.ts`) — so it breaks early if the SDK changes.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Function that sends a notification from the MCP server to the client.
 *
 * In `@modelcontextprotocol/sdk` 1.x, `McpServer` (facade) does NOT expose
 * `sendNotification` at the top level — it's on the underlying `Server` instance
 * accessible via `.server`. We encapsulate that cast here.
 */
export type ServerNotifier = (method: string, params: unknown) => Promise<void>;

interface ServerInternals {
  server?: {
    notification?: (n: { method: string; params: unknown }) => Promise<void>;
  };
}

/**
 * Returns a notifier — function that receives `(method, params)` and fires the
 * MCP notification. Throws Error if the SDK doesn't expose the expected path
 * (protection against future incompatibility).
 */
export function getServerNotifier(server: McpServer): ServerNotifier {
  const internals = server as unknown as ServerInternals;
  const underlying = internals.server;
  if (!underlying || typeof underlying.notification !== "function") {
    throw new SdkIncompatibilityError(
      "McpServer.server.notification is not available; SDK incompatibility",
    );
  }
  return async (method, params) => {
    await underlying.notification!({ method, params });
  };
}

/** Thrown when the SDK internal isn't what's expected. */
export class SdkIncompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdkIncompatibilityError";
  }
}
