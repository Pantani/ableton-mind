/**
 * Cliente TCP NDJSON JSON-RPC 2.0 para a bridge Python do ableton-mind.
 *
 * Responsabilidades:
 * - Conexão persistente a `127.0.0.1:9876` (override via env).
 * - Framing NDJSON: cada mensagem é UMA linha terminada por `\n`.
 * - Buffer parcial: linha incompleta no fim de um chunk fica guardada para
 *   o próximo `data`.
 * - Fila de requests pendentes por `id` com timeout default 5s.
 * - Reconnect transparente com backoff exponencial (100ms → 5s).
 * - Notifications (sem id) viram eventos via EventEmitter.
 *
 * Não conhece a semântica dos métodos. Quem chama é responsável pelo schema
 * dos params/result.
 */

import { EventEmitter } from "node:events";
import net from "node:net";

import { logger } from "../utils/logger.js";
import {
  type JsonRpcId,
  type JsonRpcNotification,
  JsonRpcRemoteError,
  JsonRpcTransportError,
  decodeIncoming,
  encodeRequest,
  isNotification,
  isResponse,
} from "./jsonrpc.js";

export interface TcpClientOptions {
  host?: string;
  port?: number;
  /** Timeout default por request, em ms. */
  defaultTimeoutMs?: number;
  /** Backoff inicial em ms para reconnect. */
  reconnectInitialMs?: number;
  /** Backoff máximo em ms para reconnect. */
  reconnectMaxMs?: number;
  /** Se `true`, tenta reconectar quando o socket cair. Default `true`. */
  autoReconnect?: boolean;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
  method: string;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9876;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RECONNECT_INITIAL_MS = 100;
const DEFAULT_RECONNECT_MAX_MS = 5000;

/**
 * Parse env var como inteiro positivo. Retorna `undefined` se não setado,
 * vazio, NaN ou <= 0 — assim o `??` funciona corretamente para fallback.
 * (TD-001: `Number(undefined) ?? default` vira NaN e quebra o fallback.)
 */
function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

interface ResolvedTcpOptions {
  host: string;
  port: number;
  defaultTimeoutMs: number;
  reconnectInitialMs: number;
  reconnectMaxMs: number;
  autoReconnect: boolean;
}

/**
 * Resolve `TcpClientOptions` → defaults aplicáveis em runtime.
 * Extraído do constructor para manter complexidade ciclomática ≤ 10.
 * Precedência: opt explícita > env var > DEFAULT_*.
 */
function resolveTcpOptions(options: TcpClientOptions): ResolvedTcpOptions {
  return {
    host: options.host ?? process.env.ABLETON_MIND_HOST ?? DEFAULT_HOST,
    port: options.port ?? parsePositiveInt(process.env.ABLETON_MIND_PORT) ?? DEFAULT_PORT,
    defaultTimeoutMs:
      options.defaultTimeoutMs ??
      parsePositiveInt(process.env.ABLETON_MIND_TIMEOUT_MS) ??
      DEFAULT_TIMEOUT_MS,
    reconnectInitialMs: options.reconnectInitialMs ?? DEFAULT_RECONNECT_INITIAL_MS,
    reconnectMaxMs: options.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS,
    autoReconnect: options.autoReconnect ?? true,
  };
}

export type TcpClientState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

/**
 * Cliente TCP NDJSON. Emite:
 * - `connect` — socket pronto.
 * - `disconnect` — socket caiu (antes de tentar reconectar).
 * - `notification` — `(method, params)` para mensagens JSON-RPC sem id.
 * - `error` — erros não fatais (parse de linha, etc.).
 */
export class TcpJsonRpcClient extends EventEmitter {
  private readonly host: string;
  private readonly port: number;
  private readonly defaultTimeoutMs: number;
  private readonly reconnectInitialMs: number;
  private readonly reconnectMaxMs: number;
  private readonly autoReconnect: boolean;

  private socket: net.Socket | null = null;
  private buffer = "";
  private nextId = 1;
  private state: TcpClientState = "disconnected";
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private readonly pending = new Map<JsonRpcId, PendingRequest>();

  constructor(options: TcpClientOptions = {}) {
    super();
    const resolved = resolveTcpOptions(options);
    this.host = resolved.host;
    this.port = resolved.port;
    this.defaultTimeoutMs = resolved.defaultTimeoutMs;
    this.reconnectInitialMs = resolved.reconnectInitialMs;
    this.reconnectMaxMs = resolved.reconnectMaxMs;
    this.autoReconnect = resolved.autoReconnect;
  }

  getState(): TcpClientState {
    return this.state;
  }

