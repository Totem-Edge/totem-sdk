[**@totemsdk/root-identity**](../index.md)

***

[@totemsdk/root-identity](../index.md) / createRootIdentityProofVerifier

# Function: createRootIdentityProofVerifier()

> **createRootIdentityProofVerifier**(): [`RootIdentityProofVerifier`](../interfaces/RootIdentityProofVerifier.md)

Create a structural verifier compatible with `IdentityProofVerifier`.

Root ancestry is evidence only: consumers must still enforce authorization
through identity/authority. `expectedRootAddress` is mandatory for
identity/manifest binding; the verifier never widens an authorization scope.

## Returns

[`RootIdentityProofVerifier`](../interfaces/RootIdentityProofVerifier.md)
