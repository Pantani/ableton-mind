# tdmcp-Compatible Feature Backlog for ableton-mind

This backlog records `tdmcp` features that are compatible with ableton-mind and how they should map to Ableton Live. It is intentionally domain-adapted; TouchDesigner-specific surfaces are not copied directly.

| tdmcp feature | Ableton Mind equivalent | Compatibility | Priority | Status | Notes |
|---|---|---:|---:|---|---|
| Local LLM copilot (`chat`, `llm-run`) | `ableton-mind chat` / `llm-run` with Ollama/OpenAI-compatible endpoint | High | P0 | Implemented MVP | Default `safe`; `--write` and `--creative` opt in to mutations. |
| Headless local prompt (`ask`) | `ableton-mind ask "<prompt>"` | High | P0 | Implemented MVP | Scriptable one-shot; JSON mode exists but should gain richer error/status fields later. |
| Safe/standard/creative tool tiers | Curated Live tools by risk | High | P0 | Implemented MVP | Keep read-only default for Live session safety. |
| Bridge-offline local UI | Chat starts without Live; live tools return bridge errors | High | P0 | Implemented MVP | Next step: static resources should be more useful offline. |
| Handoff to Claude/Codex | Generate a handoff prompt when task exceeds local model lane | High | P1 | Planned | Add `src/llm/handoff.ts` and `/handoff` endpoint. |
| CLI agent command catalog | `ableton-mind-agent commands/schema/run/repl` or subcommands under `ableton-mind` | High | P1 | Planned | Useful for local copilot, docs, and scripts. |
| Doctor LLM checks | `doctor --json/--fix` including LLM endpoint/model readiness | High | P1 | Planned | Current doctor is read-only and does not check Ollama. |
| Install/onboarding CLI | Real `ableton-mind install-remote-script` / `init` dispatcher | High | P1 | Planned | Docs currently imply a subcommand that is not routed by `src/index.ts`. |
| Watch events | CLI watch over `event.*` notifications | High | P1 | Planned | Builds on current listener forwarding. |
| Watch-build | TS build + Python compile + bridge reload guidance | High | P1 | Planned | Adapt `tdmcp-agent watch-build`; no TouchDesigner reload assumptions. |
| Generated tool docs | Generate docs from `allTools`, prompts and resources | High | P1 | Planned | Reduces README/docs drift on tool counts. |
| Command/resource catalog | `live://commands`, tool schemas, prompt catalog awareness | High | P1 | Planned | Helps small local models choose legal calls. |
| Recipe validation/dry-run | Recipe linter, dry-run, transaction/rollback policy | High | P1 | Planned | Especially important before exposing recipes broadly in creative tier. |
| Expanded resources | Device details, scales, packs, browser tree and tool catalog resources | High | P1 | Planned | Static resources should work without Live. |
| Expanded prompts | Mix audit, arrangement repair, live-set prep, Push rig, sound redesign | High | P1 | Planned | Current prompt set is useful but small. |
| Preview/verify | Audio bounce, waveform/metadata summary, richer snapshot/diff | High | P2 | Planned | Replace TouchDesigner visual preview with Ableton audio/session preview. |
| Live smoke automation | `smoke:live` against bridge + Live GUI | Medium | P2 | Planned | Keep optional due GUI dependency. |
| Config profiles | Studio/live-set profiles for host, model, tier, output paths | Medium | P2 | Planned | Port only after core CLI stabilizes. |
| HTTP transport | Loopback HTTP/SSE transport with token | Medium | P2 | Planned | Useful for web UIs; keep DNS-rebinding safeguards. |
| Panic/live guard | Stop all clips, all-notes-off, safe mixer/routing boundaries | High | P2 | Planned | Important before autonomous creative mode grows. |
| Package manager | Ableton Packs/M4L/VST discovery | Medium | P3 | Planned | Do not copy tdmcp package install semantics literally. |
| Visual preview/screenshot | Audio bounce/session snapshot instead | Low | P3 | Adapted only | TouchDesigner visual screenshots do not map directly. |
| Palette self-bootstrap | Remote Script installer + MCPB packaging | Low | P3 | Adapted only | TouchDesigner Palette packages are not relevant to Ableton. |

## Execution Order

1. P0: local copilot MVP, safe tier defaults, bridge-offline UI.
2. P1: handoff, doctor LLM checks, install dispatcher, command catalog, watch/watch-build, generated docs.
3. P2: audio preview, live smoke, config profiles, HTTP transport, panic/live guard.
4. P3: pack/plugin discovery and other long-tail adaptations.
