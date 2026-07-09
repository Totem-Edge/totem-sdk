[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / verifyTreeSignature

# Function: verifyTreeSignature()

> **verifyTreeSignature**(`expectedPubkey`, `data`, `signature`): `boolean`

Verify a tree signature against expected public key and data

Matches TreeKey.java verify():
- First proof's computed root must match expected public key
- Each intermediate proof must sign the next level's root
- Final proof must verify against the actual data

## Parameters

### expectedPubkey

`Bytes`

### data

`Bytes`

### signature

[`TreeSignature`](../interfaces/TreeSignature.md)

## Returns

`boolean`
