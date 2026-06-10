---
name: runtime-release-audit
description: Audit ableton-mind runtime and release readiness. Use for npm pack dry-runs, DXT/MCPB, Docker, docs build, bin smoke, manifest version sync, release workflows, real Live smoke and final publish gates.
---

# Runtime Release Audit

Use this skill to prove that the current checkout can build, package and run without performing irreversible publish actions.

## Workflow

1. Verify version sync across package.json, package-lock.json, dxt/manifest.json, server.json and safeskill.manifest.json.
2. Build and inspect dist and bin entrypoints.
3. Run DXT/MCPB check mode and inspect generated bundle contents when needed.
4. Run npm pack dry-run and compare included files with package expectations.
5. Build docs and Docker image when required by the audit scope.
6. Smoke CLI bins after build.
7. Run mock bridge tests. Run real Live or Push smoke only when the user confirms the environment is ready.
8. Do not run npm publish, gh release create/upload, Docker push or registry submit without explicit confirmation.

## Report Format

Write _workspace/quality-audit/runtime-release-{N}.md with:
- Artifact.
- Command.
- Result.
- Evidence.
- Release risk.
- Blocked checks with prerequisites.
