/**
 * Context injected into every tool/resource/prompt handler.
 *
 * Holds:
 * - `bridge.call(method, params)` — wrapper around the TcpJsonRpcClient.
 * - `logger` — structured logger writing to stderr.
 *
 * Phase 1+ adds `knowledge`, `verify`, transaction helpers here.
 */

import type { TcpJsonRpcClient } from "../live-client/tcp-client.js";
import { logger } from "../utils/logger.js";

/**
 * Minimal wrapper around the TCP client. Exists so that tools DON'T touch
 * the socket directly and to make mocking easier in tests.
 */
export interface BridgeClient {
  /**
   * Performs a JSON-RPC call and returns the raw `result`.
   * Errors from the bridge are `JsonRpcRemoteError`; transport errors are
   * `JsonRpcTransportError`.
   */
  call<TResult = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<TResult>;
}

export interface ToolContext {
  bridge: BridgeClient;
  logger: typeof logger;
}

/**
 * Adapter: converts a `TcpJsonRpcClient` into the context's `BridgeClient`.
 * We keep the interface lean so the tool handler doesn't need to know about
 * EventEmitter, connection state, etc. — that's the server bootstrap's responsibility.
 */
export function createBridgeClient(tcp: TcpJsonRpcClient): BridgeClient {
  return {
    call: (method, params, timeoutMs) => tcp.call(method, params, timeoutMs),
  };
}

export function createToolContext(bridge: BridgeClient): ToolContext {
  return { bridge, logger };
}
