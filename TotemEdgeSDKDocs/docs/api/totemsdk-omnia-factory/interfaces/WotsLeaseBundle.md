[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / WotsLeaseBundle

# Interface: WotsLeaseBundle

## Properties

### leaseProvider

> **leaseProvider**: [`FactoryLeaseOps`](FactoryLeaseOps.md)

***

### signer

> **signer**: `ChannelSigner`

***

### verify?

> `optional` **verify?**: (`sig`, `commitment`, `pkdHex`) => `boolean`

Optional verify override. When absent, the implementation falls back to
`wotsVerifyDigest(sig, commitment, fromHex(pkd))` from `@totemsdk/core`.

Signature: `(sig, commitment, pkd_hex) => boolean`

#### Parameters

##### sig

`Uint8Array`

##### commitment

`Uint8Array`

##### pkdHex

`string`

#### Returns

`boolean`
