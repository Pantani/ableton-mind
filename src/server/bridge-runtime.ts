import { TcpJsonRpcClient, performHandshake } from "../live-client/index.js";
import { type BridgeClient, createBridgeClient } from "./context.js";

export interface BridgeRuntime {
  bridge: BridgeClient;
  client: TcpJsonRpcClient | null;
  connected: boolean;
  detail: string;
  close: () => Promise<void>;
}

export interface CreateBridgeRuntimeOptions {
  client?: TcpJsonRpcClient;
  handshake?: (client: TcpJsonRpcClient) => Promise<unknown>;
}

export function createOfflineBridgeClient(detail: string): BridgeClient {
  return {
    call: async () => {
      throw new Error(`Ableton bridge offline: ${detail}`);
    },
  };
}

export async function createBridgeRuntime(
  opts: CreateBridgeRuntimeOptions = {},
): Promise<BridgeRuntime> {
  const client = opts.client ?? new TcpJsonRpcClient();
  const handshake = opts.handshake ?? performHandshake;

  try {
    await client.connect();
    await handshake(client);
  } catch (err) {
    const detail = (err as Error).message;
    await closeIgnoringErrors(client);
    return {
      bridge: createOfflineBridgeClient(detail),
      client: null,
      connected: false,
      detail,
      close: async () => {},
    };
  }

  return {
    bridge: createBridgeClient(client),
    client,
    connected: true,
    detail: "Ableton bridge connected",
    close: () => client.close(),
  };
}

async function closeIgnoringErrors(client: TcpJsonRpcClient): Promise<void> {
  try {
    await client.close();
  } catch {
    // Nothing useful to do during fallback to offline mode.
  }
}
