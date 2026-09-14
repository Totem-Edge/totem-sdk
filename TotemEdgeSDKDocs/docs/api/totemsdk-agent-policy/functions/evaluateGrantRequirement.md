[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / evaluateGrantRequirement

# Function: evaluateGrantRequirement()

> **evaluateGrantRequirement**(`requirement`, `authorizedGrantIds`): `boolean`

Evaluate a grant requirement (allOf / anyOf) against the set of grant ids
that authorized. Explicit semantics — never "whichever approves first".

## Parameters

### requirement

[`GrantRequirement`](../interfaces/GrantRequirement.md) \| `undefined`

### authorizedGrantIds

`string`[]

## Returns

`boolean`
