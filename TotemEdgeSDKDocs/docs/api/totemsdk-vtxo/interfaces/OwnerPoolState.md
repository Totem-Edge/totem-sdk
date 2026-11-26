[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / OwnerPoolState

# Interface: OwnerPoolState

## Properties

### epoch

> **epoch**: `number`

Monotonic state epoch; every transfer increments it.

***

### exitBlock

> **exitBlock**: `number`

Absolute block after which the committed owner may exit unilaterally.

***

### ownerAddr

> **ownerAddr**: `string`

Current owner payout address (derived from `ownerPk` by the transfer builder).

***

### ownerPk

> **ownerPk**: `string`

Current owner public-key digest (32-byte hex, `0x`-prefixed).

***

### root

> **root**: `string`

Batch/root commitment (opaque to this covenant; owner cannot change it).
