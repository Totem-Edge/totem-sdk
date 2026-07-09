[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / verifyTxPoWWork

# Function: verifyTxPoWWork()

> **verifyTxPoWWork**(`txpowHex`): [`VerifyResult`](../interfaces/VerifyResult.md)

Relay-side work verification from raw TxPoW hex.

Validates hex format, minimum length (spam filter), then computes
SHA3-256 of the serialized bytes as a proxy txpowId and checks it
against TX_POW_MIN_DIFFICULTY.

Note: full structural parsing of TxPoW headers is deferred to a future
parser. PureMinima performs authoritative work verification on submission.

## Parameters

### txpowHex

`string`

## Returns

[`VerifyResult`](../interfaces/VerifyResult.md)
