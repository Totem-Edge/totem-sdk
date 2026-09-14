[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / serializeSuperParents

# Function: serializeSuperParents()

> **serializeSuperParents**(`superParents`): `Uint8Array`

Serialize the super-parent RLE runs per TxHeader.writeDataStream.

Consecutive equal hashes are coalesced into (count: MiniByte, hash) runs.
A fresh candidate with all-distinct parents serializes as 32 runs.

## Parameters

### superParents

`string`[]

## Returns

`Uint8Array`
