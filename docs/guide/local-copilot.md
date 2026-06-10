# Local copilot

`ableton-mind` includes a local LLM copilot for simple Ableton Live tasks without a paid API. It talks to any OpenAI-compatible chat endpoint and defaults to local Ollama.

## Quick start

```bash
# one-time: install Ollama, then optionally pre-pull the default model
ollama pull qwen2.5:3b

# from a built checkout
npm run build
node dist/index.js chat
```

The chat UI opens at `http://127.0.0.1:4142`.

## Safety tiers

The default tier is **safe**, which is read-only. This is intentional: Live sessions can contain real work, so the local model should inspect before it is allowed to change anything.

```bash
ableton-mind chat              # safe: inspect only
ableton-mind chat --write      # standard: simple transport/track/clip/device changes
ableton-mind chat --creative   # standard + recipes/browser load
ableton-mind chat --read-only  # lock the browser UI to safe mode
```

## Headless prompts

Use `ask` for scripts or quick checks:

```bash
ableton-mind ask "List the tracks and tell me what looks missing"
ableton-mind ask --write "Set the tempo to 128 BPM"
ableton-mind ask --json "What can you inspect without changing Live?"
```

`chat --prompt` uses the same engine:

```bash
ableton-mind chat --prompt "What is in this set?"
```

## Configuration

| Var | Default | Purpose |
|---|---|---|
| `ABLETON_MIND_LLM_BASE_URL` | `http://127.0.0.1:11434/v1` | OpenAI-compatible endpoint |
| `ABLETON_MIND_LLM_MODEL` | `qwen2.5:3b` | Model id |
| `ABLETON_MIND_LLM_API_KEY` | unset | Optional bearer token |
| `ABLETON_MIND_LLM_TIER` | `safe` | `safe`, `standard`, or `creative` |
| `ABLETON_MIND_LLM_MAX_STEPS` | `8` | Max model/tool loop steps |
| `ABLETON_MIND_LLM_TEMPERATURE` | `0.4` | Sampling temperature |
| `ABLETON_MIND_CHAT_PORT` | `4142` | Local browser UI port |

Flags `--model`, `--base-url`, `--port`, `--no-ollama`, and `--no-open` override the defaults for one run.

## Bridge behavior

The local UI can start even when Ableton Live is closed. Static guidance still works, but tools that need Live return a bridge-offline error until the AbletonMind Remote Script is active.

The browser server binds to loopback only and rejects non-loopback Host/Origin requests.
