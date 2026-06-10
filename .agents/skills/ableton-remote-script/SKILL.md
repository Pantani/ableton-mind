---
name: ableton-remote-script
description: Patterns for the ableton-mind Python Remote Script bridge: ControlSurface lifecycle, handlers, thread-safe LiveAPI, listeners, undo transactions and offline tests.
---

# Ableton Remote Script — Python Bridge Patterns

Use this skill when implementing or reviewing code under live/AbletonMind/.

## Constraints

- LiveAPI must be touched on Live's main thread. TCP worker threads enqueue work.
- Prefer stdlib only inside Live.
- Keep handlers idempotent and read-before-write.
- Wrap composite mutations in Song.begin_undo_step/end_undo_step.
- Return JSON-serializable data and structured JSON-RPC errors.
- Test offline with unittest and faked LiveAPI.

## ControlSurface Lifecycle

Expose create_instance(c_instance), construct AbletonMind(ControlSurface), start the bridge when the control surface loads and stop it cleanly on disconnect/reload. Use log_message for structured diagnostics.

## Handler Pattern

Register handlers with stable method names such as transport.play or track.list. Validate inputs, resolve Live objects at call time, check liveobj_valid before use, mutate only when needed, then read state back and return the contract shape.

## Listener Pattern

Use a ListenerRegistry that tracks add/remove pairs. Subscribing twice is a no-op. Unsubscribe on client disconnect and surface reload. Listener callbacks push JSON-RPC notifications with stable event names and compact params.

## Transactions

Use transaction helpers for multi-step mutations: create track + rename + load device should become one undo action. Always end the undo step in finally.

## Tests

Every handler gets at least one happy path and one error path. Listener tests verify duplicate registration and cleanup. Smoke tests may use a real Live instance, but unit tests must pass without Live.
