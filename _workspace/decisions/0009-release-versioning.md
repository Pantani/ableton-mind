# ADR 0009 — Release versioning + branching

**Data:** 2026-06-09
**Status:** Aceito
**Autor:** architect

## Contexto

Phase 7 entra em finalização. Precisa política de versão antes do primeiro release público (`v0.1.0` planejado Cycle 14 após smoke real).

## Decisão

### SemVer estrito

`MAJOR.MINOR.PATCH`:
- **MAJOR:** breaking change em qualquer tool MCP (input/output shape, naming, behavior), no protocolo bridge (envelope, error codes, method naming), ou no recipe format.
- **MINOR:** novas tools, novos devices na knowledge, novas recipes, novas notifications, novos handlers no bridge sem mudar os existentes.
- **PATCH:** bug fixes, performance, docs, refactor interno sem mudar API.

Pre-1.0: MINOR pode quebrar (sinalizado em CHANGELOG). Pós-1.0: estrito.

### Branching

- `main` — sempre publicável.
- `feat/*` — work in progress, squash-merge no main.
- `release/X.Y.Z` — congelado para tag + release.

Tags: `vX.Y.Z` (com `v` prefix).

### Release flow

1. `CHANGELOG.md` updated com a versão.
2. Bump `package.json` version + `dxt/manifest.json` version (devem casar — Doctor CLI checa).
3. PR `release/X.Y.Z` → merge.
4. `git tag vX.Y.Z` + push.
5. GitHub Action `release.yml` rodando:
   - npm publish (após pre-1.0)
   - build:dxt → upload artifact + release attachment
   - smithery sync
   - docker build + push para `ghcr.io/Pantani/ableton-mind:vX.Y.Z` e `:latest`

### Pre-releases

Tags com `-rc.N` ou `-beta.N` para release candidates (`v0.1.0-rc.1`).

### Linha do tempo planejada

- `v0.0.x` — Cycles 1-13 (estado atual). API instável.
- `v0.1.0-rc.1` — Cycle 14 após smoke real. Release candidate.
- `v0.1.0` — Cycle 15 após validação.
- `v1.0.0` — Phase 8 (long tail) limpada + 50+ devices + 20+ recipes + smoke CI verde em macOS+Windows.

### Compatibilidade Live

Cada release declara `live_compat: ["12.x", "11.x"]` em README. Tools que dependem de feature Live-12-only marcadas individualmente (já visto em `bass.json`, `drift.json`, `shifter.json`, etc).

## Consequências

- `package.json::version` e `dxt/manifest.json::version` precisam casar. Doctor CLI ganha check (TD-038 baixa).
- CI/release workflow versionados.
- CHANGELOG mandatório em PR (lint via GitHub Action) — Cycle 14+.

## Como aplicar

- Cycle 13: estabelece `CHANGELOG.md`, GitHub Actions, ADR.
- Cycle 14: smoke real → tag `v0.1.0-rc.1`.
