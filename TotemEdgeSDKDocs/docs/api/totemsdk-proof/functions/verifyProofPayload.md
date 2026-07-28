[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / verifyProofPayload

# Function: verifyProofPayload()

> **verifyProofPayload**(`signedProof`, `graceMs?`, `now?`): `boolean`

Check the payload constraints of a SignedProof (expiry only).
Returns false if expiresAt is in the past.

## Parameters

### signedProof

[`SignedProof`](../interfaces/SignedProof.md)

### graceMs?

`number` = `0`

optional tolerance in ms for clock skew (default 0).

### now?

`number`

optional explicit timestamp (ms). When provided, the check is
  deterministic and does NOT call Date.now(). If omitted, Date.now() is used.

## Returns

`boolean`
