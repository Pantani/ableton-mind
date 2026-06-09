/**
 * Contexto injetado em todo handler de tool/resource/prompt.
 *
 * Mantém:
 * - `bridge.call(method, params)` — wrapper sobre o TcpJsonRpcClient.
 * - `logger` — logger estruturado em stderr.
 *
 * Phase 1+ adiciona aqui `knowledge`, `verify`, helpers de transação.
 */

import type { TcpJsonRpcClient } from "../live-client/tcp-client.js";
import { logger } from "../utils/logger.js";

/**
 * Wrapper minimalista sobre o client TCP. Existe para que tools NÃO toquem
 * direto no socket e para facilitar mock em testes.
 */
export interface BridgeClient {
  /**
   * Faz uma chamada JSON-RPC e devolve `result` cru.
   * Erros do bridge são `JsonRpcRemoteError`; erros de transport são
   * `JsonRpcTransportError`.
   */
  call<TResult = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<TResult>;
}

export interface ToolContext {
  bridge: BridgeClient;
  logger: typeof logger;
}

/**
 * Adapter: converte um `TcpJsonRpcClient` no `BridgeClient` do contexto.
 * Mantemos a interface enxuta para o handler de tool não conhecer EventEmitter,
 * estado de conexão etc. — isso é responsabilidade do server bootstrap.
 */
export function createBridgeClient(tcp: TcpJsonRpcClient): BridgeClient {
  return {
    call: (method, params, timeoutMs) => tcp.call(method, params, timeoutMs),
  };
}

export function createToolContext(bridge: BridgeClient): ToolContext {
  return { bridge, logger };
}
