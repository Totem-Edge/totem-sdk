[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / PublishReleaseAnnouncementInput

# Interface: PublishReleaseAnnouncementInput\<T\>

## Type Parameters

### T

`T`

## Properties

### kind

> **kind**: `"sdk-release"` \| `"security-advisory"`

***

### nonce?

> `optional` **nonce?**: `string`

***

### now?

> `optional` **now?**: `number`

***

### payload

> **payload**: `T`

***

### publisher?

> `optional` **publisher?**: `string`

Publisher identity. Defaults to the signing key's address (must match).

***

### sequence

> **sequence**: `number`

***

### subjectId?

> `optional` **subjectId?**: `string`

***

### topics?

> `optional` **topics?**: `string`[]

***

### treeKey

> **treeKey**: `TreeKey`

Release signing key (root or release key).

***

### ttlMs?

> `optional` **ttlMs?**: `number`

Lifetime; defaults to 30 days.

***

### useIndex

> **useIndex**: `number`

WOTS leaf reserved for this announcement.
