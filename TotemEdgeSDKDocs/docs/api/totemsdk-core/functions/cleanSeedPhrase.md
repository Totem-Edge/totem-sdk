[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / cleanSeedPhrase

# Function: cleanSeedPhrase()

> **cleanSeedPhrase**(`seedPhrase`): `string`

Clean and normalize a seed phrase matching Minima's BIP39.cleanSeedPhrase() exactly

From BIP39.java:
- Split by whitespace
- For each token: lowercase; length >= 3 required
- If token length < 4: must match full word in wordlist
- Else: accept FIRST word in wordlist that startsWith(token)
- Join with single spaces, trim, then convert to UPPERCASE

## Parameters

### seedPhrase

`string`

Raw user input (may be abbreviated, mixed case)

## Returns

`string`

Canonical uppercase phrase with full words from BIP39 list

## Throws

Error if any word cannot be matched
