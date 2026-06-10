# ADR 0012 - Quality Audit Harness Boundaries

**Date:** 2026-06-10
**Status:** Accepted
**Author:** quality-audit-lead

## Context

The existing `ableton-mind-build` harness is optimized for PLAN.md phase execution: feature slices, track ownership, integration and QA gates. The repo now also needs a transversal audit workflow that can test the real command surface, security posture, usability flows, missing tests, maintainability and release/runtime readiness without turning every audit into a feature cycle.

## Decision

Create a sibling orchestrator, `ableton-mind-quality-audit`, with dedicated audit agents:

- `quality-audit-lead`
- `command-surface-auditor`
- `security-supply-chain-auditor`
- `usability-flow-auditor`
- `test-coverage-engineer`
- `refactor-maintainability-engineer`
- `runtime-release-auditor`

The build harness delegates broad quality-audit requests to the new orchestrator. The quality-audit harness writes reports under `_workspace/quality-audit/` and uses `qa-integration` as the final cross-boundary gate when fixes land.

## Consequences

- Feature phase work remains governed by `ableton-mind-build`.
- Audit cycles can run in `audit-only`, `audit-fix`, `re-run`, `targeted` or `status` mode.
- Publish, push, registry, Docker push, real Live mutation and Push hardware checks remain blocked unless the user explicitly confirms the environment and side effects.
- Findings must include evidence, owner, risk, suggested fix and verification command.

## How To Apply

Use `ableton-mind-quality-audit` for requests such as "complete audit", "test all commands", "security/usability review", "refactor audit", "add tests where missing", "launch readiness", "release readiness" or "continue/fix audit findings".
