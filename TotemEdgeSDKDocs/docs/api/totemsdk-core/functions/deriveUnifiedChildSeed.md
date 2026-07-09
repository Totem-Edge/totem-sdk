[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / deriveUnifiedChildSeed

# Function: deriveUnifiedChildSeed()

> **deriveUnifiedChildSeed**(`baseSeed`, `index`): `Uint8Array`

Derive a unified child seed for the address at `index`.

Architecture:
  child_seed_i = SHA3-256( serializeMiniData(root_priv_seed) ‖ serializeMiniData(indexBytes(i)) )

## Parameters

### baseSeed

`Uint8Array`

32-byte wallet base seed (from mnemonic)

### index

`number`

Address index (0-63)

## Returns

`Uint8Array`

32-byte child seed for the TreeKey at this address
