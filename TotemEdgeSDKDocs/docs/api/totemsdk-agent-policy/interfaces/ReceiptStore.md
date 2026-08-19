[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / ReceiptStore

# Interface: ReceiptStore

ReceiptStore — persists AgentReceipt objects for audit trail.

Default implementation stores receipts in memory. Callers can provide
a custom `save` function for file, database, or remote storage.

## Methods

### count()

> **count**(): `Promise`\<`number`\>

Total number of stored receipts.

#### Returns

`Promise`\<`number`\>

***

### get()

> **get**(`receiptId`): `Promise`\<[`AgentReceipt`](AgentReceipt.md) \| `null`\>

Retrieve a receipt by receiptId.

#### Parameters

##### receiptId

`string`

#### Returns

`Promise`\<[`AgentReceipt`](AgentReceipt.md) \| `null`\>

***

### list()

> **list**(`limit?`, `offset?`): `Promise`\<[`AgentReceipt`](AgentReceipt.md)[]\>

List all receipts, newest first.

#### Parameters

##### limit?

`number`

##### offset?

`number`

#### Returns

`Promise`\<[`AgentReceipt`](AgentReceipt.md)[]\>

***

### save()

> **save**(`receipt`): `Promise`\<`string`\>

Persist a receipt. Returns a receiptId for retrieval.

#### Parameters

##### receipt

[`AgentReceipt`](AgentReceipt.md)

#### Returns

`Promise`\<`string`\>
