[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / convertWordListToSeed

# Function: convertWordListToSeed()

> **convertWordListToSeed**(`words`): `Uint8Array`

Convert word array to seed matching Minima's BIP39.convertWordListToSeed()

From BIP39.java:
  String allwords = convertWordListToString(zWords);
  MiniString ministr = new MiniString(allwords);
  MiniData hash = new MiniData(Crypto.getInstance().hashData(ministr.getData()));

## Parameters

### words

`string`[]

Array of BIP39 words

## Returns

`Uint8Array`

32-byte SHA3-256 seed
