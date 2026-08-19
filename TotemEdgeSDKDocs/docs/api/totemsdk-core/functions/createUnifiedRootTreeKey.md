[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / createUnifiedRootTreeKey

# Function: createUnifiedRootTreeKey()

> **createUnifiedRootTreeKey**(`baseSeed`): [`TreeKey`](../classes/TreeKey.md)

Create the unified root identity TreeKey (identity anchor, never a spend address).

Derivation: root_priv_seed = deriveRootPrivSeed(baseSeed)
            treeKey = new TreeKey(root_priv_seed, 64, 3)

## Parameters

### baseSeed

`Bytes`

32-byte wallet base seed (from mnemonic)

## Returns

[`TreeKey`](../classes/TreeKey.md)

Root identity TreeKey with size=64, depth=3
