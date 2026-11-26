[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / EncryptedBackupLog

# Class: EncryptedBackupLog

Append-only backup stream; consumers remain responsible for encrypting state.

## Constructors

### Constructor

> **new EncryptedBackupLog**(`log`): `EncryptedBackupLog`

#### Parameters

##### log

[`ReplicatedLog`](../interfaces/ReplicatedLog.md)\<[`EncryptedBackupRecord`](../interfaces/EncryptedBackupRecord.md)\>

#### Returns

`EncryptedBackupLog`

## Methods

### append()

> **append**(`record`): `Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

#### Parameters

##### record

[`EncryptedBackupRecord`](../interfaces/EncryptedBackupRecord.md)

#### Returns

`Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### readSince()

> **readSince**(`cursor?`): `AsyncIterable`\<\{ `cursor`: `string`; `record`: [`EncryptedBackupRecord`](../interfaces/EncryptedBackupRecord.md); \}\>

#### Parameters

##### cursor?

`string`

#### Returns

`AsyncIterable`\<\{ `cursor`: `string`; `record`: [`EncryptedBackupRecord`](../interfaces/EncryptedBackupRecord.md); \}\>
