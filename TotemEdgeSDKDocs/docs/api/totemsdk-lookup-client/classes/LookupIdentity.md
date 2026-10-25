[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / LookupIdentity

# Class: LookupIdentity

## Accessors

### maxUses

#### Get Signature

> **get** **maxUses**(): `number`

Total signatures this identity can produce.

##### Returns

`number`

***

### rootPublicKey

#### Get Signature

> **get** **rootPublicKey**(): `string`

Hex of the 32-byte WOTS/TreeKey public key (what verifiers need).

##### Returns

`string`

***

### uses

#### Get Signature

> **get** **uses**(): `number`

Number of signatures consumed so far.

##### Returns

`number`

## Methods

### sign()

> **sign**(`digest`): `object`

Sign a 32-byte digest, consuming one use. Returns { signature, nonce } where
`nonce` is the use index that was consumed (the anti-replay value to put on
the wire).

#### Parameters

##### digest

`Uint8Array`

#### Returns

`object`

##### nonce

> **nonce**: `number`

##### signature

> **signature**: `Uint8Array`

***

### fromSeed()

> `static` **fromSeed**(`seed`, `options?`): `LookupIdentity`

Build a lookup identity from a 32-byte seed (low-level primitive / tests).

Production deployments should use [LookupIdentity.fromWallet](#fromwallet) so the
lookup identity is the same root identity used elsewhere, with its watermark
persisted (see `UnifiedIdentityWallet.getWatermarkState`).

#### Parameters

##### seed

`Uint8Array`

##### options?

[`LookupIdentityOptions`](../interfaces/LookupIdentityOptions.md) = `{}`

#### Returns

`LookupIdentity`

***

### fromWallet()

> `static` **fromWallet**(`wallet`, `options?`): `LookupIdentity`

RFC-032 §9 Q1: use the root identity as the lookup identity.

Signs with the wallet's root key (`slot: 'root'`) or a child (numeric slot),
advancing the wallet's forward-only watermark after each signature. Persist
the wallet's `getWatermarkState()` so the counter survives restarts and no
WOTS leaf is ever reused.

#### Parameters

##### wallet

`UnifiedIdentityWallet`

##### options?

[`FromWalletOptions`](../interfaces/FromWalletOptions.md) = `{}`

#### Returns

`LookupIdentity`
