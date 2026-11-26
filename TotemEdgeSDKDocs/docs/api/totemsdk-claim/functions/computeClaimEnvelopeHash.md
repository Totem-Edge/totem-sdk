[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / computeClaimEnvelopeHash

# Function: computeClaimEnvelopeHash()

> **computeClaimEnvelopeHash**(`envelope`): `string`

The canonical envelope hash. This is the commitment a claim link or receipt
can carry; re-serialising the same envelope always produces the same digest.

## Parameters

### envelope

[`ClaimEnvelope`](../interfaces/ClaimEnvelope.md)

## Returns

`string`
