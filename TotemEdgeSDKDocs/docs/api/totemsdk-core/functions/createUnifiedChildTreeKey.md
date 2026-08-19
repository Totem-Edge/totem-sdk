[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / createUnifiedChildTreeKey

# Function: createUnifiedChildTreeKey()

> **createUnifiedChildTreeKey**(`baseSeed`, `index`): [`TreeKey`](../classes/TreeKey.md)

Create the unified child TreeKey for spend address at `index`.

Derivation: child_seed_i = deriveUnifiedChildSeed(baseSeed, i)
            treeKey = new TreeKey(child_seed_i, 64, 3)

## Parameters

### baseSeed

`Bytes`

32-byte wallet base seed (from mnemonic)

### index

`number`

Address index (0-63)

## Returns

[`TreeKey`](../classes/TreeKey.md)

TreeKey for this spend address with size=64, depth=3
