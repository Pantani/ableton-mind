---
name: mcp-distribution
description: Como distribuir o ableton-mind — bundle DXT/MCPB para Claude Desktop, publicação npm, Dockerfile, Smithery listing, GitHub Actions, scripts de setup, README PT-BR+EN, CLI doctor/agent. Usar quando estiver trabalhando em dxt/, package.json, Dockerfile, docs/, scripts/setup.mjs, .github/workflows/, README.md, CHANGELOG.md, smithery.yaml.
---

# MCP Distribution — Empacotamento, instalação e CI

Skill consumido pelo `distribution-docs-engineer`. Cobre o caminho do dev branch até o usuário final.

## Canais

| Canal | Arquivo | Quem usa |
|---|---|---|
| Claude Desktop | `.mcpb` (Claude Desktop Bundle, ex-`.dxt`) | Artista/músico, 1 clique |
| Claude Code / Cursor / Codex | `npm install @dpantani/ableton-mind` | Devs |
| Smithery | `smithery.yaml` | Multi-client cloud |
| Docker | `Dockerfile` + `docker-compose.yml` | CI, sandbox |
| GitHub release | binário tarball | Air-gapped |

## DXT/MCPB para Claude Desktop

`.mcpb` é um zip com `manifest.json` na raiz + servidor MCP embutido. Anthropic mantém spec.

`dxt/manifest.json`:
```jsonc
{
  "dxt_version": "0.1",
  "name": "ableton-mind",
  "display_name": "Ableton Mind",
  "version": "0.1.0",
  "description": "Build Ableton Live sets from plain language.",
  "author": { "name": "Pantani", "url": "https://github.com/Pantani" },
  "license": "MIT",
  "icon": "icon.png",
  "server": {
    "type": "node",
    "entry_point": "dist/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/dist/index.js"],
      "env": {
        "ABLETON_MIND_HOST": "${user_config.host}",
        "ABLETON_MIND_PORT": "${user_config.port}"
      }
    }
  },
  "user_config": {
    "host": { "type": "string", "default": "127.0.0.1", "description": "Bridge host" },
    "port": { "type": "number", "default": 9876, "description": "Bridge TCP port" }
  },
  "tools_generated": true,
  "prompts_generated": true,
  "compatibility": {
    "platforms": ["darwin", "win32"],
    "runtimes": { "node": ">=20" }
  }
}
```

Build via `scripts/build-dxt.mjs`:
1. Roda `pnpm build` (gera `dist/`).
2. Copia `dist/`, `recipes/`, `live/`, `manifest.json`, `icon.png` para `_dxt-build/`.
3. Zipa → `ableton-mind-0.1.0.mcpb`.
4. Anexa ao release GitHub.

Pós-install no Desktop: usuário 2-clica `.mcpb` → Claude Desktop instala → roda `scripts/setup.mjs` que copia Remote Script para `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`.

## npm publishing

`package.json`:
```jsonc
{
  "name": "@dpantani/ableton-mind",
  "mcpName": "io.github.Pantani/ableton-mind",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=20" },
  "bin": {
    "ableton-mind": "dist/index.js",
    "ableton-mind-agent": "dist/cli/agent.js"
  },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": [
    "dist",
    "recipes",
    "live/AbletonMind",
    "scripts/setup.mjs",
    "scripts/extract-device-schemas.mjs",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "setup": "node scripts/setup.mjs",
    "build": "tsc && tsup && node scripts/copy-assets.mjs",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "lint": "biome check .",
    "format": "biome format --write .",
    "test": "vitest run",
    "test:bridge": "python3 -m unittest discover -s live/tests",
    "typecheck": "tsc --noEmit",
    "doctor": "node dist/cli/doctor.js",
    "build:dxt": "node scripts/build-dxt.mjs",
    "validate:knowledge": "node scripts/validate-knowledge.mjs",
    "validate:recipes": "node scripts/validate-recipes.mjs"
  }
}
```

Publish com `npm publish --provenance --access public` no CI.

## Dockerfile

Multi-stage:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/recipes ./recipes
COPY --from=build /app/live ./live
COPY package.json README.md ./
EXPOSE 9876
CMD ["node", "dist/index.js"]
```

`docker-compose.yml` para dev local com bridge mock.

## CLI doctor

`src/cli/doctor.ts` — diagnose. Saída legível, com emoji opcional.

```ts
import chalk from "chalk";  // ou tinta nativa

