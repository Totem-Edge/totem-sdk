[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / verifyProofOfWork

# Function: verifyProofOfWork()

> **verifyProofOfWork**(`txpowId`, `mTxnDifficulty`): [`VerifyResult`](../interfaces/VerifyResult.md)

Verify that a TxPoW ID beats the stated difficulty target.

valid = txpowId < mTxnDifficulty (big-endian 256-bit comparison)

## Parameters

### txpowId

`Uint8Array`

The 32-byte TxPoW ID (SHA3-256 of the header).

### mTxnDifficulty

`Uint8Array`

The 32-byte difficulty target from the TxBody.

## Returns

[`VerifyResult`](../interfaces/VerifyResult.md)
