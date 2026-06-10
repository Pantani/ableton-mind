/**
 * Wire-level smoke test (Cycle 20).
 *
 * Spawns the Python bridge in headless mode (`python -m AbletonMind --port N`),
 * connects the TS TcpJsonRpcClient over real TCP, exercises:
 *   1. handshake (system.hello)
 *   2. system.ping
 *   3. transport.play  (handler responds even without Live via headless dispatch)
 *
 * Does NOT require Live — tests the wire (NDJSON framing, JSON-RPC envelope,
 * dispatcher) that socket mocks don't exercise.
 *
 * **OPT-IN.** Skipped unless `RUN_WIRE_SMOKE=1` in env, because:
 *   - Requires Python 3 installed (not guaranteed in default CI).
 *   - Allocates ephemeral port, spawns subprocess — noisy.
 *
 * To run locally:
 *   RUN_WIRE_SMOKE=1 npm test -- wire-smoke
 *
 * In Phase 7+ CI (Python matrix already in ci.yml), just set
 * `RUN_WIRE_SMOKE: "1"` in the job env.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import net from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TcpJsonRpcClient, performHandshake } from "../src/live-client/index.js";

const ENABLED = process.env.RUN_WIRE_SMOKE === "1";

/** Finds a free port. */
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

/** Waits until the port is accepting connections (5s timeout). */
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
    // In headless mode without ControlSurface, `self.song` is None, so the handler raises LIVE_NOT_RUNNING.
    await expect(
      client.call("track.list", { include_master: false, include_returns: false }),
    ).rejects.toMatchObject({ name: "JsonRpcRemoteError", code: -32000 });
  });
});

describe("wire-smoke (disabled by default)", () => {
  it.skipIf(ENABLED)("note about enabling", () => {
    expect(true).toBe(true);
    // Docs: to run a real local wire smoke, use `RUN_WIRE_SMOKE=1 npm test`.
  });
});
