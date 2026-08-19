[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / phraseToSeed

# Function: phraseToSeed()

> **phraseToSeed**(`rawPhrase`): `Uint8Array`

Full pipeline: raw user input → 32-byte seed

1. cleanSeedPhrase() - normalize with prefix matching, output uppercase
2. convertStringToSeed() - SHA3-256 hash of phrase bytes

## Parameters

### rawPhrase

`string`

User's input (may be abbreviated, mixed case)

## Returns

`Uint8Array`

32-byte seed for TreeKey

## Throws

Error if phrase contains invalid words
