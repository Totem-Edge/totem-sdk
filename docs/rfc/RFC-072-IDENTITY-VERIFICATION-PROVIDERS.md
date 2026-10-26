# RFC-072 — Identity Verification Providers: Sumsub and FeatherID

**Status:** Proposed — design; no implementation authorised
**Priority:** P1 (identity, KYC, and personhood)
**Created:** 2026-10-26
**Authors:** Totem SDK Contributors
**Depends on:** RFC-032 (post-quantum identity), RFC-037 (unified WOTS), RFC-070 (namespace/identity direction)
**Touches:** `identity`, `root-identity`, `proof`, `proofgraph`; new `identity-sumsub`, `identity-featherid`
**First consumer:** QRWA (RFC-003)

> **Decision.** Sumsub and FeatherID become **SDK-wide optional identity
> providers**, not application-specific integrations and not dependencies of
> `@totemsdk/identity`.
>
> `@totemsdk/identity` gains a provider-neutral external-verification contract.
> Sumsub and FeatherID ship as separate optional packages. The core stays pure,
> offline, and provider-agnostic.

---

## 1. Summary

Totem applications need portable answers to two different questions:

1. **KYC/AML and accreditation** — typically Sumsub or a manual compliance
   review.
2. **Personhood and passport uniqueness** — potentially FeatherID's RISC Zero
   passport proof.

They are not interchangeable:

- a passport does not prove accredited-investor status;
- KYC does not prove one-passport-one-person uniqueness;
- a signed identity claim records what an authorised attestor asserted, not that
  a provider's underlying check was legally sufficient.

This RFC defines one SDK-wide verification path:

```text
Sumsub / FeatherID evidence
        │
        ▼
optional provider package
  @totemsdk/identity-sumsub
  @totemsdk/identity-featherid
        │
        ▼
provider-neutral VerificationVerdict
        │
        ▼
application attestor signs an ExternalVerificationClaim
        │
        ▼
any Totem application verifies the claim
```

The application decides whether to issue a claim, which program policy applies,
and what storage/retention is appropriate.

---

## 2. Goals

- Provide Sumsub and FeatherID as optional, independently installable packages.
- Keep `@totemsdk/identity` pure, offline, and free of provider dependencies.
- Define one canonical verification result and claim shape.
- Bind providers to a Totem identity: `rootAddress`, `controllerAddress`, and
  `computeIdentityId(...)`.
- Let applications sign claims with their own attestor key.
- Fail closed on missing, expired, revoked, mismatched, or replayed evidence.
- Keep credentials and raw identity data out of claims and off-chain PII stores.
- Support composition: KYC + accreditation + personhood + uniqueness.

## 3. Non-goals

- Building a marketplace or transfer gate.
- Treating Sumsub or FeatherID as a legal determination.
- Storing passport images, Sumsub documents, or raw applicant data on-chain.
- Making the identity core depend on network clients or RISC Zero.
- Deriving accreditation from passport data.
- Replacing application-specific compliance review.
- Authorising new packages beyond the two provider adapters in this RFC.

---

## 4. Package layout

| Package | Type | Depends on | Responsibility |
|---|---|---|---|
| `@totemsdk/identity` | core, pure | `core`, `manifest` | Claim schema, WOTS signing/verification, graph resolution, external-verification types and helpers |
| `@totemsdk/identity-sumsub` | optional, server | `identity` | Sumsub request signing, applicant/WebSDK helpers, webhook verification, status mapping |
| `@totemsdk/identity-featherid` | optional, browser/Node | `identity`, optional `root-identity` | FeatherID receipt/journal verification, wallet/root binding, predicate normalization |
| `@totemsdk/proof-integritas` | precedent | `proof` | Existing optional provider-adapter pattern |

Rules:

- no provider package may be a dependency of `identity`;
- applications install only the providers they use;
- provider packages never import application code;
- provider packages never sign identity claims;
- provider packages return canonical facts and an evidence digest.

---

## 5. Core identity changes

### 5.1 New claim type

Add:

```ts
type IdentityClaimType =
  | "delegates_to"
  | "payment_recipient"
  | "service_endpoint"
  | "rotates_to"
  | "revokes"
  | "external_verification";
```

