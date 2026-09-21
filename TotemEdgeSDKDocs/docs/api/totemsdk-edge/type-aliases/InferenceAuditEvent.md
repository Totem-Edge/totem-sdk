[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / InferenceAuditEvent

# Type Alias: InferenceAuditEvent

> **InferenceAuditEvent** = \{ `agentId?`: `string`; `context?`: `Record`\<`string`, `unknown`\>; `event`: `"started"`; `principal?`: `string`; `proposalId?`: `string`; `providerId`: `string`; `requestId`: `string`; `runId?`: `string`; `startedAt`: `number`; `workflow`: \{ `domain`: `string`; `op`: `string`; \}; \} \| \{ `context?`: `Record`\<`string`, `unknown`\>; `errorCode?`: `string`; `errorMessage?`: `string`; `event`: `"finished"`; `finishedAt`: `number`; `outcome`: `"completed"` \| `"failed"` \| `"outcome-unknown"`; `requestId`: `string`; `usage?`: [`InferenceRecordedUsage`](../interfaces/InferenceRecordedUsage.md); \}

Journaled inference usage/execution event.

Two events per dispatched call, joined by `requestId`. The journal is
append-only: outcomes are never mutated in place, a `finished` event is
appended when the outcome is known (or deliberately recorded unknown).

## Union Members

### Type Literal

\{ `agentId?`: `string`; `context?`: `Record`\<`string`, `unknown`\>; `event`: `"started"`; `principal?`: `string`; `proposalId?`: `string`; `providerId`: `string`; `requestId`: `string`; `runId?`: `string`; `startedAt`: `number`; `workflow`: \{ `domain`: `string`; `op`: `string`; \}; \}

#### agentId?

> `readonly` `optional` **agentId?**: `string`

#### context?

> `readonly` `optional` **context?**: `Record`\<`string`, `unknown`\>

Verbatim invocation context (governance linkage for reconciliation).

#### event

> `readonly` **event**: `"started"`

#### principal?

> `readonly` `optional` **principal?**: `string`

#### proposalId?

> `readonly` `optional` **proposalId?**: `string`

#### providerId

> `readonly` **providerId**: `string`

#### requestId

> `readonly` **requestId**: `string`

#### runId?

> `readonly` `optional` **runId?**: `string`

#### startedAt

> `readonly` **startedAt**: `number`

#### workflow

> `readonly` **workflow**: `object`

##### workflow.domain

> `readonly` **domain**: `string`

##### workflow.op

> `readonly` **op**: `string`

***

### Type Literal

\{ `context?`: `Record`\<`string`, `unknown`\>; `errorCode?`: `string`; `errorMessage?`: `string`; `event`: `"finished"`; `finishedAt`: `number`; `outcome`: `"completed"` \| `"failed"` \| `"outcome-unknown"`; `requestId`: `string`; `usage?`: [`InferenceRecordedUsage`](../interfaces/InferenceRecordedUsage.md); \}

#### context?

> `readonly` `optional` **context?**: `Record`\<`string`, `unknown`\>

Verbatim invocation context, mirrored from the paired `started` event.

#### errorCode?

> `readonly` `optional` **errorCode?**: `string`

#### errorMessage?

> `readonly` `optional` **errorMessage?**: `string`

#### event

> `readonly` **event**: `"finished"`

#### finishedAt

> `readonly` **finishedAt**: `number`

#### outcome

> `readonly` **outcome**: `"completed"` \| `"failed"` \| `"outcome-unknown"`

#### requestId

> `readonly` **requestId**: `string`

#### usage?

> `readonly` `optional` **usage?**: [`InferenceRecordedUsage`](../interfaces/InferenceRecordedUsage.md)
