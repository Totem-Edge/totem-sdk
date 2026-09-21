[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / ProofGraphEvidenceStoreOptions

# Interface: ProofGraphEvidenceStoreOptions

## Properties

### namespace?

> `optional` **namespace?**: `string`

Namespace the ArtifactStore writes artifact bytes under.

***

### strict?

> `optional` **strict?**: `boolean`

true (default) — a `corrupt` or `unavailable` evidence read throws
`StorageError` (never fail-open). `not-found` is always returned as a
result, never thrown. Set false to return audit-able results instead.
