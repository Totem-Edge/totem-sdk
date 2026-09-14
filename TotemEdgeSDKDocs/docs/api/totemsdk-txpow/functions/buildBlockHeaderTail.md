[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / buildBlockHeaderTail

# Function: buildBlockHeaderTail()

> **buildBlockHeaderTail**(`template`, `customHash`, `txBodyHash`): `Uint8Array`

Build the TxHeader tail (everything after the nonce field) for a block
candidate with the given customHash commitment.

Field order (TxHeader.writeDataStream):
  mNonce | mChainID | mTimeMilli | mBlockNumber | mBlockDifficulty |
  super-parents RLE | mMMRRoot | mMMRTotal | mMagic | mCustomHash | mTxBodyHash

## Parameters

### template

[`MinimaWorkTemplate`](../interfaces/MinimaWorkTemplate.md)

The current Minima work template.

### customHash

`string`

The action commitment (32-byte hex) to place in mCustomHash.

### txBodyHash

`string`

SHA3-256 of the serialized TxBody (32-byte hex).

## Returns

`Uint8Array`
