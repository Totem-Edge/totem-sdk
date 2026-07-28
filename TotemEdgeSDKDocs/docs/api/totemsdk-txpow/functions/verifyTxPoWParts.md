[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / verifyTxPoWParts

# Function: verifyTxPoWParts()

> **verifyTxPoWParts**(`headerBytes`, `bodyBytes`): [`VerifyResult`](../interfaces/VerifyResult.md)

Verify a TxPoW from pre-split header and body bytes.

Computes SHA3-256(headerBytes) as the txpowId, extracts mTxnDifficulty
from the body, and checks txpowId < mTxnDifficulty. Falls back to
TX_POW_MIN_DIFFICULTY when the body cannot be parsed.

## Parameters

### headerBytes

`Uint8Array`

Raw TxHeader bytes (SHA3-256 of these is the txpowId).

### bodyBytes

`Uint8Array`

Raw TxBody bytes (mTxnDifficulty extracted from here).

## Returns

[`VerifyResult`](../interfaces/VerifyResult.md)
