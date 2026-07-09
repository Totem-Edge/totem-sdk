[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / wotsVerify

# Function: wotsVerify()

> **wotsVerify**(`sig`, `message`, `pkFull`, `ps?`): `boolean`

Verify WOTS signature against a FULL 1088-byte public key

Matches Java's Winternitz.verify():
1. Hash the message internally: hashedMsg = SHA3-256(message)
2. Recover FULL public key from signature using hashedMsg (1088 bytes)
3. Compare FULL reconstructed key to expected FULL public key

CRITICAL: Java's Winternitz.verify() compares the FULL 1088-byte reconstructed
public key against the FULL 1088-byte stored public key, NOT a 32-byte digest!

IMPORTANT: This function hashes the message internally to match Java/BouncyCastle.
Callers pass RAW 32-byte data (tx digest, child root), NOT pre-hashed!

## Parameters

### sig

`Uint8Array`

The 1088-byte WOTS signature

### message

`Uint8Array`

Raw 32-byte message (will be hashed internally)

### pkFull

`Uint8Array`

The FULL 1088-byte WOTS public key (L=34 × 32 bytes)

### ps?

[`ParamSet`](../type-aliases/ParamSet.md) = `...`

WOTS parameter set (default: minima)

## Returns

`boolean`
