[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionAttempt

# Interface: DecisionAttempt

One provider invocation, preserved for provenance. Never carries secrets.

## Properties

### accepted

> `readonly` **accepted**: `boolean`

***

### confidence?

> `readonly` `optional` **confidence?**: `number`

***

### durationMs

> `readonly` **durationMs**: `number`

***

### errorCode?

> `readonly` `optional` **errorCode?**: [`DecisionErrorCode`](../type-aliases/DecisionErrorCode.md)

***

### message?

> `readonly` `optional` **message?**: `string`

***

### providerId

> `readonly` **providerId**: `string`

***

### providerVersion?

> `readonly` `optional` **providerVersion?**: `string`

***

### reason?

> `readonly` `optional` **reason?**: [`DecisionEscalationReason`](../type-aliases/DecisionEscalationReason.md)

***

### skipped?

> `readonly` `optional` **skipped?**: `boolean`

When the route was skipped before invocation.

***

### startedAt

> `readonly` **startedAt**: `number`
