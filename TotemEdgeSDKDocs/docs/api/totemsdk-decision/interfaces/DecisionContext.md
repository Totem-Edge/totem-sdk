[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionContext

# Interface: DecisionContext

Trace/governance metadata. Must never contain key material.

**Invariant (RFC-012 §11.3):** context MUST NOT affect provider semantics.
It does not participate in the request digest, and the runtime strips it
before invoking providers. Anything intended to influence the answer belongs
in `state`, `goal`, `instruction`, criterion metadata, or another
digest-bound semantic field.

## Properties

### agentId?

> `readonly` `optional` **agentId?**: `string`

***

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, [`DecisionValue`](../type-aliases/DecisionValue.md)\>

***

### principal?

> `readonly` `optional` **principal?**: `string`

***

### proposalId?

> `readonly` `optional` **proposalId?**: `string`

***

### runId?

> `readonly` `optional` **runId?**: `string`
