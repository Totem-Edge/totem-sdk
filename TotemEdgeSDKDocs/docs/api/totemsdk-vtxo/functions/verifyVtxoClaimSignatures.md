[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / verifyVtxoClaimSignatures

# Function: verifyVtxoClaimSignatures()

> **verifyVtxoClaimSignatures**(`vtxo`, `witness`, `ctx`, `verifySignature`): `Promise`\<\{ `errors`: `string`[]; `signers`: `string`[]; `valid`: `boolean`; \}\>

Verify every supplied signature over its canonical claim preimage and return
the identities actually backed by a valid signature.

This is deliberately separate from [verifyClaimPolicy](verifyClaimPolicy.md): the policy
decides *who* may claim; this decides *whether they proved it*.

## Parameters

### vtxo

`Pick`\<[`OmniaVtxo`](../interfaces/OmniaVtxo.md), `"vtxoId"` \| `"poolId"` \| `"tokenId"` \| `"amount"` \| `"owner"`\>

### witness

[`ClaimWitness`](../interfaces/ClaimWitness.md)

### ctx

[`ClaimContext`](../interfaces/ClaimContext.md)

### verifySignature

[`ClaimSignatureVerifier`](../type-aliases/ClaimSignatureVerifier.md)

## Returns

`Promise`\<\{ `errors`: `string`[]; `signers`: `string`[]; `valid`: `boolean`; \}\>
