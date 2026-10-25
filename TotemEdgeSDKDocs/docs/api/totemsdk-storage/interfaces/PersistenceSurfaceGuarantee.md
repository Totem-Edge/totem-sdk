[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / PersistenceSurfaceGuarantee

# Interface: PersistenceSurfaceGuarantee

## Properties

### mode

> `readonly` **mode**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"` \| `"none"`

`'none'` = no surface supplied; otherwise the supplied adapter's `WriteAckMode`.
