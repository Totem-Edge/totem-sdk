[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / computeTxPoWId

# Function: computeTxPoWId()

> **computeTxPoWId**(`headerBytes`): `Uint8Array`

Compute TxPoW ID = SHA3-256(TxHeader bytes).
Matches Java: Crypto.getInstance().hashObject(mHeader) via SHA3Digest(256).

## Parameters

### headerBytes

`Uint8Array`

## Returns

`Uint8Array`
