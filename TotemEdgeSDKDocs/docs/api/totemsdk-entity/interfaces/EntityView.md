[**@totemsdk/entity**](../index.md)

***

[@totemsdk/entity](../index.md) / EntityView

# Interface: EntityView

`@totemsdk/entity` — disclosure-bounded entity resolution and projection
(RFC-056).

Pure, local-first. No network, signing, custody, authority evaluation or
money movement. Absence of disclosure is reported as `unknown`, never as
`invalid` or `false`.

## Properties

### asOf

> **asOf**: `number`

***

### authority?

> `optional` **authority?**: [`EntityAuthorityGrant`](EntityAuthorityGrant.md)[]

***

### children?

> `optional` **children?**: [`EntityChildProofView`](EntityChildProofView.md)

***

### claims?

> `optional` **claims?**: [`EntityClaimsView`](EntityClaimsView.md)

***

### digest

> **digest**: `string`

Canonical digest of the view excluding `digest` itself.

***

### disclosed

> **disclosed**: [`EntitySection`](../type-aliases/EntitySection.md)[]

Sections successfully disclosed.

***

### disclosureLevel

> **disclosureLevel**: [`EntityDisclosureLevel`](../type-aliases/EntityDisclosureLevel.md)

***

### identity?

> `optional` **identity?**: [`EntityIdentityView`](EntityIdentityView.md)

***

### invalid

> **invalid**: [`EntitySection`](../type-aliases/EntitySection.md)[]

Requested sections that failed verification.

***

### manifest?

> `optional` **manifest?**: [`EntityManifestView`](EntityManifestView.md)

***

### mode

> **mode**: [`EntityProjectionMode`](../type-aliases/EntityProjectionMode.md)

***

### root?

> `optional` **root?**: [`EntityRootView`](EntityRootView.md)

Present only when the projection explicitly requests the root section.

***

### status

> **status**: `Partial`\<`Record`\<[`EntitySection`](../type-aliases/EntitySection.md), [`EntitySectionState`](../type-aliases/EntitySectionState.md)\>\>

State of the sections that were requested by the projection policy.

***

### unknown

> **unknown**: [`EntitySection`](../type-aliases/EntitySection.md)[]

Requested sections with no supplied source.

***

### version

> **version**: `"entity-view/v1"`

***

### withheld

> **withheld**: [`EntitySection`](../type-aliases/EntitySection.md)[]

Sections excluded by mode/level/purpose (no existence signal).
