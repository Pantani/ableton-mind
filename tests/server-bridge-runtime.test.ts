import { describe, expect, it, vi } from "vitest";

import type { TcpJsonRpcClient } from "../src/live-client/index.js";
import { createBridgeRuntime } from "../src/server/bridge-runtime.js";

describe("createBridgeRuntime", () => {
  it("returns an offline bridge instead of throwing when the TCP bridge is unavailable", async () => {
    const client = {
      connect: vi.fn(async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:9876");
      }),
      close: vi.fn(async () => {}),
      call: vi.fn(),
    } as unknown as TcpJsonRpcClient;
    const handshake = vi.fn();

    const runtime = await createBridgeRuntime({ client, handshake });

    expect(runtime.connected).toBe(false);
    expect(runtime.client).toBeNull();
    expect(runtime.detail).toContain("connect ECONNREFUSED 127.0.0.1:9876");
    expect(handshake).not.toHaveBeenCalled();
    expect(client.close).toHaveBeenCalledTimes(1);
    await expect(runtime.bridge.call("session.get_info")).rejects.toThrow(
      "Ableton bridge offline: connect ECONNREFUSED 127.0.0.1:9876",
    );
  });

  it("returns a connected bridge after a successful TCP connection and handshake", async () => {
    const client = {
      connect: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      call: vi.fn(async () => ({ ok: true })),
    } as unknown as TcpJsonRpcClient;
    const handshake = vi.fn(async () => ({ protocol_version: "0.1" }));

    const runtime = await createBridgeRuntime({ client, handshake });

    expect(runtime.connected).toBe(true);
    expect(runtime.client).toBe(client);
    expect(runtime.detail).toBe("Ableton bridge connected");
    await expect(runtime.bridge.call("system.ping")).resolves.toEqual({ ok: true });
    await runtime.close();
    expect(client.close).toHaveBeenCalledTimes(1);
  });
});
