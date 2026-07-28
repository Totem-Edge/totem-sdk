[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildAcceptanceScript

# Function: buildAcceptanceScript()

> **buildAcceptanceScript**(`targetDomain`, `targetPolicyRoot`, `constraints?`): `string`

Build the KISSVM acceptance script for a cross-domain bridge.
This script runs in the source domain and validates that a proof
from the target domain satisfies the bridge constraints.

## Parameters

### targetDomain

`string`

### targetPolicyRoot

`string`

### constraints?

`CrossDomainConstraints` = `{}`

## Returns

`string`
