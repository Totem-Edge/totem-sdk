[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / BoundaryFailure

# Interface: BoundaryFailure

Structured boundary failure — never a bare boolean.

## Properties

### boundary?

> `optional` **boundary?**: `string`

***

### escalation?

> `optional` **escalation?**: [`BoundaryEscalation`](BoundaryEscalation.md)

***

### kind

> **kind**: `"boundary_exceeded"` \| `"transition_invalid"` \| `"obligation_failed"` \| `"escalate"`

***

### reason

> **reason**: `string`
