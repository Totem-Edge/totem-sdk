[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / computeBlockCandidateId

# Function: computeBlockCandidateId()

> **computeBlockCandidateId**(`headerBytes`): `Uint8Array`

Compute the TxPoW ID for a mined block-candidate header.
txpowId = SHA3-256(serialized TxHeader).

## Parameters

### headerBytes

`Uint8Array`

## Returns

`Uint8Array`
