# Instalação

Quatro canais. Escolha pela audiência.

## 1. Claude Desktop `.mcpb` (recomendado)

Bundle one-click. Baixe `ableton-mind.mcpb` na [release mais recente](https://github.com/Pantani/ableton-mind/releases) e dê duplo-clique. O Claude Desktop registra o servidor e roda o setup do Remote Script automaticamente.

## 2. npm global

```bash
npm install -g ableton-mind
ableton-mind install:remote-script
```

Em `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ableton-mind": { "command": "ableton-mind" }
  }
}
```

## 3. Docker

```bash
docker run --rm -it \
  -e ABLETON_MIND_HOST=host.docker.internal \
  ghcr.io/pantani/ableton-mind:latest
```

Útil para CI e sandboxes — não para uso interativo no desktop (o transport MCP é stdio).

## 4. Smithery

Listing em `smithery.yaml`. Quem usa Smithery para descobrir servidores MCP encontra `ableton-mind` lá.

## Detalhes completos

A página [Distribuição](../distribution) cobre cada canal em profundidade, incluindo CI, release pipeline e gates de publicação.
