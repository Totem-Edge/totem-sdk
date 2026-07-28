[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ActionStorage

# Interface: ActionStorage

## Methods

### getExecution()

> **getExecution**(`id`): `Promise`\<`EdgeOperationResult`\<[`ActionExecution`](ActionExecution.md)\>\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<[`ActionExecution`](ActionExecution.md)\>\>

***

### getProposal()

> **getProposal**(`id`): `Promise`\<`EdgeOperationResult`\<[`ActionProposal`](ActionProposal.md)\>\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<[`ActionProposal`](ActionProposal.md)\>\>

***

### saveExecution()

> **saveExecution**(`execution`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### execution

[`ActionExecution`](ActionExecution.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

***

### saveProposal()

> **saveProposal**(`proposal`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### proposal

[`ActionProposal`](ActionProposal.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

***

### saveReceipt()

> **saveReceipt**(`receipt`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### receipt

[`ActionReceipt`](ActionReceipt.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>
