[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / buildEmptyBlockBody

# Function: buildEmptyBlockBody()

> **buildEmptyBlockBody**(`prng`, `txnDifficulty`): `Uint8Array`

Build the serialized TxBody for a fresh block candidate.

Mirrors TxBody.writeDataStream with an empty transaction and witness (the
same shape Minima's MINEPULSE automine uses for block candidates):
  mPRNG | mTxnDifficulty | mTransaction | mWitness |
  mBurnTransaction | mBurnWitness | mTxPowIDList

## Parameters

### prng

`Uint8Array`

32-byte PRNG (deterministic for tests; random otherwise).

### txnDifficulty

`string`

Transaction difficulty (32-byte hex). For a block
                     candidate this is typically the block difficulty.

## Returns

`Uint8Array`
