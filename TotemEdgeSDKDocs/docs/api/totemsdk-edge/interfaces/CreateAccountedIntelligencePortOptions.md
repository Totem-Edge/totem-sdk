[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / CreateAccountedIntelligencePortOptions

# Interface: CreateAccountedIntelligencePortOptions

## Properties

### afterCompleted?

> `optional` **afterCompleted?**: (`completed`) => `Promise`\<`void`\>

Optional live-accounting hook invoked after a dispatch finishes
`completed` (the journal write already appended). The commerce accounting
fold (`@totemsdk/edge/commerce-accounting`) attaches here. Best-effort:
a failure is reported to `onAfterCompletedError` and does NOT fail the
already-completed dispatch — the authoritative fold pass is
[foldUsageStatements](../functions/foldUsageStatements.md) on restart (idempotent by messageId).

#### Parameters

##### completed

###### context

`Record`\<`string`, `unknown`\> \| `undefined`

###### requestId

`string`

###### usage

[`InferenceRecordedUsage`](InferenceRecordedUsage.md) \| `undefined`

#### Returns

`Promise`\<`void`\>

***

### journal

> **journal**: `Journal`\<[`InferenceAuditEvent`](../type-aliases/InferenceAuditEvent.md)\>

Append-only accounting journal (durably-acknowledged in production).

***

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to Date.now).

#### Returns

`number`

***

### onAfterCompletedError?

> `optional` **onAfterCompletedError?**: (`error`) => `void`

Reports a best-effort `afterCompleted` failure (never throws upward).

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### port

> **port**: [`EdgeIntelligencePort`](EdgeIntelligencePort.md)

Underlying provider-neutral port.

***

### requestId?

> `optional` **requestId?**: () => `string`

Request-id generator used when the caller omits one (defaults to UUID).

#### Returns

`string`
