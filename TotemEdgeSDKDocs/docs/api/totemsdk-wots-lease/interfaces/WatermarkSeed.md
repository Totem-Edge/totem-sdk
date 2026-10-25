[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / WatermarkSeed

# Interface: WatermarkSeed

A portable, self-describing watermark snapshot (RFC-013 §9). Used to seed a
freshly-provisioned local watermark from an exported blob, an operator-supplied
high-water mark, or the on-chain cursor, so a restored wallet never starts
below the true high-water mark and reissues a spent leaf.

## Properties

### addressCursor

> `readonly` **addressCursor**: `number`

***

### l1Cursor

> `readonly` **l1Cursor**: `number`

***

### l2Cursor

> `readonly` **l2Cursor**: `number`

***

### treeId

> `readonly` **treeId**: `string`

***

### unavailable?

> `readonly` `optional` **unavailable?**: readonly `number`[]

Flat indices already consumed (reserved/committed/burned).

***

### version

> `readonly` **version**: `1`
