# RFC-060 — Bootstrap Points and Future Token Recognition

Status: **Draft — proposed.** Phase 1 (data-only points ledger, program manifest, rules, digests, in-memory store) is authorised. Host/Connect APIs, indexers, anchoring and any future token recognition are gated by RFC-058 P0/P1/P2.
Created: 2026-10-20
Authors: Totem SDK Contributors
Depends on: RFC-039 (Custody Conformance), RFC-048 (Omnia Primitive Completeness), RFC-050 (Eefi Product Architecture), RFC-058 (Custody Modes and Disclosure Gate), RFC-059 (Eefi Credit and Discoverable Liquidity), Totem Network Economics Gold Paper v2.0
References: RFC-053 (Eefi Generic Contracts), RFC-055 (routing), RFC-057 (distributed storage), RFC-002 (parity)
Touches: `points` (new), `manifest`, `identity`, `root-identity`, `omnia-host`, `connect`, `storage`, `proofgraph`, `statechain` (optional anchoring), `liquidity-bond`, `eefi-credit`, `extensions/totem-extension`, MOKA (external consumer)

> **Positioning.** The Totem ecosystem is prerelease and has no users and no live
> `$TOTEM`. Do **not** create or emit a token now. Run a time-boxed **Bootstrap
> Points** programme across a small, explicit set of applications. Points are a
> non-transferable record of verified contribution, not money, not yield, not
> equity, and not a guaranteed token claim.
>
> **Future recognition.** At token genesis — if a token is launched — the
> issuer/DAO MAY publish a signed `ConversionPolicy` recognising Bootstrap Points
> under stated caps, vesting, eligibility, jurisdiction and KYC/AML rules. Until
> that policy is signed and legally reviewed, points carry no monetary value and no
> conversion right.
>
> **No MOKA token.** MOKA is one participating application. It does not issue,
> custody or guarantee points or tokens. It displays points and programme terms.
>
> **Gold Paper alignment.** Rewards follow useful economic work, not passive
> holding or TVL; bootstrap incentives have objectives, measurable outcomes,
> budgets and sunset conditions; utility precedes liquidity (`TOTEM_NETWORK_
> ECONOMICS_GOLD_PAPER.md` §5, §21, §25).

---

## 1. Summary of decisions

1. **No token in v0.1.** Points only. No `$TOTEM` issuance, no MOKA token, no
   transferable points, no market, no redemption.
2. **Points ≠ credits ≠ yield.** Bootstrap Points measure contribution. Service
   Credits (if used) are spendable on fees/usage and are not token-convertible.
3. **One ecosystem programme, app-scoped accounting.** `Bootstrap Season 0` has an
   explicit app allowlist; each app emits canonical `PointsEvent`s; a global
   aggregate is keyed by root identity. No open-ended farming.
4. **Reward verified use, not deposits.** Credit drawn and performing, allocated
   liquidity, settled volume, channel/factory utilisation, repayment reliability.
   No points for idle TVL, borrowed-back capital, recursive leverage, self-dealing
   or wash activity.
5. **Data-only ledger.** Signed events, derived balances, per-epoch Merkle roots.
   Optional Minima anchoring for tamper-evidence; no per-action L1 writes.
6. **Future recognition is a signed policy, not a promise.** A `ConversionPolicy`
   is published only at token genesis, with snapshot, ratio, caps, vesting,
   jurisdictions, KYC/AML, claim window and unclaimed treatment.
7. **New reusable primitive `@totemsdk/points`.** Not MOKA-specific. Programme
   identity and discovery reuse `@totemsdk/manifest`; identity binding reuses
   `identity`/`root-identity`; anchoring MAY reuse `statechain`/`proofgraph`.
8. **Prerelease, clean break.** No migration, aliases or backward-compatibility
   shims. Safety, custody, determinism and conformance gates still apply.

---

## 2. Motivation

### 2.1 Why points first

Early networks need to encourage participation before demand is sufficient, but
token-first bootstrapping creates well-known failure modes: mercenary capital,
recursive farming, inflated TVL, governance capture and regulatory exposure. The
Gold Paper explicitly separates **bootstrapping incentives** from permanent
monetary policy and requires objectives, measurable outcomes, budgets and sunset
conditions (`§25`). It also states that rewards should follow useful economic work
and that utility precedes liquidity (`§5`, `§21`).

