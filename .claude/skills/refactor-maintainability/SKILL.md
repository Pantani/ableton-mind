---
name: refactor-maintainability
description: Audit and improve maintainability in ableton-mind. Use for complexity, duplication, dead code, dependency boundaries, confusing modules, safe refactor slices and code-quality hardening.
---

# Refactor Maintainability

Use this skill for maintainability audits and bounded refactor work.

## Workflow

1. Run or inspect complexity and dependency checks when available.
2. Search for duplicated validation, repeated command parsing, oversized functions, stale TODOs and unclear ownership boundaries.
3. Rank refactor candidates by risk, user impact and test coverage.
4. Before changing behavior, coordinate with test-coverage-expansion.
5. Refactor in small slices that preserve public contracts.
6. Verify with focused tests plus lint/typecheck/build as needed.

## Refactor Rules

- Do not rename MCP tools, JSON-RPC methods, recipe formats or public docs paths without an ADR and explicit scope.
- Do not introduce abstractions unless they remove real duplication or clarify a boundary.
- Do not mix formatting-only churn with behavior fixes.

## Report Format

Write _workspace/quality-audit/maintainability-{N}.md with:
- Candidate.
- Evidence.
- Risk.
- Suggested slice.
- Required tests.
- Verification.
