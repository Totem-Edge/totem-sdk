[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / ReplicatedDecisionReceiptLog

# Class: ReplicatedDecisionReceiptLog

## Constructors

### Constructor

> **new ReplicatedDecisionReceiptLog**(`log`): `ReplicatedDecisionReceiptLog`

#### Parameters

##### log

`ReplicatedLog`\<[`DecisionRefRecord`](../interfaces/DecisionRefRecord.md)\>

#### Returns

`ReplicatedDecisionReceiptLog`

## Methods

### append()

> **append**(`record`): `Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

#### Parameters

##### record

[`DecisionRefRecord`](../interfaces/DecisionRefRecord.md)

#### Returns

`Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### readSince()

> **readSince**(`cursor?`): `AsyncIterable`\<\{ `cursor`: `string`; `record`: [`DecisionRefRecord`](../interfaces/DecisionRefRecord.md); \}\>

#### Parameters

##### cursor?

`string`

#### Returns

`AsyncIterable`\<\{ `cursor`: `string`; `record`: [`DecisionRefRecord`](../interfaces/DecisionRefRecord.md); \}\>