Points let the ecosystem:

- measure real contribution before pricing it;
- iterate on weights and exclusions without a token market;
- run a fixed, auditable window;
- preserve optionality for a future token without promising one;
- avoid turning every application into a separate token issuer.

### 2.2 Why ecosystem-wide

A shared points schema lets a user earn once for useful work across MOKA, routing,
credit, edge services and partner applications, without each app inventing its own
ledger. It also lets the ecosystem measure cross-app contribution and prevents the
same capital from being counted twice.

### 2.3 What exists today

| Capability | Existing primitive |
|---|---|
| Signed declarations, stable IDs, wire encoding, WOTS | `@totemsdk/manifest` |
| Identity / root identity | `identity`, `root-identity` |
| Canonical hashing and bigint/hex utilities | `@totemsdk/core` |
| Durable storage, snapshots, journals | `@totemsdk/storage` |
| Receipt/evidence graphs | `@totemsdk/proofgraph` |
| Statechain / Omnia / MASH anchoring seams | `statechain`, `omnia`, node MASH |
| Credit and liquidity semantics | RFC-059, `eefi-credit`, `liquidity-bond`, `omnia-pool` |
| Host/Connect boundary | `omnia-host`, `connect` |
| Wallet/extension boundary | RFC-058, `extensions/totem-extension` |

There is no points ledger, no bootstrap programme manifest and no conversion
policy. `$TOTEM` is not live; the tokenomics paper is explicitly superseded and
contingent on utility gates.

---

## 3. Definitions

- **Bootstrap Points** — a non-transferable, non-monetary integer recorded against
  a beneficiary for a verified contribution during a programme window. No cash
  value; no redemption; no market; no implied APR.
- **Service Credits** — optional, product-scoped credits spendable on fees or
  usage. Not convertible to tokens and not part of the Bootstrap Points ledger.
- **Programme** — a signed `BootstrapProgramManifest` defining season, apps,
  window, rules, caps, exclusions and optional conversion-policy hash.
- **Season** — a named, finite programme window (for example `season-0`).
- **Epoch** — a fixed accounting interval inside a season used for event roots and
  balance snapshots.
- **Beneficiary** — the root identity / primary address that owns points. One
  beneficiary per natural or legal person or entity; no per-wallet duplication.
- **App namespace** — the application (`appId`) that emitted the event. Points are
  app-scoped and globally aggregated; the same contribution is never counted twice.
- **Verified action** — an action whose evidence is independently checkable
  (settlement proof, credit position state, liquidity allocation, channel/factory
  usage), not a self-asserted claim.
- **Conversion Policy** — a signed, future-only policy recognising points at token
  genesis. It is not valid until signed; it is not a promise before then.
- **Recognition** — the act of granting a token allocation under a signed
  Conversion Policy. Distinct from a claim to revenue, equity or yield.

---

## 4. Scope and non-goals

**In scope:**

- a generic points domain model, rules, ledger, epoch roots and conversion policy;
- an ecosystem Season 0 programme with an explicit app allowlist;
- signed, verifiable accrual events and derived balances;
- anti-farming, caps, time weighting, exclusions and clawback;
- optional Minima anchoring of epoch roots;
- MOKA display/participation;
- a future token-recognition framework that does not create a token now.

**Out of scope:**

- issuing, minting, selling or listing a token;
- transferable points or a points market;
- points as collateral, money, security, equity or revenue share;
- a MOKA token;
- pooled investment vehicles;
- KYC/AML implementation (the conversion policy may require it; the SDK does not
  implement identity verification);
- legal classification;
- automatic conversion or guaranteed airdrops;
- per-action on-chain writes.

---

## 5. Architecture and boundaries

```text
                         MOKA / partner apps
                                  │
                         @totemsdk/connect
                                  │
                       Totem extension / host
                         │                │
              @totemsdk/points      @totemsdk/omnia-host
           (rules, ledger, roots)   (indexer, claims, RPC)
                         │                │
              ┌──────────┼──────────┐     │
              │          │          │     │
          manifest    identity   proofgraph/statechain
        (program ID) (beneficiary) (anchoring)
              │
       product packages
   (eefi-credit, liquidity-bond, omnia, ...)
```

