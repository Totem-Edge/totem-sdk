[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / verifyVtxoClaim

# Function: verifyVtxoClaim()

> **verifyVtxoClaim**(`vtxo`, `witness`, `ctx`, `options`): `Promise`\<[`ClaimResult`](../interfaces/ClaimResult.md)\>

Authoritative claim verification.

Requires cryptographic signature proof for the claimed signer(s) — a bare
`witness.signers` list is rejected. The policy is then evaluated with only
the verified signer identities. Callers must supply a real signature
verifier (e.g. WOTS verification against the signer's public key) and, on
the authoritative path, the chain tip so a caller-chosen future block is
rejected (OMN-007).

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### witness

[`ClaimWitness`](../interfaces/ClaimWitness.md)

### ctx

[`ClaimContext`](../interfaces/ClaimContext.md)

### options

[`VerifyClaimOptions`](../interfaces/VerifyClaimOptions.md)

## Returns

`Promise`\<[`ClaimResult`](../interfaces/ClaimResult.md)\>
