[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / VerifyOptions

# Interface: VerifyOptions

## Properties

### verifyBlindSig?

> `optional` **verifyBlindSig?**: (`sig`, `commitment`, `sePkdHex`) => `boolean`

Override SE blind-signature verification.
Default: `wotsVerifyDigest(fromHex(sig), commitment, fromHex(sePkdHex))`
Tests override because mock SE sigs use SHA3-256.

#### Parameters

##### sig

`string`

##### commitment

`Uint8Array`

##### sePkdHex

`string`

#### Returns

`boolean`

***

### verifyOwnerSig?

> `optional` **verifyOwnerSig?**: (`ownerSig`, `commitment`, `fromPkdHex`) => `boolean`

Override old-owner signature verification per hop.
Default: `wotsVerifyDigest(fromHex(ownerSig), commitment, fromHex(fromPkdHex))`
Tests override because mock owner sigs use SHA3-256.

#### Parameters

##### ownerSig

`string`

##### commitment

`Uint8Array`

##### fromPkdHex

`string`

#### Returns

`boolean`

***

### verifyTransferKey?

> `optional` **verifyTransferKey?**: (`transferKey`, `fromPublicKeyDigest`) => `boolean`

Override transferKey lineage verification.
Default: `hex(derivePKdigest(fromHex(transferKey), 0)) === fromPublicKeyDigest`
Tests override because mock seeds are not real WOTS seeds.

#### Parameters

##### transferKey

`string`

##### fromPublicKeyDigest

`string`

#### Returns

`boolean`
