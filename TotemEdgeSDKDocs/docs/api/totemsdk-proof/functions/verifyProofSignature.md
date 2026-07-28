[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / verifyProofSignature

# Function: verifyProofSignature()

> **verifyProofSignature**(`signedProof`): `boolean`

Verify the WOTS signature of a SignedProof.

Recomputes the digest from the unsigned proof fields (stripping signature,
anchor, rootIdentityProof). Does NOT use signature.message.

Security: cryptographically derives the expected Minima address from the
WOTS public-key digest and compares it with the declared signature.address.
Rejects the proof when the addresses do not match, preventing an attacker
from setting a privileged address while signing with a different key.

## Parameters

### signedProof

[`SignedProof`](../interfaces/SignedProof.md)

## Returns

`boolean`
