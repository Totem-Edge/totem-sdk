[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / verifyTxPoWWork

# Function: verifyTxPoWWork()

> **verifyTxPoWWork**(`txpowHex`): [`VerifyResult`](../interfaces/VerifyResult.md)

Relay-side work verification from raw TxPoW hex.

Parses the TxPoW hex into header and body by locating the hasBody byte via
body-hash verification. Computes the canonical TxPoW ID (SHA3-256 of the
header only), extracts mTxnDifficulty from the TxBody, and verifies:
  txpowId < mTxnDifficulty

Falls back to TX_POW_MIN_DIFFICULTY as a spam filter when:
  - The hex is invalid or malformed
  - No valid header/body split can be found (non-standard structure)
  - mTxnDifficulty cannot be extracted from the body

PureMinima performs authoritative work verification on submission; this
function is a first-pass relay-side filter.

## Parameters

### txpowHex

`string`

Hex-encoded serialized TxPoW (TxHeader | 0x01 | TxBody).

## Returns

[`VerifyResult`](../interfaces/VerifyResult.md)
