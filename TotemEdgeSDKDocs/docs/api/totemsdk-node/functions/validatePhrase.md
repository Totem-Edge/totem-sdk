[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / validatePhrase

# Function: validatePhrase()

> **validatePhrase**(`phrase`): `boolean`

Validate that a phrase contains valid BIP39 words
Does NOT check checksum (Minima doesn't use checksums)

## Parameters

### phrase

`string`

Space-separated words (any case)

## Returns

`boolean`

true if all words are valid BIP39 words
