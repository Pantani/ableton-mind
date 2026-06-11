---
name: usability-flow-audit
description: Audit ableton-mind user flows and developer flows. Use for install, doctor, CLI UX, docs quickstart, MCP tool ergonomics, recipe workflows, error messages, recovery steps and producer-facing usability.
---

# Usability Flow Audit

Use this skill to test whether users can install, diagnose and use ableton-mind without hidden knowledge.

## Workflow

1. Pick real personas: musician installing the bundle, developer using npm, MCP client user, contributor running tests.
2. Trace each flow through README, docs, CLI and actual commands.
3. Run safe parts of the flow. For unavailable Live/hardware steps, mark the exact prerequisite.
4. Check that errors tell users what happened and what to do next.
5. Check MCP tool and recipe ergonomics: names, schemas, defaults, verify/diff output and discoverability.
6. Keep root docs English and localized docs under docs/pt.

## Report Format

Write _workspace/quality-audit/usability-{N}.md with:
- Flow.
- Steps tested.
- Result.
- Friction or failure.
- Proposed copy/CLI/schema change.
- Verification step.
