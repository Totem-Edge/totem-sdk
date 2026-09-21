[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / ReconcileInferenceAccountingOptions

# Interface: ReconcileInferenceAccountingOptions

## Properties

### authority

> **authority**: [`InferenceAccountingAuthority`](InferenceAccountingAuthority.md)

***

### journal

> **journal**: `Journal`\<[`InferenceAuditEvent`](../type-aliases/InferenceAuditEvent.md)\>

***

### mandateId

> **mandateId**: `string`

***

### stepIdOf?

> `optional` **stepIdOf?**: (`entry`) => `string` \| `undefined`

Map a journal event to the step a host tuned into `context.metadata`
at dispatch time. Defaults to reading `context.metadata.stepId`.

#### Parameters

##### entry

[`InferenceReadEvent`](../type-aliases/InferenceReadEvent.md)

#### Returns

`string` \| `undefined`
