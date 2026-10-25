[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / ArtifactCacheRetentionPolicy

# Interface: ArtifactCacheRetentionPolicy

Per-object cache policy. Deliberately does NOT reuse the `retention:
'fixed'|'managed'|'none'` vocabulary: that is a BACKEND capability, not a
per-object request.

## Properties

### invalidateOnExpiry?

> `readonly` `optional` **invalidateOnExpiry?**: `boolean`

***

### ttlMs?

> `readonly` `optional` **ttlMs?**: `number`
