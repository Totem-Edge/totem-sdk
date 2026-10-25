[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / verifyFactorySettlementSignature

# Function: verifyFactorySettlementSignature()

> **verifyFactorySettlementSignature**(`factory`, `txDigest`, `partyId`, `signature`, `verify?`): `boolean`

Verify a remote settlement signature against a factory participant.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### txDigest

`Uint8Array`

### partyId

`string`

### signature

`Uint8Array`

### verify?

(`sig`, `digest`, `pkd`) => `boolean`

## Returns

`boolean`
