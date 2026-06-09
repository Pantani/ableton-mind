---
layout: home

hero:
  name: ableton-mind
  text: O MCP definitivo para Ableton Live
  tagline: "\"Crie um tech house de 128 BPM com kick punchy, bassline rolling, hi-hats com swing.\" — o LLM faz no Live. Sem palpite, sem cola visual."
  actions:
    - theme: brand
      text: Começar
      link: /guide/getting-started
    - theme: alt
      text: Instalar
      link: /guide/installation
    - theme: alt
      text: GitHub
      link: https://github.com/Pantani/ableton-mind

features:
  - icon: 🎛️
    title: 100% LOM
    details: ~180 tools cobrindo os 21 domínios do Live Object Model — transport, tracks, clips, devices, automation, modulação, browser, arrangement, push.
  - icon: 🧠
    title: Knowledge base embutida
    details: 55+ devices nativos do Live 12 com schema de parâmetros (nome, range, default, unidade). LLM nunca chuta "Osc 1 Position".
  - icon: 🍳
    title: Recipes musicais
    details: JSON declarativo para drum kits, basslines, racks e arranjos por gênero. O servidor expande recipes em sequências de tools.
  - icon: 🔁
    title: Verify loop
    details: Depois de cada batch, re-lê o estado e diffa contra a intenção. Tools retornam { ok, verified, diff } — não só ok.
  - icon: 📡
    title: Listeners reativos
    details: Mudanças no LOM viram MCP notifications. O LLM "vê" o usuário tocar, gravar, mudar tempo.
  - icon: 📦
    title: Distribuição completa
    details: DXT one-click pro Claude Desktop, npm publish com provenance, Docker para CI, Smithery listing.
---

## Stack

- **TypeScript + Node 20+** — servidor MCP, `@modelcontextprotocol/sdk`, Zod.
- **Python 3.11** (Live 12) — Remote Script bridge dentro do Live, TCP NDJSON JSON-RPC 2.0 em `127.0.0.1:9876`.
- **Idempotente, transacional, reversível, schema-aware** — invariantes em [PLAN.md §2](https://github.com/Pantani/ableton-mind/blob/main/PLAN.md).

## Status

| Phase | Status |
|---|---|
| 0 — Spike | código pronto, smoke real validado |
| 1 — Paridade `ahujasid` | 22/22 tools |
| 2 — Listeners → MCP notifications | 7 eventos `event.*` |
| 3 — Knowledge base | 55/50+ devices |
| 4 — Automation envelopes | linear/hold |
| 5 — Preview/verify | snapshot+diff |
| 6 — Push 1/2/3 | pad/button/mode |
| 7 — Distribuição | DXT/Docker/Smithery/CI |
| 8 — Long tail | em aberto |

> Atualmente: **31 tools MCP**, **55 device schemas (~800 params indexados)**, **14 recipes** em 7/7 categorias, **verify loop 23/23**, **7 eventos `event.*`**.
