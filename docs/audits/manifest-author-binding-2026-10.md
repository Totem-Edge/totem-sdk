# Security Advisory — Manifest Author Binding (2026-10)

**Severity:** High

**Affected:** `@totemsdk/manifest` 1.0.0 through 2.0.1

**Fixed:** `@totemsdk/manifest` 2.0.2 (unreleased at time of writing)

**Reported:** 2026-09-29 (privately)

## Summary

`verifyManifest` verified the WOTS signature against the supplied
`signerPublicKey` and checked that the wrapper `authorAddress` matched the
manifest's declared author field. It did **not** derive the address from
`signerPublicKey`.

An attacker could therefore:

1. create a manifest declaring a victim's `authorAddress` / `agentAddress` /
   `operatorAddress`;
2. sign it with their own WOTS key;
3. replace the wrapper `authorAddress` with the victim's address.

Verification returned `valid: true` and reported the victim as the signer,
because both the wrapper and the manifest contained the victim address. The
signature was valid only for the attacker's key.

## Impact

Consumers that trusted `verifyManifest(...).signerAddress` or the manifest author
field could accept an impersonated manifest. This affects discovery, manifest
binding, registry ingestion and any policy that treats a verified manifest author
as an identity.

## Fix

`verifyManifest` now:

1. verifies the WOTS signature against `signerPublicKey`;
2. derives the Minima address from `signerPublicKey`;
3. requires the wrapper `authorAddress` to equal the derived address;
4. requires the manifest's declared author/agent/operator address to equal the
   derived address;
5. returns the derived address as `signerAddress`.

The Rust/WASM verifier applies the same checks and requires an address-derivation
callback. Regression tests cover the forged-wrapper case.

## Mitigation for older versions

If an upgrade is not possible, do not trust `signed.authorAddress`. Independently
derive the address from `signed.signerPublicKey` and require equality with both
the wrapper and the manifest address before authorising anything.

## Residual notes

- `signedAt` and `rootIdentityProof` are wrapper fields outside the signed
  manifest digest; treat them as metadata, not authenticated manifest content.
- WOTS key reuse remains a separate critical invariant governed by
  `@totemsdk/wots-lease`.
- Consumers must still verify the manifest's semantic claims and authority; a
  valid signer address is not a capability grant.
