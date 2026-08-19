[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / attachCounterpartySignature

# Function: attachCounterpartySignature()

> **attachCounterpartySignature**(`channel`, `partialState`, `counterPartyId`, `counterSignature`, `counterIndices`, `counterClosePackage?`): `object`

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### partialState

`Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>

### counterPartyId

`string`

### counterSignature

`ChannelSignature`

### counterIndices

`SigningIndices`

### counterClosePackage?

[`SignedClosePackage`](../interfaces/SignedClosePackage.md)

## Returns

`object`

### channel

> **channel**: [`OmniaChannel`](../interfaces/OmniaChannel.md)

### signedState

> **signedState**: [`SignedChannelState`](../interfaces/SignedChannelState.md)
