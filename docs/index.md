---
layout: home

hero:
  name: ableton-mind
  text: The definitive MCP for Ableton Live
  tagline: "\"Make me a 128 BPM tech house with a punchy kick, rolling bassline, swung hi-hats.\" — the assistant builds it in Live, reads it back, and tells you what changed."
  actions:
    - theme: brand
      text: I'm an artist
      link: /guide/what-is-ableton-mind
    - theme: alt
      text: Prompt cookbook
      link: /guide/prompt-cookbook
    - theme: alt
      text: Developer reference
      link: /architecture

features:
  - icon: 🎛️
    title: Live tools, not guesses
    details: 36 MCP tools today, targeting ~180 across the 21 Live Object Model domains — transport, tracks, clips, devices, automation, browser, arrangement, Push and more.
  - icon: 🧠
    title: Embedded knowledge base
    details: 55+ Live 12 native devices with parameter schemas (name, range, default, unit). The LLM never guesses "Osc 1 Position".
  - icon: 🍳
    title: Music recipes
    details: 14 declarative JSON recipes for drums, bass, chords, racks, arrangements, mixing and live performance.
  - icon: 🔁
    title: Verify loop
    details: After every batch, re-read state and diff against intent. Tools return { ok, verified, diff } — not just ok.
  - icon: 📡
    title: Reactive listeners
    details: LOM property changes become MCP notifications. The LLM "sees" the user play, record, change tempo.
  - icon: 📦
    title: Distribution path
    details: Source install, npm, GitHub Release .mcpb, Docker build and MCP Registry are ready for 0.1.0; Glama has a listing, but its hosted release is a separate admin publish flow.
---

## Two ways in

**I make music.** Start with [What is ableton-mind?](./guide/what-is-ableton-mind), then [install from source](./guide/installation), make [your first Live set](./guide/first-live-set), and keep the [prompt cookbook](./guide/prompt-cookbook) open.

**I'm a developer.** Jump to the [architecture](./architecture), [tools reference](./tools/), [knowledge base](./knowledge/), [recipes](./recipes/) and [distribution notes](./distribution).

## Current status

**36 MCP tools**, **5 prompts**, **3 MCP resources**, **55 device schemas**, **14 recipes** across 7/7 categories, **verify loop 23/23 mutation/preview tools**, and **real Ableton Live 12.4.1 smoke PASS** for core bridge/session/transport/track flows.

Validation gates are green for `0.1.0`, including typecheck, lint, tests, build, `.mcpb`, docs build, package dry-runs and doctor. npm, GitHub Release `.mcpb` and MCP Registry are published. Glama has a listing, but its hosted release requires the Glama admin Deploy -> Make Release flow; Smithery indexing and ghcr.io availability should be verified per channel. TD-030 Push 2/3 hardware smoke remains hardware-blocked until physical hardware is available.

Phase 8 is not a broad long-tail release yet. Slice 1 delivers read-only Max for Live/plug-in introspection and Link/remote status discovery. Deeper M4L control, VST3 sidecars, remote DAW integration and mobile companion work remain pending, and real Live smoke for M4L/plug-in/Link is still unproven in this pass.
