# Cycle 24 Knowledge Summary

## Decision

Added one compact Phase 8 discovery vocabulary in `src/knowledge/discovery.json`.
This is useful for stable labels only: plug-in/device formats, Max for Live
read-only inspection capabilities, and Link status fields.

## Rationale

- Phase 8 slice 1 needs canonical names the LLM can reuse without guessing.
- Third-party plug-in catalogs, Max device catalogs, remote DAW inventories, and
  hardware/mobile capability matrices are intentionally deferred because they
  are runtime facts or unvalidated future integrations.
- The metadata is source-backed and small enough to remain static knowledge.

## Runtime Copy

- `loadDiscoveryMetadata()` validates the file through the knowledge loader.
- `scripts/copy-assets.mjs` copies `src/knowledge/discovery.json` to
  `dist/discovery.json` during `npm run build`.

## Validation

- `npm test -- tests/knowledge-discovery.test.ts` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed and copied `dist/discovery.json`.
- `npx biome check src/knowledge/index.ts tests/knowledge-discovery.test.ts scripts/copy-assets.mjs`
  exited 0. It reported existing `console.log` warnings in `scripts/copy-assets.mjs`.
