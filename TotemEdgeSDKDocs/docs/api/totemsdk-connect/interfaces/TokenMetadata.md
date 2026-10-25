[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TokenMetadata

# Interface: TokenMetadata

Rich token metadata, serialized into the on-chain token `name` as JSON.

## Properties

### attributes?

> `optional` **attributes?**: `object`[]

Arbitrary structured attributes (traits for NFTs).

#### trait\_type

> **trait\_type**: `string`

#### value

> **value**: `string` \| `number`

***

### description?

> `optional` **description?**: `string`

Longer description.

***

### externalUrl?

> `optional` **externalUrl?**: `string`

External/canonical URL for the token.

***

### extra?

> `optional` **extra?**: `Record`\<`string`, `unknown`\>

Any additional metadata fields, merged verbatim.

***

### icon?

> `optional` **icon?**: `string`

Small icon URL or data URI.

***

### image?

> `optional` **image?**: `string`

Image as a URL.

***

### imageData?

> `optional` **imageData?**: `string`

Image as an inline data URI (e.g. `data:image/png;base64,...`).

***

### name

> **name**: `string`

Token display name (required).

***

### ticker?

> `optional` **ticker?**: `string`

Short ticker/symbol (e.g. "TOTEM").

***

### url?

> `optional` **url?**: `string`

Website / project URL.

***

### webvalidate?

> `optional` **webvalidate?**: `string`

Web-verification link used by explorers/wallets to validate the token
(Minima's `webvalidate` convention).