| Concern | Owner | MUST NOT own |
|---|---|---|
| Programme declaration, discovery, signature | `@totemsdk/manifest` (`points-program` kind) | event ledger, balances |
| Points rules, events, balances, epoch roots | `@totemsdk/points` | token issuance, custody, KYC |
| Beneficiary identity | `identity` / `root-identity` | points accounting |
| Evidence / settlement proofs | `proofgraph`, product packages | points weights |
| Anchoring | `statechain` / `omnia` / MASH (optional) | points ledger |
| Durable indexer / RPC | `omnia-host` | protocol rules |
| Wallet/approval boundary | `connect` + extension | points issuance |
| Product UI | MOKA / partner apps | protocol logic |

`@totemsdk/points` is data-only and network-free. Transport and indexing live in
`omnia-host`/`connect`. The points package MUST NOT depend on product packages;
products emit normalized evidence/events and the host applies programme rules.

---

## 6. Programme manifest

A programme is a signed declaration, not a mutable database row. It reuses the
existing manifest envelope (`SignedManifest<T>`, `signManifest`, `verifyManifest`,
`computeManifestId`, wire encoding, WOTS).

```ts
interface BootstrapProgramManifest {
  type: 'points-program';
  version: 'points-program/v1';
  programId: string;                 // computeManifestId: stable logical ID
  season: string;                    // e.g. 'season-0'
  issuer: string;                    // DAO/issuer address; verifyManifest binds it
  title: string;
  description: string;

  apps: ProgramApp[];                // explicit allowlist; no permissionless apps
  startHeight: string;               // decimal block height
  endHeight: string;
  pointsCap?: string;                // optional programme budget in points
  epochLengthBlocks: string;

  rules: PointsRule[];
  exclusions: string[];              // action ids or patterns that earn nothing
  antiFraudPolicyHash?: string;

  conversionPolicyHash?: string;     // absent or 'none' means no recognition claim
  disclosureHash: string;            // operator/programme custody/risk disclosure
  createdAt: number;
  expiresAt?: number;
  metadataHash?: string;
}

interface ProgramApp {
  appId: string;                     // stable app identity
  name: string;
  manifestId?: string;               // signed app/service manifest, if any
  namespaces: string[];              // event namespaces this app may emit
  weights: Record<string, string>;   // action -> integer weight/multiplier
  caps?: Record<string, string>;     // per-action or per-account caps
}
```

Rules:

- `programId === computeManifestId(manifest)`.
- The issuer address is the manifest's signature-bound address.
- `apps` is an allowlist. An event from an app not in the signed manifest is
  invalid.
- `startHeight`/`endHeight` are absolute; points outside the window are invalid.
- `conversionPolicyHash` is either absent/`none` or the digest of a signed
  `ConversionPolicy`. It is not a promise before the policy is signed.
- The manifest is versioned and content-addressed; changes require a new signed
  manifest and a new `programId`, not mutation.

**Manifest integration (small, contained change):**

- Add `type: 'points-program'` to the `Manifest` union.
- Stable key for `computeManifestId`:
  `points-program\0<issuer>\0<season>`.
- `verifyManifest` binds `authorAddress` to `issuer`.
- Wire type byte `0x06` (opportunity is `0x05`).
- Add `isPointsProgramManifest`; update `encodeManifest`/`decodeManifest` and
  `constants.ts`.
- Reuse `signManifest`/`verifyManifest`; do not create a second signing stack.

---

## 7. Points rules and accrual

### 7.1 Rule model

```ts
interface PointsRule {
  ruleId: string;
  appId: string;
  action: string;                    // normalized action id, e.g. 'credit.draw'
  mode: 'per-event' | 'time-weighted' | 'epoch';
  weight: string;                    // integer; programme-defined
  unit: 'points-per-asset' | 'points-per-block' | 'points-per-event' | 'multiplier';
  capPerAccount?: string;
  capPerProvider?: string;
  minDurationBlocks?: string;
  evidenceType: string;              // e.g. 'credit-position', 'liquidity-allocation', 'settlement'
  exclusions?: string[];
}
```

The programme, not the app, defines weights. Apps emit normalized, evidenced
actions; the indexer applies the signed rules. An app cannot self-assign arbitrary
points.

### 7.2 What earns points

