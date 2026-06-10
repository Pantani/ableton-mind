---
name: ableton-mind-quality-audit
description: Orchestrates the ableton-mind quality audit team whenever the user asks for full repo audit, quality hardening, run/test all commands, security/usability/flow review, refactor audit, coverage expansion, launch readiness, release readiness, regression hunt, or to continue/update/re-run a previous audit. Use this instead of ableton-mind-build for broad quality audits and hardening waves.
---

# ableton-mind-quality-audit - Team Orchestrator

Use this skill for broad quality work: complete audits, command matrix validation, security review, usability and flow review, refactor planning, missing-test coverage, release/runtime readiness and follow-up hardening waves.

Use ableton-mind-build for feature phase execution. Use this skill when the goal is to increase repo quality across existing surfaces.

## Team

| Track | Agent | Domain |
|---|---|---|
| Lead | quality-audit-lead | scope, triage, severity, fan-in, remediation gate |
| Commands | command-surface-auditor | package scripts, bins, CI commands, docs commands |
| Security | security-supply-chain-auditor | dependencies, scripts, bridge safety, workflows, Docker |
| Usability | usability-flow-auditor | install, doctor, docs, CLI errors, MCP ergonomics |
| Coverage | test-coverage-engineer | missing tests, regression tests, offline fakes |
| Maintainability | refactor-maintainability-engineer | complexity, duplication, boundaries, safe refactors |
| Runtime | runtime-release-auditor | package artifacts, DXT/MCPB, Docker, docs, release gates |
| Gate | qa-integration | cross-boundary verification after fixes |

## Phase 0 - Context And Mode

1. Read PLAN.md, _workspace/PROGRESS.md, _workspace/tech-debt.md if present, latest _workspace/qa reports and latest _workspace/quality-audit reports.
2. Read package.json, pyproject.toml, ruff.toml, biome/eslint/tsconfig/vitest config, .github/workflows and Dockerfile.
3. Check git status. Preserve unrelated local changes.
4. Choose mode:

| Mode | When | Action |
|---|---|---|
| Full audit | User asks for complete audit or quality sweep | Create new audit briefing and launch all tracks |
| Targeted audit | User names one area | Launch only relevant tracks plus lead and QA gate |
| Fix wave | User asks to fix audit findings | Read latest report/backlog, add tests first where feasible, patch bounded items |
| Re-run | User asks to re-run or verify | Re-run the command matrix and affected checks only |
| Status | User asks what is pending | Summarize latest report/backlog without launching changes |

## Phase 1 - Briefing

Write _workspace/quality-audit/briefing-{N}.md with:
- User goal and exclusions.
- Current release/project state from _workspace/PROGRESS.md.
- Command matrix sources: package.json, workflows, docs and scripts.
- Side-effect policy for each command class.
- Track assignments and non-overlapping write scopes.
- Gate criteria and expected artifacts.

## Command Safety Policy

Classify every command before execution:

| Class | Examples | Default action |
|---|---|---|
| Safe read/check | typecheck, lint, tests, build, docs build, dxt check, dep checks | Run locally |
| Local mutating | lint:fix, format, install remote script, generated graphs | Ask lead; prefer temporary copy or check mode |
| External read | npm audit, npm view, gh read-only checks | Run if network/auth is available and useful |
| Publish/write | npm publish, git push, gh release create/upload, Docker push, registry submit | Do not run without explicit user confirmation |
| Hardware/live | real Ableton Live or Push smoke | Run only when the user confirms the app/hardware is ready |

In Codex local execution, prefix shell commands with `rtk proxy` when running raw commands from this repo.

## Phase 2 - Parallel Audit

Launch tracks in parallel when their write scopes do not overlap. Read-only tracks may run together. If a track needs to edit files, assign a disjoint ownership boundary and remind it that other agents may be editing the repo.

Required track outputs:
- command-surface-{N}.md: command inventory, run results and stale command findings.
- security-{N}.md: dependency, workflow, bridge and script risk findings.
- usability-{N}.md: setup, doctor, docs, CLI and MCP workflow findings.
- test-coverage-{N}.md: untested surfaces and new tests or proposed tests.
- maintainability-{N}.md: complexity, boundaries, dead code and safe refactor candidates.
- runtime-release-{N}.md: artifact, package, docs, Docker and release-readiness evidence.

## Phase 3 - Fan-In Report

The lead writes:
- _workspace/quality-audit/report-{N}.md with findings ordered by severity.
- _workspace/quality-audit/backlog-{N}.md with immediate fixes, later fixes and blocked checks.

Finding format:
- Severity: BLOCKER, MAJOR, MINOR or NICE.
- Owner.
- Evidence: file/line and command or repro step.
- Risk.
- Suggested fix.
- Verification command.
- Status: open, fixed, blocked or accepted debt.

## Phase 4 - Fix Wave

When the user asks to fix findings or when the audit scope explicitly includes fixes:
1. Fix BLOCKER and MAJOR findings first.
2. Add or identify tests before behavior changes when feasible.
3. Keep patches scoped to the finding.
4. Re-run focused verification after each fix.
5. Ask qa-integration for cross-boundary verification when TS, Python, recipes, knowledge, docs or packaging contracts changed.
6. Update report/backlog statuses and _workspace/tech-debt.md for deferred debt.

## Baseline Verification Matrix

Build the exact matrix from current files, but these commands are expected in this repo when present:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run build:dxt:check
npm run docs:build
npm run deps:validate
npm run complexity
npm run complexity:py
npm run lint:py
python3 -m unittest discover -s live/AbletonMind/tests -t live -v
npm pack --dry-run --json
npm audit --omit=dev
docker build -t ableton-mind:audit .
```

Do not pretend hardware, publish, registry or credentialed checks passed. Report them as blocked with exact prerequisites.

## Test Scenarios

Normal flow:
- User: "criar time para uma auditoria completa, testar todos os comandos, ver seguranca/usabilidade/refactor/testes."
- Expected: create/read briefing, launch all tracks, classify commands, run safe matrix, write report/backlog, then fix scoped findings only when requested or included in the briefing.

Error flow:
- A command requires publish credentials, Ableton Live, Push hardware or external registry write access.
- Expected: do not run it by default; record it as blocked with the exact command, required prerequisite and safer dry-run alternative.

Follow-up flow:
- User: "continua a auditoria" or "corrige os achados."
- Expected: read latest _workspace/quality-audit report/backlog, avoid rediscovery, patch bounded items with tests and update statuses.
