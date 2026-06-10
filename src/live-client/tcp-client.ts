/**
 * NDJSON JSON-RPC 2.0 TCP client for the ableton-mind Python bridge.
 *
 * Responsibilities:
 * - Persistent connection to `127.0.0.1:9876` (override via env).
 * - NDJSON framing: each message is ONE line terminated by `\n`.
 * - Partial buffer: incomplete line at the end of a chunk is kept for
 *   the next `data`.
 * - Pending request queue by `id` with default 5s timeout.
 * - Transparent reconnect with exponential backoff (100ms → 5s).
 * - Notifications (no id) become events via EventEmitter.
 *
 * Does not know method semantics. The caller is responsible for the
 * params/result schema.
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
  /** Default timeout per request, in ms. */
  defaultTimeoutMs?: number;
  /** Maximum bytes for one incoming NDJSON frame before disconnecting. */
  maxFrameBytes?: number;
  /** Maximum in-flight JSON-RPC requests before rejecting new calls. */
  maxPendingRequests?: number;
  /** Initial backoff in ms for reconnect. */
  reconnectInitialMs?: number;
  /** Maximum backoff in ms for reconnect. */
  reconnectMaxMs?: number;
  /** If `true`, attempts to reconnect when socket drops. Default `true`. */
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
const DEFAULT_MAX_FRAME_BYTES = 1_048_576;
const DEFAULT_MAX_PENDING_REQUESTS = 128;
const DEFAULT_RECONNECT_INITIAL_MS = 100;
const DEFAULT_RECONNECT_MAX_MS = 5000;

/**
 * Parse env var as a positive integer. Returns `undefined` if unset,
 * empty, NaN, or <= 0 — so `??` works correctly for fallback.
 * (TD-001: `Number(undefined) ?? default` becomes NaN and breaks the fallback.)
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
  maxFrameBytes: number;
  maxPendingRequests: number;
  reconnectInitialMs: number;
  reconnectMaxMs: number;
  autoReconnect: boolean;
}

function resolvePositiveIntOption(
  explicit: number | undefined,
  envName: string,
  fallback: number,
): number {
  return explicit ?? parsePositiveInt(process.env[envName]) ?? fallback;
}

/**
 * Resolves `TcpClientOptions` → applicable runtime defaults.
 * Extracted from the constructor to keep cyclomatic complexity ≤ 10.
 * Precedence: explicit opt > env var > DEFAULT_*.
 */
function resolveTcpOptions(options: TcpClientOptions): ResolvedTcpOptions {
  return {
    host: options.host ?? process.env.ABLETON_MIND_HOST ?? DEFAULT_HOST,
    port: resolvePositiveIntOption(options.port, "ABLETON_MIND_PORT", DEFAULT_PORT),
    defaultTimeoutMs: resolvePositiveIntOption(
      options.defaultTimeoutMs,
      "ABLETON_MIND_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
    ),
    maxFrameBytes: resolvePositiveIntOption(
      options.maxFrameBytes,
      "ABLETON_MIND_MAX_FRAME_BYTES",
      DEFAULT_MAX_FRAME_BYTES,
    ),
    maxPendingRequests: resolvePositiveIntOption(
      options.maxPendingRequests,
      "ABLETON_MIND_MAX_PENDING_REQUESTS",
      DEFAULT_MAX_PENDING_REQUESTS,
    ),
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
 * NDJSON TCP client. Emits:
 * - `connect` — socket ready.
 * - `disconnect` — socket dropped (before attempting reconnect).
 * - `notification` — `(method, params)` for JSON-RPC messages without id.
 * - `error` — non-fatal errors (line parse, etc.).
 */
export class TcpJsonRpcClient extends EventEmitter {
  private readonly host: string;
  private readonly port: number;
  private readonly defaultTimeoutMs: number;
  private readonly maxFrameBytes: number;
  private readonly maxPendingRequests: number;
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
    this.maxFrameBytes = resolved.maxFrameBytes;
    this.maxPendingRequests = resolved.maxPendingRequests;
    this.reconnectInitialMs = resolved.reconnectInitialMs;
    this.reconnectMaxMs = resolved.reconnectMaxMs;
    this.autoReconnect = resolved.autoReconnect;
  }

  getState(): TcpClientState {
    return this.state;
  }

  /**
   * Opens the TCP connection. Resolves when the socket connects.
   * If already connected, returns immediately.
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
   * Closes the connection and marks as `closed`. Pending requests are rejected.
   * A new call requires a new instance.
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
   * Sends a JSON-RPC request and awaits the matching response.
   *
   * @throws `JsonRpcTransportError` when the socket disconnects or the timeout fires.
   * @throws `JsonRpcRemoteError` when the bridge responds with `error`.
   */
  async call<TResult = unknown>(
    method: string,
    params?: unknown,
    timeoutMs: number = this.defaultTimeoutMs,
  ): Promise<TResult> {
    if (this.state !== "connected" || !this.socket) {
      throw new JsonRpcTransportError(`cannot call ${method}: state=${this.state}`);
    }
    if (this.pending.size >= this.maxPendingRequests) {
      throw new JsonRpcTransportError(
        `max pending JSON-RPC requests exceeded: ${this.maxPendingRequests}`,
      );
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
      this.emitError(err instanceof Error ? err : new Error(String(err)));
    });
    sock.on("close", (hadError) => {
      logger.warn("socket closed", { hadError });
      this.handleDisconnect();
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    // NDJSON: split by `\n`. Incomplete trailing line stays in `this.buffer`.
    let newlineIdx = this.buffer.indexOf("\n");
    while (newlineIdx >= 0) {
      const line = this.buffer.slice(0, newlineIdx);
      this.buffer = this.buffer.slice(newlineIdx + 1);
      if (this.frameTooLarge(line)) {
        this.failConnection(
          new JsonRpcTransportError(`incoming JSON-RPC frame exceeded ${this.maxFrameBytes} bytes`),
        );
        return;
      }
      if (line.trim().length > 0) {
        this.processLine(line);
      }
      newlineIdx = this.buffer.indexOf("\n");
    }
    if (this.frameTooLarge(this.buffer)) {
      this.failConnection(
        new JsonRpcTransportError(`incoming JSON-RPC frame exceeded ${this.maxFrameBytes} bytes`),
      );
    }
  }

  private frameTooLarge(frame: string): boolean {
    return Buffer.byteLength(frame, "utf8") > this.maxFrameBytes;
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
      this.emitError(err instanceof Error ? err : new Error(String(err)));
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
    if (this.state === "closed" || (this.state === "disconnected" && this.socket === null)) return;
    this.socket = null;
    this.buffer = "";
    this.rejectAllPending(new JsonRpcTransportError("socket disconnected"));
    this.state = "disconnected";
    this.emit("disconnect");

    if (!this.autoReconnect) return;
    this.scheduleReconnect();
  }

  private failConnection(reason: JsonRpcTransportError): void {
    logger.warn("closing bridge connection", { message: reason.message });
    this.buffer = "";
    this.rejectAllPending(reason);
    const sock = this.socket;
    this.socket = null;
    if (this.state !== "closed") {
      this.state = "disconnected";
      this.emit("disconnect");
    }
    this.emitError(reason);
    sock?.destroy();
    if (this.autoReconnect) this.scheduleReconnect();
  }

  private emitError(err: Error): void {
    if (this.listenerCount("error") > 0) this.emit("error", err);
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
