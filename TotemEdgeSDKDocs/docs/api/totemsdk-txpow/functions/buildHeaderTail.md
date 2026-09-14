[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / buildHeaderTail

# Function: buildHeaderTail()

> **buildHeaderTail**(`txBodyHash`, `timeMilli`): `Uint8Array`

Build the "header tail" — the part of TxHeader that follows mNonce.

This is computed once at the start of a mine and never changes during it.

This is the fresh-transaction header shape (blockNumber=0, MAX_HASH block
difficulty, zero super-parents, zero MMR, zero customHash). Block-candidate
mining (Machine Work Admission) builds its own tail via
`admission/template.ts` with real chain state and a customHash commitment.

## Parameters

### txBodyHash

`Uint8Array`

### timeMilli

`bigint`

## Returns

`Uint8Array`
