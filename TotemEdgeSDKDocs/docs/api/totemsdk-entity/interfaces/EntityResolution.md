[**@totemsdk/entity**](../index.md)

***

[@totemsdk/entity](../index.md) / EntityResolution

# Interface: EntityResolution

`@totemsdk/entity` — disclosure-bounded entity resolution and projection
(RFC-056).

Pure, local-first. No network, signing, custody, authority evaluation or
money movement. Absence of disclosure is reported as `unknown`, never as
`invalid` or `false`.

## Properties

### asOf

> **asOf**: `number`

***

### authority

> **authority**: [`EntityAuthorityGrant`](EntityAuthorityGrant.md)[]

***

### children

> **children**: [`EntityChildProofView`](EntityChildProofView.md) \| `null`

***

### entityId

> **entityId**: `string`

***

### errors

> **errors**: `string`[]

***

### manifest

> **manifest**: [`EntityManifestBindingView`](EntityManifestBindingView.md) \| `null`

***

### resolved

> **resolved**: `ResolvedIdentity` \| `null`

***

### rootAddress

> **rootAddress**: `string`

***

### status

> **status**: `Record`\<[`EntitySection`](../type-aliases/EntitySection.md), [`EntitySectionState`](../type-aliases/EntitySectionState.md)\>

***

### version

> **version**: `"entity-resolution/v1"`
