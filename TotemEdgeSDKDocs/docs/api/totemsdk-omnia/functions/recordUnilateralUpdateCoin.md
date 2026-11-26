[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / recordUnilateralUpdateCoin

# Function: recordUnilateralUpdateCoin()

> **recordUnilateralUpdateCoin**(`channel`, `coinId`, `chainProvider?`, `minConfirmations?`): `Promise`\<[`OmniaChannel`](../interfaces/OmniaChannel.md)\>

Record the on-chain output of the broadcast unilateral update.

The update transaction is built with the eltoo placeholder coin id, so its
output coin id cannot be derived locally — only the chain knows it. Until this
is recorded, `finalizeUnilateralClose` refuses to run: finalising on an
unfunded assumption is exactly how a premature settlement would happen.

Recording also restarts the contest clock from the coin's actual inclusion
height, rather than from the pre-broadcast tip.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### coinId

`string`

### chainProvider?

`ChainStateProvider`

### minConfirmations?

`number` = `1`

## Returns

`Promise`\<[`OmniaChannel`](../interfaces/OmniaChannel.md)\>