const checks = [
  { name: "Node ≥ 20", fn: checkNode },
  { name: "Live encontrado", fn: checkLiveInstalled },
  { name: "Live ≥ 11", fn: checkLiveVersion },
  { name: "Remote Script instalado", fn: checkRemoteScript },
  { name: "Live aberto", fn: checkLiveRunning },
  { name: "Control Surface AbletonMind ativado", fn: checkControlSurface },
  { name: "Porta TCP livre/conectada", fn: checkPort },
  { name: "Handshake bridge OK", fn: checkHandshake },
  { name: "Versões server↔bridge compatíveis", fn: checkVersionMatch },
];

for (const c of checks) {
  const r = await c.fn();
  console.log(`${r.ok ? "✓" : "✗"} ${c.name}${r.hint ? `  →  ${r.hint}` : ""}`);
}
```

Cada check tem `hint` quando falha. Ex: "Remote Script não está em `User Library/Remote Scripts/AbletonMind/`. Rode `npx ableton-mind setup` ou copie manualmente de `node_modules/@dpantani/ableton-mind/live/AbletonMind`."

## Script setup

`scripts/setup.mjs` — instalação 1-shot:
1. Detecta OS.
2. Acha `User Library/Remote Scripts/` (`~/Music/Ableton/User Library/...` no macOS, `~/Documents/Ableton/...` no Windows).
3. Copia (ou symlink se possível) `live/AbletonMind/` para lá.
4. Imprime instruções para abrir Live → Preferences → Link/Tempo/MIDI → Control Surface "AbletonMind".

## Docs (VitePress, PT-BR + EN)

Estrutura `docs/`:
```
docs/
├─ index.md                      (PT-BR home)
├─ guide/
│  ├─ o-que-e.md
│  ├─ instalar.md
│  ├─ primeiro-set.md
│  ├─ recipes.md
│  ├─ prompt-cookbook.md
│  └─ troubleshooting.md
├─ reference/
│  ├─ arquitetura.md
│  ├─ tools.md
│  ├─ recursos.md
│  ├─ bridge-api.md
│  ├─ cli.md
│  ├─ ambiente.md
│  └─ roadmap.md
├─ en/                           (mirror EN)
│  └─ ...
├─ .vitepress/
│  └─ config.ts
└─ public/
   └─ assets/
```

`reference/tools.md` é auto-gerada a partir das `defineTool({ name, description, input })` via script `scripts/generate-tools-doc.mjs`. Não escreve à mão.

## GitHub Actions

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }} }
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm validate:knowledge
      - run: pnpm validate:recipes
  bridge-test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: python -m unittest discover -s live/tests
```

`.github/workflows/release.yml`:
```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, registry-url: 'https://registry.npmjs.org' }
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm build:dxt
      - run: npm publish --provenance --access public
        env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            ableton-mind-*.mcpb
            CHANGELOG.md
```

## CHANGELOG + semver

Conventional commits (`feat:`, `fix:`, `breaking:`, `docs:`, `chore:`) → script `scripts/release.mjs` (ou `changesets`) gera CHANGELOG e bumps version.

## README estrutura

PT-BR como principal:
1. Headline ("ableton-mind — o MCP definitivo para Ableton Live").
2. 1 GIF/screenshot mostrando assistente fazendo set no Live.
3. Promessa em 1 linha.
4. Para artistas vs Para devs (2 colunas).
5. Como começar (1 minuto).
6. Tabela de links: docs PT-BR / docs EN / recipes / roadmap.
7. Status do projeto + license + créditos.

EN espelha (`README.en.md` ou seção depois). Glama badge.

## Antipatterns

| ❌ | ✅ |
|---|---|
| `npm publish` manual sem CI | Publish só do CI, com `--provenance` |
| DXT build em laptop sem checksum | Build no CI, attest do binário |
| Docs à mão e divergem do código | `tools.md` gerado de `defineTool` |
| `doctor` que só diz "deu errado" | Cada falha tem hint acionável |
| README só em inglês | PT-BR como cidadão de primeira |
