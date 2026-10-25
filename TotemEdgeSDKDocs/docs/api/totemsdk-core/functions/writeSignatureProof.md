[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / writeSignatureProof

# Function: writeSignatureProof()

> **writeSignatureProof**(`sigProof`): `Uint8Array`

Write SignatureProof per Java SignatureProof.writeDataStream()

Java source (SignatureProof.java):
  mPublicKey.writeDataStream(zOut);  // MiniData
  mSignature.writeDataStream(zOut);  // MiniData
  mProof.writeDataStream(zOut);      // MMRProof

## Parameters

### sigProof

`SignatureProof`

## Returns

`Uint8Array`
