[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / computeSuperLevel

# Function: computeSuperLevel()

> **computeSuperLevel**(`txpowId`, `blockDifficulty`): `number`

Compute the Minima Super level for a TxPoW ID against a block difficulty,
with Minima's exact integer semantics.

From TxPoW.calculateTXPOWID() / getSuperLevel():
  quot  = blockDifficulty / txpowId          (unsigned BigInteger division)
  super = quot.bitLength() - 1               (floor(log2(quot)))
  if super >= MINIMA_CASCADE_LEVELS (32) → clamp to 31

When the TxPoW is NOT a block (txpowId >= blockDifficulty), quot = 0,
bitLength(0) = 0, so super = -1.

Result:
  -1   — not a Minima block
   0   — ordinary/base Minima block (Super-0)
   1..31 — Super-1 … Super-31 (stronger blocks; 31 is the maximum represented)

## Parameters

### txpowId

`Uint8Array`

SHA3-256(header), 32 bytes.

### blockDifficulty

`string`

32-byte hex block difficulty target.

## Returns

`number`
