[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / deriveRootPrivSeed

# Function: deriveRootPrivSeed()

> **deriveRootPrivSeed**(`baseSeed`): `Uint8Array`

Derive the unified root private seed from a base wallet seed.

Architecture:
  root_priv_seed = SHA3-256( serializeMiniData(baseSeed) ‖ serializeMiniData("ROOT_IDENTITY" bytes) )

## Parameters

### baseSeed

`Uint8Array`

32-byte wallet base seed (from mnemonic)

## Returns

`Uint8Array`

32-byte root private seed
