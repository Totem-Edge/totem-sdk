[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / convertStringToSeed

# Function: convertStringToSeed()

> **convertStringToSeed**(`phrase`): `Uint8Array`

Convert a seed phrase to a 32-byte seed matching Minima's BIP39.convertStringToSeed()

IMPORTANT: This is NOT standard BIP39!
Minima simply hashes the phrase bytes with SHA3-256.
No PBKDF2, no passphrase salt, no "mnemonic" prefix.

From BIP39.java convertStringToSeed():
  MiniString phrase = new MiniString(zPhrase);
  return new MiniData(Crypto.getInstance().hashData(phrase.getData()));

## Parameters

### phrase

`string`

Canonical phrase (should be cleaned first with cleanSeedPhrase)

## Returns

`Uint8Array`

32-byte SHA3-256 seed
