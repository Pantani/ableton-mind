/**
 * Barrel do live-client. Tudo que o restante do código precisa para falar
 * com a bridge sai daqui.
 */

export {
  ABLETON_MIND_ERRORS,
  JSON_RPC_RESERVED_ERRORS,
  JsonRpcRemoteError,
  JsonRpcTransportError,
} from "./jsonrpc.js";
export type {
  JsonRpcErrorObject,
  JsonRpcId,
  JsonRpcIncoming,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./jsonrpc.js";

export { TcpJsonRpcClient } from "./tcp-client.js";
export type { TcpClientOptions, TcpClientState } from "./tcp-client.js";

export {
  EXPECTED_PROTOCOL_VERSION,
  ProtocolMismatchError,
  TS_CLIENT_VERSION,
  performHandshake,
} from "./handshake.js";
export type { HelloParams, HelloResult } from "./handshake.js";
