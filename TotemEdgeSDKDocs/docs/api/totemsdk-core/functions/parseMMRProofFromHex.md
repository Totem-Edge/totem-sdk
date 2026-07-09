[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / parseMMRProofFromHex

# Function: parseMMRProofFromHex()

> **parseMMRProofFromHex**(`data`): `object`

Deserialize MMRProof from bytes matching Minima's MMRProof.readDataStream()

Format:
  1. blockTime (MiniNumber)
  2. chain length (MiniNumber)
  3. Each chunk: isLeft (1 byte) + MMRData (hash with 4-byte length prefix + value MiniNumber)

CRITICAL: Java MMRData.readDataStream uses mData.readHashFromStream() which reads
a 4-byte big-endian length prefix followed by the hash bytes.

## Parameters

### data

`Bytes`

## Returns

`object`

### blockTime

> **blockTime**: `bigint`

### bytesRead

> **bytesRead**: `number`

### proof

> **proof**: [`MMRProof`](../interfaces/MMRProof.md)
