# Entity projection P0 hardening (October 2026)

> **Post-audit amendment:** RFC-056 Amendment A changes `minimal` to disclose no
> sections, including no root address or `entityRef`. This audit records the
> earlier P0 design and is retained for history.

Status: P0-A…P0-E landed; P1 `@totemsdk/entity` 0.1.0 landed (RFC-056)

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


## RFC-056 privacy and disclosure principles (normative)

Entity projection is **disclosure-bounded**, not a completeness requirement.

> **Absence of disclosure means unknown, not invalid.**
>
> `unknown != false` · `undisclosed != unauthorized` · `unproven != disproven`

- A resolver projects only information made available by its configured sources.
  It MUST NOT require completeness, infer undisclosed attributes, or treat the
  absence of an optional record as invalidity.
- A legitimate minimal view may contain only the root identity (and any
  controller/proof needed for the interaction): no identity document, manifest,
  claims, proofs, resources, actions, governance or real-world identity.
- Disclosure levels are optional, not mandatory:
  0. root identity only ("same cryptographic actor");
  1. selective child ownership proof ("these addresses share a root");
  2. semantic Totem identity (agent/device/person/organization);
  3. manifest ("I provide these capabilities");
  4. specific claims/proofs ("I possess X / own Y / satisfy Z");
  5. governance/authority ("I may perform Q").
- Projection modes: `minimal`, `available`, `purpose-bound`. A purpose-bound view
  reveals only the evidence needed for that interaction (e.g. "may I use this
  charger?"), not the whole entity graph.
- This is **pseudonymous, not anonymous**. A persistent root address can become
  linkable if reused publicly. The privacy-preserving pattern keeps the root
  private and uses children per context, disclosing a root-membership proof only
  when linking contexts is required.
- **Root ancestry SHOULD be selectively disclosed, not globally projected by
  default.** A local view may know that A, B and C share root R while the
  counterparty view for A contains only A unless policy requires otherwise.
- Root identity is therefore the **privacy floor**: "I control this
  cryptographic identity" without disclosing name, location, company, devices or
  history.

## Remaining

- **P0-E** ProofGraph manifest revision envelopes (`computeManifestEnvelopeId`) — landed in `561239c5`.
- **P1** `@totemsdk/entity` package + `projectEntity()` / `resolveEntity()` — landed (v0.1.0). See RFC-056.
- **P2 (proposed)** raw signed-claim disclosure for independent verification, manifest-revision references in entity views, and a policy-backed purpose registry.

See RFC-050 §7.1 for the unrelated pooled-capital gate.
