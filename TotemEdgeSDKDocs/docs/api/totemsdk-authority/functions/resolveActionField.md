[**@totemsdk/authority**](../index.md)

***

[@totemsdk/authority](../index.md) / resolveActionField

# Function: resolveActionField()

> **resolveActionField**(`action`, `field`): `unknown`

Resolve a constraint field against an action intent.

Supports:
 - top-level action fields (`target`, `principal`, `agent`, `action`, `nonce`);
 - flat constraint keys (`action.constraints[field]`);
 - dotted nested paths into the constraint map (`payload.foo` → `constraints.payload.foo`).

This lets governance-emitted constraints such as `target` and `payload.foo`
match without the caller manually flattening them into a single map.

## Parameters

### action

[`ActionIntent`](../interfaces/ActionIntent.md)

### field

`string`

## Returns

`unknown`
