[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / EpochAuthority

# Class: EpochAuthority

## Constructors

### Constructor

> **new EpochAuthority**(`options`): `EpochAuthority`

#### Parameters

##### options

[`EpochAuthorityOptions`](../interfaces/EpochAuthorityOptions.md)

#### Returns

`EpochAuthority`

## Methods

### append()

> **append**(`receipt`, `root`): `Promise`\<[`EpochRecord`](../interfaces/EpochRecord.md)\>

Record a co-signed receipt. The operator signs the epoch commitment after
verifying the receipt, so the durable record cannot be forged later.

#### Parameters

##### receipt

[`VtxoOperatorReceipt`](../interfaces/VtxoOperatorReceipt.md)

##### root

`string`

#### Returns

`Promise`\<[`EpochRecord`](../interfaces/EpochRecord.md)\>

***

### current()

> **current**(): `Promise`\<[`EpochAuthorityState`](../interfaces/EpochAuthorityState.md) & `object`\>

#### Returns

`Promise`\<[`EpochAuthorityState`](../interfaces/EpochAuthorityState.md) & `object`\>

***

### markPublished()

> **markPublished**(`epoch`): `Promise`\<`void`\>

Mark an epoch as published/anchored. Idempotent.

#### Parameters

##### epoch

`number`

#### Returns

`Promise`\<`void`\>

***

### recover()

> **recover**(): `Promise`\<[`EpochRecovery`](../interfaces/EpochRecovery.md)\>

Recover pending (durable but unpublished) epochs after a restart.

#### Returns

`Promise`\<[`EpochRecovery`](../interfaces/EpochRecovery.md)\>

***

### verifyReceipt()

> **verifyReceipt**(`receipt`, `root`): `Promise`\<`boolean`\>

Acceptance check: the receipt must be recorded, match the current
epoch/root, and verify against the operator key.

#### Parameters

##### receipt

[`VtxoOperatorReceipt`](../interfaces/VtxoOperatorReceipt.md)

##### root

`string`

#### Returns

`Promise`\<`boolean`\>
