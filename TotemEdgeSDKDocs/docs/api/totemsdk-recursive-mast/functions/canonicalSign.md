[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / canonicalSign

# Function: canonicalSign()

> **canonicalSign**(`domain`, `payload`, `signFn`, `version?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

## Parameters

### domain

[`EncodingDomain`](../type-aliases/EncodingDomain.md)

### payload

`Record`\<`string`, `unknown`\>

### signFn

(`data`) => `Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

### version?

`number` = `CANONICAL_ENCODING_VERSION`

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>
