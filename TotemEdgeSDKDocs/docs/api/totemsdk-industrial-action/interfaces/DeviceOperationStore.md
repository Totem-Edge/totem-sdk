[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / DeviceOperationStore

# Interface: DeviceOperationStore

## Methods

### claimOperation()

> **claimOperation**(`operationId`, `proposalId`, `now`): `Promise`\<[`OperationClaim`](OperationClaim.md)\>

Atomically claim an operation. Returns the existing record when one is
already present (terminal or in-flight); otherwise creates an `in-flight`
record and returns `claimed: true`.

#### Parameters

##### operationId

`string`

##### proposalId

`string` \| `undefined`

##### now

`number`

#### Returns

`Promise`\<[`OperationClaim`](OperationClaim.md)\>

***

### getOperation()

> **getOperation**(`operationId`): `Promise`\<[`DeviceOperationRecord`](DeviceOperationRecord.md) \| `undefined`\>

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<[`DeviceOperationRecord`](DeviceOperationRecord.md) \| `undefined`\>

***

### transitionOperation()

> **transitionOperation**(`next`): `Promise`\<`boolean`\>

Replace a record (typically transitioning it out of `in-flight`).

#### Parameters

##### next

[`DeviceOperationRecord`](DeviceOperationRecord.md)

#### Returns

`Promise`\<`boolean`\>
