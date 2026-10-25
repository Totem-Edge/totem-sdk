[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / verifyDecisionRef

# Function: verifyDecisionRef()

> **verifyDecisionRef**(`ref`, `receipt`): `boolean`

Verify a ref against the runtime-owned receipt. Returns false on any mismatch
(receipt id, kind, provider, issuedAt or any of the four digests).

## Parameters

### ref

[`DecisionRef`](../interfaces/DecisionRef.md)

### receipt

`DecisionReceipt`

## Returns

`boolean`
