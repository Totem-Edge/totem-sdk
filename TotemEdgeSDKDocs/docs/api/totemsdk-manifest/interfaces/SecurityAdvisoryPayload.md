[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / SecurityAdvisoryPayload

# Interface: SecurityAdvisoryPayload

Payload for `kind: 'security-advisory'` — human action required, signed.

## Properties

### advisories

> **advisories**: `object`[]

#### affected

> **affected**: `object`[]

#### id

> **id**: `string`

#### patchedIn?

> `optional` **patchedIn?**: `string`

#### publishedAt?

> `optional` **publishedAt?**: `string`

#### severity

> **severity**: `"low"` \| `"moderate"` \| `"high"` \| `"critical"`

#### title

> **title**: `string`

#### url?

> `optional` **url?**: `string`
