[**@totemsdk/entity**](../index.md)

***

[@totemsdk/entity](../index.md) / EntitySources

# Interface: EntitySources

`@totemsdk/entity` — disclosure-bounded entity resolution and projection
(RFC-056).

Pure, local-first. No network, signing, custody, authority evaluation or
money movement. Absence of disclosure is reported as `unknown`, never as
`invalid` or `false`.

## Properties

### authority?

> `optional` **authority?**: [`EntityAuthorityGrant`](EntityAuthorityGrant.md)[]

Optional: grants already verified by `@totemsdk/authority`.

***

### identity

> **identity**: `IdentityGraph`

Required: the actor's identity graph.

***

### manifest?

> `optional` **manifest?**: `SignedManifest`\<`Manifest`\>

Optional: a signed manifest to bind to the identity.

***

### rootIdentityProof?

> `optional` **rootIdentityProof?**: `string`

Optional: serialized `OwnershipProof`, verified via `proofVerifier`.