| Action | Basis | Notes |
|---|---|---|
| Credit drawn and performing | drawn principal × blocks × repayment performance | only drawn, not merely offered |
| Injectable/allocated liquidity | verified allocated capital × blocks × utilisation | not idle NAV |
| Swap/routing volume | verified settled volume × fee contribution | not wash volume |
| Channel/factory capacity used | capacity × blocks × usage | not unused capacity |
| Repayment / close completed | completion and reliability | capped; no double reward |
| Partner-app contribution | programme-defined verified action | allowlisted apps only |

### 7.3 What does not earn points

- idle deposits or unallocated capital;
- capital borrowed back from the same programme/position;
- recursive leverage or self-dealing between related identities;
- wash trading or circular payments;
- unverified or self-asserted liquidity;
- actions outside the programme window;
- actions by apps not in the allowlist;
- duplicate events/replays.

### 7.4 Time weighting and caps

- Time-weighted rules use the **minimum** verified committed balance over the
  interval, not a spot balance, to prevent end-of-epoch gaming.
- Per-account and per-provider caps are mandatory for capital-based rules.
- Programme-level `pointsCap` (if set) is a hard budget; accrual stops or is
  pro-rated at the cap according to the signed policy.
- Caps are applied before aggregation, not after claiming.

### 7.5 Anti-farming and identity

- One beneficiary per root identity; no per-wallet farming.
- Require identity/provider evidence for capital-based rules; anonymous
  participation may be allowed only for low-value usage rules.
- Detect related-address/self-dealing clusters; exclude or cap.
- Require evidence references for every event; the indexer verifies them.
- Publish the anti-fraud policy hash; keep the full policy available.
- Clawback only for **proven** fraud or duplicate accrual; define the process and
  appeal path in the programme terms.
- Do not reward borrowing of the rewarded asset or circular credit.

---

## 8. Points events and ledger

### 8.1 Event

```ts
interface PointsEvent {
  version: 'points-event/v1';
  eventId: string;                   // canonical digest
  programId: string;
  appId: string;
  namespace: string;
  beneficiary: string;               // root identity / primary address
  action: string;
  points: string;                    // integer decimal; derived from rule + evidence
  ruleId: string;
  epoch: number;
  height?: string;                   // block height, when applicable
  evidenceRefs: string[];            // settlement/position/allocation/usage proofs
  createdAt: number;
  nonce: string;
  signature: string;                 // app/host signer over canonical digest
}
```

- Points are integers; no decimals, no floating point.
- `eventId` is a domain-separated canonical digest of the event body excluding
  `eventId`/`signature`.
- `createdAt` is caller-supplied; validation uses the programme window
  (`startHeight`/`endHeight`) and event `height`, not local wall clock.
- The signer must be an authorised app/host key declared in the programme manifest
  or its signed app manifest.
- Events are append-only. Balances are derived; do not mutate a balance row as the
  source of truth.
- No nested arbitrary objects in the signed event body beyond `evidenceRefs`;
  keep the canonical form small and schema-validated.

### 8.2 Account and balance

```ts
interface PointsAccount {
  beneficiary: string;
  programId: string;
  appPoints: Record<string, string>; // appId -> points
  totalPoints: string;
  firstEventAt: number;
  lastEventAt: number;
  status: 'active' | 'frozen' | 'clawed-back' | 'claimed' | 'expired';
}

interface PointsBalance {
  beneficiary: string;
  programId: string;
  totalPoints: string;
  byApp: Record<string, string>;
  asOfEpoch: number;
  asOfHeight?: string;
  root: string;                      // epoch balance-root inclusion proof
}
```

### 8.3 Epoch roots

```ts
interface PointsEpochRoot {
  programId: string;
  epoch: number;
  fromHeight: string;
  toHeight: string;
  eventRoot: string;                 // Merkle root of canonical event ids
  balanceRoot: string;               // Merkle root of beneficiary balances
  eventCount: number;
  totalPoints: string;
  anchoredTxId?: string;             // optional Minima anchor
  createdAt: number;
}
```

- Epoch roots are canonical and domain-separated.
- Optionally anchor the root to Minima via `statechain`/`omnia`/MASH for
  tamper-evidence. Anchoring frequency is programme-defined (for example daily or
  weekly), not per action.
