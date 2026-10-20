# Entity projection P0 hardening (October 2026)

Status: P0-A, P0-B, P0-C and P0-D landed; P0-E pending

## Numbering and package naming

- The proposal circulated as **“RFC-033”** collides with the existing
  `RFC-033-GO-WOTS-VIA-RUST-FFI.md`. It is tracked as **RFC-056**
  (`Entity Projection and Operational Resolution`).
- The proposed package is **`@totemsdk/entity`** — **not** `@totemsdk/entity-view`.

## P0-C — governance → authority principal

- `createGovernedMandate` and `executeProposal` now take an explicit
  `principalIdentityId`.
- The mandate's `principal` is that real identity; `proposalId` remains a signed
  constraint (`proposalId`, `actionIndex`, `membershipSnapshotHash`,
  `voteTallyHash`, `outcomeProofId`).
- End-to-end test: a governance-generated mandate verifies through the real
  Authority `verifyMandate` with a real principal identity graph; the old
  `principal = proposalId` form is rejected.

## P0-D — industrial context freshness

- `ContextValue<T> { value, observedAt, source?, proofId? }` added and exported.
- `validateContext` / `assertValidContext` enforce `ContextSchema.maxAgeMs`:
  - freshness metadata is required when `maxAgeMs` is set;
  - stale observations (`now - observedAt > maxAgeMs`) are rejected;
  - future observations are rejected;
  - the inner `value` is type-checked.
- Backward-compatible: only schemas that declare `maxAgeMs` require the wrapper.

## P0-A — explicit resolution time

- `resolveIdentityGraph(graph, { asOf })` — claims are effective only when
  `issuedAt <= asOf` and not expired at `asOf`.
- `verifyManifestIdentity(..., { asOf })` rejects manifests signed after `asOf`
  and manifests expired at `asOf`.
- Historical replay tests cover effective/expired/future claims and revocations.

## P0-B — root verifier + binding hardening

- `@totemsdk/root-identity` now exports
  `encodeRootIdentityProof`, `decodeRootIdentityProof` and
  `createRootIdentityProofVerifier` (returns `rootAddress`,
  `provenAddresses`, `proofDigest`).
- Manifest binding passes `expectedRootAddress` and requires
  `proof.rootAddress === identity.document.rootAddress`.
- Root-proven children are **evidence only**: they do not grant
  `manifest:sign` (root, controller or an explicit `manifest:sign` delegate only).

## Remaining

- **P0-E** ProofGraph manifest revision envelopes (`computeManifestEnvelopeId`).
- **P1** `@totemsdk/entity` package + `projectEntity()` / `resolveEntity()`.

See RFC-050 §7.1 for the unrelated pooled-capital gate.
