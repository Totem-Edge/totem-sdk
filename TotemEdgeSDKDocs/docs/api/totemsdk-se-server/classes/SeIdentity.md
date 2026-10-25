[**@totemsdk/se-server**](../index.md)

***

[@totemsdk/se-server](../index.md) / SeIdentity

# Class: SeIdentity

## Methods

### getPublishedIdentity()

> **getPublishedIdentity**(): [`SePublishedIdentity`](../interfaces/SePublishedIdentity.md)

#### Returns

[`SePublishedIdentity`](../interfaces/SePublishedIdentity.md)

***

### sign()

> **sign**(`message`): `Promise`\<[`SeSignature`](../interfaces/SeSignature.md)\>

Lease the next child leaf, sign `message` with it, and commit (the
off-chain transfer blind-signature path). The leaf is burned, never reused,
if signing fails.

#### Parameters

##### message

`string`

#### Returns

`Promise`\<[`SeSignature`](../interfaces/SeSignature.md)\>

***

### signChild()

> **signChild**(`message`): `Promise`\<[`SeSignature`](../interfaces/SeSignature.md)\>

Off-chain transfer blind-signature (leased child leaf).

#### Parameters

##### message

`string`

#### Returns

`Promise`\<[`SeSignature`](../interfaces/SeSignature.md)\>

***

### signRoot()

> **signRoot**(`message`): `Promise`\<[`SeSignature`](../interfaces/SeSignature.md)\>

On-chain claim co-signature (leased root leaf; verifies against the published root).

#### Parameters

##### message

`string`

#### Returns

`Promise`\<[`SeSignature`](../interfaces/SeSignature.md)\>

***

### create()

> `static` **create**(`options`): `Promise`\<`SeIdentity`\>

#### Parameters

##### options

[`SeIdentityOptions`](../interfaces/SeIdentityOptions.md)

#### Returns

`Promise`\<`SeIdentity`\>

***

### verify()

> `static` **verify**(`message`, `signature`, `published`): `Promise`\<`boolean`\>

Verify an SE signature. A `child` signature must be a member of the
member's root `OwnershipProof`; a `root` signature must be the published
root identity itself. Either way the one-time signature must verify over
`message`.

#### Parameters

##### message

`string`

##### signature

[`SeSignature`](../interfaces/SeSignature.md)

##### published

[`SePublishedIdentity`](../interfaces/SePublishedIdentity.md)

#### Returns

`Promise`\<`boolean`\>
