[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / applyFactorySignature

# Function: applyFactorySignature()

> **applyFactorySignature**(`factory`, `partyId`, `signature`): [`ChannelFactory`](../interfaces/ChannelFactory.md)

Merge a co-signer's opening signature (RFC-035 B2). When all N participants
have signed, the opening commits (`'opening'` → `'active'`).

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### partyId

`string`

### signature

`Uint8Array`

## Returns

[`ChannelFactory`](../interfaces/ChannelFactory.md)