- Anchoring is evidence, not custody. A missing anchor does not invalidate the
  ledger, but it weakens independent auditability; the programme MUST publish the
  anchoring policy.

### 8.4 Storage and concurrency

```ts
interface PointsStore {
  saveProgram(program: BootstrapProgramManifest, expectedVersion?: number): Promise<void>;
  getProgram(programId: string): Promise<BootstrapProgramManifest | undefined>;

  appendEvent(event: PointsEvent, expectedSequence?: number): Promise<void>;
  listEvents(filter: PointsEventFilter): Promise<PointsEvent[]>;

  saveEpochRoot(root: PointsEpochRoot, expectedVersion?: number): Promise<void>;
  getEpochRoot(programId: string, epoch: number): Promise<PointsEpochRoot | undefined>;

  saveAccount(account: PointsAccount, expectedVersion?: number): Promise<void>;
  getAccount(programId: string, beneficiary: string): Promise<PointsAccount | undefined>;
}
```

Ship `MemoryPointsStore`; durable adapters live in `storage`/`omnia-host`.
Mutations use explicit precondition/version checks. The indexer must be
crash-recoverable and reorg-aware.

### 8.5 Indexer

- The indexer verifies programme manifests, app authorisation, event signatures,
  rules, evidence and caps.
- It publishes epoch roots and a query API; it does not custody value.
- It MUST be replaceable: any independent indexer can reproduce balances from the
  signed events and programme manifest.
- Reorg handling is explicit; roots are finalised only after the programme's
  confirmation depth.
- The indexer may be operated by the DAO or a partner; if it controls claims or
  balances, it is trust-minimised and must disclose that.

---

## 9. Conversion policy and future token recognition

### 9.1 Policy

```ts
interface ConversionPolicy {
  version: 'points-conversion/v1';
  policyId: string;                  // canonical digest
  programId: string;
  status: 'draft' | 'signed' | 'active' | 'closed';
  issuer: string;
  token: string;                     // token id/symbol; not live until issued
  snapshot: {
    epoch: number;
    height: string;
    eventRoot: string;
    balanceRoot: string;
  };
  ratio: {
    pointsPerToken?: string;
    tokensPerPoint?: string;
    capPerBeneficiary?: string;
  };
  vesting: {
    cliffBlocks?: string;
    durationBlocks?: string;
    linear?: boolean;
  };
  eligibility: {
    apps: string[];
    jurisdictions?: string[];        // allowed or excluded, programme-defined
    minPoints?: string;
    kycRequired: boolean;
    identityRequired: boolean;
  };
  claim: {
    startHeight: string;
    endHeight: string;
    unclaimed: 'burn' | 'treasury' | 'rollover';
  };
  legalHash?: string;
  disclosureHash: string;
  createdAt: number;
}
```

### 9.2 Rules

- A `ConversionPolicy` is **invalid until signed** by the issuer/DAO and legally
  reviewed. Before then, points have no monetary value and no conversion right.
- The snapshot MUST reference a finalised epoch root; no retroactive edits.
- The policy MUST state caps, vesting, eligibility, jurisdictions, KYC/AML and
  unclaimed treatment.
- Claiming MUST be proof-based: beneficiary proves points via the epoch/balance
  root; duplicate claims are rejected.
- A signed policy is a token allocation commitment, not a yield promise. It MUST
  NOT be marketed as an APR or revenue share.
- If no token is launched, points remain non-monetary. Do not imply a redemption.

### 9.3 Claim flow (future)

```text
programme manifest + signed conversion policy
        ↓
beneficiary proves points (epoch/balance root)
        ↓
eligibility + KYC/AML (if required)
        ↓
claim tx / allocation
        ↓
vesting / lockup
```

The SDK may define types and verification helpers but MUST NOT implement KYC/AML,
token issuance or legal compliance.

---

## 10. MOKA participation

MOKA is a participating application, not the programme issuer.

- MOKA displays **Bootstrap points** separately from fees, interest and APR.
- It shows the signed programme terms, app allowlist, window, caps, exclusions and
  conversion status (`none` until a signed policy exists).
- It shows points earned per app and total; points are non-transferable and have
  no market.
- It does not create, custody, sell or guarantee points or tokens.
- It does not advertise points as yield, APR or a guaranteed airdrop.
- It may show partner-app points through the shared ledger, using the host/extension
  transport; it does not become a central indexer.
