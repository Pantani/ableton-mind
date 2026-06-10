---
name: cross-boundary-qa
description: Integration QA rules for ableton-mind boundaries across TS, Python, knowledge and recipes, including parity checks, contract drift, recipe lint and smoke gates.
---

# Cross-Boundary QA

Use this skill for scripts or reports under scripts/qa/ and _workspace/qa/.

## Principle

Each track owns its internals. QA owns the boundaries where independently correct pieces can still disagree.

## Checks

1. Tool/handler parity: compare defineTool names in src/tools with registered Python handlers.
2. Contract drift: compare Zod schemas and Python dataclasses or returned payloads.
3. Recipe lint: every step.tool exists, inputs match schemas and refs resolve.
4. Knowledge consistency: device IDs, parameter names, indexes, units and URIs are unique and valid.
5. Smoke: run bridge mock smoke in CI; run real Live smoke locally when available.

## Report Format

Write _workspace/qa/cycle-{N}-report.md with status PASS, PASS-WITH-WARNINGS or FAIL. Findings lead with severity, file/line, symptom, repro command or steps, likely owner and suggested fix.

## Gate Guidance

BLOCKER stops the next cycle until fixed. MAJOR can pass with warnings only if the architect records the debt. MINOR is tracked but does not block. Repeated patterns should become lint or codegen proposals.
