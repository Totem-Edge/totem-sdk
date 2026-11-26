[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / ReplicatedReceiptStore

# Class: ReplicatedReceiptStore

ReceiptStore — persists AgentReceipt objects for audit trail.

Default implementation stores receipts in memory. Callers can provide
a custom `save` function for file, database, or remote storage.

## Implements

- [`ReceiptStore`](../interfaces/ReceiptStore.md)

## Constructors

### Constructor

> **new ReplicatedReceiptStore**(`log`): `ReplicatedReceiptStore`

#### Parameters

##### log

`ReplicatedLog`\<[`AgentReceipt`](../interfaces/AgentReceipt.md)\>

#### Returns

`ReplicatedReceiptStore`

## Methods

### count()

> **count**(): `Promise`\<`number`\>

Total number of stored receipts.

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`ReceiptStore`](../interfaces/ReceiptStore.md).[`count`](../interfaces/ReceiptStore.md#count)

***

### get()

> **get**(`receiptId`): `Promise`\<[`AgentReceipt`](../interfaces/AgentReceipt.md) \| `null`\>

Retrieve a receipt by receiptId.

#### Parameters

##### receiptId

`string`

#### Returns

`Promise`\<[`AgentReceipt`](../interfaces/AgentReceipt.md) \| `null`\>

#### Implementation of

[`ReceiptStore`](../interfaces/ReceiptStore.md).[`get`](../interfaces/ReceiptStore.md#get)

***

### list()

> **list**(`limit?`, `offset?`): `Promise`\<[`AgentReceipt`](../interfaces/AgentReceipt.md)[]\>

List all receipts, newest first.

#### Parameters

##### limit?

`number` = `50`

##### offset?

`number` = `0`

#### Returns

`Promise`\<[`AgentReceipt`](../interfaces/AgentReceipt.md)[]\>

#### Implementation of

[`ReceiptStore`](../interfaces/ReceiptStore.md).[`list`](../interfaces/ReceiptStore.md#list)

***

### save()

> **save**(`receipt`): `Promise`\<`string`\>

Persist a receipt. Returns a receiptId for retrieval.

#### Parameters

##### receipt

[`AgentReceipt`](../interfaces/AgentReceipt.md)

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`ReceiptStore`](../interfaces/ReceiptStore.md).[`save`](../interfaces/ReceiptStore.md#save)
