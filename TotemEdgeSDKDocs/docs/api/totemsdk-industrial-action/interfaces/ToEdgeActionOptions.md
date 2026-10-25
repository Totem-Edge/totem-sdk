[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ToEdgeActionOptions

# Interface: ToEdgeActionOptions

## Properties

### approvals?

> `optional` **approvals?**: [`ApprovalRegistry`](ApprovalRegistry.md)

Approval registry (RFC-011 §4.9).

***

### events?

> `optional` **events?**: [`ActionEventSink`](ActionEventSink.md)

Lifecycle event stream (RFC-011 §4.6).

***

### expectedSchemaHash?

> `optional` **expectedSchemaHash?**: `string`

***

### expectedVersion?

> `optional` **expectedVersion?**: `number`

Expected definition version/schema hash; a mismatch fails closed (RFC-011 §4.5).

***

### interlocks?

> `optional` **interlocks?**: [`InterlockRegistry`](InterlockRegistry.md)

Interlocks evaluated before authorization (RFC-011 §4.3).

***

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to `Date.now`).

#### Returns

`number`

***

### operationStore?

> `optional` **operationStore?**: [`DeviceOperationStore`](DeviceOperationStore.md)

Durable operation store enabling at-most-once actuation (RFC-010 §6.6).

***

### rateLimiter?

> `optional` **rateLimiter?**: [`RateLimiter`](RateLimiter.md)

Durable rate limiter (required when `schedule.rateLimit` is set).

***

### requireApproval?

> `optional` **requireApproval?**: `boolean`

Require an approved request bound to this action's commitment.

***

### resolveResourceId?

> `optional` **resolveResourceId?**: (`params`, `context`) => [`ResourceId`](ResourceId.md) \| `undefined`

Resolve the target resource so resource-scoped interlocks apply.

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

##### context

`Record`\<`string`, `unknown`\>

#### Returns

[`ResourceId`](ResourceId.md) \| `undefined`

***

### schedule?

> `optional` **schedule?**: [`ActionSchedule`](ActionSchedule.md)

Maintenance windows + rate limit (RFC-011 §4.8).

***

### units?

> `optional` **units?**: [`UnitRegistry`](UnitRegistry.md)

Unit registry for quantity validation (RFC-011 §4.1). Defaults to the built-in units.
