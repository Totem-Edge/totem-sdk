[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / AvailabilityGateConfig

# Interface: AvailabilityGateConfig

## Properties

### action

> `readonly` **action**: `string`

The action being authorized (a content action, or the recovery action).

***

### availabilityPolicy

> `readonly` **availabilityPolicy**: [`AvailabilityPolicy`](AvailabilityPolicy.md)

***

### kind?

> `readonly` `optional` **kind?**: [`AvailabilityGateKind`](../type-aliases/AvailabilityGateKind.md)

Default `'content'`; `'recovery'` is exempt from the content availability gate.

***

### now?

> `readonly` `optional` **now?**: `number`

Injectable clock (seconds).

***

### policyId

> `readonly` **policyId**: `string`

***

### recoveryPolicy?

> `readonly` `optional` **recoveryPolicy?**: [`RecoveryAvailabilityPolicy`](RecoveryAvailabilityPolicy.md)

***

### replicas

> `readonly` **replicas**: `PolicyStoreReplica`[]
