[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / calculateProofRoot

# Function: calculateProofRoot()

> **calculateProofRoot**(`leafData`, `proof`): `Bytes`

Calculate root from leaf data and proof
Matches SignatureProof.getRootPublicKey() in Java

From SignatureProof.java:
  MMRData pubentry = MMRData.CreateMMRDataLeafNode(mPublicKey, MiniNumber.ZERO);
  return mProof.calculateProof(pubentry).getData();

## Parameters

### leafData

[`MMRData`](../interfaces/MMRData.md)

### proof

[`MMRProof`](../interfaces/MMRProof.md)

## Returns

`Bytes`
