# Distribuicao

Como o `ableton-mind` chega ao usuario final no release `0.1.0`.

## Estado do release

`0.1.0` esta preparado localmente, mas nao publicado ate o gate manual final. Nao assuma que npm, GitHub Release, MCP Registry, Smithery, Glama ou ghcr.io estao no ar antes dos comandos de publicacao.

A integracao com Ableton tem duas partes:

- MCP server: processo Node.js iniciado por Claude Desktop, Codex, Cursor, npm, Docker, Smithery ou outro cliente MCP.
- Remote Script: arquivos Python em `live/AbletonMind/` que precisam ser instalados na User Library do Ableton Live e ativados nas preferencias do Live.

Canais hospedados conseguem rodar o MCP server, mas nao controlam um Ableton Live local sem acesso de rede ao bridge do Remote Script.

O bridge do Remote Script usa `127.0.0.1` por padrao e rejeita hosts que nao sejam loopback, exceto quando `ABLETON_MIND_ALLOW_REMOTE=1` estiver definido. Use isso apenas atras de uma fronteira de rede/OS confiavel.

## Instalacao via source

Use este caminho para desenvolvimento ou validacao de checkout local.

```bash
npm ci
npm run build
npm run install:remote-script
npm run test:bridge
npm start
```

O install de desenvolvimento usa symlink por padrao. Reabra o Control Surface no Live depois de editar para recarregar o script.

```bash
node scripts/install-remote-script.mjs --check
node scripts/install-remote-script.mjs --copy --force
```

## npm

Apos publicar:

```bash
npm install -g ableton-mind
ableton-mind-install-remote-script
ableton-mind-doctor
ableton-mind
```

O pacote npm inclui:

- servidor compilado em `dist/`
- recipes e knowledge assets de runtime
- runtime do Remote Script em `live/AbletonMind/`, sem testes/cache
- `ableton-mind-install-remote-script` para instalar o Remote Script na User Library do Ableton
- arquivos de metadata/listing dos registries

Valide antes de publicar:

```bash
npm pack --dry-run --json
npm publish --dry-run
```

## Claude Desktop `.mcpb`

Build local:

```bash
npm run build
npm run build:mcpb
```

Instale arrastando `build/ableton-mind-0.1.0.mcpb` para o Claude Desktop ou usando um instalador MCPB.

O bundle instala e roda o MCP server Node. Ele tambem inclui os arquivos do Remote Script e o installer para referencia, mas o Claude Desktop nao copia esses arquivos automaticamente para o Ableton Live. Instale o Remote Script separadamente pelo installer npm/source e depois ative no Live:

Live -> Preferences -> Link/Tempo/MIDI -> Control Surface -> AbletonMind.

## MCP Registry

`server.json` e o manifesto do MCP Registry. Ele usa o nome:

```text
io.github.Pantani/ableton-mind
```

Antes de submeter, confira a sincronizacao de versao:

```bash
node -e "const p=require('./package.json'),s=require('./server.json'); console.log(p.version, p.mcpName, s.name, s.version, s.packages[0].version)"
```

Submeta apenas depois que o pacote npm e o asset da GitHub Release existirem.

## Smithery e Glama

`smithery.yaml` e `glama.json` sao metadata para canais de catalogo/hosting.

```bash
smithery publish
```

Smithery/Glama ajudam com descoberta e hosting remoto do MCP server. Eles ainda precisam conseguir acessar o bridge local do Ableton do usuario. Para a maioria dos musicos, npm local ou `.mcpb` sao os caminhos principais.

## Docker e ghcr.io

Build local:

```bash
docker build -t ableton-mind .
docker run --rm -i --network host ableton-mind
```

Tags do workflow de release para versoes estaveis:

```text
ghcr.io/pantani/ableton-mind:v0.1.0
ghcr.io/pantani/ableton-mind:latest
```

Prerelease tags mantem apenas a tag exata da versao e nao movem `latest`.

### macOS / Linux

`--network host` deixa o container acessar `127.0.0.1:9876` no Linux. No Docker Desktop para macOS, `host.docker.internal` costuma ser mais confiavel:

```bash
docker run --rm -i \
  -e ABLETON_MIND_HOST=host.docker.internal \
  -e ABLETON_MIND_PORT=9876 \
  ableton-mind
```

### Windows

A rede do Docker Desktop varia por backend. Prefira WSL2 quando possivel:

```bash
docker run --rm -i \
  -e ABLETON_MIND_HOST=host.docker.internal \
  -e ABLETON_MIND_PORT=9876 \
  ableton-mind
```

Se o container nao conseguir acessar o bridge, use npm ou `.mcpb` localmente.

Para um container ou MCP server hospedado que realmente precise acessar o Live a partir de outro host, defina `ABLETON_MIND_HOST` no lado do Remote Script e habilite explicitamente `ABLETON_MIND_ALLOW_REMOTE=1`. Nao exponha o bridge em rede nao confiavel.

## Workflow de release

`.github/workflows/release.yml` roda em tags `v*`. Ele valida sync de versao dos manifestos, roda typecheck/lint/tests/build, gera o `.mcpb`, cria ou atualiza a GitHub Release, faz push de imagens ghcr.io e publica npm apenas quando isso estiver explicitamente habilitado.

Comportamento do npm:

- prerelease tags com `-` sao ignoradas
- tags estaveis publicam apenas com `ABLETON_MIND_AUTO_NPM_PUBLISH=true` e `NPM_TOKEN`
- publish manual continua sendo o padrao para `0.1.0`

Secrets/variables de GitHub Actions:

| Nome | Uso |
|---|---|
| `NPM_TOKEN` | publish npm opcional com provenance |
| `ABLETON_MIND_AUTO_NPM_PUBLISH` | variavel do repo que habilita publish npm automatico |
| `GITHUB_TOKEN` | GitHub Release e push para ghcr.io |

## Doctor CLI

```bash
ableton-mind-doctor
```

O doctor verifica Node, instalacao do Remote Script, acesso ao bridge, knowledge assets, recipes e imports dos primitivos MCP.
