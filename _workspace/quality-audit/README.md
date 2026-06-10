# Quality Audit Workspace

This folder stores artifacts produced by the `ableton-mind-quality-audit` harness.

## File Conventions

Use an incrementing audit number `{N}`:

- `briefing-{N}.md` - scope, command safety policy, assignments and gate criteria.
- `command-surface-{N}.md` - package scripts, bins, CI/docs commands and run results.
- `security-{N}.md` - dependency, script, workflow, bridge, Docker and release risks.
- `usability-{N}.md` - install, doctor, docs, CLI and MCP workflow findings.
- `test-coverage-{N}.md` - missing tests, tests added and remaining gaps.
- `maintainability-{N}.md` - complexity, duplication, boundaries and refactor candidates.
- `runtime-release-{N}.md` - artifact, DXT/MCPB, Docker, docs and release-readiness evidence.
- `report-{N}.md` - consolidated findings ordered by severity.
- `backlog-{N}.md` - accepted fixes, deferred debt and blocked checks.

## Severity

| Severity | Meaning |
|---|---|
| BLOCKER | Must be fixed or explicitly waived before release or broad adoption. |
| MAJOR | Real bug, security risk, broken command or high-friction flow. |
| MINOR | Quality issue that should be fixed but does not block current release state. |
| NICE | Improvement idea with low direct risk. |

## Finding Template

```markdown
### {Severity}: {short title}

- Owner:
- Evidence:
- Repro or command:
- Risk:
- Suggested fix:
- Verification:
- Status: open | fixed | blocked | accepted debt
```

## Command Safety

Do not run publish/write commands by default: `npm publish`, `git push`, `gh release create/upload`, Docker push, registry submission or hardware/live mutation. Record blocked prerequisites instead.