  /**
   * Abre conexão TCP. Resolve quando o socket conecta.
   * Se já está conectado, retorna imediatamente.
   */
  async connect(): Promise<void> {
    if (this.state === "connected") return;
    if (this.state === "closed") {
      throw new JsonRpcTransportError("client is closed; instantiate a new one");
    }
    this.state = "connecting";
    return new Promise<void>((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port });
      const onConnect = (): void => {
        sock.removeListener("error", onError);
        this.socket = sock;
        this.state = "connected";
        this.reconnectAttempt = 0;
        this.attachSocketHandlers(sock);
        logger.info("bridge connected", { host: this.host, port: this.port });
        this.emit("connect");
        resolve();
      };
      const onError = (err: Error): void => {
        sock.removeListener("connect", onConnect);
        this.state = "disconnected";
        reject(new JsonRpcTransportError(`failed to connect: ${err.message}`, err));
      };
      sock.once("connect", onConnect);
      sock.once("error", onError);
    });
  }

  /**
   * Fecha conexão e marca como `closed`. Pending requests são rejeitadas.
   * Nova chamada precisa de nova instância.
   */
  async close(): Promise<void> {
    this.state = "closed";
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending(new JsonRpcTransportError("client closed"));
    if (this.socket) {
      const sock = this.socket;
      this.socket = null;
      await new Promise<void>((resolve) => {
        sock.end(() => resolve());
        sock.once("error", () => resolve());
      });
    }
  }

  /**
   * Envia um request JSON-RPC e aguarda a resposta correspondente.
   *
   * @throws `JsonRpcTransportError` quando socket desconecta ou timeout estoura.
   * @throws `JsonRpcRemoteError` quando bridge responde com `error`.
   */
  async call<TResult = unknown>(
    method: string,
    params?: unknown,
    timeoutMs: number = this.defaultTimeoutMs,
  ): Promise<TResult> {
    if (this.state !== "connected" || !this.socket) {
      throw new JsonRpcTransportError(`cannot call ${method}: state=${this.state}`);
    }
    const id = this.nextId++;
    const payload = encodeRequest({ jsonrpc: "2.0", id, method, params });

    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new JsonRpcTransportError(`timeout calling ${method} after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (v) => resolve(v as TResult),
        reject,
        timer,
        method,
      });

      this.socket!.write(payload, (err) => {
        if (err) {
          const entry = this.pending.get(id);
          if (entry) {
            clearTimeout(entry.timer);
            this.pending.delete(id);
          }
          reject(new JsonRpcTransportError(`socket write failed: ${err.message}`, err));
        }
      });
    });
  }

  // -------- internals ----------------------------------------------------

  private attachSocketHandlers(sock: net.Socket): void {
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => this.onData(chunk));
    sock.on("error", (err) => {
      logger.warn("socket error", { message: err.message });
      this.emit("error", err);
    });
    sock.on("close", (hadError) => {
      logger.warn("socket closed", { hadError });
      this.handleDisconnect();
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    // NDJSON: separa por `\n`. Linha incompleta no fim fica em `this.buffer`.
    let newlineIdx = this.buffer.indexOf("\n");
    while (newlineIdx >= 0) {
      const line = this.buffer.slice(0, newlineIdx);
      this.buffer = this.buffer.slice(newlineIdx + 1);
      if (line.trim().length > 0) {
        this.processLine(line);
      }
      newlineIdx = this.buffer.indexOf("\n");
    }
  }

  private processLine(line: string): void {
    let msg: ReturnType<typeof decodeIncoming>;
    try {
      msg = decodeIncoming(line);
    } catch (err) {
      logger.error("failed to decode incoming line", {
        error: (err as Error).message,
        line: line.slice(0, 200),
      });
      this.emit("error", err);
      return;
    }

    if (isResponse(msg)) {
      const idKey = msg.id as JsonRpcId | null;
      if (idKey == null) {
        logger.warn("response with null id ignored");
        return;
      }
      const entry = this.pending.get(idKey);
      if (!entry) {
        logger.warn("response for unknown id", { id: idKey });
        return;
      }
      this.pending.delete(idKey);
      clearTimeout(entry.timer);
      if ("error" in msg) {
        entry.reject(new JsonRpcRemoteError(msg.error));
      } else {
        entry.resolve(msg.result);
      }
      return;
    }

    if (isNotification(msg)) {
      this.emitNotification(msg);
      return;
    }
  }

  private emitNotification(msg: JsonRpcNotification): void {
    logger.debug("notification received", { method: msg.method });
    this.emit("notification", msg.method, msg.params);
  }

  private handleDisconnect(): void {
    if (this.state === "closed") return;
    this.socket = null;
    this.buffer = "";
    this.rejectAllPending(new JsonRpcTransportError("socket disconnected"));
    this.state = "disconnected";
    this.emit("disconnect");

    if (!this.autoReconnect) return;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.state === "closed") return;
    this.state = "reconnecting";
    const delay = Math.min(
      this.reconnectInitialMs * 2 ** this.reconnectAttempt,
      this.reconnectMaxMs,
    );
    this.reconnectAttempt += 1;
    logger.info("scheduling reconnect", { attempt: this.reconnectAttempt, delayMs: delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        logger.warn("reconnect attempt failed", { message: (err as Error).message });
        this.handleDisconnect();
      });
    }, delay);
  }

  private rejectAllPending(reason: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(reason);
      this.pending.delete(id);
    }
  }
}
