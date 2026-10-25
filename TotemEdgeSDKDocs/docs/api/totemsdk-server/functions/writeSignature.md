[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / writeSignature

# Function: writeSignature()

> **writeSignature**(`sig`): `Uint8Array`

Write Signature per Java Signature.writeDataStream()

Java source (Signature.java):
  MiniNumber.WriteToStream(zOut, mSignatures.size());
  for each sig: sig.writeDataStream(zOut);

## Parameters

### sig

`Signature`

## Returns

`Uint8Array`
