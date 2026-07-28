[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / canonicalVerify

# Function: canonicalVerify()

> **canonicalVerify**(`domain`, `payload`, `signature`, `verifyFn`, `version?`): `Promise`\<`boolean`\>

## Parameters

### domain

[`EncodingDomain`](../type-aliases/EncodingDomain.md)

### payload

`Record`\<`string`, `unknown`\>

### signature

`Uint8Array`

### verifyFn

(`data`, `sig`) => `boolean` \| `Promise`\<`boolean`\>

### version?

`number` = `CANONICAL_ENCODING_VERSION`

## Returns

`Promise`\<`boolean`\>
