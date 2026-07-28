[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildMigrationScript

# Function: buildMigrationScript()

> **buildMigrationScript**(`fromPolicyRoot`, `toPolicyRoot`, `activationBlock`, `deprecationBlock`): `string`

Build the KISSVM migration script.
During the transition window (activationBlock ≤

## Parameters

### fromPolicyRoot

`string`

### toPolicyRoot

`string`

### activationBlock

`number`

### deprecationBlock

`number`

## Returns

`string`

## BLOCK

< deprecationBlock),
both old and new policies are accepted. After deprecationBlock, only the
new policy is accepted.
