[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / ConfirmationProvider

# Interface: ConfirmationProvider

Minimal provider the verifier polls. `MinimaProvider` implements this.

## Methods

### getBalance()?

> `optional` **getBalance**(`address`, `tokenId?`): `Promise`\<`string`\>

Optional: recipient balance lookup, for the `expect` delta check.

#### Parameters

##### address

`string`

##### tokenId?

`string`

#### Returns

`Promise`\<`string`\>

***

### getTxPowStatus()

> **getTxPowStatus**(`txpowId`): `Promise`\<[`TxPowStatus`](TxPowStatus.md) \| `null`\>

Fetch the txpow record, or `null` if the node does not serve it.

#### Parameters

##### txpowId

`string`

#### Returns

`Promise`\<[`TxPowStatus`](TxPowStatus.md) \| `null`\>
