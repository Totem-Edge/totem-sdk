[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / computeVtxoClaimPreimage

# Function: computeVtxoClaimPreimage()

> **computeVtxoClaimPreimage**(`vtxo`, `witness`, `ctx`, `signer`): `Uint8Array`

The canonical bytes a claimant must sign. Binds the VTXO identity, the
claimed signer, the policy context (block, path, scope, HTLC, preimage) and
the vesting amount so a signature cannot be replayed in another context.

## Parameters

### vtxo

`Pick`\<[`OmniaVtxo`](../interfaces/OmniaVtxo.md), `"vtxoId"` \| `"poolId"` \| `"tokenId"` \| `"amount"` \| `"owner"`\>

### witness

[`ClaimWitness`](../interfaces/ClaimWitness.md)

### ctx

[`ClaimContext`](../interfaces/ClaimContext.md)

### signer

`string`

## Returns

`Uint8Array`
