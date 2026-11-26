[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / deriveSignatureLeafBinding

# Function: deriveSignatureLeafBinding()

> **deriveSignatureLeafBinding**(`signature`): [`SignatureLeafBinding`](../interfaces/SignatureLeafBinding.md) \| `null`

Recover the signing leaf from the MMR proof carried by a TreeSignature.

Each proof's chunks encode the leaf index in their `isLeft` flags, so the
claimed `signingIndices` can be checked against the signature itself rather
than trusted from the state payload.

## Parameters

### signature

[`ChannelSignature`](../type-aliases/ChannelSignature.md)

## Returns

[`SignatureLeafBinding`](../interfaces/SignatureLeafBinding.md) \| `null`
