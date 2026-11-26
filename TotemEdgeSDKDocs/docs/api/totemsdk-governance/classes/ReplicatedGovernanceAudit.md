[**@totemsdk/governance**](../index.md)

***

[@totemsdk/governance](../index.md) / ReplicatedGovernanceAudit

# Class: ReplicatedGovernanceAudit

## Constructors

### Constructor

> **new ReplicatedGovernanceAudit**(`log`): `ReplicatedGovernanceAudit`

#### Parameters

##### log

`ReplicatedLog`\<[`GovernanceAuditRecord`](../type-aliases/GovernanceAuditRecord.md)\>

#### Returns

`ReplicatedGovernanceAudit`

## Methods

### append()

> **append**(`record`): `Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

#### Parameters

##### record

[`GovernanceAuditRecord`](../type-aliases/GovernanceAuditRecord.md)

#### Returns

`Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### readSince()

> **readSince**(`cursor?`): `AsyncIterable`\<\{ `cursor`: `string`; `record`: [`GovernanceAuditRecord`](../type-aliases/GovernanceAuditRecord.md); \}\>

#### Parameters

##### cursor?

`string`

#### Returns

`AsyncIterable`\<\{ `cursor`: `string`; `record`: [`GovernanceAuditRecord`](../type-aliases/GovernanceAuditRecord.md); \}\>
