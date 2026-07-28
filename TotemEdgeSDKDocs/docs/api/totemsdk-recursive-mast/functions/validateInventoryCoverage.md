[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / validateInventoryCoverage

# Function: validateInventoryCoverage()

> **validateInventoryCoverage**(`inventory`, `availableHashes`): `object`

## Parameters

### inventory

[`BranchInventory`](../interfaces/BranchInventory.md)

### availableHashes

`Set`\<`string`\>

## Returns

`object`

### available

> **available**: `number`

### coverage

> **coverage**: `number`

### missing

> **missing**: [`BranchInventoryEntry`](../interfaces/BranchInventoryEntry.md)[]

### missingCritical

> **missingCritical**: [`BranchInventoryEntry`](../interfaces/BranchInventoryEntry.md)[]

### missingRecovery

> **missingRecovery**: [`BranchInventoryEntry`](../interfaces/BranchInventoryEntry.md)[]

### total

> **total**: `number`
