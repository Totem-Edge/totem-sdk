# npm Publish-State Audit — 2026-10-01

Post-remediation audit after fixing `@totemsdk/mcp-server@0.2.0` packaging
defects. Compares each publishable package's **local version and source state**
against what is live on npm.

## Method

For all 63 `publishable` packages in `scripts/workspace-gates.config.json`:

1. local `package.json` version;
2. `npm view <name> version` (published version) / registry `time` (publish date);
3. `git log -1 --format=%cI -- src` (last source change, tests excluded).

A package **needs a republish** when the published artifact would differ from
local: either (a) the local version is ahead, or (b) source changed after the
publish date (same-version drift — the mcp-server failure mode).

## Findings

### A. Republish required — version already ahead

| Package | Local | npm |
|---|---|---|
| `@totemsdk/edge` | **1.2.0** | 1.1.0 |

### B. Never published (publishable but absent on npm)

| Package | Local | Status |
|---|---|---|
| `@totemsdk/decision` | 0.2.0 | not on npm |
| `@totemsdk/storage` | 0.2.0 | not on npm |
| `@totemsdk/edge-nfc` | 0.2.0 | not on npm |

These are first publishes; siblings that depend on them currently resolve via
workspace links only.

### C. Same-version source drift (published artifact is stale)

36 of the 60 published packages have `src/` commits **after** their npm publish
date. These will not update until bumped and republished.

| Package | npm ver | published | last src |
|---|---|---|---|
| `@totemsdk/agent-policy` | 0.3.0 | 2026-09-14 | 2026-10-01 |
| `@totemsdk/authority` | 1.0.0 | 2026-08-31 | 2026-09-30 |
| `@totemsdk/chain-provider` | 0.2.0 | 2026-08-31 | 2026-09-26 |
| `@totemsdk/connect` | 2.1.0 | 2026-06-22 | 2026-10-01 |
| `@totemsdk/core` | 1.2.10 | 2026-09-08 | 2026-10-01 |
| `@totemsdk/core-wasm` | 1.0.0 | 2026-08-20 | 2026-09-30 |
| `@totemsdk/edge-adapters` | 0.2.0 | 2026-08-31 | 2026-09-29 |
| `@totemsdk/edge-mqtt` | 0.2.4 | 2026-08-19 | 2026-09-30 |
| `@totemsdk/governance` | 0.2.0 | 2026-08-31 | 2026-09-30 |
| `@totemsdk/identity` | 1.0.0 | 2026-08-31 | 2026-09-29 |
| `@totemsdk/industrial-action` | 0.2.0 | 2026-08-31 | 2026-10-01 |
| `@totemsdk/intelligence` | 0.1.0 | 2026-09-14 | 2026-09-19 |
| `@totemsdk/kissvm` | 1.2.0 | 2026-09-08 | 2026-10-01 |
| `@totemsdk/liquidity-bond` | 0.3.0 | 2026-09-08 | 2026-09-30 |
| `@totemsdk/lookup-node` | 0.2.0 | 2026-08-31 | 2026-09-30 |
| `@totemsdk/mcp-server` | 0.2.0 | 2026-08-31 | 2026-09-28 |
| `@totemsdk/minima-rpc` | 0.2.1 | 2026-09-08 | 2026-09-25 |
| `@totemsdk/omnia` | 1.0.1 | 2026-08-31 | 2026-10-01 |
| `@totemsdk/omnia-factory` | 0.2.0 | 2026-08-31 | 2026-09-17 |
| `@totemsdk/omnia-host` | 0.2.1 | 2026-08-31 | 2026-09-30 |
| `@totemsdk/omnia-pool` | 0.1.0 | 2026-09-08 | 2026-09-20 |
| `@totemsdk/omnia-router` | 0.2.0 | 2026-08-31 | 2026-09-17 |
| `@totemsdk/omnia-splice` | 0.2.0 | 2026-08-31 | 2026-09-17 |
| `@totemsdk/omnia-vtxo` | 0.2.0 | 2026-08-31 | 2026-09-16 |
| `@totemsdk/pear` | 0.2.0 | 2026-08-31 | 2026-09-16 |
| `@totemsdk/proofgraph` | 1.0.0 | 2026-08-31 | 2026-09-29 |
| `@totemsdk/provider-bond` | 0.2.0 | 2026-08-31 | 2026-09-29 |
| `@totemsdk/qvac` | 0.1.0 | 2026-09-14 | 2026-09-19 |
| `@totemsdk/recursive-mast` | 0.2.6 | 2026-08-19 | 2026-10-01 |
| `@totemsdk/root-identity` | 1.0.8 | 2026-08-19 | 2026-09-29 |
| `@totemsdk/se-server` | 0.5.0 | 2026-08-31 | 2026-09-30 |
| `@totemsdk/server` | 1.0.2 | 2026-08-19 | 2026-09-16 |
| `@totemsdk/statechain` | 0.2.0 | 2026-08-31 | 2026-09-26 |
| `@totemsdk/tx-builder` | 0.2.0 | 2026-08-31 | 2026-10-01 |
| `@totemsdk/txpow` | 1.0.1 | 2026-09-08 | 2026-09-30 |
| `@totemsdk/wots-lease` | 1.0.0 | 2026-08-20 | 2026-09-29 |

> This list is an upper bound: a `src/` change since publish guarantees the
> artifact is stale, but some changes may be internal-only. Treat it as the
> candidate set, not a mandate to bump all 36.

## Recommended action

1. **mcp-server**: bump `0.2.0 → 0.3.0` (done) and republish — the packaged
   artifact was broken (no shebang, empty index offline, 9 vs 13 tools).
2. **`@totemsdk/edge`**: publish `1.2.0`.
3. **First publishes**: `decision`, `storage`, `edge-nfc` (resolve dependency
   order first — they are widely depended upon).
4. **Section C**: cut a release that bumps and republishes the stale set, in
   topological order via `scripts/create-releases.mjs` + `bump-versions.mjs`.

## Structural fixes (prevent recurrence)

- `@totemsdk/mcp-server` now builds its bundled index on `build`/`prepare` and
  ships `data/`; `scripts/verify-mcp-pack.mjs` gates the packed artifact
  (shebang, exec bit, non-empty bundled index, tool-count parity, clean-room
  npx launch with a real index-backed answer).
- Publish workflow runs the MCP pack gate for `@totemsdk/mcp-server`.
- **Recommended**: add a repo-wide "published-artifact freshness" gate that runs
  the section-C comparison in CI, so same-version drift is caught before release.