Typed aliases may follow later: `kyc_verified`, `accreditation`,
`personhood_verified`, `passport_verified`.

### 5.2 Claim payload

```ts
interface ExternalVerificationPayload {
  provider: "sumsub" | "featherid-zk";
  kind: "kyc" | "accreditation" | "personhood" | "passport";
  status: "approved" | "rejected" | "pending" | "expired" | "revoked";
  evidenceDigest: string;
  providerReferenceHash: string;
  level?: string;
  jurisdiction?: string;
  accredited?: boolean;
  personhood?: boolean;
  passportCommitment?: string;
  attestationNullifier?: string;
  reviewAnswer?: "GREEN" | "RED";
  verifiedAt: number;
  expiresAt?: number;
}
```

The claim `subject` is the identity id. The claim `object` is the provider
reference hash. Raw provider payloads never enter the claim.

### 5.3 Verification verdict

```ts
interface VerificationVerdict {
  valid: boolean;
  status: "pending" | "approved" | "rejected" | "expired" | "revoked";
  subjectId: string;
  controllerAddress: string;
  rootAddress?: string;
  facts: Omit<ExternalVerificationPayload, "evidenceDigest" | "providerReferenceHash" | "status" | "verifiedAt" | "expiresAt">;
  reasons: string[];
  evidenceDigest: string;
  providerReferenceHash: string;
  issuedAt: number;
  expiresAt?: number;
}
```

### 5.4 Provider contract

```ts
interface ExternalVerificationProvider {
  readonly provider: "sumsub" | "featherid-zk";
  verify(input: unknown, context: {
    subjectId: string;
    controllerAddress: string;
    now?: number;
  }): Promise<VerificationVerdict>;
}
```

Provider adapters may also implement `IdentityProofVerifier`, but the SDK's
canonical contract is `ExternalVerificationProvider`.

### 5.5 Helpers

```ts
createExternalVerificationClaim({
  issuer,
  subject,
  verdict,
  issuedAt,
  expiresAt,
}): IdentityClaim

verifyExternalVerificationClaim(signed, {
  providers?,
  asOf?,
}): IdentityVerifyResult
```

`resolveIdentityGraph` may accept the same optional provider registry. Provider
hooks must be additive and must not change the existing `"root-identity"` slot.

### 5.6 Backward compatibility

- Existing claims, manifests, and `proofVerifiers["root-identity"]` behavior stay
  unchanged.
- New claim type and verifier hooks are additive.
- Applications that do not install providers see no new network behavior.
- `@totemsdk/identity` remains network-free.

---

## 6. `@totemsdk/identity-sumsub`

### 6.1 API

```ts
const sumsub = createSumsubProvider({
  appToken,
  secretKey,
  levelName,
  webhookSecret,
  baseUrl: "https://api.sumsub.com",
});

const session = await sumsub.createWebSdkSession({
  externalUserId,
  ttlInSecs: 600,
});

const verdict = await sumsub.verifyWebhook({
  rawBody,
  digest,
  algorithm,
  subjectId,
  controllerAddress,
});
```

### 6.2 Responsibilities

- Sumsub app-token request signing:
  `HMAC_SHA256(secret, ts + METHOD + path + body)`.
- Webhook verification:
  `HMAC_SHA256(webhookSecret, exactRawBody)` with
  `X-Payload-Digest-Alg: HMAC_SHA256_HEX`.
- Applicant creation/reuse.
- WebSDK access-token minting.
- Applicant status mapping.
- Evidence normalization into `VerificationVerdict`.
- Event id and payload digest exposure for application idempotency.

### 6.3 Constraints

- Server-only. API secrets never reach a browser.
- No Express/HTTP-framework dependency; caller supplies raw bytes.
- No implicit environment reads; configuration is injected.
- No claim signing.
- No eligibility/program policy.
- No raw applicant payload logging.

### 6.4 Status mapping

| Sumsub state | QRWA-neutral status |
|---|---|
| `completed` + `GREEN` | `approved` |
| `completed` + `RED` | `rejected` |
| `pending`, `prechecked`, `queued`, `onHold` | `pending` |
| `reset` | `pending` |
| unknown | `rejected` or explicit `unknown`; fail closed |