- Points are earned from verified MOKA actions: credit drawn/performing, allocated
  liquidity, settled swaps/routing, channel/factory utilisation, completed
  repayment/close. Idle deposits earn nothing.

### 10.1 UI language

```text
Bootstrap Season 0
Points: 12,480        [No monetary value]
Apps: MOKA · Router · Credit · Partner
Window: block 1,200,000 → 1,800,000
Conversion: none published
```

If a conversion policy is later signed, the UI must show its caps, vesting,
eligibility and claim window, and the legal/disclosure terms. Until then:
“Bootstrap points — no value; future recognition not guaranteed.”

---

## 11. Fit with RFC-058 and custody

- The points ledger is **data-only** and holds no value → `non-custodial`.
- If an operator holds points, controls the claim or can freeze balances, it is
  **trust-minimised** or custodial and must disclose that.
- The underlying capital action (deposit, credit draw, pool allocation) is a
  **liquidity commitment** under RFC-058 §4 and is gated separately. Earning points
  does not bypass `SignRequest`/`SignerPort` or the extension disclosure gate.
- No public yield advertising in the non-custodial default. Points are not yield;
  conversion is not guaranteed.
- A hosted operator running its own programme owns its disclosures, KYC/AML and
  legal wrapper; MOKA displays, but does not endorse, hosted programme terms.
- Proposed RFC-058 amendment: add `points` to `SignRequest.domain` for
  accrual/claim/recognition signatures, and add programme manifests to the
  disclosure boundary where an operator controls balances/claims.

---

## 12. Security invariants

- Points are non-transferable; no transfer, market or collateral operation exists.
- Points are non-negative integers; arithmetic is bigint/decimal-string only.
- No event outside the programme window or app allowlist is accepted.
- No duplicate `eventId`; replay is rejected.
- Balances are derived from signed events and reproducible by an independent
  indexer.
- One beneficiary per root identity; cross-app double counting is rejected.
- Caps are applied before aggregation; no post-hoc cap circumvention.
- Epoch roots are canonical; a finalised root cannot be silently rewritten.
- Conversion snapshots reference finalised roots; no retroactive edits.
- A conversion policy is invalid until signed; no implied claim before then.
- Clawback only for proven fraud/duplicate accrual, with a published process.
- Indexer compromise cannot mint points without valid signed events and rules.
- No private data beyond what the programme discloses; beneficiary privacy is
  preserved in public roots where possible.

---

## 13. Threat model

| Threat | Mitigation |
|---|---|
| Sybil farming | root identity, provider/identity evidence, one beneficiary, caps, anomaly detection |
| Wash/circular activity | verified settlement/usage evidence, exclusion rules, graph analysis |
| Recursive leverage | exclude borrowed-back capital, self-dealing clusters, position caps |
| Fake liquidity | only verified allocated/funded positions; advertised ≠ verified |
| Event forgery | app/host signature, allowlist, canonical digest, evidence refs |
| Replay/double count | event ids, sequence, epoch roots, cross-app dedup |
| Indexer manipulation | independent reproducibility, signed events, anchored roots |
| Root withholding/stale roots | finality depth, multiple indexers, anchoring |
| Insider allocation | signed programme rules, caps, public audit, DAO approval |
| Conversion overpromise | no policy until signed/legal; explicit “no value” UI |
| Privacy leakage | aggregate roots, selective disclosure, no per-user public positions |
| Governance capture | allowlist approval, caps, sunset, transparent budgets |

---

## 14. Testing and conformance

- programme manifest ID/signature/encoding; app allowlist; expiry/window;
- rule application for each mode; caps; time-weighted minimum balance;
- event canonicalisation/signature/replay; duplicate/unknown app rejection;
- cross-app identity aggregation; no double counting;
- epoch root determinism and independent recomputation;
- reorg/finality handling; crash/restart recovery;
- anti-farming fixtures (recursive, wash, self-dealing, idle TVL);
- conversion policy validation; snapshot finality; claim proof and duplicate claim;
- privacy/disclosure redaction;
- MOKA UI labels: points ≠ APR/yield; conversion `none` until signed;
- end-to-end Season 0 with at least two apps and one partner app.

---

## 15. Implementation sequence

