[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / verifyChannelParticipantIdentity

# Function: verifyChannelParticipantIdentity()

> **verifyChannelParticipantIdentity**(`participant`): [`IdentityVerificationResult`](../interfaces/IdentityVerificationResult.md)

Verify a channel participant's root-identity anchor (RFC-037-A).

Fails closed: any malformed proof, mismatch, or missing child key ⇒ invalid.
A participant without `identity` is valid (identity is optional).

## Parameters

### participant

`ChannelParticipant`

## Returns

[`IdentityVerificationResult`](../interfaces/IdentityVerificationResult.md)
