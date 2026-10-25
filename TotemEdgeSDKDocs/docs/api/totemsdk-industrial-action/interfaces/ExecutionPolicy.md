[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ExecutionPolicy

# Interface: ExecutionPolicy

Industrial execution policy (RFC-010 §6.5).

Retries are opt-in and must only be enabled for idempotent device operations;
a timeout is never treated as success.

## Properties

### backoffMs?

> `optional` **backoffMs?**: `number`

Linear backoff base in milliseconds between attempts. Default 0.

***

### failureMode?

> `optional` **failureMode?**: [`FailureMode`](../type-aliases/FailureMode.md)

Failure semantics (RFC-011 §4.11). Mandatory for `write` actions.

***

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Total attempts (1 = no retry). Default 1.

***

### onInFlight?

> `optional` **onInFlight?**: `"fail"` \| `"return-existing"`

Behaviour when a durable record already exists for the operation. Default `fail`.

***

### retryable?

> `optional` **retryable?**: (`error`) => `boolean`

Whether a failed attempt is retryable. Default: timeout/transport only.

#### Parameters

##### error

[`ActionError`](ActionError.md)

#### Returns

`boolean`

***

### rollback?

> `optional` **rollback?**: (`op`, `error`) => `Promise`\<`void`\>

Compensating action run after a terminal failure (saga hook).

#### Parameters

##### op

[`PreparedDeviceOp`](PreparedDeviceOp.md)

##### error

[`ActionError`](ActionError.md)

#### Returns

`Promise`\<`void`\>

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Actuation timeout in milliseconds. Default 30_000.
