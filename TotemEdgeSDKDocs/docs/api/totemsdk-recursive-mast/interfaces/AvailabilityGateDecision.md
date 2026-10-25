[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / AvailabilityGateDecision

# Interface: AvailabilityGateDecision

## Properties

### action

> `readonly` **action**: `string`

***

### allowed

> `readonly` **allowed**: `boolean`

Whether the operation may proceed. Always `true` for a recovery action.

***

### kind

> `readonly` **kind**: [`AvailabilityGateKind`](../type-aliases/AvailabilityGateKind.md)

***

### reason

> `readonly` **reason**: `string`

***

### recoveryUnderReplicated

> `readonly` **recoveryUnderReplicated**: `boolean`

Advisory: the recovery path is held by fewer than the declared minimum
replicas. Reported for recovery (and content) evaluations; never a denial.

***

### report

> `readonly` **report**: [`PolicyAvailabilityReport`](PolicyAvailabilityReport.md)
