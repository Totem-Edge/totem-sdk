[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / evaluateClaim

# Function: evaluateClaim()

> **evaluateClaim**(`policy`, `witness`, `ctx`): [`ClaimResult`](../interfaces/ClaimResult.md)

Pure authorization evaluator. May be used offline.

This decides *who may claim* from the signer set and the supplied context. It
does not verify signatures and does not check settlement-specific bindings.

## Parameters

### policy

[`ClaimPolicy`](../type-aliases/ClaimPolicy.md)

### witness

[`ClaimWitness`](../interfaces/ClaimWitness.md)

### ctx

[`ClaimContext`](../interfaces/ClaimContext.md)

## Returns

[`ClaimResult`](../interfaces/ClaimResult.md)
