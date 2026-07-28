[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / verifyProof

# Function: verifyProof()

> **verifyProof**(`signedProof`, `options?`): [`ProofVerifyResult`](../interfaces/ProofVerifyResult.md)

Full combined proof verification: signature + payload constraints.

Checks performed:
  1. signature object is present with address, publicKey, signature fields
  2. proofId matches a recomputation from the unsigned fields
  3. WOTS signature is valid over the canonical unsigned proof
  4. expiresAt is not in the past (with configurable graceMs)

## Parameters

### signedProof

[`SignedProof`](../interfaces/SignedProof.md)

### options?

#### graceMs?

`number`

#### now?

`number`

## Returns

[`ProofVerifyResult`](../interfaces/ProofVerifyResult.md)
