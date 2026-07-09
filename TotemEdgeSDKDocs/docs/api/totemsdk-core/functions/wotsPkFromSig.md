[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / wotsPkFromSig

# Function: wotsPkFromSig()

> **wotsPkFromSig**(`message`, `signature`, `paramSet?`): `Uint8Array`

Recover public key from signature

Matches WinternitzOTSVerify.Verify():
  1. Hash the message: hashedMsg = SHA3-256(message)
  2. for each digit d[i]:
       top[i] = hash(sig[i], (255 - d[i]) times)
  3. return H(concat(tops))

CRITICAL: This function hashes the message internally to match Java/BouncyCastle
Winternitz behavior. Both wotsSign and wotsPkFromSig hash internally for parity.

## Parameters

### message

`Uint8Array`

### signature

[`WotsSignature`](../type-aliases/WotsSignature.md)

### paramSet?

[`ParamSet`](../type-aliases/ParamSet.md)

## Returns

`Uint8Array`
