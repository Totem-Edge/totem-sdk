[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / ArtifactBackendCapabilities

# Interface: ArtifactBackendCapabilities

## Properties

### acknowledge

> `readonly` **acknowledge**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

***

### atomic

> `readonly` **atomic**: `boolean`

***

### deletable

> `readonly` **deletable**: `boolean`

RFC-007 Amendment A: whether `delete()` can actually remove/tombstone bytes.
Retention policy (`retention`) and the ability to delete are related but not
identical, so the ability is explicit.

***

### offlineReadable

> `readonly` **offlineReadable**: `boolean`

***

### retention

> `readonly` **retention**: `"none"` \| `"fixed"` \| `"managed"`

***

### writable

> `readonly` **writable**: `boolean`
