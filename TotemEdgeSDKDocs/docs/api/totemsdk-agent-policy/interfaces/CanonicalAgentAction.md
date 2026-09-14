[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / CanonicalAgentAction

# Interface: CanonicalAgentAction

Canonical action produced by the wallet from a prepared operation. The
authorization layer commits to these effects — not to an agent description.

## Extends

- [`RunActionIntent`](RunActionIntent.md)

## Properties

### action

> **action**: `string`

#### Inherited from

[`RunActionIntent`](RunActionIntent.md).[`action`](RunActionIntent.md#action)

***

### agent

> **agent**: `string`

#### Inherited from

[`RunActionIntent`](RunActionIntent.md).[`agent`](RunActionIntent.md#agent)

***

### constraints?

> `optional` **constraints?**: `Record`\<`string`, `unknown`\>

#### Inherited from

[`RunActionIntent`](RunActionIntent.md).[`constraints`](RunActionIntent.md#constraints)

***

### effects

> **effects**: [`StepEffects`](StepEffects.md)

***

### nonce?

> `optional` **nonce?**: `string`

#### Inherited from

[`RunActionIntent`](RunActionIntent.md).[`nonce`](RunActionIntent.md#nonce)

***

### parentReceiptIds?

> `optional` **parentReceiptIds?**: `string`[]

Optional: receipt ids of predecessor steps this step depends on.

***

### principal

> **principal**: `string`

#### Inherited from

[`RunActionIntent`](RunActionIntent.md).[`principal`](RunActionIntent.md#principal)

***

### runId

> **runId**: `string`

***

### stepId

> **stepId**: `string`

***

### target?

> `optional` **target?**: `string`

#### Inherited from

[`RunActionIntent`](RunActionIntent.md).[`target`](RunActionIntent.md#target)
