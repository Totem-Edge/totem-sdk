[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / assertClaimEnvelope

# Function: assertClaimEnvelope()

> **assertClaimEnvelope**(`envelope`): `void`

Minimal structural validation. This is not a schema validator: it checks the
properties the policy evaluator depends on and lets the caller validate the
payload with the adapter that owns it.

## Parameters

### envelope

[`ClaimEnvelope`](../interfaces/ClaimEnvelope.md)

## Returns

`void`
