[**@totemsdk/provider-bond**](../index.md)

***

[@totemsdk/provider-bond](../index.md) / verifyBondProof

# Function: verifyBondProof()

> **verifyBondProof**(`proof`, `verifier?`): `Promise`\<[`ProviderBondVerifyResult`](../interfaces/ProviderBondVerifyResult.md)\>

RFC-020 C4: a bond proof is only meaningful when independently verified.
Every proof type (including self-declared `manual`/`declared`) must be
verified by the supplied [BondProofVerifier](../interfaces/BondProofVerifier.md); without one it fails
closed rather than asserting an unbacked `ok`.

## Parameters

### proof

[`BondProofRef`](../interfaces/BondProofRef.md)

### verifier?

[`BondProofVerifier`](../interfaces/BondProofVerifier.md)

## Returns

`Promise`\<[`ProviderBondVerifyResult`](../interfaces/ProviderBondVerifyResult.md)\>
