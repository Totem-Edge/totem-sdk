[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ApprovalRegistry

# Interface: ApprovalRegistry

## Methods

### approve()

> **approve**(`approvalId`, `approver`): `Promise`\<[`ApprovalRequest`](ApprovalRequest.md)\>

#### Parameters

##### approvalId

`string`

##### approver

`string`

#### Returns

`Promise`\<[`ApprovalRequest`](ApprovalRequest.md)\>

***

### get()

> **get**(`approvalId`): `Promise`\<[`ApprovalRequest`](ApprovalRequest.md) \| `undefined`\>

#### Parameters

##### approvalId

`string`

#### Returns

`Promise`\<[`ApprovalRequest`](ApprovalRequest.md) \| `undefined`\>

***

### listPending()

> **listPending**(): `Promise`\<[`ApprovalRequest`](ApprovalRequest.md)[]\>

#### Returns

`Promise`\<[`ApprovalRequest`](ApprovalRequest.md)[]\>

***

### reject()

> **reject**(`approvalId`, `approver`, `reason?`): `Promise`\<[`ApprovalRequest`](ApprovalRequest.md)\>

#### Parameters

##### approvalId

`string`

##### approver

`string`

##### reason?

`string`

#### Returns

`Promise`\<[`ApprovalRequest`](ApprovalRequest.md)\>

***

### request()

> **request**(`params`): `Promise`\<[`ApprovalRequest`](ApprovalRequest.md)\>

#### Parameters

##### params

[`ApprovalRequestParams`](ApprovalRequestParams.md)

#### Returns

`Promise`\<[`ApprovalRequest`](ApprovalRequest.md)\>

***

### validate()

> **validate**(`approvalId`, `commitmentHash`): `Promise`\<[`ApprovalValidation`](ApprovalValidation.md)\>

Valid when approved, bound to the same commitment, and unexpired.

#### Parameters

##### approvalId

`string`

##### commitmentHash

`string`

#### Returns

`Promise`\<[`ApprovalValidation`](ApprovalValidation.md)\>
