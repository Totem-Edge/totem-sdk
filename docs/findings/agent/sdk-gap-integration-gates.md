# sdk-gap:integration-gates — 41 publishable packages declare no test:integration gate

**Kind:** sdk-gap  
**Severity:** medium  
**Status:** open  
**Packages:** `@totemsdk/agent-policy`, `@totemsdk/authority`, `@totemsdk/chain-provider`, `@totemsdk/connect`, `@totemsdk/decision`, `@totemsdk/edge`, `@totemsdk/governance`, `@totemsdk/identity`, `@totemsdk/intelligence`, `@totemsdk/kissvm`, `@totemsdk/liquidity-bond`, `@totemsdk/lookup-client`, `@totemsdk/lookup-node`, `@totemsdk/lookup-protocol`, `@totemsdk/manifest`, `@totemsdk/mcp-server`, `@totemsdk/omnia-factory`, `@totemsdk/omnia-host`, `@totemsdk/omnia-pool`, `@totemsdk/omnia-router`, `@totemsdk/omnia-vtxo`, `@totemsdk/p2p-hub`, `@totemsdk/pear`, `@totemsdk/provider-bond`, `@totemsdk/minima-rpc`, `@totemsdk/pubsub-transport`, `@totemsdk/qvac`, `@totemsdk/realtime`, `@totemsdk/recursive-mast`, `@totemsdk/root-identity`, `@totemsdk/se-server`, `@totemsdk/server`, `@totemsdk/storage`, `@totemsdk/stream-transport`, `@totemsdk/tx-builder`, `@totemsdk/txpow`, `@totemsdk/wallet-adapter`, `@totemsdk/wots-lease`, `@totemsdk/entity`, `@totemsdk/eefi`, `@totemsdk/replication`
**Source:** `/Users/peter.cheek/Downloads/CRYSTAL_LABS/TOTEM/totem-sdk-omnia-p0/scripts/workspace-gates.config.json`

## Context

The maturity gate requires test:integration for RC packages, but these declare none and carry no reasoned notApplicable exemption. They are invisible to `verify-workspace --integration`.

## Impact

A behavioural regression in any of these packages reaches a release with no integration evidence; the canary cannot cover them all on its own.

## Reproduce

```bash
node scripts/verify-workspace.mjs --integration
```

**Expected:** Every RC package either declares test:integration or a reasoned exemption.

**Actual:** Missing: @totemsdk/agent-policy (rc), @totemsdk/authority (rc), @totemsdk/chain-provider (rc), @totemsdk/connect (rc), @totemsdk/decision (beta), @totemsdk/edge (rc), @totemsdk/governance (rc), @totemsdk/identity (rc), @totemsdk/intelligence (beta), @totemsdk/kissvm (rc), @totemsdk/liquidity-bond (rc), @totemsdk/lookup-client (rc), @totemsdk/lookup-node (rc), @totemsdk/lookup-protocol (rc), @totemsdk/manifest (rc), @totemsdk/mcp-server (rc), @totemsdk/omnia-factory (rc), @totemsdk/omnia-host (rc), @totemsdk/omnia-pool (rc), @totemsdk/omnia-router (rc), @totemsdk/omnia-vtxo (rc), @totemsdk/p2p-hub (alpha), @totemsdk/pear (rc), @totemsdk/provider-bond (rc), @totemsdk/minima-rpc (rc), @totemsdk/pubsub-transport (rc), @totemsdk/qvac (beta), @totemsdk/realtime (rc), @totemsdk/recursive-mast (rc), @totemsdk/root-identity (rc), @totemsdk/se-server (rc), @totemsdk/server (rc), @totemsdk/storage (rc), @totemsdk/stream-transport (rc), @totemsdk/tx-builder (rc), @totemsdk/txpow (rc), @totemsdk/wallet-adapter (rc), @totemsdk/wots-lease (rc), @totemsdk/entity (alpha), @totemsdk/eefi (rc), @totemsdk/replication (alpha)

## Where to fix

- `scripts/workspace-gates.config.json`
- `the packages listed in this finding`

### Approach

Add a real test:integration per package (packed-consumer or invariant check), or record a reasoned notApplicable exemption in scripts/workspace-gates.config.json naming an owner.

## Constraints (do not violate)

- Do not add notApplicable entries without an owner and a reason.
- Do not add a script that always exits 0.

## Acceptance criteria

- [ ] node scripts/verify-workspace.mjs --integration reports no missing test:integration for RC packages.
- [ ] Each new suite asserts behaviour, not just an import.

## Verification (run before opening a PR)

```bash
node scripts/verify-workspace.mjs --integration
```

## Definition of done

1. The defect is fixed at the layer named above — not worked around downstream, not masked in the canary.
2. The acceptance criteria above all hold, with tests that fail without the fix.
3. This finding's `status` is moved to `fixed` in `artifacts/canary/src/findings/registry.ts` with the fixing commit.
4. The canary re-runs clean and the pins are updated to the published patch version.

## If it does not reproduce

Do not guess and do not "fix" a neighbouring behaviour. Re-run the reproduction, capture the output, and report back with the divergence (pinned version, platform, and the exact assertion).

## Links

- SDK backlog: `docs/SDK_TODO.md`
