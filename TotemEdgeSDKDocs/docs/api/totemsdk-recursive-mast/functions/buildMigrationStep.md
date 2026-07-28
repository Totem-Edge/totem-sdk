[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildMigrationStep

# Function: buildMigrationStep()

> **buildMigrationStep**(`fromPolicyRoot`, `toPolicyRoot`, `activationBlock`, `deprecationBlock`, `proof`): `MigrationStep`

Build a single migration step.

## Parameters

### fromPolicyRoot

`string`

The old policy root being migrated from.

### toPolicyRoot

`string`

The new policy root being migrated to.

### activationBlock

`number`

Block height at which this migration activates.

### deprecationBlock

`number`

Block height at which the old policy is fully deprecated.

### proof

`string`

Merkle proof that the migration script is in the old policy root.

## Returns

`MigrationStep`
