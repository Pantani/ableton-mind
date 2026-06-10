import type { ResourceDefinition } from "./index.js";

/**
 * `live://session/state` — deep snapshot of Live (tempo + transport + tracks
 * + clips + devices). READ-ONLY equivalent of the `session_snapshot` tool, but
 * exposed via the MCP Resource primitive.
 *
 * A client wanting to "see current state" via the resources menu → invokes this URI.
 */
export const sessionStateResource: ResourceDefinition = {
  uri: "live://session/state",
  name: "session_state",
  description:
    "Deep snapshot of the current Ableton Live session (tempo, transport, tracks, clips, devices).",
  mimeType: "application/json",
  read: async (bridge) => {
    if (bridge === null) {
      return {
        contents: [
          {
            uri: "live://session/state",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                error: "bridge unavailable",
                hint: "Is Ableton Live running with AbletonMind Remote Script?",
              },
              null,
              2,
            ),
          },
        ],
      };
    }
    try {
      const snap = await bridge.call("session.snapshot", {
        include_clips: true,
        include_devices: true,
      });
      return {
        contents: [
          {
            uri: "live://session/state",
            mimeType: "application/json",
            text: JSON.stringify(snap, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        contents: [
          {
            uri: "live://session/state",
            mimeType: "application/json",
            text: JSON.stringify(
              { error: (err as Error).message, name: (err as Error).name },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
};
