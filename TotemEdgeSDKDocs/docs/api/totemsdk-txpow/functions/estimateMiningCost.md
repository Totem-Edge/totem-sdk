[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / estimateMiningCost

# Function: estimateMiningCost()

> **estimateMiningCost**(`txnDifficulty`, `hashRatePerSec`): [`MiningEstimate`](../interfaces/MiningEstimate.md)

Given a difficulty target and a measured hash rate, return the expected
number of hashes, expected wall-clock time, and a confidence label.

expectedHashes ≈ MAX_HASH / txnDifficulty
  (geometric distribution: each hash has P(valid) = txnDifficulty / MAX_HASH)

Confidence labels:
  fast   < 2 s
  normal 2 – 15 s
  slow   > 15 s

## Parameters

### txnDifficulty

`Uint8Array`

### hashRatePerSec

`number`

## Returns

[`MiningEstimate`](../interfaces/MiningEstimate.md)
