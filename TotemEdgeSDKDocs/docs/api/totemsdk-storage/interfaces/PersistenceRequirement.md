[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / PersistenceRequirement

# Interface: PersistenceRequirement

## Properties

### acknowledge?

> `readonly` `optional` **acknowledge?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Desired KV floor. Meaningful when `durable:false` (or exactly the durable floor).

***

### artifactAcknowledge?

> `readonly` `optional` **artifactAcknowledge?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Desired artifact floor. Default: `acknowledge`. Meaningful when `durable:false`.

***

### atomic?

> `readonly` `optional` **atomic?**: `boolean`

Requires atomic transactions (delegated to `assertCapabilities()`).

***

### conditional?

> `readonly` `optional` **conditional?**: `boolean`

Requires conditional/CAS writes (delegated to `assertCapabilities()`).

***

### durable

> `readonly` **durable**: `boolean`

Not weakenable. `durable:true` ⇒ the required KV floor and the required
artifact floor are ALWAYS `'durably-acknowledged'`; an explicit non-durable
`acknowledge`/`artifactAcknowledge` alongside `durable:true` is a
contradiction and throws.

***

### failurePolicy?

> `readonly` `optional` **failurePolicy?**: `"strict"` \| `"lenient"`

Required corruption policy. Default: 'strict'.

***

### needsArtifactDelete?

> `readonly` `optional` **needsArtifactDelete?**: `boolean`

Requires `artifacts.capabilities.deletable`.

***

### needsArtifacts?

> `readonly` `optional` **needsArtifacts?**: `boolean`

Functional requirement, independent of `durable`.

***

### rebuildable?

> `readonly` `optional` **rebuildable?**: `boolean`

Derivable content ⇒ corrupt may be rebuilt (lenient recovery).
