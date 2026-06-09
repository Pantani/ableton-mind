/**
 * Wire-level smoke test (Cycle 20).
 *
 * Spawns the Python bridge in headless mode (`python -m AbletonMind --port N`),
 * connects the TS TcpJsonRpcClient over real TCP, exercises:
 *   1. handshake (system.hello)
 *   2. system.ping
 *   3. transport.play  (handler responds even without Live via headless dispatch)
 *
 * NÃO precisa de Live — testa o cabo (NDJSON framing, JSON-RPC envelope,
 * dispatcher) que mocks de socket não exercitam.
 *
 * **OPT-IN.** Skipped unless `RUN_WIRE_SMOKE=1` in env, porque:
 *   - Requer Python 3 instalado (não garantido em CI default).
 *   - Aloca porta efêmera, levanta subprocess — ruidoso.
 *
 * Para rodar local:
 *   RUN_WIRE_SMOKE=1 npm test -- wire-smoke
 *
 * Em CI Phase 7+ (matriz Python já presente em ci.yml), basta setar
 * `RUN_WIRE_SMOKE: "1"` no env do job.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import net from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TcpJsonRpcClient, performHandshake } from "../src/live-client/index.js";

const ENABLED = process.env.RUN_WIRE_SMOKE === "1";

/** Acha uma porta livre. */
function pickPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const sock = net.createServer();
    sock.unref();
    sock.on("error", reject);
    sock.listen(0, "127.0.0.1", () => {
      const addr = sock.address();
      if (typeof addr === "object" && addr !== null) {
        const port = addr.port;
        sock.close(() => resolve(port));
      } else {
        reject(new Error("no port assigned"));
      }
    });
  });
}

/** Espera até a porta estar aceitando conexões (timeout 5s). */
async function waitForPort(port: number, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: Error | null = null;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const s = net.createConnection({ host: "127.0.0.1", port });
        s.once("connect", () => {
          s.end();
          resolve();
        });
        s.once("error", reject);
      });
      return;
    } catch (err) {
      lastErr = err as Error;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`port ${port} not ready in ${timeoutMs}ms (last: ${lastErr?.message})`);
}

describe.skipIf(!ENABLED)("wire-smoke (RUN_WIRE_SMOKE=1)", () => {
  let proc: ChildProcessWithoutNullStreams;
  let port = 0;
  let client: TcpJsonRpcClient;

  beforeAll(async () => {
    port = await pickPort();
    proc = spawn("python3", ["-m", "AbletonMind", "--port", String(port)], {
      cwd: "live",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    proc.stderr.on("data", (chunk) => {
      process.stderr.write(`[bridge] ${chunk}`);
    });
    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        process.stderr.write(`[bridge] exited code=${code}\n`);
      }
    });
    await waitForPort(port);
    client = new TcpJsonRpcClient({ host: "127.0.0.1", port, autoReconnect: false });
    await client.connect();
  }, 15000);

  afterAll(async () => {
    if (client) {
      try {
        await client.close();
      } catch {
        // ignore
      }
    }
    if (proc && !proc.killed) {
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 200));
      if (!proc.killed) proc.kill("SIGKILL");
    }
  });

  it("handshake returns protocol_version 0.1", async () => {
    const r = await performHandshake(client);
    expect(r.protocol_version).toBe("0.1");
    expect(r.bridge).toBe("ableton-mind/python");
  });

  it("system.ping returns pong + ts", async () => {
    const r = await client.call<{ pong: boolean; ts: number }>("system.ping");
    expect(r.pong).toBe(true);
    expect(typeof r.ts).toBe("number");
  });

  it("track.list returns -32000 (no Live song)", async () => {
    // Em headless sem ControlSurface, `self.song` é None → handler levanta LIVE_NOT_RUNNING.
    await expect(
      client.call("track.list", { include_master: false, include_returns: false }),
    ).rejects.toMatchObject({ name: "JsonRpcRemoteError", code: -32000 });
  });
});

describe("wire-smoke (disabled by default)", () => {
  it.skipIf(ENABLED)("note about enabling", () => {
    expect(true).toBe(true);
    // Documento: para rodar real wire smoke local, `RUN_WIRE_SMOKE=1 npm test`.
  });
});
