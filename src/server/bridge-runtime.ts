import { JsonRpcTransportError, TcpJsonRpcClient, performHandshake } from "../live-client/index.js";
import { logger } from "../utils/logger.js";
import type { BridgeClient } from "./context.js";

/**
 * Bridge runtime for the MCP server.
 *
 * The MCP host (Claude Desktop, Cursor, …) usually starts this server before
 * Ableton Live is running, and Live may be restarted while the server stays
 * up. The runtime therefore never gives up on the bridge: every call checks
 * the current connection and, if it is down, opens a fresh TCP client and
 * repeats the handshake before forwarding the call. Failed attempts are rate
 * limited by `reconnectCooldownMs` so a burst of tool calls while Live is
 * closed does not hammer the socket.
 */
export interface BridgeRuntime {
  /** Always-usable bridge. Calls reconnect on demand when Live is reachable again. */
  bridge: BridgeClient;
  /** The currently connected client, or `null` while offline. */
  readonly client: TcpJsonRpcClient | null;
  /** Whether the initial connection attempt at startup succeeded. */
  connected: boolean;
  /** Human-readable status of the initial connection attempt. */
  detail: string;
  /**
   * Registers a callback that runs for every client that completes a
   * handshake (immediately, if one is already connected). The callback may
   * return a cleanup function, which runs when that client is replaced or
   * when the returned unsubscribe function is called.
   */
  onClient: (attach: (client: TcpJsonRpcClient) => (() => void) | undefined) => () => void;
  close: () => Promise<void>;
}

export interface CreateBridgeRuntimeOptions {
  /** Client used for the initial connection attempt (tests). */
  client?: TcpJsonRpcClient;
  /** Factory for clients created on reconnect. Defaults to a non-auto-reconnecting TCP client. */
  clientFactory?: () => TcpJsonRpcClient;
  handshake?: (client: TcpJsonRpcClient) => Promise<unknown>;
  /** Minimum delay between reconnect attempts after a failure. Default 1000 ms. */
  reconnectCooldownMs?: number;
  /** Clock override for tests. */
  now?: () => number;
}

export const DEFAULT_RECONNECT_COOLDOWN_MS = 1_000;

export function createOfflineBridgeClient(detail: string): BridgeClient {
  return {
    call: async () => {
      throw new JsonRpcTransportError(`Ableton bridge offline: ${detail}`);
    },
  };
}

type Attach = (client: TcpJsonRpcClient) => (() => void) | undefined;

export async function createBridgeRuntime(
  opts: CreateBridgeRuntimeOptions = {},
): Promise<BridgeRuntime> {
  const clientFactory =
    opts.clientFactory ?? (() => new TcpJsonRpcClient({ autoReconnect: false }));
  const handshake = opts.handshake ?? performHandshake;
  const cooldownMs = opts.reconnectCooldownMs ?? DEFAULT_RECONNECT_COOLDOWN_MS;
  const now = opts.now ?? Date.now;

  let current: TcpJsonRpcClient | null = null;
  let inFlight: Promise<TcpJsonRpcClient> | null = null;
  let lastError: string | null = null;
  let lastFailureAt = Number.NEGATIVE_INFINITY;
  let closed = false;

  const subscribers = new Map<Attach, (() => void) | undefined>();

  const detachAll = (): void => {
    for (const [attach, cleanup] of subscribers) {
      runCleanup(cleanup);
      subscribers.set(attach, undefined);
    }
  };

  const attachAll = (client: TcpJsonRpcClient): void => {
    for (const attach of subscribers.keys()) {
      subscribers.set(attach, safeAttach(attach, client));
    }
  };

  const connectFresh = async (client: TcpJsonRpcClient): Promise<TcpJsonRpcClient> => {
    try {
      await client.connect();
      await handshake(client);
    } catch (err) {
      await closeIgnoringErrors(client);
      lastError = (err as Error).message;
      lastFailureAt = now();
      throw err;
    }
    if (closed) {
      await closeIgnoringErrors(client);
      throw new JsonRpcTransportError("bridge runtime closed");
    }
    const previous = current;
    detachAll();
    current = client;
    lastError = null;
    attachAll(client);
    if (previous && previous !== client) await closeIgnoringErrors(previous);
    return client;
  };

  const ensureConnected = async (): Promise<TcpJsonRpcClient> => {
    if (closed) throw new JsonRpcTransportError("Ableton bridge offline: runtime closed");
    if (current && isConnected(current)) return current;
    if (inFlight) return inFlight;

    if (lastError !== null && now() - lastFailureAt < cooldownMs) {
      throw new JsonRpcTransportError(`Ableton bridge offline: ${lastError}`);
    }

    if (current) {
      logger.info("Ableton bridge connection lost; reconnecting");
    } else {
      logger.info("Ableton bridge offline; attempting reconnect");
    }

    inFlight = connectFresh(clientFactory())
      .then((client) => {
        logger.info("Ableton bridge reconnected");
        return client;
      })
      .catch((err: unknown) => {
        throw new JsonRpcTransportError(`Ableton bridge offline: ${(err as Error).message}`);
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  // Initial attempt: same behaviour as before for the startup log, but a
  // failure no longer locks the server into offline mode.
  let connected = false;
  let detail: string;
  try {
    await connectFresh(opts.client ?? clientFactory());
    connected = true;
    detail = "Ableton bridge connected";
  } catch (err) {
    detail = (err as Error).message;
  }

  const bridge: BridgeClient = {
    call: async <TResult = unknown>(method: string, params?: unknown, timeoutMs?: number) => {
      const client = await ensureConnected();
      return client.call<TResult>(method, params, timeoutMs);
    },
  };

  return {
    bridge,
    get client() {
      return current && isConnected(current) ? current : null;
    },
    connected,
    detail,
    onClient: (attach) => {
      subscribers.set(attach, current ? safeAttach(attach, current) : undefined);
      return () => {
        runCleanup(subscribers.get(attach));
        subscribers.delete(attach);
      };
    },
    close: async () => {
      closed = true;
      detachAll();
      subscribers.clear();
      const client = current;
      current = null;
      if (client) await client.close();
    },
  };
}

function isConnected(client: TcpJsonRpcClient): boolean {
  // Test doubles may not implement getState; treat them as connected.
  return typeof client.getState !== "function" || client.getState() === "connected";
}

function safeAttach(attach: Attach, client: TcpJsonRpcClient): (() => void) | undefined {
  try {
    return attach(client);
  } catch (err) {
    logger.warn("bridge client subscriber failed", { error: (err as Error).message });
    return undefined;
  }
}

function runCleanup(cleanup: (() => void) | undefined): void {
  if (!cleanup) return;
  try {
    cleanup();
  } catch (err) {
    logger.warn("bridge client cleanup failed", { error: (err as Error).message });
  }
}

async function closeIgnoringErrors(client: TcpJsonRpcClient): Promise<void> {
  try {
    await client.close();
  } catch {
    // Nothing useful to do while discarding a failed or replaced client.
  }
}
