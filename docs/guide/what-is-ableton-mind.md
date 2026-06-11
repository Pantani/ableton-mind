# What is ableton-mind?

`ableton-mind` lets an AI assistant build and inspect an Ableton Live set from plain language. You describe the musical result; the assistant uses real Live tools, reads the set back, and reports what changed.

> "Create a 128 BPM tech-house starter: four-on-the-floor kick, rolling bass, off-beat hats, a sidechain rack, and a 16-bar drop."

The goal is not a chat-only suggestion. The goal is a real Live set: tracks, clips, devices, automation, mixer state and a verification diff.

## Who it is for

- Producers who want a fast starting point inside Live instead of a blank session.
- Live performers who want repeatable rigs, clip-launching layouts and Push/Launchpad-friendly setups.
- Sound designers who want the assistant to use real device names and parameter ranges.
- Developers who want a typed MCP bridge into the Live Object Model.

If you want the internals, jump to the [developer architecture](../architecture). If you want to make music first, start with [Your first Live set](./first-live-set).

## Why it works

Most AI music workflows stop at advice. `ableton-mind` is designed around three grounded layers:

- **Real execution**: a Python Remote Script runs inside Live and talks to the TypeScript MCP server over local JSON-RPC.
- **Real knowledge**: 55 Live device schemas, scales and recipe metadata are embedded so the assistant can use valid parameters instead of guessing.
- **Real verification**: tools read state before and after mutations and return `{ ok, verified, diff }`.

## Current status

The code has passed a real Ableton Live 12.4.1 smoke test for core transport/session/track operations, and the `0.1.1` package validation gates are green. npm, GitHub Release `.mcpb` and MCP Registry channels are published. Glama has a listing, but its hosted release is published through a separate Glama admin flow; use source install when you need to develop or validate local changes.

Phase 8 slice 1 delivers read-only Max for Live/plug-in introspection and Link/remote status discovery. It does not mean broad M4L control, VST3 sidecars, remote DAW integration or mobile companion support are available yet.

## Next steps

1. [Install from source](./installation).
2. [Make your first Live set](./first-live-set).
3. Keep the [prompt cookbook](./prompt-cookbook) open for starting prompts.
