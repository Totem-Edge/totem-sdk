[**@totemsdk/entity**](../index.md)

***

[@totemsdk/entity](../index.md) / EntityAuthorityGrant

# Interface: EntityAuthorityGrant

An authority grant that has already been verified by `@totemsdk/authority`.

`@totemsdk/entity` does not verify mandates. It only enforces the subject
binding and the `validFrom`/`expiresAt` window at the requested `asOf`.

## Properties

### capabilities

> **capabilities**: `string`[]

***

### expiresAt?

> `optional` **expiresAt?**: `number`

***

### id

> **id**: `string`

***

### issuer

> **issuer**: `string`

***

### proofId

> **proofId**: `string`

***

### subject

> **subject**: `string`

***

### validFrom

> **validFrom**: `number`

***

### verified

> **verified**: `true`

***

### verifiedBy

> **verifiedBy**: `"authority"`
