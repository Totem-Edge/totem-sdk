[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / verifyPoolFundTx

# Function: verifyPoolFundTx()

> **verifyPoolFundTx**(`tx`, `proof`, `expectedPoolAddress?`): [`PoolFundVerification`](../interfaces/PoolFundVerification.md)

Verify a deep funding proof. `expectedPoolAddress` (the pool/channel script
address) is required to prove the spend target — without it the proof only
proves the LP signed some tx, which is why acceptance must pass it.

## Parameters

### tx

[`PoolFundTx`](../interfaces/PoolFundTx.md)

### proof

[`DeepFundingProof`](../interfaces/DeepFundingProof.md)

### expectedPoolAddress?

`string`

## Returns

[`PoolFundVerification`](../interfaces/PoolFundVerification.md)
