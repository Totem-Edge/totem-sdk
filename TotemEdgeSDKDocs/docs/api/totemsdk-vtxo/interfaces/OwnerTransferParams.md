[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / OwnerTransferParams

# Interface: OwnerTransferParams

## Properties

### coin

> **coin**: [`OwnerPoolCoin`](OwnerPoolCoin.md)

The coin being transferred (input).

***

### from

> **from**: [`OwnerPoolState`](OwnerPoolState.md)

The previously committed state (must match the input coin's state).

***

### to

> **to**: [`OwnerPoolState`](OwnerPoolState.md)

The new owner. `epoch` must be greater than `from.epoch`.
