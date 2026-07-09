[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / WotsLeaseBundle

# Interface: WotsLeaseBundle

Bundle of `FactoryLeaseOps` + `ChannelSigner` for one factory participant.

In production, wire a real `WotsLeaseProvider` (which satisfies `FactoryLeaseOps`
structurally) and a `ChannelSigner` backed by the participant's WOTS tree key.
In tests, provide mock implementations of all three methods on `leaseProvider`.

The optional `verify` callback overrides the default `wotsVerifyDigest` from
`@totemsdk/core`, allowing test code to inject a no-op verifier without
requiring real WOTS key material.

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
