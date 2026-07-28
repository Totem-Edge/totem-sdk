[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / StateMachineConfig

# Interface: StateMachineConfig

## Properties

### id

> **id**: `string`

State machine identifier.

***

### initialState

> **initialState**: `string`

Initial state.

***

### name

> **name**: `string`

Human-readable name.

***

### operatorPkd?

> `optional` **operatorPkd?**: `string`

Operator public key digest (for authorization).

***

### statePort

> **statePort**: `number`

STATE port for the current state.

***

### states

> **states**: `string`[]

Allowed states.

***

### transitions

> **transitions**: `Record`\<`string`, `string`[]\>

Allowed transitions: from → to[].
