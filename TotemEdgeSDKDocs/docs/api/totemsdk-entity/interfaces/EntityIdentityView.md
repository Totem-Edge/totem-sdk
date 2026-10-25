[**@totemsdk/entity**](../index.md)

***

[@totemsdk/entity](../index.md) / EntityIdentityView

# Interface: EntityIdentityView

`@totemsdk/entity` — disclosure-bounded entity resolution and projection
(RFC-056).

Pure, local-first. No network, signing, custody, authority evaluation or
money movement. Absence of disclosure is reported as `unknown`, never as
`invalid` or `false`.

## Properties

### controllerAddress

> **controllerAddress**: `string`

***

### createdAt

> **createdAt**: `number`

***

### id

> **id**: `string`

***

### kind

> **kind**: `IdentityKind`

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### rootAddress

> **rootAddress**: `string`

***

### status

> **status**: `IdentityStatus`

***

### version

> **version**: `number`
