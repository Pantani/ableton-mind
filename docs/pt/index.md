---
layout: home

hero:
  name: ableton-mind
  text: O MCP definitivo para Ableton Live
  tagline: "\"Crie um tech house de 128 BPM com kick punchy, bassline rolling, hi-hats com swing.\" — o assistente constroi no Live, le de volta e diz o que mudou."
  actions:
    - theme: brand
      text: Sou artista
      link: /pt/guide/what-is-ableton-mind
    - theme: alt
      text: Prompt cookbook
      link: /pt/guide/prompt-cookbook
    - theme: alt
      text: Referencia dev
      link: /pt/architecture

features:
  - icon: 🎛️
    title: Tools reais, nao palpite
    details: 33 tools MCP hoje, mirando ~180 nos 21 dominios do Live Object Model — transport, tracks, clips, devices, automation, browser, arrangement, Push e mais.
  - icon: 🧠
    title: Knowledge base embutida
    details: 55+ devices nativos do Live 12 com schema de parâmetros (nome, range, default, unidade). LLM nunca chuta "Osc 1 Position".
  - icon: 🍳
    title: Recipes musicais
    details: 14 recipes JSON declarativas para drums, bass, chords, racks, arrangements, mixing e live performance.
  - icon: 🔁
    title: Verify loop
    details: Depois de cada batch, re-lê o estado e diffa contra a intenção. Tools retornam { ok, verified, diff } — não só ok.
  - icon: 📡
    title: Listeners reativos
    details: Mudanças no LOM viram MCP notifications. O LLM "vê" o usuário tocar, gravar, mudar tempo.
  - icon: 📦
    title: Caminho de distribuicao
    details: Source install funciona hoje. .mcpb one-click, npm, Docker e Smithery estao configurados, mas o RC publico espera package validation.
---

## Dois caminhos

**Eu faco musica.** Comece por [O que e ableton-mind?](./guide/what-is-ableton-mind), depois [instale via source](./guide/installation), faca [seu primeiro set no Live](./guide/first-live-set) e deixe o [prompt cookbook](./guide/prompt-cookbook) aberto.

**Sou dev.** Va direto para [arquitetura](./architecture), [tools](./tools/), [knowledge base](./knowledge/), [recipes](./recipes/) e [distribution](./distribution).

## Status

| Phase | Status |
|---|---|
| 0 — Spike | smoke real validado |
| 1 — Paridade `ahujasid` | 22/22 tools |
| 2 — Listeners → MCP notifications | 7 eventos `event.*` |
| 3 — Knowledge base | 55/50+ devices |
| 4 — Automation envelopes | linear/hold |
| 5 — Preview/verify | snapshot+diff |
| 6 — Push 1/2/3 | pad/button/mode |
| 7 — Distribuição | source ok; RC bloqueado por TD-048 |
| 8 — Long tail | em aberto |

> Atualmente: **33 tools MCP**, **5 prompts**, **3 resources MCP**, **55 device schemas**, **14 recipes** em 7/7 categorias, **verify loop 23/23** e **smoke real PASS no Ableton Live 12.4.1** para core bridge/session/transport/track.

Os canais publicos npm e release bundle ainda nao foram publicados. O proximo passo de engenharia e TD-048: deixar `npm run typecheck`, `npm test`, `npm run build` e `npm run build:dxt:check` verdes, depois cortar `v0.1.0-rc.1`.
