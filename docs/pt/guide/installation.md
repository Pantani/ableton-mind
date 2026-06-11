# Instalação

Os caminhos mais rapidos agora sao **npm global** ou o `.mcpb` da GitHub Release. Use instalacao via source para desenvolver o repo ou testar mudancas locais.

## 1. Instalacao via source

```bash
git clone https://github.com/Pantani/ableton-mind.git
cd ableton-mind
npm ci
npm run build
npm run install:remote-script
```

Depois ative `AbletonMind` no Live:

**Live -> Preferences -> Link, Tempo & MIDI -> Control Surface -> AbletonMind**.

## 2. Config do cliente MCP

Para checkout local, aponte o cliente para `dist/index.js`:

```json
{
  "mcpServers": {
    "ableton-mind": {
      "command": "node",
      "args": ["/absolute/path/to/ableton-mind/dist/index.js"]
    }
  }
}
```

Use o path absoluto da sua maquina.

## 3. Claude Desktop `.mcpb`

Baixe `ableton-mind-0.1.1.mcpb` na [GitHub Release v0.1.1](https://github.com/Pantani/ableton-mind/releases/tag/v0.1.1) e arraste para o Claude Desktop.

O repo tambem consegue montar bundle local:

```bash
npm run build:dxt
```

Arraste o `.mcpb` gerado para o Claude Desktop.

## 4. npm global

```bash
npm install -g ableton-mind
ableton-mind
ableton-mind-doctor
```

Estado atual do registry: `ableton-mind@0.1.1` esta publicado no npm.

## 5. Docker

Build local:

```bash
docker build -t ableton-mind .
docker run --rm -i --network host ableton-mind
```

No macOS/Windows com Docker Desktop, talvez seja necessario usar `host.docker.internal` como host da bridge:

```bash
docker run --rm -it \
  -e ABLETON_MIND_HOST=host.docker.internal \
  ableton-mind
```

Util para CI e sandboxes; para uso interativo no desktop, source ou `.mcpb` tendem a ser mais simples.

## 6. Smithery

`smithery.yaml` existe para o caminho de listagem. A indexacao hospedada da Smithery pode atrasar em relacao ao metadata do repo.

## Detalhes completos

A página [Distribuição](../distribution) cobre cada canal em profundidade, incluindo CI, release pipeline e gates de publicação.
