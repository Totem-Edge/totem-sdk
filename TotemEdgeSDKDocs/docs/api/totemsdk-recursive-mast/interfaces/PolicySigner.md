[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / PolicySigner

# Interface: PolicySigner

## Properties

### address

> **address**: `string`

## Methods

### burnKey()?

> `optional` **burnKey**(`leaseReceipt`, `reason`): `Promise`\<`void`\>

#### Parameters

##### leaseReceipt

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

***

### commitKey()?

> `optional` **commitKey**(`leaseReceipt`): `Promise`\<`void`\>

#### Parameters

##### leaseReceipt

`string`

#### Returns

`Promise`\<`void`\>

***

### getPublicKey()

> **getPublicKey**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

***

### reserveKey()?

> `optional` **reserveKey**(): `Promise`\<\{ `keyIndex`: `number`; `leaseReceipt`: `string`; \}\>

#### Returns

`Promise`\<\{ `keyIndex`: `number`; `leaseReceipt`: `string`; \}\>

***

### signDomainSeparated()

> **signDomainSeparated**(`domain`, `payload`): `Promise`\<[`PolicySignature`](PolicySignature.md)\>

#### Parameters

##### domain

[`SigningDomain`](../type-aliases/SigningDomain.md)

##### payload

`Uint8Array`

#### Returns

`Promise`\<[`PolicySignature`](PolicySignature.md)\>
