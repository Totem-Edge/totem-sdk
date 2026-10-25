[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / getCoins

# Function: getCoins()

> **getCoins**(`origin`, `params?`): `Promise`\<[`TotemGetCoinsResponse`](../type-aliases/TotemGetCoinsResponse.md)\>

## Parameters

### origin

`string`

### params?

#### address?

`string`

#### minAmount?

`string`

#### relevant?

`boolean`

Only coins relevant to the wallet.

#### sendable?

`boolean`

Only spendable coins.

#### spent?

`boolean`

Filter by spent status (UTXO inspection).

#### tokenId?

`string`

## Returns

`Promise`\<[`TotemGetCoinsResponse`](../type-aliases/TotemGetCoinsResponse.md)\>
