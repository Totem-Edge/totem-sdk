[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createProofPortAdapter

# Function: createProofPortAdapter()

> **createProofPortAdapter**(`config`): `EdgeProofPort`

Wraps a ProofProvider (e.g. proof-integritas) as an EdgeProofPort.

When config.seed is provided the returned proof is a SignedProof;
without seed only an UnsignedProof is returned and MUST NOT be
presented as a completed proof.

## Parameters

### config

[`ProofPortConfig`](../interfaces/ProofPortConfig.md)

## Returns

`EdgeProofPort`
