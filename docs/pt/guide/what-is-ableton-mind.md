# O que e ableton-mind?

`ableton-mind` permite que um assistente de IA crie e inspecione um set do Ableton Live a partir de linguagem natural. Voce descreve o resultado musical; o assistente usa tools reais do Live, le o set de volta e relata o que mudou.

> "Crie um starter de tech house a 128 BPM: kick four-on-the-floor, bass rolling, hats off-beat, sidechain rack e drop de 16 compassos."

O objetivo nao e sugestao em texto. O objetivo e um set real no Live: tracks, clips, devices, automacao, mixer e diff de verificacao.

## Para quem e

- Produtores que querem sair rapido do zero dentro do Live.
- Performers que precisam de rigs repetiveis, cenas e setups prontos para Push/Launchpad.
- Sound designers que querem nomes e ranges reais de devices.
- Devs que querem uma ponte MCP tipada para o Live Object Model.

Se voce quer os detalhes internos, va para [arquitetura](../architecture). Se quer fazer musica primeiro, comece por [Seu primeiro set no Live](./first-live-set).

## Por que funciona

Muitos fluxos de IA para musica param em conselho. `ableton-mind` foi desenhado com tres camadas concretas:

- **Execucao real**: um Remote Script Python roda dentro do Live e conversa com o servidor MCP TypeScript por JSON-RPC local.
- **Conhecimento real**: 55 schemas de devices do Live, escalas e metadata de recipes ficam embutidos para evitar parametro inventado.
- **Verificacao real**: tools leem estado antes/depois e retornam `{ ok, verified, diff }`.

## Estado atual

O codigo ja passou smoke real no Ableton Live 12.4.1 para operacoes centrais de transport/session/track, e os gates de package validation do `0.1.0` estao verdes. npm, GitHub Release `.mcpb`, MCP Registry e Glama estao publicados; use instalacao via source quando precisar desenvolver ou validar mudancas locais.

A slice 1 da Phase 8 entrega introspeccao read-only de Max for Live/plug-in e descoberta de status Link/remote. Isso nao significa que controle M4L amplo, sidecars VST3, integracao remote DAW ou mobile companion ja estejam disponiveis.

## Proximos passos

1. [Instale via source](./installation).
2. [Faca seu primeiro set no Live](./first-live-set).
3. Deixe o [prompt cookbook](./prompt-cookbook) aberto para ideias.
