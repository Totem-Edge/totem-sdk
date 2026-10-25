[**@totemsdk/entity**](../index.md)

***

[@totemsdk/entity](../index.md) / EntityProjectionRequest

# Interface: EntityProjectionRequest

`@totemsdk/entity` — disclosure-bounded entity resolution and projection
(RFC-056).

Pure, local-first. No network, signing, custody, authority evaluation or
money movement. Absence of disclosure is reported as `unknown`, never as
`invalid` or `false`.

## Properties

### asOf?

> `optional` **asOf?**: `number`

If present, MUST equal the resolution `asOf` (prevents replay).

***

### includeMetadata?

> `optional` **includeMetadata?**: `string`[]

Identity-document metadata key allow-list. Omit to disclose no metadata.

***

### maxDisclosureLevel?

> `optional` **maxDisclosureLevel?**: [`EntityDisclosureLevel`](../type-aliases/EntityDisclosureLevel.md)

Upper bound on disclosure. Defaults to 0 for `minimal`, 5 otherwise.

***

### mode?

> `optional` **mode?**: [`EntityProjectionMode`](../type-aliases/EntityProjectionMode.md)

Defaults to `minimal`.

***

### purposes?

> `optional` **purposes?**: [`EntityPurpose`](../type-aliases/EntityPurpose.md)[]

Required for `purpose-bound`; ignored otherwise.
