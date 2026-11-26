[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / serializeWitness

# Function: serializeWitness()

> **serializeWitness**(`wotsData`, `coinProofsHex`, `scriptDescriptors`, `extraScripts?`, `externalSignatures?`): `Uint8Array`

Serialize the three Minima witness sections:

  [Signature count][Signature…]
  [CoinProof count][CoinProof…]
  [ScriptProof count][ScriptProof…]

`coinProofsHex` must be the serialized `coinexport` payload. Script proofs are
derived from each input's `ScriptDescriptor`; extra MAST scripts are appended.

## Parameters

### wotsData

[`WotsSignatureData`](../interfaces/WotsSignatureData.md) \| `undefined`

### coinProofsHex

`string`[]

### scriptDescriptors

`ScriptDescriptor`[]

### extraScripts?

`Map`\<`string`, `string`\>

### externalSignatures?

`ExternalSignature`[]

## Returns

`Uint8Array`
