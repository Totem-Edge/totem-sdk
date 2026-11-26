[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / AgentReceiptLog

# Class: AgentReceiptLog

## Constructors

### Constructor

> **new AgentReceiptLog**(`log`): `AgentReceiptLog`

#### Parameters

##### log

`ReplicatedLog`\<[`AgentReceipt`](../interfaces/AgentReceipt.md)\>

#### Returns

`AgentReceiptLog`

## Methods

### append()

> **append**(`receipt`): `Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

#### Parameters

##### receipt

[`AgentReceipt`](../interfaces/AgentReceipt.md)

#### Returns

`Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### readSince()

> **readSince**(`cursor?`): `AsyncIterable`\<\{ `cursor`: `string`; `record`: [`AgentReceipt`](../interfaces/AgentReceipt.md); \}\>

#### Parameters

##### cursor?

`string`

#### Returns

`AsyncIterable`\<\{ `cursor`: `string`; `record`: [`AgentReceipt`](../interfaces/AgentReceipt.md); \}\>

***

### status()

> **status**(): `ReplicationStatus`

#### Returns

`ReplicationStatus`
