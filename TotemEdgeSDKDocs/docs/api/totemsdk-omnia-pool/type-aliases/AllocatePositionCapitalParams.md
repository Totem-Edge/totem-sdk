[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / AllocatePositionCapitalParams

# Type Alias: AllocatePositionCapitalParams

> **AllocatePositionCapitalParams** = `object`

Params exported from allocate.ts for the public index.

## Properties

### allocationType

> **allocationType**: `AllocationType`

***

### amount

> **amount**: `string`

***

### anchorRoot?

> `optional` **anchorRoot?**: `string`

Pool registry anchor root — verified against the channel's program state at co-sign (#26).

***

### ctx?

> `optional` **ctx?**: [`OmniaPoolAllocationContext`](../interfaces/OmniaPoolAllocationContext.md)

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### position

> **position**: `LiquidityPosition`

***

### purpose

> **purpose**: `LiquidityPurpose`

***

### rooting?

> `optional` **rooting?**: [`RegistryRootingContext`](../interfaces/RegistryRootingContext.md)

When set, the produced registry transition is signed and anchored.

***

### target

> **target**: [`AllocationTarget`](AllocationTarget.md)
