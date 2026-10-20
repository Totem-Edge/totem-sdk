# Entity projection P0 hardening (October 2026)

Status: P0-C and P0-D landed; P0-A/B/E pending

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

## Remaining

- **P0-A** identity explicit `asOf` + root-binding hardening.
- **P0-B** `root-identity` verifier (`encode/decode`, `createRootIdentityProofVerifier`).
- **P0-E** ProofGraph manifest revision envelopes (`computeManifestEnvelopeId`).
- **P1** `@totemsdk/entity` package + `projectEntity()` / `resolveEntity()`.

See RFC-050 §7.1 for the unrelated pooled-capital gate.
