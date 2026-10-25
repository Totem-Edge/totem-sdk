[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / toMigrationPathScript

# Function: toMigrationPathScript()

> **toMigrationPathScript**(`path`): `string`

Generate the full nested MAST script for a migration path.

RFC-018 P2-2: each step delegates to the *next composed script* (its
canonical root), not merely its `toPolicyRoot` — the previous form appended a
terminal `MAST` after a `RETURN TRUE`, leaving the child unreachable. An empty
path fails closed rather than compiling to allow-all.

## Parameters

### path

`MigrationPath`

## Returns

`string`