### Phase 1 — data model (authorised now)

1. `@totemsdk/points`: types, canonical digests, rules, events, accounts, epoch
   roots, conversion policy, validation, in-memory store, tests.
2. `@totemsdk/manifest`: add `type: 'points-program'` and
   `BootstrapProgramManifest` to the union; reuse sign/verify/encoding/guards.
3. No host/Connect mutation methods, no indexer, no live value.

### Phase 2 — host and indexer (after RFC-058 P1/P2)

4. `omnia-host` points service: programme registry, event ingestion, verification,
   epoch root publication, query API.
5. `connect` read/subscribe methods; signing via `SignRequest`/`SignerPort`.
6. Durable store, reorg handling, optional anchoring via `statechain`/`proofgraph`.
7. Extension disclosure/consent where an operator controls points/claims.

### Phase 3 — Season 0

8. DAO/issuer signs the Season 0 programme manifest with an explicit app allowlist.
9. MOKA and partner apps emit verified events; MOKA displays points and terms.
10. Public audit: independent indexer reproduces balances and epoch roots.

### Phase 4 — future token recognition (conditional)

11. If a token is launched: DAO/issuer signs a `ConversionPolicy`; legal review;
    snapshot; KYC/AML/eligibility; claim and vesting.
12. If no token: points remain non-monetary; programme closes and archives.

---

## 16. Open questions

1. Points vs credits naming and whether Service Credits should exist at all in
   Season 0.
2. Season length, epoch length, cap and app allowlist.
3. Whether points are keyed by root identity, primary address, or both.
4. Whether capital-based rules require identity/provider bond or can be pseudonymous.
5. How to handle cross-app identity merge/split and privacy.
6. Indexer operator: DAO, foundation, partner, or multiple independent indexers.
7. Anchoring cadence and chain: statechain, Omnia channel, MASH, or proofgraph only.
8. Clawback process and appeal path.
9. Whether to publish a conversion policy at token genesis only, or a non-binding
   intent earlier (recommendation: genesis only).
10. Jurisdictions, KYC/AML, tax and legal classification — requires counsel.
11. Whether partner apps can define their own weights or must use programme weights.
12. How to prevent points from becoming a de facto transferable asset (no transfers,
    no market, no collateral, no redemption).

---

## 17. References

- `TOTEM_NETWORK_ECONOMICS_GOLD_PAPER.md` — §5 (not a revenue share), §21 (fair
  launch; utility before liquidity), §25 (bootstrapping without distorting the
  network; budgets and sunset), §31 (incentive farming).
- RFC-039 — custody conformance.
- RFC-048 — Omnia primitive completeness and privacy.
- RFC-050 — Eefi product architecture and pooled-capital gate.
- RFC-058 — custody modes, `SignRequest`/`SignerPort`, disclosure gate.
- RFC-059 — Eefi credit, collateral, discoverable liquidity.
- RFC-053 — Eefi generic contracts.
- RFC-057 — distributed storage and replication.
- `packages/manifest` — signed declarations, IDs, wire encoding, WOTS.
- `packages/identity`, `packages/root-identity` — identity binding.
- `packages/proofgraph` — receipt/evidence graphs.
- `packages/storage` — durable stores, snapshots, journals.
- `packages/statechain` — optional anchoring seam.
- `packages/omnia-host`, `packages/connect` — service/RPC boundary.
- `extensions/totem-extension` — signing/disclosure boundary.

---

## 18. Authorisation

Phase 1 is authorised: `@totemsdk/points` (data-only types, rules, events,
accounts, epoch roots, conversion policy, in-memory store) and the
`@totemsdk/manifest` `points-program` kind. No token, no transfers, no value, no
host/Connect mutation path, no indexer.

Phase 2 is **not authorised** until RFC-058 P1/P2 lands (`SignRequest`/`SignerPort`,
custody/disclosure schema, host services, Connect wrappers, extension gate, live
E2E). Phase 3 (Season 0) requires a signed programme manifest and an explicit app
allowlist. Phase 4 (token recognition) requires a launched token, a signed
`ConversionPolicy`, DAO approval and jurisdiction-specific legal review.

The decision not to create a token now is deliberate. Points are a
non-transferable record of useful contribution; any future recognition is a
separate, signed, legally reviewed act.
