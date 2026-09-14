[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / verifyIdentityChallengeProof

# Function: verifyIdentityChallengeProof()

> **verifyIdentityChallengeProof**(`proof`, `claimedAddress`, `entityId`): `boolean`

Verify a signature-backed identity proof against a claimed address.
All gates must hold:
 1. the proof's address matches the claimed address;
 2. the public key digest actually owns that address;
 3. the challenge is the domain-separated challenge for this entity+address;
 4. the WOTS signature verifies over the challenge.

## Parameters

### proof

[`IdentityChallengeProof`](../interfaces/IdentityChallengeProof.md)

### claimedAddress

`string`

### entityId

`string`

## Returns

`boolean`
