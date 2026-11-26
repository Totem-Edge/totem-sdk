[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / ActualConsumptionV1

# Interface: ActualConsumptionV1

A trusted metered account of what an executed operation consumed. This is an
accounting claim backed by evidence references, not a raw provider callback.

## Properties

### compute?

> `optional` **compute?**: [`ActualComputeConsumption`](ActualComputeConsumption.md)[]

***

### evidenceRefs

> **evidenceRefs**: `string`[]

***

### fees?

> `optional` **fees?**: [`ActualSpend`](ActualSpend.md)[]

***

### mandateUsage

> **mandateUsage**: [`ActualMandateUsage`](ActualMandateUsage.md)[]

***

### measuredAt

> **measuredAt**: `number`

***

### measurementStatus

> **measurementStatus**: `"verified"` \| `"partial"` \| `"unavailable"`

***

### schema

> **schema**: `"totem:act:actual-consumption/v1"`

***

### spends

> **spends**: [`ActualSpend`](ActualSpend.md)[]
