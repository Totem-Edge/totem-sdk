[**@totemsdk/entity**](../index.md)

***

[@totemsdk/entity](../index.md) / EntityResolverOptions

# Interface: EntityResolverOptions

`@totemsdk/entity` — disclosure-bounded entity resolution and projection
(RFC-056).

Pure, local-first. No network, signing, custody, authority evaluation or
money movement. Absence of disclosure is reported as `unknown`, never as
`invalid` or `false`.

## Properties

### asOf?

> `optional` **asOf?**: `number`

Explicit resolution time. Defaults to `Date.now()`.

***

### proofVerifier?

> `optional` **proofVerifier?**: `IdentityProofVerifier`

Injected root-identity verifier (e.g. from `@totemsdk/root-identity`).
