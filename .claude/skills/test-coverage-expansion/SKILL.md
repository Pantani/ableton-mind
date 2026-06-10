---
name: test-coverage-expansion
description: Add or plan missing tests for ableton-mind. Use for untested code, regression tests, coverage gaps, commands without tests, TS tools, Python bridge handlers, CLI scripts, recipes, knowledge, distribution checks and audit-driven fixes.
---

# Test Coverage Expansion

Use this skill when audit findings need tests or when code lacks nearby coverage.

## Workflow

1. Map changed or risky implementation files to existing tests.
2. Identify coverage gaps that protect public behavior, not trivia.
3. Add focused failing tests before fixes when feasible.
4. Keep default tests offline and deterministic. Use fakes for Ableton Live and Push behavior.
5. Prefer existing Vitest and Python unittest patterns.
6. Run focused tests first, then broader suite when the change surface justifies it.

## Coverage Priorities

1. MCP tool schemas, validation errors and verify/diff behavior.
2. JSON-RPC bridge handler shapes and error handling.
3. CLI doctor and install failure modes.
4. Distribution package contents and manifest/version sync.
5. Recipe and knowledge consistency.
6. Regression tests for every BLOCKER or MAJOR audit fix.

## Report Format

Write _workspace/quality-audit/test-coverage-{N}.md with:
- Gap.
- Existing tests checked.
- Test added or proposed.
- Command run.
- Remaining risk.
