[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildStateTransition

# Function: buildStateTransition()

> **buildStateTransition**(`port`, `name`, `currentValue`, `previousValue`, `transition`): [`StateTransition`](../interfaces/StateTransition.md)

Build a single state transition definition.

## Parameters

### port

`number`

STATE/PREVSTATE port number.

### name

`string`

Human-readable name.

### currentValue

`string`

Current state value.

### previousValue

`string`

Previous state value (from PREVSTATE).

### transition

`string`

Description of the transition function.

## Returns

[`StateTransition`](../interfaces/StateTransition.md)
