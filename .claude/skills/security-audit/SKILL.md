---
name: security-audit
description: Security and supply-chain audit for ableton-mind. Use for dependency audit, install scripts, JSON-RPC bridge safety, workflow permissions, Docker, secrets, provenance, path handling, child processes and release security.
---

# Security Audit

Use this skill for practical security review of ableton-mind.

## Workflow

1. Inspect package scripts before executing them.
2. Run dependency audit when available: `npm audit --omit=dev`.
3. Search for risky surfaces: child processes, eval-like execution, filesystem writes, network listeners, path joins, environment variables and secret use.
4. Review JSON-RPC bridge input validation, handler dispatch, error handling, localhost exposure and listener notifications.
5. Review GitHub Actions permissions, token use, release provenance and Docker publishing.
6. Rank issues by exploitability and affected user.

## Finding Requirements

Each finding must include:
- Severity.
- File and line when possible.
- Attack or misuse path.
- Why this matters for a local MCP/Remote Script project.
- Suggested fix.
- Verification command or review step.

## Report Format

Write _workspace/quality-audit/security-{N}.md with findings that include all required fields from the "Finding Requirements" section above.

## Non-Goals

Do not report generic "dependency exists" noise without an affected path. Do not run external write or publish actions while auditing.
