[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / DurableActionStorage

# Interface: DurableActionStorage

## Extends

- [`ActionStorage`](ActionStorage.md)

## Methods

### getExecution()

> **getExecution**(`id`): `Promise`\<`EdgeOperationResult`\<[`ActionExecution`](ActionExecution.md)\>\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<[`ActionExecution`](ActionExecution.md)\>\>

#### Inherited from

[`ActionStorage`](ActionStorage.md).[`getExecution`](ActionStorage.md#getexecution)

***

### getProposal()

> **getProposal**(`id`): `Promise`\<`EdgeOperationResult`\<[`ActionProposal`](ActionProposal.md)\>\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<[`ActionProposal`](ActionProposal.md)\>\>

#### Inherited from

[`ActionStorage`](ActionStorage.md).[`getProposal`](ActionStorage.md#getproposal)

***

### getReceipt()

> **getReceipt**(`receiptId`): `Promise`\<`EdgeOperationResult`\<[`ActionReceipt`](ActionReceipt.md)\>\>

#### Parameters

##### receiptId

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<[`ActionReceipt`](ActionReceipt.md)\>\>

***

### getRevision()

> **getRevision**(): `Promise`\<`number`\>

Current registry transition counter (0 before the first write).

#### Returns

`Promise`\<`number`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`ActionRegistryState`](ActionRegistryState.md)\>

Current persisted snapshot state.

#### Returns

`Promise`\<[`ActionRegistryState`](ActionRegistryState.md)\>

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

True once any snapshot record has been persisted.

#### Returns

`Promise`\<`boolean`\>

***

### saveExecution()

> **saveExecution**(`execution`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### execution

[`ActionExecution`](ActionExecution.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Inherited from

[`ActionStorage`](ActionStorage.md).[`saveExecution`](ActionStorage.md#saveexecution)

***

### saveProposal()

> **saveProposal**(`proposal`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### proposal

[`ActionProposal`](ActionProposal.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Inherited from

[`ActionStorage`](ActionStorage.md).[`saveProposal`](ActionStorage.md#saveproposal)

***

### saveReceipt()

> **saveReceipt**(`receipt`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### receipt

[`ActionReceipt`](ActionReceipt.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Inherited from

[`ActionStorage`](ActionStorage.md).[`saveReceipt`](ActionStorage.md#savereceipt)
