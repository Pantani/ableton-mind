/**
 * TS notification forwarder tests (TD-015 + TD-018).
 *
 * Verifies that:
 *  - Methods with `event.` prefix are forwarded to the MCP notifier.
 *  - Methods without the prefix are dropped (notifier not called).
 *  - Notifier errors don't propagate (they are swallowed with a log).
 *  - `attachNotificationForwarder` returns a `dispose` function that removes the listener.
 */

import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import { attachNotificationForwarder, forwardNotification } from "../src/server/notifications.js";

describe("forwardNotification", () => {
  it("forwards event.* methods", async () => {
    const notifier = vi.fn(async () => {});
    const ok = await forwardNotification(notifier, "event.transport_tempo_changed", {
      value: 140,
      previous: 120,
      ts: 1,
    });
    expect(ok).toBe(true);
    expect(notifier).toHaveBeenCalledWith("event.transport_tempo_changed", {
      value: 140,
      previous: 120,
      ts: 1,
    });
  });

  it("drops methods without event. prefix", async () => {
    const notifier = vi.fn(async () => {});
    const ok = await forwardNotification(notifier, "transport.play", {});
    expect(ok).toBe(false);
    expect(notifier).not.toHaveBeenCalled();
  });

  it("returns false when notifier throws (does not propagate)", async () => {
    const notifier = vi.fn(async () => {
      throw new Error("MCP send failed");
    });
    const ok = await forwardNotification(notifier, "event.foo_changed", {});
    expect(ok).toBe(false);
  });
});

describe("attachNotificationForwarder", () => {
  it("wires client.on('notification') to the notifier and dispose removes listener", async () => {
    const client = new EventEmitter() as EventEmitter & {
      on: EventEmitter["on"];
      off: EventEmitter["off"];
    };
    const notifier = vi.fn(async () => {});

    const dispose = attachNotificationForwarder(client as never, notifier);

    client.emit("notification", "event.transport_is_playing_changed", { value: true });
    // forwardNotification is async — wait for next tick.
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(notifier).toHaveBeenCalledTimes(1);
    expect(notifier).toHaveBeenCalledWith("event.transport_is_playing_changed", {
      value: true,
    });

    dispose();
    client.emit("notification", "event.foo", {});
    await new Promise<void>((r) => setTimeout(r, 0));
    // Was not called again.
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it("drops non-event notifications received via emitter", async () => {
    const client = new EventEmitter();
    const notifier = vi.fn(async () => {});
    attachNotificationForwarder(client as never, notifier);

    client.emit("notification", "transport.play", {});
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(notifier).not.toHaveBeenCalled();
  });
});
