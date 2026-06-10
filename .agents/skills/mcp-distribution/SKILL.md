---
name: mcp-distribution
description: Distribution workflow for ableton-mind: MCPB/DXT bundle, npm, Docker, Smithery, GitHub Actions, setup scripts, README, CHANGELOG and docs.
---

# MCP Distribution

Use this skill when working on dxt/, package.json, Dockerfile, docs/, install scripts, workflows, README.md, CHANGELOG.md or smithery.yaml.

## Distribution Targets

| Target | Artifact | Audience |
|---|---|---|
| Codex/Claude Desktop | .mcpb / DXT bundle | one-click users |
| npm | package and CLI bins | developers and MCP clients |
| Docker | image | CI and sandboxed server runs |
| Smithery | listing | MCP discovery |
| GitHub release | bundle and notes | manual installs |

## Rules

- Root repo docs are English. Localized pages live under docs/pt.
- Keep README, docs, CHANGELOG, package metadata, DXT manifest and Smithery metadata aligned.
- Bundle checks must verify dist, manifest version, README, LICENSE and embedded knowledge.
- Install docs must cover Remote Script location, Control Surface activation and doctor troubleshooting.
- Do not add dependencies casually; package size and attack surface matter.

## Verification

Run typecheck, lint, tests, build, build:dxt:check and docs:build when the touched surface requires it. If Live is needed and unavailable, state exactly what remained unverified.