Accreditation is not inferred from KYC. It requires an explicit questionnaire,
level, or application attestation.

---

## 7. `@totemsdk/identity-featherid`

### 7.1 API

```ts
const featherid = createFeatherIdVerifier({
  imageId,
  expectedChallenge,
  allowDevMode: false,
});

const verdict = await featherid.verify({
  receipt,
  journal,
  walletSignature,
  walletPublicKey,
  rootProof,
  subjectId,
  controllerAddress,
});
```

### 7.2 Responsibilities

- Verify the RISC Zero receipt against the pinned image id.
- Parse and validate the journal layout.
- Verify the Totem wallet WOTS signature over journal + challenge.
- Optionally verify a root-identity proof through `@totemsdk/root-identity`.
- Normalize passport commitment, attestation nullifier, predicates, and
  revocation facts into `VerificationVerdict`.
- Provide a stable proof envelope for portability.

### 7.3 FeatherID proof envelope

```ts
interface FeatherIdProofEnvelope {
  version: 1;
  imageId: string;
  receipt: string;
  journal: {
    passportCommitment: string;
    attestationNullifier: string;
    actionNullifier: string;
    challengeNonceHash: string;
    walletAddress: string;
    issuerCountry?: string;
    expiryStatus?: "valid" | "expired" | "unknown";
    predicates?: Record<string, boolean>;
    timestamp: number;
    revocationCommitment?: string;
  };
  walletSignature: string;
  walletPublicKey: string;
  rootIdentityProof?: string;
  providerVersion: string;
  proofDigest: string;
}
```

### 7.4 Constraints

- Does not read passports.
- Does not run the prover.
- Does not decide accreditation or program eligibility.
- Runs in browser, verifier-node, and server contexts.
- FeatherID remains responsible for the prover, verifier node, nullifier
  registry, and passport revocation list.

### 7.5 Required FeatherID changes

- Return the journal from the verifier, not only `"valid"`.
- Add a Totem wallet signature over journal + challenge.
- Add root-identity ownership proof.
- Add issuer country, expiry, predicate results, timestamp, and revocation
  commitment to the journal.
- Add nullifier and passport revocation checks.
- Complete the passive-auth guest port.

---

## 8. Application integration

The application (QRWA first, then other Totem apps) does:

1. Choose providers and install only their packages.
2. Verify evidence and obtain `VerificationVerdict`.
3. Require `valid === true` and an approved status.
4. Bind `subjectId` and `controllerAddress`.
5. Sign `createExternalVerificationClaim(...)` with its attestor key.
6. Store the claim id, evidence digest, status, expiry, and provider reference.
7. Apply program-specific policy.

Provider packages do not know about programs, transfer policies, or storage.

---

## 9. Security and privacy

### 9.1 Data minimization

- Store derived facts, provider reference hashes, and evidence digests.
- Never store passport bytes, Sumsub documents, or raw applicant payloads.
- Never put PII on-chain.
- Redact secrets and applicant identifiers from logs.
- Document retention for derived jurisdiction/accreditation facts.

### 9.2 Trust boundaries

- Sumsub app/webhook secrets stay server-side.
- FeatherID image id is pinned.
- The application attestor key is registered and revocable.
- The claim issuer must be authorised by the identity root/controller.
- Provider packages are untrusted until their signature/receipt checks pass.

### 9.3 Threat model

| Threat | Mitigation |
|---|---|
| Forged Sumsub webhook | HMAC over raw body; reject unknown algorithms |
| Replayed webhook | Event id/payload digest uniqueness |
| Replayed FeatherID proof | Challenge nonce hash + action nullifier |
| One passport, many identities | Attestation nullifier registry |
| Stolen passport | Revocation list + active-auth possession |
| Altered journal | Receipt commits journal; wallet signs journal |
| Wallet substitution | Controller address bound to root |
| Expired KYC | Claim expiry and re-verification |
| Revoked provider key | Trusted key registry and revocation epoch |
| Provider outage | Pending; no approval until verified |

### 9.4 Explicit residual risk

An application-level transfer preflight is not on-chain enforcement. Applications
must not describe a token as fully permissioned until the token script or an
issuer/transfer-agent signature enforces identity.

---

## 10. Testing

