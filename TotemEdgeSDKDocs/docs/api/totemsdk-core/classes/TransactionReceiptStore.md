[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / TransactionReceiptStore

# Class: TransactionReceiptStore

## Constructors

### Constructor

> **new TransactionReceiptStore**(`storage`, `logger?`, `config?`): `TransactionReceiptStore`

#### Parameters

##### storage

[`StorageAdapter`](../interfaces/StorageAdapter.md)

##### logger?

[`LoggerAdapter`](../interfaces/LoggerAdapter.md) = `...`

##### config?

[`TransactionReceiptStoreConfig`](../interfaces/TransactionReceiptStoreConfig.md) = `{}`

#### Returns

`TransactionReceiptStore`

## Methods

### add()

> **add**(`receipt`): `Promise`\<`void`\>

#### Parameters

##### receipt

[`TransactionReceipt`](../interfaces/TransactionReceipt.md)

#### Returns

`Promise`\<`void`\>

***

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### count()

> **count**(): `number`

#### Returns

`number`

***

### getAll()

> **getAll**(): [`TransactionReceipt`](../interfaces/TransactionReceipt.md)[]

#### Returns

[`TransactionReceipt`](../interfaces/TransactionReceipt.md)[]

***

### getByTxpowid()

> **getByTxpowid**(`txpowid`): [`TransactionReceipt`](../interfaces/TransactionReceipt.md) \| `undefined`

#### Parameters

##### txpowid

`string`

#### Returns

[`TransactionReceipt`](../interfaces/TransactionReceipt.md) \| `undefined`

***

### getRecent()

> **getRecent**(`count?`): [`TransactionReceipt`](../interfaces/TransactionReceipt.md)[]

#### Parameters

##### count?

`number` = `50`

#### Returns

[`TransactionReceipt`](../interfaces/TransactionReceipt.md)[]

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### isInitialized()

> **isInitialized**(): `boolean`

#### Returns

`boolean`

***

### updateStatus()

> **updateStatus**(`txpowid`, `status`): `Promise`\<`void`\>

#### Parameters

##### txpowid

`string`

##### status

`"pending"` \| `"confirmed"` \| `"failed"`

#### Returns

`Promise`\<`void`\>
