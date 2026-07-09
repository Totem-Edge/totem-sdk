[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / MultisigManager

# Class: MultisigManager

## Constructors

### Constructor

> **new MultisigManager**(`storage?`): `MultisigManager`

#### Parameters

##### storage?

[`KeyValueStorage`](../interfaces/KeyValueStorage.md)

#### Returns

`MultisigManager`

## Properties

### ready

> `readonly` **ready**: `Promise`\<`void`\>

## Methods

### addOwnSignature()

> **addOwnSignature**(`transactionId`, `signature`, `proof?`): `Promise`\<`void`\>

#### Parameters

##### transactionId

`string`

##### signature

`string`

##### proof?

`MMRProof`

#### Returns

`Promise`\<`void`\>

***

### cleanupExpired()

> **cleanupExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

***

### computeMultisigAddress()

> **computeMultisigAddress**(`config`): `string`

#### Parameters

##### config

[`MultisigConfig`](../interfaces/MultisigConfig.md)

#### Returns

`string`

***

### createMultisigScript()

> **createMultisigScript**(`config`): `ScriptDescriptor`

#### Parameters

##### config

[`MultisigConfig`](../interfaces/MultisigConfig.md)

#### Returns

`ScriptDescriptor`

***

### createPendingTransaction()

> **createPendingTransaction**(`config`, `transactionHex`, `transactionDigest`, `expirationHours?`): `Promise`\<[`PendingMultisigTransaction`](../interfaces/PendingMultisigTransaction.md)\>

#### Parameters

##### config

[`MultisigConfig`](../interfaces/MultisigConfig.md)

##### transactionHex

`string`

##### transactionDigest

`string`

##### expirationHours?

`number` = `24`

#### Returns

`Promise`\<[`PendingMultisigTransaction`](../interfaces/PendingMultisigTransaction.md)\>

***

### deleteTransaction()

> **deleteTransaction**(`transactionId`): `Promise`\<`boolean`\>

#### Parameters

##### transactionId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### exportTransaction()

> **exportTransaction**(`transactionId`): `Promise`\<[`MultisigExportData`](../interfaces/MultisigExportData.md)\>

#### Parameters

##### transactionId

`string`

#### Returns

`Promise`\<[`MultisigExportData`](../interfaces/MultisigExportData.md)\>

***

### getAllPending()

> **getAllPending**(): `Promise`\<[`PendingMultisigTransaction`](../interfaces/PendingMultisigTransaction.md)[]\>

#### Returns

`Promise`\<[`PendingMultisigTransaction`](../interfaces/PendingMultisigTransaction.md)[]\>

***

### getSignatures()

> **getSignatures**(`transactionId`): `Promise`\<`ExternalSignature`[]\>

#### Parameters

##### transactionId

`string`

#### Returns

`Promise`\<`ExternalSignature`[]\>

***

### getSignatureStatus()

> **getSignatureStatus**(`transactionId`): `Promise`\<\{ `collected`: `number`; `missing`: `string`[]; `required`: `number`; `status`: `string`; \}\>

#### Parameters

##### transactionId

`string`

#### Returns

`Promise`\<\{ `collected`: `number`; `missing`: `string`[]; `required`: `number`; `status`: `string`; \}\>

***

### getTransaction()

> **getTransaction**(`transactionId`): `Promise`\<[`PendingMultisigTransaction`](../interfaces/PendingMultisigTransaction.md) \| `undefined`\>

#### Parameters

##### transactionId

`string`

#### Returns

`Promise`\<[`PendingMultisigTransaction`](../interfaces/PendingMultisigTransaction.md) \| `undefined`\>

***

### importExternalSignature()

> **importExternalSignature**(`transactionId`, `publicKey`, `signature`, `signatureType?`, `proof?`): `Promise`\<\{ `error?`: `string`; `valid`: `boolean`; \}\>

#### Parameters

##### transactionId

`string`

##### publicKey

`string`

##### signature

`string`

##### signatureType?

`"wots"` \| `"standard"`

##### proof?

`MMRProof`

#### Returns

`Promise`\<\{ `error?`: `string`; `valid`: `boolean`; \}\>

***

### importTransaction()

> **importTransaction**(`data`): `Promise`\<[`PendingMultisigTransaction`](../interfaces/PendingMultisigTransaction.md)\>

#### Parameters

##### data

[`MultisigExportData`](../interfaces/MultisigExportData.md)

#### Returns

`Promise`\<[`PendingMultisigTransaction`](../interfaces/PendingMultisigTransaction.md)\>

***

### isReady()

> **isReady**(`transactionId`): `Promise`\<`boolean`\>

#### Parameters

##### transactionId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### markBroadcast()

> **markBroadcast**(`transactionId`): `Promise`\<`void`\>

#### Parameters

##### transactionId

`string`

#### Returns

`Promise`\<`void`\>

***

### markFailed()

> **markFailed**(`transactionId`, `error?`): `Promise`\<`void`\>

#### Parameters

##### transactionId

`string`

##### error?

`string`

#### Returns

`Promise`\<`void`\>
