[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / VestingSchedule

# Interface: VestingSchedule

Vesting schedule arithmetic.

The schedule is intentionally pure and chain-agnostic: the caller supplies the
evaluation block. Integer division floors, so a vested amount is never rounded
up. The KISSVM script templates in `@totemsdk/kissvm` implement the same
release curve on-chain.

## Properties

### cliffBlock

> **cliffBlock**: `number`

***

### endBlock

> **endBlock**: `number`

***

### startBlock

> **startBlock**: `number`

***

### totalAmount

> **totalAmount**: `bigint`

***

### vestedAmount

> **vestedAmount**: `bigint`

The maximum claimable amount at the evaluated block (floor, never rounded up).
