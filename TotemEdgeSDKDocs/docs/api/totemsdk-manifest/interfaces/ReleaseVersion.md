[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / ReleaseVersion

# Interface: ReleaseVersion

Release/advisory awareness feed (#update-awareness).

This module is deliberately non-enforcing: it tells an operator (or a host)
that newer package versions and advisories exist. It never installs, never
blocks a peer, and never changes behaviour on its own. Enforcement is a
separate concern.

## Properties

### deprecated?

> `optional` **deprecated?**: `boolean`

***

### integrity?

> `optional` **integrity?**: `string`

***

### publishedAt?

> `optional` **publishedAt?**: `string`

***

### version

> **version**: `string`
