[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / MemoryReceiptStore

# Class: MemoryReceiptStore

In-memory receipt store with optional JSON-file persistence.

## Example

```ts
// In-memory only
const store = new MemoryReceiptStore();

// With file persistence
const store = new MemoryReceiptStore({ filePath: './data/receipts.jsonl' });
```

## Implements

- [`ReceiptStore`](../interfaces/ReceiptStore.md)

## Constructors

### Constructor

> **new MemoryReceiptStore**(`opts?`): `MemoryReceiptStore`

#### Parameters

##### opts?

###### filePath?

`string`

#### Returns

`MemoryReceiptStore`

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
