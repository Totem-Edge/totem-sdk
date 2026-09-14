[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / buildPoolFundTx

# Function: buildPoolFundTx()

> **buildPoolFundTx**(`params`): [`PoolFundBuildResult`](../interfaces/PoolFundBuildResult.md)

Construct the pool-funding spending transaction and the LP's deep proof.
The returned TxPoW-relevant digest is what the LP signs; broadcast/mine is
left to the caller (which then proves the coin spent into the pool script).

## Parameters

### params

[`BuildPoolFundTxParams`](../interfaces/BuildPoolFundTxParams.md)

## Returns

[`PoolFundBuildResult`](../interfaces/PoolFundBuildResult.md)
