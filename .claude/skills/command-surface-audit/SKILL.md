---
name: command-surface-audit
description: Audit, classify and run the real ableton-mind command surface. Use whenever package scripts, CI commands, docs commands, bins, "run all commands", stale scripts, broken commands or command coverage are mentioned.
---

# Command Surface Audit

Use this skill to build an evidence-backed command matrix from the current checkout.

## Workflow

1. Inventory commands from package.json scripts, bin entries, .github/workflows, docs snippets and scripts/.
2. Classify each command as safe read/check, local mutating, external read, publish/write or hardware/live.
3. Run safe commands. Use dry-run or check mode for packaging and release paths.
4. Do not run publish/write commands without explicit user confirmation.
5. Record exact failures with the command, output signature, source file and likely owner.
6. Flag commands that exist in docs but not package.json, or package scripts that no workflow/docs can reach.

## Report Format

Write _workspace/quality-audit/command-surface-{N}.md:

| Command | Source | Class | Status | Evidence | Notes |
|---|---|---|---|---|---|

End with:
- Broken commands.
- Stale or undocumented commands.
- Commands blocked by missing Live, hardware, credentials or external services.
- Suggested tests or docs changes.

## Local Execution

When running locally from Codex, use `rtk proxy <command>` for raw commands. Keep raw command names in the report so CI/users can copy them.
