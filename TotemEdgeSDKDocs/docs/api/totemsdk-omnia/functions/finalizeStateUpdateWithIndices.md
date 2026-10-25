[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / finalizeStateUpdateWithIndices

# Function: finalizeStateUpdateWithIndices()

> **finalizeStateUpdateWithIndices**(`unsigned`, `updateSignature`, `updateIndices`, `settlementSignature`, `settlementIndices`): `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>

Assemble a `SignedChannelState` from unsigned data and wallet-supplied indices.

## Parameters

### unsigned

[`UnsignedStateUpdate`](../interfaces/UnsignedStateUpdate.md)

### updateSignature

[`ChannelSignature`](../type-aliases/ChannelSignature.md)

### updateIndices

`SigningIndices`

### settlementSignature

[`ChannelSignature`](../type-aliases/ChannelSignature.md)

### settlementIndices

`SigningIndices`

## Returns

`Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>
