# PROGRESS — ableton-mind

**Estado:** Phases 1-7 fechadas em código. Knowledge 80%. Recipes 10. Versão 0.0.14. **Pronto para v0.1.0-rc.1 condicionado a smoke real (TD-004).**
**Última atualização:** 2026-06-09

## Fases
- **Phase 0:** código completo. Smoke pendente (TD-004) — **gate v0.1.0-rc.1**.
- **Phase 1 — ahujasid:** ✅ 22/22+.
- **Phase 2 — Listeners:** ✅ 7 eventos.
- **Phase 3 — Knowledge:** **40/50+ devices (80%)** 🎯.
- **Phase 4 — Automation:** ✅.
- **Phase 5 — Preview/verify:** ✅.
- **Phase 6 — Push:** ✅.
- **Phase 7 — Distribuição:** ✅ Doctor (6 checks) + Docker + Smithery + CI/Release workflows + CHANGELOG + ADR-0009 + validation tests.
- **Recipes (Trilha C):** 10 recipes em 7/7 categorias.
- **Verify loop:** 23/23.

## Ciclos

| # | Status |
|---|---|
| 1-13 | PASS-WITH-WARNINGS (13) |
| 14 | PASS-WITH-WARNINGS |

Detalhe Cycle 14: [qa/cycle-14-report.md](qa/cycle-14-report.md).

## Cycle 14 — entregas

**Tech debt fechado:** TD-038 (workflow tests), TD-039 (version sync check), TD-040 (CI secrets docs).

**Doctor CLI:** 6º check (version sync pkg ↔ DXT), implementado com graceful skip em ambiente sem manifest.

**Tests:** `tests/distribution-validation.test.ts` — 14+ casos cobrindo pkg/dxt sync, CHANGELOG, GitHub workflows, Dockerfile, smithery.yaml, .npmignore, README/docs presence.

**Docs:** `docs/distribution.md §5b` — secrets do release workflow + dry-run local.

**Knowledge — 40 devices (80%) 🎯:**
- +2: Drum Buss, Redux.

**Recipes — 10:**
- +`chords/lofi-jazz` — Operator + Redux + Vinyl Distortion + Cmaj7→Am7→Fmaj7→G7.

**Versão:** 0.0.14 (sync pkg + manifest + CHANGELOG).

## Decisões abertas
Nenhuma.

## Tech debt aberto

[tech-debt.md](tech-debt.md). **Apenas 4 itens** — 1 ⚠medium (TD-004 bloqueio release), 3 baixos.

## Próximo — Cycle 15 (Release)

**Pré-condição CRÍTICA: TD-004 smoke real PASS.**

Procedimento release:
```bash
git checkout -b release/0.1.0-rc.1
# bump package.json + dxt/manifest.json para 0.1.0-rc.1
# atualizar CHANGELOG
git tag v0.1.0-rc.1
git push origin v0.1.0-rc.1
```

Release workflow dispara: build → test → docker push ghcr.io + GitHub Release com `.mcpb`.

Adicionalmente:
- TD-041 (knowledge docs ambíguas).
- +5 devices (rumo a 45/50).
- +2 recipes.

Disparar com "continuar" ou "começar Cycle 15".
