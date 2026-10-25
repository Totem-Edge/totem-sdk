[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / EffectivePersistence

# Interface: EffectivePersistence

## Properties

### artifacts?

> `readonly` `optional` **artifacts?**: [`PersistenceSurfaceGuarantee`](PersistenceSurfaceGuarantee.md)

***

### durable

> `readonly` **durable**: `boolean`

true only when EVERY required surface meets its required durability.

***

### failurePolicy

> `readonly` **failurePolicy**: `"strict"` \| `"lenient"`

***

### storage

> `readonly` **storage**: [`PersistenceSurfaceGuarantee`](PersistenceSurfaceGuarantee.md)
