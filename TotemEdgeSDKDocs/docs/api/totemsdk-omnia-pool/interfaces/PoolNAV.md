[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / PoolNAV

# Interface: PoolNAV

## Properties

### accruedFees

> **accruedFees**: `bigint`

Sum of recorded but unclaimed LP fees.

***

### nav

> **nav**: `bigint`

Net asset value = totalCommitted + accruedFees.

***

### totalAllocated

> **totalAllocated**: `bigint`

Capital currently allocated to live execution backends.

***

### totalAvailable

> **totalAvailable**: `bigint`

Capital available for new allocations.

***

### totalCommitted

> **totalCommitted**: `bigint`

Total committed capital across all positions.

***

### totalReserved

> **totalReserved**: `bigint`

Capital reserved but not yet allocated.
