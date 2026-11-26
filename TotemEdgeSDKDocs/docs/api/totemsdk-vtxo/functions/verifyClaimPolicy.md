[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / verifyClaimPolicy

# Function: verifyClaimPolicy()

> **verifyClaimPolicy**(`policy`, `witness`, `ctx`): [`ClaimResult`](../interfaces/ClaimResult.md)

Verify the VTXO binding, then evaluate the pure claim policy.

Binding is deliberately enforced here, not in `@totemsdk/claim`: a policy
bound to `poolId`/`tokenId` must not be evaluated against another pool or
asset. The generic evaluator knows nothing about VTXO pools.

## Parameters

### policy

[`VtxoClaimPolicy`](../type-aliases/VtxoClaimPolicy.md)

### witness

[`ClaimWitness`](../interfaces/ClaimWitness.md)

### ctx

[`ClaimContext`](../interfaces/ClaimContext.md)

## Returns

[`ClaimResult`](../interfaces/ClaimResult.md)
