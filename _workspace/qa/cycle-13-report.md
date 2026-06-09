# QA Report — Cycle 13

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**

## Resumo

TD-035/036/037 fechados. Phase 7 finalizada (CI/release workflows + CHANGELOG + version bump 0.0.13). Knowledge 38 devices (76%). Recipes 9 — **7/7 categorias PLAN.md §6 cobertas**.

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDENTE (usuário) |
| TD-005 | 🟡 PENDENTE (sandbox) |
| TD-030 | 🟡 PENDENTE (Push hardware) |
| TD-035 (Docker Windows) | ✅ FECHADO — `docs/distribution.md` com 3 opções (WSL2/host.docker.internal/skip) |
| TD-036 (npm publish prep) | ✅ FECHADO — `.npmignore` + GitHub Actions `release.yml` com npm publish + provenance |
| TD-037 (live_performance recipe) | ✅ FECHADO — `recipes/live_performance/launchpad-rig.json` |

**3 fechados. Aberto: TD-004/005/030 (todos de ambiente real).**

## ADR-0009 — Release versioning

SemVer estrito. Pre-1.0 MINOR pode quebrar (sinalizado em CHANGELOG). Branching: main publicável, feat/* WIP, release/X.Y.Z congelado. Tags `vX.Y.Z`. Release flow descrito.

Linha do tempo planejada:
- v0.0.x — Cycles 1-13 (estado atual)
- v0.1.0-rc.1 — Cycle 14 após smoke real
- v0.1.0 — Cycle 15 após validação
- v1.0.0 — Phase 8 limpa + 50+ devices + 20+ recipes + CI macOS+Windows verde

## Phase 7 finalização

- `.github/workflows/ci.yml` — matriz TS (Node 20+22 × ubuntu+macos) + Python (3.7+3.11) + Docker build.
- `.github/workflows/release.yml` — npm publish (com provenance, skip pre-1.0), ghcr.io push (vX.Y.Z + latest), GitHub Release com `.mcpb` attachment, prerelease auto-detect.
- `CHANGELOG.md` — histórico completo Cycle 1-13 + Unreleased section.
- `package.json` + `dxt/manifest.json` bump para 0.0.13.

## Knowledge — 38 devices (76% PLAN.md §5)

Novos Cycle 13: Meld, Pitch, Multiband Dynamics, EQ Three, Vinyl Distortion.

## Recipes — 9 / 7 categorias

Novos Cycle 13:
- `live_performance/launchpad-rig` (TD-037) — Drums/Bass/Synth/FX + tempo + Limiter.
- `racks/parallel-comp` — NY-style parallel compression.

**Cobertura PLAN.md §6: 7/7 ✅**

| Categoria | Recipe count |
|---|---|
| drums | 1 |
| bass | 1 |
| chords | 1 |
| racks | 2 |
| arrangements | 1 |
| mixing | 2 |
| live_performance | 1 |

## Warnings

### W1 — CHANGELOG.md menciona Cycles 1-13 mas link de compare aponta v0.0.13 para HEAD
Funciona. GitHub gera compare URL automaticamente após push. OK.

### W2 — Tests para Cycle 13 (release workflows + version bump) não escritos
GitHub Actions são "código declarativo" — validação acontece quando rodam no CI. Testes de schema validation poderiam ser adicionados. TD-038 (baixa).

### W3 — Doctor CLI não checa version mismatch entre package.json e dxt/manifest.json
ADR-0009 menciona esse check; não implementado. TD-039 (baixa, trivial).

### W4 — Release workflow assume secrets `NPM_TOKEN` configurado
Sem secret, npm publish step falha. Documentar no `docs/distribution.md`. TD-040 (trivial).

## Recomendação

**PASS Cycle 13.** Phase 7 efetivamente fechada em código. Próximo é o release.

Cycle 14 (Release Candidate):
- **TD-004 smoke real** ← BLOQUEIO.
- TD-038/039/040.
- Tag `v0.1.0-rc.1`.
- +2 devices (rumo a 40/50 = 80%).
- +1 recipe (`mixing/bass-glue` ou similar).
