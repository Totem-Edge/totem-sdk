[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / createPerAddressTreeKey

# ~~Function: createPerAddressTreeKey()~~

> **createPerAddressTreeKey**(`baseSeed`, `addressIndex`): [`TreeKey`](../classes/TreeKey.md)

## Parameters

### baseSeed

`Bytes`

### addressIndex

`number`

## Returns

[`TreeKey`](../classes/TreeKey.md)

## Deprecated

Use [createUnifiedChildTreeKey](createUnifiedChildTreeKey.md) instead.
This wrapper preserves the LEGACY per-address seed derivation
(`SHA3-256(baseSeed ‖ indexBytes(i))`) so that existing callers
that import this symbol by name continue to derive the same keys.
New code must use createUnifiedChildTreeKey which applies the unified
two-step derivation (root_priv_seed → child_seed_i).
