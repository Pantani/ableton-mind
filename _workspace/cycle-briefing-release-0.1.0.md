# Cycle Briefing - Release Closure v0.1.0

**Date:** 2026-06-10  
**Lead:** architect  
**Goal:** close TD-048 and prepare the repository for `ableton-mind@0.1.0` publication without tagging, pushing, publishing, or uploading anything before the final explicit user gate.

## Initial State

- Required context files were read before this briefing.
- `git status --short --branch --untracked-files=all` in `/Users/pantani/Desktop/projects/art/ableton-mind` reports `## main...origin/main`.
- Cycle 23 leaves TD-048 open: package validation is red for typecheck, tests, build, DXT check, and npm package validation.
- TD-030 remains hardware-blocked: no Push 2/3 hardware is available. It is accepted as post-0.1.0 hardware validation unless release policy changes at final gate.
- The requested `src/llm/*` and `src/cli/chat.ts` WIP surfaces are not present in this checkout at briefing time. If they appear during the cycle, they are release-blocking unless isolated behind an explicit experimental flag and excluded from stable bins/exports.

## Scope Decision for v0.1.0

Ships now:

- Stable MCP server, Live TCP bridge, knowledge base, recipes, prompts/resources, doctor CLI, npm package, `.mcpb` bundle, MCP Registry metadata, Smithery/Glama metadata, Docker/ghcr workflow readiness.
- Remote Script installation from a published package, either through the existing installer or an exposed stable bin.
- Version sync at `0.1.0` across `package.json`, lockfile, `server.json`, `dxt/manifest.json`, and `safeskill.manifest.json`.
- Release docs in English and Portuguese covering source, npm, `.mcpb`, MCP Registry, Smithery/Glama, Docker, and hosted-cloud limitations for local Ableton.

Deferred after v0.1.0:

- Push hardware smoke closure for TD-030, pending physical Push 2/3.
- Any local LLM/copilot/chat feature that is not present, not green, or not intentionally documented as experimental.
- Hosted cloud claims that imply direct control of a local Ableton instance without a reachable local bridge.

## Track Ownership and Touchable Files

### architect

Owns:

- `_workspace/cycle-briefing-release-0.1.0.md`
- `_workspace/PROGRESS.md`
- `_workspace/decisions/*` only if a release contract changes
- `CHANGELOG.md`
- final integration and gate decision

Must coordinate before touching docs/manifests/code owned by another track.

### ts-server-engineer + local-copilot-engineer

Owns:

- `src/**/*.ts`
- `tests/**/*.ts`
- `tsconfig.json`
- `biome.json`
- `eslint.config.js`

Boundaries:

- Do not expose unstable copilot/chat commands in `package.json::bin`.
- Keep public `ableton-mind` and `ableton-mind-doctor` stable.
- Coordinate with distribution before changing bins/exports.

### python-bridge-engineer

Owns:

- `live/AbletonMind/**/*.py`
- `live/__init__.py`
- Python test import/path fixes
- the canonical `test:bridge` command proposal

Boundaries:

- Do not require Push hardware for v0.1.0.
- Coordinate with distribution if installer or package layout changes affect import paths.

### distribution-docs-engineer

Owns:

- `package.json`
- `package-lock.json`
- `scripts/install-remote-script.mjs`
- `scripts/build-dxt.mjs`
- `scripts/copy-assets.mjs`
- `.github/workflows/release.yml`
- `server.json`
- `dxt/manifest.json`
- `safeskill.manifest.json`
- `smithery.yaml`
- `glama.json`
- `docs/distribution.md`
- `docs/pt/distribution.md`

Boundaries:

- Coordinate with TS before bin/export changes.
- Coordinate with Python before changing Remote Script package shape.

### knowledge-curator + recipe-designer

Owns:

- `src/knowledge/**`
- `recipes/**`
- recipe/knowledge path tests only when packaging changes break load behavior

Boundaries:

- No scope expansion. Only fix distribution-caused schema/path/import breakage.

### qa-integration

Owns:

- `_workspace/qa/release-0.1.0-report.md`
- command evidence collection
- tarball and `.mcpb` audits

Boundaries:

- QA does not merge unreviewed production changes. QA can identify blockers and propose minimal fixes.

## Gate Criteria

Required PASS or explicit BLOCKED explanation:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run build:mcpb`
- `npm run build:dxt:check`
- `npm run test:bridge`
- `npm pack --dry-run --json`
- `npm publish --dry-run`
- `npm audit --omit=dev`
- `npm run docs:build`
- `npx --yes @anthropic-ai/mcpb validate dxt/manifest.json` if the validator is available

Package audit requirements:

- npm tarball includes `dist/`, `live/AbletonMind/`, recipes, knowledge assets, docs/readme/license/changelog, installer scripts needed by stable bins.
- npm tarball excludes tests, caches, `__pycache__`, `.pyc`, local workspaces, and build scratch.
- `.mcpb` installs/runs the server and does not promise automatic Ableton Remote Script installation unless that behavior is implemented.

Final release actions are blocked until explicit user confirmation:

- branch creation or release commit
- `git tag`
- `git push`
- GitHub Release publication
- `npm publish`
- MCP Registry submission
- Smithery/Glama publication
- Docker/ghcr push
