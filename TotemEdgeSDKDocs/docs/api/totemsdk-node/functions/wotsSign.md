[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / wotsSign

# Function: wotsSign()

> **wotsSign**(`seed`, `i`, `message`, `ps?`): `Uint8Array`

Sign a message using WOTS

Matches Java's WinternitzOTSignature.getSignature():
1. Hash the message internally: hashedMsg = SHA3-256(message)
2. For each digit d[i]: sig[i] = hash(privateKey[i], d[i] times)

IMPORTANT: This function hashes the message internally to match Java/BouncyCastle.
Callers pass RAW 32-byte data (tx digest, child root), NOT pre-hashed!

## Parameters

### seed

`Uint8Array`

32-byte master seed

### i

`number`

Key index

### message

`Uint8Array`

Raw 32-byte message (will be hashed internally)

### ps?

[`ParamSet`](../type-aliases/ParamSet.md)

WOTS parameter set (default: minima)

## Returns

`Uint8Array`

Flat signature (L × 32 = 1088 bytes)
