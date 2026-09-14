[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / computeWithdrawalId

# Function: computeWithdrawalId()

> **computeWithdrawalId**(`positionId`, `nonce`): `string`

Non-replayable withdrawal ID (#9): a domain hash over positionId + nonce,
so `wdrw-${Date.now()}-${counter}`-style forgeability in the same millisecond
is gone — the same position+nonce always yields the same ID, and a replayed
intent is detectable.

## Parameters

### positionId

`string`

### nonce

`string`

## Returns

`string`
