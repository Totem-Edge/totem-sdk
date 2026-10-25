[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / validatePolicyAnchorConfig

# Function: validatePolicyAnchorConfig()

> **validatePolicyAnchorConfig**(`config`): `void`

Validate a [PolicyAnchorConfig](../interfaces/PolicyAnchorConfig.md)'s port assignments.

Throws when two ports collide, when a port is not a non-negative integer,
when the reserved subject port (0) is reused, or when the action-argument
port (`actionRoot + 1`) collides with a committed port. Collisions would
let one state slot be interpreted two ways and are a fail-open risk, so
they are rejected at build time rather than at spend time.

## Parameters

### config

[`PolicyAnchorConfig`](../interfaces/PolicyAnchorConfig.md)

## Returns

`void`