### Core

- Claim canonicalization, signing, verification.
- `external_verification` claim validation.
- Provider hook composition and fail-closed behavior.
- Backward compatibility with existing claims/manifests.

### Sumsub package

- Request signature vector.
- Webhook signature vector; malformed body, wrong digest, wrong algorithm.
- Status/reviewAnswer mapping, `onHold`, unknown state.
- Replay/idempotency helpers.
- No secret leakage in errors.

### FeatherID package

- Receipt image-id mismatch.
- Altered journal.
- Wallet signature mismatch.
- Missing/wrong challenge.
- Root-identity mismatch.
- Reused nullifier.
- Expired/revoked passport.
- Browser and Node bundle smoke tests.

### Integration

- Sumsub sandbox → verdict → signed claim.
- FeatherID test vector → verdict → signed claim.
- A non-QRWA application can consume both packages.
- `@totemsdk/identity` has no provider dependencies.

---

## 11. Release plan

### Phase 0 — Freeze

- Approve this RFC.
- Freeze claim payload, verdict, and proof envelope.
- Confirm package names and versioning.

### Phase 1 — Core + Sumsub

- Add external-verification types/helpers and verifier hooks to `identity`.
- Publish `@totemsdk/identity-sumsub`.
- Ship tests and docs.

### Phase 2 — FeatherID

- FeatherID exports journal/envelope and adds wallet/root binding.
- Publish `@totemsdk/identity-featherid`.
- Ship browser/Node/verifier-node tests.

### Phase 3 — Consumers

- QRWA and other applications consume the packages.
- Add program policy, storage, and audit trails outside the SDK.

---

## 12. Acceptance criteria

- `@totemsdk/identity` exposes external-verification claims and optional provider
  hooks without network dependencies.
- `@totemsdk/identity-sumsub` verifies real Sumsub signatures and status.
- `@totemsdk/identity-featherid` verifies a FeatherID receipt/journal and wallet
  binding.
- A non-QRWA app can install either package and obtain a `VerificationVerdict`.
- Claims verify without provider packages installed.
- Provider packages are optional and independently versioned.
- No raw PII enters claims or chain data.
- Existing identity/manifest behavior remains unchanged.

---

## 13. Open questions

1. Does `external_verification` need typed aliases, or is one claim type enough?
2. Does `identity-featherid` bundle the RISC Zero verifier WASM or accept an
   injected verifier?
3. Which root-identity proof format does the Totem mobile wallet return?
4. Is the FeatherID nullifier registry an SDK concern or a FeatherID service?
5. What are the exact package versions and publication order?
6. How are provider-specific claim revocations propagated?
7. Should provider packages expose a standard retry/idempotency store helper?
8. Which package owns the canonical `FeatherIdProofEnvelope` type?

---

## 14. Alternatives considered

### Put providers inside `@totemsdk/identity`

Rejected. The core must stay network-free and provider-agnostic.

### Keep providers in QRWA

Rejected. Provider logic must be reusable across Totem applications.

### Use only Sumsub

Rejected. KYC does not provide passport uniqueness or personhood.

### Use only FeatherID

Rejected. A passport does not provide AML/sanctions or accreditation.

### Use `IdentityProofVerifier["root-identity"]` for KYC

Rejected. That slot has root-ownership semantics and is only used by manifest
binding.

---

## 15. References

- RFC-032 — Lookup-stack post-quantum identity
- RFC-037 — Omnia unified WOTS signatures
- RFC-070 — Totem namespace and name resolution
- `packages/identity` — claims, signing, resolution, manifest binding
- `packages/proof-integritas` — optional provider-adapter precedent
- Sumsub:
  - https://docs.sumsub.com/docs/overview-development
  - https://docs.sumsub.com/reference/authentication
  - https://docs.sumsub.com/docs/webhooks
- FeatherID-new:
  - `risc_0/featherid_zk/src/main.rs`
  - `risc_0/verifier-wasm/src/lib.rs`
  - `risc_0/verifier-node/app.js`
  - `docs/roadmap-zk.md`
- QRWA:
  - `RFC-003-FEATHERID-SUMSUB-IDENTITY.md`
  - `docs/L14-ELIGIBILITY.md`
