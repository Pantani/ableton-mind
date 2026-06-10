---
layout: home

hero:
  name: ableton-mind
  text: The definitive MCP for Ableton Live
  tagline: "\"Make me a 128 BPM tech house with a punchy kick, rolling bassline, swung hi-hats.\" — the LLM does it in Live. No guesswork, no visual hack."
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Install
      link: /guide/installation
    - theme: alt
      text: GitHub
      link: https://github.com/Pantani/ableton-mind

features:
  - icon: 🎛️
    title: Full LOM
    details: ~180 tools covering the 21 Live Object Model domains — transport, tracks, clips, devices, automation, modulation, browser, arrangement, push.
  - icon: 🧠
    title: Embedded knowledge base
    details: 55+ Live 12 native devices with parameter schemas (name, range, default, unit). The LLM never guesses "Osc 1 Position".
  - icon: 🍳
    title: Music recipes
    details: Declarative JSON for drum kits, basslines, racks and arrangements per genre. The server expands recipes into tool sequences.
  - icon: 🔁
    title: Verify loop
    details: After every batch, re-read state and diff against intent. Tools return { ok, verified, diff } — not just ok.
  - icon: 📡
    title: Reactive listeners
    details: LOM property changes become MCP notifications. The LLM "sees" the user play, record, change tempo.
  - icon: 📦
    title: Full distribution
    details: One-click DXT for Claude Desktop, npm publish with provenance, Docker for CI, Smithery listing.
---

## Status

**31 MCP tools**, **55 device schemas (~800 indexed params)**, **14 recipes** across 7/7 categories, **verify loop 23/23**, **7 `event.*` notifications**.
