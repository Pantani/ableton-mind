/**
 * Testes do TcpJsonRpcClient contra um mini-server TCP NDJSON em loopback.
 *
 * Cobre:
 * - connect + system.hello + close.
 * - call() request/response com correlação por `id`.
 * - call() recebendo error e mapeando para JsonRpcRemoteError.
 * - notification chega via evento.
 * - timeout estoura JsonRpcTransportError.
 *
 * Não toca Live. Não usa rede real além do loopback.
 */

import { type AddressInfo, createServer, type Server, type Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ABLETON_MIND_ERRORS,
  JsonRpcRemoteError,
  JsonRpcTransportError,
  TcpJsonRpcClient,
} from "../src/live-client/index.js";

interface MockServer {
  server: Server;
  port: number;
  sockets: Set<Socket>;
  /** Encaminha cada linha recebida para esse handler. */
  onLine: (line: string, sock: Socket) => void;
  send: (sock: Socket, payload: object) => void;
  close: () => Promise<void>;
}

async function startMockBridge(): Promise<MockServer> {
  const sockets = new Set<Socket>();
  let onLineRef: (line: string, sock: Socket) => void = () => {};

  const server = createServer((sock) => {
    sockets.add(sock);
    let buffer = "";
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => {
      buffer += chunk;
      let idx = buffer.indexOf("\n");
      while (idx >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.trim()) onLineRef(line, sock);
        idx = buffer.indexOf("\n");
      }
    });
    sock.on("close", () => sockets.delete(sock));
    sock.on("error", () => sockets.delete(sock));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address() as AddressInfo;

  const send = (sock: Socket, payload: object): void => {
    sock.write(`${JSON.stringify(payload)}\n`);
  };

  const close = async (): Promise<void> => {
    for (const sock of sockets) sock.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };

  return {
    server,
    port: addr.port,
    sockets,
    get onLine() {
      return onLineRef;
    },
    set onLine(fn: (line: string, sock: Socket) => void) {
      onLineRef = fn;
    },
    send,
    close,
  };
}

describe("TcpJsonRpcClient", () => {
  let mock: MockServer;

  beforeEach(async () => {
    mock = await startMockBridge();
  });

  afterEach(async () => {
    await mock.close();
  });

  it("connects, sends request, resolves with result", async () => {
    mock.onLine = (line, sock) => {
      const msg = JSON.parse(line);
      mock.send(sock, {
        jsonrpc: "2.0",
        id: msg.id,
        result: { pong: true, ts: 1234 },
      });
    };

    const client = new TcpJsonRpcClient({
      host: "127.0.0.1",
      port: mock.port,
      autoReconnect: false,
    });
    await client.connect();
    const result = await client.call<{ pong: boolean; ts: number }>("system.ping");
    expect(result).toEqual({ pong: true, ts: 1234 });
    await client.close();
  });

  it("maps error response to JsonRpcRemoteError with code + data", async () => {
    mock.onLine = (line, sock) => {
      const msg = JSON.parse(line);
      mock.send(sock, {
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: ABLETON_MIND_ERRORS.OUT_OF_RANGE,
          message: "bpm out of range",
          data: { min: 20, max: 999, got: 9999 },
        },
      });
    };

    const client = new TcpJsonRpcClient({
      host: "127.0.0.1",
      port: mock.port,
      autoReconnect: false,
    });
    await client.connect();

    await expect(client.call("transport.set_tempo", { bpm: 9999 })).rejects.toMatchObject({
      name: "JsonRpcRemoteError",
      code: ABLETON_MIND_ERRORS.OUT_OF_RANGE,
      data: { min: 20, max: 999, got: 9999 },
    });

    await client.close();
  });

  it("emits 'notification' event for messages without id", async () => {
    mock.onLine = (_line, sock) => {
      mock.send(sock, {
        jsonrpc: "2.0",
        method: "event.beat",
        params: { beat: 17, bar: 5, song_time: 17.0 },
      });
    };

    const client = new TcpJsonRpcClient({
      host: "127.0.0.1",
      port: mock.port,
      autoReconnect: false,
    });
    await client.connect();

    const received: Array<{ method: string; params: unknown }> = [];
    client.on("notification", (method: string, params: unknown) => {
      received.push({ method, params });
    });

    // Trigger a request so the mock sends a notification back.
    // We don't actually wait for a response — the mock only sends a notif.
    const callPromise = client.call("ignored", {}, 200).catch(() => {
      /* timeout expected */
    });

    // Wait for notification to arrive.
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("notification not received")), 1000);
      client.once("notification", () => {
        clearTimeout(t);
        resolve();
      });
    });

    await callPromise;
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      method: "event.beat",
      params: { beat: 17, bar: 5, song_time: 17.0 },
    });
    await client.close();
  });

  it("rejects with JsonRpcTransportError on timeout", async () => {
    mock.onLine = () => {
      /* never respond */
    };

    const client = new TcpJsonRpcClient({
      host: "127.0.0.1",
      port: mock.port,
      autoReconnect: false,
      defaultTimeoutMs: 100,
    });
    await client.connect();

    await expect(client.call("transport.play", {})).rejects.toMatchObject({
      name: "JsonRpcTransportError",
    });

    await client.close();
  });

  it("refuses call when not connected", async () => {
    const client = new TcpJsonRpcClient({
      host: "127.0.0.1",
      port: mock.port,
      autoReconnect: false,
    });
    await expect(client.call("system.ping")).rejects.toBeInstanceOf(JsonRpcTransportError);
  });
});
