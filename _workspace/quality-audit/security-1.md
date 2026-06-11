# Security Supply Chain Audit 1

**Date:** 2026-06-10
**Mode:** read-only audit

## Checks

- `npm audit --omit=dev`: PASS, 0 runtime vulnerabilities.
- `npm audit`: FAIL, dev toolchain vulnerabilities through `vitest`, `vite`, `vitepress` and `esbuild`.
- Lockfile scan: no non-npm registry resolved dependencies observed.
- Static review: package scripts, install scripts, bridge, live-client, Dockerfile and GitHub Actions.

## Findings

### MAJOR: Dev toolchain vulnerabilities

- Evidence: `package.json` uses `vitest`, `vitepress` and Vite-linked tooling; `npm audit` reports 6 dev vulnerabilities, including a critical `vitest` chain and moderate `vite`/`esbuild`.
- Risk: runtime package is clean, but dev/docs/test servers are still a local security surface.
- Suggested fix: update Vitest/Vite/VitePress when compatible, or add an explicit dev-only audit waiver with expiry while keeping `npm audit --omit=dev` as a hard gate.
- Verification: `npm audit --omit=dev`, `npm audit`, `npm test`, `npm run docs:build`.

### MAJOR: GitHub Actions are tag-pinned, not SHA-pinned

- Evidence: `.github/workflows/ci.yml`, `.github/workflows/docs.yml` and `.github/workflows/release.yml` use actions like `actions/checkout@v6`, `actions/setup-node@v6`, Docker actions by version tag.
- Risk: mutable action tags increase supply-chain risk, especially in release jobs with write/package/id-token permissions.
- Suggested fix: pin actions to full SHAs and add Dependabot/Renovate for action updates.
- Verification: `rg 'uses: .*@(v|main|master)' .github/workflows` should return no unwaived results.

### MAJOR: Docker image is not lockfile-strict

- Evidence: `Dockerfile` uses `npm install` in builder and runtime stages, and runtime install can resolve from `package.json`.
- Risk: release image can drift from the audited lockfile.
- Suggested fix: use `npm ci` in builder and `npm ci --omit=dev` in runtime, with `package-lock.json` copied to the runtime stage.
- Verification: `docker build -t ableton-mind:audit .`.

### MAJOR: Bridge has no auth/capability guard if bound remotely

- Evidence: bridge defaults to loopback, but host is configurable in `live/AbletonMind/bridge.py`, `live/AbletonMind/__init__.py` and `live/AbletonMind/__main__.py`; dispatch executes methods without auth.
- Risk: if configured as `0.0.0.0` or tunneled, a network client can mutate Live.
- Suggested fix: reject non-loopback by default unless `ABLETON_MIND_ALLOW_REMOTE=1` is set, and require a token/capability for remote binds.
- Verification: Python tests for remote bind rejection and loopback compatibility.

### MAJOR: NDJSON framing and request queues have no size limits

- Evidence: bridge and TS client buffers accumulate until newline; bridge pending queue is unbounded.
- Risk: oversized frames or many queued calls can consume memory or freeze Live's control surface thread.
- Suggested fix: add max frame bytes, max pending requests, max clients and close sockets on limit breach.
- Verification: unit tests with oversized frame and over-limit pending calls.

### MAJOR: Automation payload validation is too permissive

- Evidence: automation point schemas accept raw numbers; handlers convert to float without finite/range/count validation.
- Risk: `NaN`, `Infinity`, extreme point counts or out-of-range values can corrupt automation or crash handlers.
- Suggested fix: validate `math.isfinite`, range, count limit, curve type and non-negative time.
- Verification: Python tests for invalid automation values returning `INVALID_PARAMS`.

### MINOR: Installer copy path shells out

- Evidence: `scripts/install-remote-script.mjs` imports `execSync` and runs `cp -R "${SRC}" "${target}"`.
- Risk: shell quoting can break on paths with quotes/metacharacters.
- Suggested fix: use `fs.cpSync` or `spawnSync("cp", ["-R", SRC, target])`.
- Verification: installer test with temp paths containing quotes.

### MINOR: `uvx ruff` is not pinned

- Evidence: `package.json` runs `uvx ruff check` without a version pin.
- Risk: Python lint gate can drift between runs.
- Suggested fix: pin `ruff` version through `uvx --from ruff==...`.
- Verification: `npm run lint:py`.

### MINOR: Network capability docs/manifests are inconsistent

- Evidence: DXT/Smithery allow configurable bridge host; safeskill expected capability describes loopback only.
- Risk: users/reviewers can miss that remote host is possible.
- Suggested fix: restrict to loopback by default or require explicit `allow_remote` and reflect it in safeskill.
- Verification: manifest validation test for host config and expected capabilities.

### NICE: Add dependency/security automation

- Evidence: no Dependabot config and no runtime audit/SBOM gate in CI/release.
- Suggested fix: Dependabot for npm/actions/Docker, runtime `npm audit --omit=dev` in CI/release, optional SBOM/provenance for Docker.
