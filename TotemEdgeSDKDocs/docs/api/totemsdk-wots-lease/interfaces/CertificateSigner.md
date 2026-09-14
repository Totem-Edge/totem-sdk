[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / CertificateSigner

# Interface: CertificateSigner

Identity used to authenticate lease certificates (Layer 4/5).

A certificate's `signature` is a signature over the canonical certificate
payload (see certificate.ts). Verifiers reject unsigned certificates.

## Properties

### name?

> `optional` **name?**: `string`

Identity label stored on issued certificates via `issuedBy`.

***

### publicKeyDigest

> **publicKeyDigest**: `string`

Hex (0x-prefixed or bare) public key digest of the issuing identity.

## Methods

### sign()

> **sign**(`message`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Sign the canonical certificate message.

#### Parameters

##### message

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### verify()?

> `optional` **verify**(`message`, `signature`): `Promise`\<`boolean`\>

Verify a signature over the canonical certificate message.

#### Parameters

##### message

`Uint8Array`

##### signature

`Uint8Array`

#### Returns

`Promise`\<`boolean`\>
