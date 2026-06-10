# Instalação

O caminho funcional hoje e **instalacao via source**. Os canais publicos npm, GitHub Release e `.mcpb` one-click estao configurados no repo, mas ainda nao foram publicados.

## 1. Instalacao via source (atual)

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

## 3. Claude Desktop `.mcpb` (bundle local)

O repo ja consegue montar bundle local:

```bash
npm run build:dxt
```

Arraste o `.mcpb` gerado para o Claude Desktop. Downloads publicos entram depois do gate manual final do `0.1.0`.

## 4. npm global (apos publicacao)

Comando planejado depois da publicacao:

```bash
npm install -g ableton-mind
ableton-mind
ableton-mind-doctor
```

Estado atual do registry: `ableton-mind` ainda nao esta publicado no npm.

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

`smithery.yaml` existe para o caminho de release. Publique depois do gate manual final de release.

## Detalhes completos

A página [Distribuição](../distribution) cobre cada canal em profundidade, incluindo CI, release pipeline e gates de publicação.
