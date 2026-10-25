[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / createToken

# Function: createToken()

> **createToken**(`origin`, `request`): `Promise`\<[`TotemTokenCreateResponse`](../type-aliases/TotemTokenCreateResponse.md)\>

Create (mint) a custom token or NFT (RFC-005 #2/#11). `decimals: 0` mints a
non-fungible token. The wallet pops an approval; on success the created
`tokenId` (`Token.getTokenID()`) is returned.

## Parameters

### origin

`string`

### request

[`TokenCreationParams`](../interfaces/TokenCreationParams.md)

## Returns

`Promise`\<[`TotemTokenCreateResponse`](../type-aliases/TotemTokenCreateResponse.md)\>
