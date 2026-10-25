[**@totemsdk/minima-rpc**](../index.md)

***

[@totemsdk/minima-rpc](../index.md) / MagicInfo

# Interface: MagicInfo

## Properties

### desired?

> `optional` **desired?**: `object`

This node's desired values (used for the weighted-average retarget).

#### kissvm?

> `optional` **kissvm?**: `string`

#### txnsperblock?

> `optional` **txnsperblock?**: `string`

#### txpowsize?

> `optional` **txpowsize?**: `string`

***

### lastblock

> **lastblock**: [`MagicNumbers`](MagicNumbers.md) \| `null`

Magic values of the current tip block (null before the first block).
