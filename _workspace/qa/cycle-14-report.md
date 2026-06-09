# QA Report — Cycle 14 (Release Candidate prep)

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**

## Resumo

TD-038/039/040 fechados. Knowledge atinge **40/50 = 80%** PLAN.md §5. Recipes 10. Doctor CLI ganha 6º check (version sync). Versão bumped para 0.0.14.

**Bloqueio para tag v0.1.0-rc.1: TD-004 (smoke real) — depende do usuário.**

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDENTE (usuário) — BLOQUEIA rc.1 |
| TD-005 | 🟡 PENDENTE (sandbox) |
| TD-030 | 🟡 PENDENTE (Push hardware) |
| TD-038 (workflow tests) | ✅ FECHADO — `tests/distribution-validation.test.ts` (14+ casos) |
| TD-039 (version sync) | ✅ FECHADO — `checkVersionSync()` em Doctor CLI |
| TD-040 (CI secrets) | ✅ FECHADO — `docs/distribution.md` §5b |

**3 fechados. Aberto: TD-004/005/030 (todos de ambiente real).**

## Doctor CLI — 6 checks

1. Node.js >= 20
2. Remote Script instalado
3. Bridge em :9876
4. Knowledge base válida
5. Recipes válidas
6. **Version sync (pkg ↔ DXT)** ← NEW Cycle 14

Em ambiente instalado via npm sem `dxt/manifest.json` empacotado, check é `ok: true` com detail "skip" (graceful).

## Distribution validation — TD-038

`tests/distribution-validation.test.ts` cobre:
- **Version sync:** `package.json::version === dxt/manifest.json::version` + SemVer regex.
- **CHANGELOG:** existe, starts with `# Changelog`, tem Unreleased section, menciona current version.
- **GitHub workflows:** ci.yml + release.yml parseáveis, referenciam npm/python/docker, permissions OIDC corretas.
- **Dockerfile:** multi-stage Node 20 + CMD aponta para dist/.
- **smithery.yaml:** commandFunction + configSchema + ABLETON_MIND_HOST presentes.
- **.npmignore:** exclude src/live/tests, mas mantém recipes/ (não está na ignore).
- **README + docs:** README.md + README.en.md + docs/distribution.md + docs/smoke-test.md existem.

14 assertions/it blocks.

## Knowledge — 40 devices (80% PLAN.md §5)

Novos Cycle 14: Drum Buss (drum bus all-in-one) + Redux (bit crusher).

## Recipes — 10

Novo: `chords/lofi-jazz` — Operator (Rhodes) + Redux + Vinyl Distortion + Cmaj7→Am7→Fmaj7→G7 progression.

## Versão: 0.0.14

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Total tools MCP: 31 (sem mudança)

## Warnings

### W1 — TD-004 ainda bloqueia rc.1
Sem smoke real, não é responsável taggar `v0.1.0-rc.1`. Pre-1.0 ciclos podem continuar adicionando devices/recipes mas a release oficial precisa de validação contra Live.

### W2 — distribution-validation tests dependem de cwd
Tests resolvem `REPO_ROOT` via `import.meta.url`. Funcionam em qualquer cwd. ✓

### W3 — Drum Buss e Redux têm params com unidade ambígua
Alguns Drive params são `0..1 linear` no UI mas mapeiam para curva no engine. Knowledge documenta valor cru — LLM precisa entender que 0.5 != metade audível. Documentação geral. Não bloqueia. TD-041 (baixa).

### W4 — CI workflow só roda em PR/push
Não roda em release tag commits. Mas `release.yml` re-roda os checks. OK.

## Recomendação

**PASS Cycle 14.** Sistema pronto para release. Quando TD-004 PASS:

```bash
git checkout -b release/0.1.0-rc.1
# bump package.json + dxt/manifest.json para 0.1.0-rc.1
# atualiza CHANGELOG
git commit -m "release: v0.1.0-rc.1"
git tag v0.1.0-rc.1
git push origin v0.1.0-rc.1
```

Release workflow dispara automaticamente.

## Próximo — Cycle 15

- **TD-004 smoke** (bloqueio).
- Tag `v0.1.0-rc.1` (após smoke PASS).
- TD-041 docs ambíguas.
- +5 devices (Spectral Blur, Drift Engine, Resonator, Beat Repeat, External Audio Effect) → meta 45 total.
- +2 recipes.
