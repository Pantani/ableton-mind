import { describe, expect, it, vi } from "vitest";

import { JsonRpcTransportError, type TcpJsonRpcClient } from "../src/live-client/index.js";
import { createBridgeRuntime } from "../src/server/bridge-runtime.js";

// Hermetic defaults: never fall back to the real clock or a real TCP socket to
// 127.0.0.1:9876 (a dev machine may have Live running there).
const noRealSocket = (): TcpJsonRpcClient => {
  throw new Error("test must not open a real TCP client");
};

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

    const runtime = await createBridgeRuntime({
      client,
      handshake,
      clientFactory: noRealSocket,
      now: () => 0,
    });

    expect(runtime.connected).toBe(false);
    expect(runtime.client).toBeNull();
    expect(runtime.detail).toContain("connect ECONNREFUSED 127.0.0.1:9876");
    expect(handshake).not.toHaveBeenCalled();
    expect(client.close).toHaveBeenCalledTimes(1);
    await expect(runtime.bridge.call("session.get_info")).rejects.toThrow(JsonRpcTransportError);
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

    const runtime = await createBridgeRuntime({
      client,
      handshake,
      clientFactory: noRealSocket,
      now: () => 0,
    });

    expect(runtime.connected).toBe(true);
    expect(runtime.client).toBe(client);
    expect(runtime.detail).toBe("Ableton bridge connected");
    await expect(runtime.bridge.call("system.ping")).resolves.toEqual({ ok: true });
    await runtime.close();
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it("falls back to offline when handshake fails after connect", async () => {
    const client = {
      connect: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      call: vi.fn(),
    } as unknown as TcpJsonRpcClient;
    const handshake = vi.fn(async () => {
      throw new Error("invalid system.hello response");
    });

    const runtime = await createBridgeRuntime({
      client,
      handshake,
      clientFactory: noRealSocket,
      now: () => 0,
    });

    expect(runtime.connected).toBe(false);
    expect(runtime.client).toBeNull();
    expect(runtime.detail).toContain("invalid system.hello response");
    expect(handshake).toHaveBeenCalledTimes(1);
    expect(client.close).toHaveBeenCalledTimes(1);
    await expect(runtime.bridge.call("session.get_info")).rejects.toThrow(JsonRpcTransportError);
    await expect(runtime.bridge.call("session.get_info")).rejects.toThrow(
      "Ableton bridge offline: invalid system.hello response",
    );
  });
});

type FakeState = "connected" | "disconnected";

function fakeClient(opts: { failConnect?: string; result?: unknown } = {}) {
  let state: FakeState = "disconnected";
  const listeners = new Set<(m: string, p: unknown) => void>();
  const client = {
    connect: vi.fn(async () => {
      if (opts.failConnect) throw new Error(opts.failConnect);
      state = "connected";
    }),
    close: vi.fn(async () => {
      state = "disconnected";
    }),
    call: vi.fn(async () => opts.result ?? { ok: true }),
    getState: () => state,
    drop: () => {
      state = "disconnected";
    },
    on: (_e: string, h: (m: string, p: unknown) => void) => listeners.add(h),
    off: (_e: string, h: (m: string, p: unknown) => void) => listeners.delete(h),
    listenerCount: () => listeners.size,
  };
  return client;
}

type Fake = ReturnType<typeof fakeClient>;
const asTcp = (c: Fake) => c as unknown as TcpJsonRpcClient;

describe("createBridgeRuntime reconnects on demand", () => {
  it("connects on a later call when Live was not running at startup", async () => {
    let clock = 0;
    const down = fakeClient({ failConnect: "connect ECONNREFUSED 127.0.0.1:9876" });
    const up = fakeClient({ result: { tempo: 142 } });
    const handshake = vi.fn(async () => ({}));

    const runtime = await createBridgeRuntime({
      client: asTcp(down),
      clientFactory: () => asTcp(up),
      handshake,
      reconnectCooldownMs: 1_000,
      now: () => clock,
    });
    expect(runtime.connected).toBe(false);
    expect(runtime.client).toBeNull();

    clock = 1_500; // Live has started since
    await expect(runtime.bridge.call("session.get_info")).resolves.toEqual({ tempo: 142 });
    expect(up.connect).toHaveBeenCalledTimes(1);
    expect(handshake).toHaveBeenCalledWith(up);
    expect(runtime.client).toBe(up);
  });

  it("does not retry inside the cooldown window", async () => {
    let clock = 0;
    const factory = vi.fn(() => asTcp(fakeClient({ failConnect: "ECONNREFUSED" })));
    const runtime = await createBridgeRuntime({
      clientFactory: factory,
      handshake: vi.fn(async () => ({})),
      reconnectCooldownMs: 1_000,
      now: () => clock,
    });
    expect(factory).toHaveBeenCalledTimes(1);

    clock = 500;
    await expect(runtime.bridge.call("x")).rejects.toThrow("Ableton bridge offline: ECONNREFUSED");
    expect(factory).toHaveBeenCalledTimes(1);

    clock = 1_200;
    await expect(runtime.bridge.call("x")).rejects.toThrow(JsonRpcTransportError);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("replaces a dropped client and moves subscribers to the new one", async () => {
    const first = fakeClient();
    const second = fakeClient();
    const runtime = await createBridgeRuntime({
      client: asTcp(first),
      clientFactory: () => asTcp(second),
      handshake: vi.fn(async () => ({})),
    });
    const handler = vi.fn();
    const detach = runtime.onClient((c) => {
      const tcp = c as unknown as Fake;
      tcp.on("notification", handler);
      return () => tcp.off("notification", handler);
    });
    expect(first.listenerCount()).toBe(1);

    first.drop(); // Live restarted
    await runtime.bridge.call("session.get_info");

    expect(second.call).toHaveBeenCalledWith("session.get_info", undefined, undefined);
    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
    expect(first.close).toHaveBeenCalled();

    detach();
    expect(second.listenerCount()).toBe(0);
    await runtime.close();
    expect(second.close).toHaveBeenCalled();
  });

  it("shares one reconnect attempt between concurrent calls", async () => {
    let clock = 0;
    const up = fakeClient();
    const factory = vi.fn(() => asTcp(up));
    const runtime = await createBridgeRuntime({
      client: asTcp(fakeClient({ failConnect: "ECONNREFUSED" })),
      clientFactory: factory,
      handshake: vi.fn(async () => ({})),
      reconnectCooldownMs: 0,
      now: () => clock,
    });
    clock = 10;

    await Promise.all([
      runtime.bridge.call("a"),
      runtime.bridge.call("b"),
      runtime.bridge.call("c"),
    ]);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(up.connect).toHaveBeenCalledTimes(1);
    expect(up.call).toHaveBeenCalledTimes(3);
  });

  it("registering the same onClient function twice does not leak the first listener", async () => {
    const client = fakeClient();
    const runtime = await createBridgeRuntime({
      client: asTcp(client),
      clientFactory: noRealSocket,
      handshake: vi.fn(async () => ({})),
      now: () => 0,
    });
    const handler = vi.fn();
    const attach = (c: TcpJsonRpcClient) => {
      const tcp = c as unknown as Fake;
      tcp.on("notification", handler);
      return () => tcp.off("notification", handler);
    };

    runtime.onClient(attach);
    const detach = runtime.onClient(attach);
    expect(client.listenerCount()).toBe(1);

    detach();
    expect(client.listenerCount()).toBe(0);
  });
});
