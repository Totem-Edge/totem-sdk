[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / deserializeTreeSignature

# Function: deserializeTreeSignature()

> **deserializeTreeSignature**(`data`): [`TreeSignature`](../interfaces/TreeSignature.md)

Deserialize a TreeSignature from bytes

Matches Java's Signature.readDataStream():
- Number of proofs: MiniNumber format
- Each SignatureProof: MiniData(pubkey) + MiniData(signature) + MMRProof

## Parameters

### data

`Bytes`

## Returns

[`TreeSignature`](../interfaces/TreeSignature.md)
