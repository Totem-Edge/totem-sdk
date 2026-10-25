[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / signSettlementRequest

# Function: signSettlementRequest()

> **signSettlementRequest**(`channel`, `request`, `leaseProvider`, `signer?`): `Promise`\<\{ `indices`: `SigningIndices`; `partyId`: `string`; `signature`: [`ChannelSignature`](../type-aliases/ChannelSignature.md); \}\>

Co-sign a settlement signing request. Used by the counterparty to provide its
half of the eltoo `MULTISIG(2 …)` settlement witness.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### request

[`SettlementSigningRequest`](../interfaces/SettlementSigningRequest.md)

### leaseProvider

`WotsLeaseProvider`

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

## Returns

`Promise`\<\{ `indices`: `SigningIndices`; `partyId`: `string`; `signature`: [`ChannelSignature`](../type-aliases/ChannelSignature.md); \}\>
