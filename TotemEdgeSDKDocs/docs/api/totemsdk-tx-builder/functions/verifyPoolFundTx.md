[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / verifyPoolFundTx

# Function: verifyPoolFundTx()

> **verifyPoolFundTx**(`tx`, `proof`, `expectedPoolAddress`, `opts?`): [`PoolFundVerification`](../interfaces/PoolFundVerification.md)

Verify a deep funding proof. `expectedPoolAddress` (the pool/channel script
address) is required to prove the spend target — without it the proof only
proves the LP signed some tx, which is why acceptance must pass it.

## Parameters

### tx

[`PoolFundTx`](../interfaces/PoolFundTx.md)

### proof

[`SignedFundingIntent`](../interfaces/SignedFundingIntent.md)

### expectedPoolAddress

`string`

### opts?

[`PoolFundVerifyOptions`](../interfaces/PoolFundVerifyOptions.md) = `{}`

## Returns

[`PoolFundVerification`](../interfaces/PoolFundVerification.md)
