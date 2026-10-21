# RFC-059 — Eefi Credit, Collateral Bonds, and Discoverable Liquidity Opportunities

Status: **Draft — proposed.** Implementation is authorised for the **data-only credit domain, the deterministic credit program, the credit-bond covenant, and the opportunity-discovery model** (Phase 1). Host/Connect mutation surfaces and live value-bearing deployments are gated by RFC-058 P0/P1/P2.
Created: 2026-10-20
Authors: Totem SDK Contributors
Depends on: RFC-039 (Custody Conformance), RFC-048 (Omnia Primitive Completeness), RFC-049 (MASH × Omnia × Eefi), RFC-050 (Eefi Product Architecture), RFC-053 (Eefi Generic Contracts), RFC-054 (Eefi Protocol 0.1), RFC-058 (Custody Modes and Disclosure Gate)
References: RFC-002 (Rust/WASM parity), RFC-003 (built-in programs), RFC-035 (peer coordination), RFC-037 (unified WOTS), RFC-038 (VTXO operator), RFC-055 (routing), RFC-057 (distributed storage), RFC-060 (Bootstrap Points and Future Token Recognition)
Touches: `eefi-credit` (new), `eefi`, `omnia`, `omnia-host`, `omnia-pool`, `liquidity-bond`, `provider-bond`, `kissvm`, `connect`, `manifest`, `identity`, `stream-transport`, `pubsub-transport`, `extensions/totem-extension`, MOKA (external consumer)

> **Positioning.** Credit is an **Eefi** product domain, not an Omnia product.
> `@totemsdk/eefi-credit` owns credit semantics and accounting; `@totemsdk/omnia`
> owns deterministic channel state (`CreditProgram`); `@totemsdk/kissvm` owns the
> enforceable collateral covenant; `@totemsdk/manifest` owns the signed
> `OpportunityManifest` envelope, canonical identity, topic derivation, generic
> verification policy and ranking; transport adapters live in
> `@totemsdk/omnia-host`/`@totemsdk/connect`; MOKA is the first web application
> that consumes all of them through `@totemsdk/connect` and the Totem extension.
>
> **Non-custodial default.** RFC-058 applies in full. Self-custody is the default.
> Hosted opportunities may be listed but must carry a signed custody disclosure and
> a blocking acknowledgement before any commitment is signed. Credit is a
> **liquidity commitment** under RFC-058 §4 and MUST NOT bypass `SignRequest` /
> `SignerPort` or the extension gate.
>
> **Pooled-capital gate.** Bilateral credit is in scope for v0.1. Pooled
> third-party capital remains **blocked** until RFC-050 §7.1 closes (real-VM L4
> exit proof, state-continuity review, settlement-aware accounting, adversarial
> routing), and RFC-058 D6 forbids pooled return and public yield advertising in
> the non-custodial default. MOKA MUST NOT advertise pooled yield as a
> non-custodial default.
>
> **Prerelease posture.** The SDK is prerelease and has no users. There is no
> backward-compatibility promise and no migration burden. This RFC chooses the
> clean long-term shape now: packages may be renamed, manifest kinds and unions may
> change, program IDs/ports/actions may be reallocated, host/Connect methods may be
> replaced, and package majors may be bumped without shims, aliases, dual
> implementations or deprecation paths. Safety, custody and conformance gates are
> **not** waived by prerelease status.

---

## 1. Summary of decisions

1. **`@totemsdk/eefi-credit` is the credit domain package.** It defines offers,
   agreements, positions, interest, collateral policy, repayment, default,
   lifecycle, events, intents, canonical digests and storage. It is data-only and
   holds no value.
2. **`CreditProgram` is a built-in Omnia channel program.** It provides
   deterministic accounting and update-path invariants. It **does not** enforce
   final settlement payout and must not be treated as the default-enforcement
   mechanism.
3. **Collateral is enforced by a separate credit-bond UTXO**, built by
   `@totemsdk/kissvm`, with two unilateral branches: borrower repay-and-reclaim and
   lender default-after-maturity. Same-asset v0.1 requires no oracle.
4. **In-channel collateral is not enforceable credit.** Eltoo update and settlement
   are both-signed; a program cannot force a defaulting borrower to co-sign a
   seizure. The bond coin is the recourse.
5. **Opportunity discovery is folded into `@totemsdk/manifest`; no new package.**
   `OpportunityManifest` is added as a first-class manifest kind, reusing the
   existing stable ID, wire encoding, `SignedManifest<OpportunityManifest>`,
   `signManifest`/`verifyManifest` and type guards. Pure discovery policy
   (topic derivation, generic verification, ranking) also lives in `manifest`
   because it needs only `@totemsdk/core`. Network adapters (Hyperswarm, relay,
   pub/sub) and host RPC live in `@totemsdk/omnia-host`/`@totemsdk/connect`.
   `manifest` stays network-free; no new package is introduced. If a non-Omnia
   consumer later needs a transport-heavy discovery layer, extract a thin
   `@totemsdk/opportunity` then — not now.
6. **MOKA is a web application over the Totem extension.** It discovers
   opportunities on Hyperswarm topics (through the extension/host transport
   bridge), verifies signed manifests, and lists opportunities by custody status
   and verified liquidity. It has no protocol-specific backend and no custodial
   role.
7. **Implementation is sequenced behind RFC-058.** Phase 1 (data, program, bond
   covenant, discovery model) may land now. Phase 2 (host/Connect mutations,
   `SignerPort`, disclosure gate) waits for RFC-058 P1/P2. Phase 3 (MOKA) follows.
   Pooled credit waits for RFC-050 §7.1.

---

## 2. Motivation

### 2.1 What exists today

The repository already contains the substrate this RFC composes:

| Capability | Existing primitive |
|---|---|
| Programmable channel state, built-ins, registry | `packages/omnia/src/program.ts`, `types.ts` |
| Deterministic TS/Rust/WASM parity | `packages/omnia/rust/src/program.rs`, `wasm.rs`, parity fixtures |
| Co-signed eltoo close, unilateral broadcast | `packages/omnia/src/script.ts`, `settlement.ts` |
| Generic host transition surface | `totem_omniaApplyProgramTransition` in `omnia-host/src/api/methods.ts` |
| Enforceable collateral bond | `packages/kissvm/src/templates/collateral.ts` (OMP-21) |
| Unilateral exercise / P-EXIT | `packages/kissvm/src/templates/exercise.ts` |
| Pooled capital orchestration | `packages/omnia-pool` (v0.5.2) |
| LP accounting, NAV, utilisation | `liquidity-bond` + `omnia-pool/src/nav.ts` |
| Provider identity, bond, score | `provider-bond` |
| Signed manifests / identity | `manifest` (schema, stable ID, wire encoding, WOTS sign/verify), `identity` |
| Manifest extension + pure discovery policy | `@totemsdk/manifest` `Manifest` union, `computeManifestId`, `verifyManifest`, `encodeManifest`, `opportunityTopic`, `rankOpportunities` |
| Hyperswarm topics and relay | `omnia/src/topic.ts`, `swarm.ts`, `omnia-relay`, `stream-transport` |
| Wallet boundary | `connect` + Totem extension |
| Generic Eefi contracts | `packages/eefi` (v0.1.0, RFC-053) |

### 2.2 What is missing

- A credit domain model and deterministic credit accounting.
- A built-in credit program with parity fixtures.
- A **unilateral** collateral covenant that makes default enforceable without
  turning settlement into a single-signer path (RFC-039 §3.2).
- A generic, signed, discoverable opportunity manifest and topic protocol.
- A custody-aware listing and ranking model for MOKA.

### 2.3 Why credit belongs in Eefi, not Omnia

RFC-048 §3.4 is explicit: bond semantics live in reusable KISSVM templates and
must not be duplicated as a lending-market package; credit underwriting, collateral
ratios, interest and liquidation belong to Eefi. RFC-049 §10 repeats this. RFC-050
§8 places Collateralized Machine Credit at product #5.

Omnia's role is narrower: programmable channel state, typed condition witnesses and
correct state enforcement. A `CreditProgram` is an Omnia primitive because it is a
deterministic channel program. The **credit product** is Eefi.

### 2.4 Why the bond must be separate

Eltoo update and settlement are both-signed (`packages/omnia/src/script.ts:37-49`).
`CreditProgram` validates updates that both parties co-sign; it cannot compel a
defaulting borrower to co-sign a default split. RFC-050 §4 warns that Omnia program
injection is update-path logic and must not be assumed to constrain final settlement
payout (`RFC-050:122-123`). RFC-039 §3.2 records the critical regression that occurs
when a single-signer settlement branch is added without an output constraint.

Therefore:

- **In-channel collateral** is only cooperative. It is not enforceable credit.
- **Pre-signed default settlement** is possible but the cure/repayment path still
  depends on the counterparty co-signing; it is **trust-minimised**, not
  non-custodial.
- **A separate collateral-bond UTXO with unilateral repayment and default
  branches** is the only shape that is both enforceable and non-custodial.

---

## 3. Architecture and boundaries

```text
                         MOKA web app
                              │
                     @totemsdk/connect
                              │
                   Totem extension / host
                    │                  │
             @totemsdk/manifest   @totemsdk/omnia-host
        (OpportunityManifest +    (durable execution +
         topics/verify/rank)       transport adapters)
                    │                  │
        ┌───────────┼───────────┐      │
        │           │           │      │
  eefi-credit   liquidity-bond  provider-bond
        │           │           │
        └───────────┼───────────┘
                    │
                 @totemsdk/eefi
                    │
        ┌───────────┼────────────┐
        │           │            │
   CreditProgram   kissvm      omnia-pool
     (omnia)     credit bond   (fund manager)
        │           │            │
        └───────────┼────────────┘
                    │
                 @totemsdk/omnia
                    │
                 Minima
```

| Concern | Owner | MUST NOT own |
|---|---|---|
| Credit terms, interest, lifecycle, events | `@totemsdk/eefi-credit` | channel signing, scripts, custody |
| Deterministic credit state machine | `CreditProgram` in `@totemsdk/omnia` | credit underwriting, pricing |
| Enforceable collateral | `@totemsdk/kissvm` credit-bond template | credit accounting |
| Opportunity schema, stable ID, wire encoding, signature, topic derivation, generic verification, ranking | `@totemsdk/manifest` | transport adapters, host RPC, execution |
| Opportunity transport adapters (Hyperswarm/relay/pubsub) and subscription service | `@totemsdk/omnia-host` / `@totemsdk/connect` | manifest schema, ranking, custody |
| Pool deployment/allocation | `@totemsdk/omnia-pool` | debt semantics |
| LP accounting/NAV | `@totemsdk/liquidity-bond` | credit positions |
| Provider evidence/score | `@totemsdk/provider-bond` | enforcement/slashing claims |
| Signing/custody boundary | RFC-058 `SignRequest`/`SignerPort` | product logic |
| User experience | MOKA (external web app) | protocol logic |

---

## 4. Primitive A — `@totemsdk/eefi-credit`

### 4.1 Purpose

Deterministic, serializable credit domain for:

```text
offer → acceptance → agreement → collateralisation → activation
     → draw → deterministic interest accrual → repayment
     → collateral release → close

             OR

active → overdue → cure OR default → resolution → close
```

It is a pure domain package: bigint only, no wall clock, no randomness, no network,
no key material, no on-chain value.

### 4.2 V0.1 credit model

V0.1 is deliberately narrow:

- fixed-term;
- fixed-rate (`fixed-apr`, basis points);
- same-asset (principal and collateral use the same asset);
- collateral-backed;
- bilateral;
- no oracle;
- no variable-rate curve;
- no pooled debt token;
- no cross-asset liquidation;
- no AMM.

**Bond shape for v0.1:** single-draw, fixed-term, bullet repayment. This keeps the
credit-bond covenant stateless and provably non-custodial. Partial and revolving
repayment require a stateful bond and are v0.2 (see §6.6).

### 4.3 Core types

```ts
type CreditAsset = string;             // token id, `0x00` = MINIMA
type CreditAmount = bigint;            // atoms; never number/float

interface FixedAprRate {
  type: 'fixed-apr';
  rateBps: bigint;                     // 800 = 8.00%
}

interface CreditTerm {
  termType: 'fixed-duration' | 'open';
  maturityHeight?: bigint;             // protocol-enforced preferred
  durationMs?: number;                 // display/API only in v0.1
  gracePeriodBlocks?: bigint;
}

interface CollateralPolicy {
  required: boolean;
  acceptedAssets: CreditAsset[];
  minCollateralRatioBps?: bigint;
  fixedCollateralAmount?: CreditAmount;
  collateralMode: 'credit-bond' | 'provider-bond' | 'factory-share' | 'external-proof';
  providerBondAllowed?: boolean;
  minimumProviderScore?: number;
}

interface RepaymentPolicy {
  allocationOrder: ['interest', 'principal']; // fees, if any, precede interest
  allowPartial: boolean;
  allowEarly: boolean;
  overpayment: 'refund' | 'reject';
}

interface DefaultPolicy {
  gracePeriodBlocks: bigint;
  cureAllowed: boolean;
  resolution: 'same-asset-bond';
  penaltyBps?: bigint;                 // explicit, capped, disclosed
}

interface CreditOffer {
  version: 'eefi-credit-offer/v1';
  offerId: string;                     // canonical digest
  lender: string;
  asset: CreditAsset;
  minPrincipal?: CreditAmount;
  maxPrincipal: CreditAmount;
  rate: FixedAprRate;
  term: CreditTerm;
  collateralPolicy: CollateralPolicy;
  repaymentPolicy: RepaymentPolicy;
  defaultPolicy: DefaultPolicy;
  providerPolicyRef?: string;          // provider-bond policy digest
  createdAt: number;                   // caller-supplied
  expiresAt?: number;
  nonce: string;
  status: CreditOfferStatus;
}

interface CreditAgreement {
  version: 'eefi-credit/v1';
  agreementId: string;                 // canonical digest
  offerId: string;
  capital: EefiCapitalAgreement;       // RFC-053 capital authorisation
  lender: string;
  borrower: string;
  asset: CreditAsset;
  limit: CreditAmount;
  rate: FixedAprRate;
  term: CreditTerm;
  collateral: CollateralPolicy;
  repayment: RepaymentPolicy;
  default: DefaultPolicy;
  termsHash: string;                   // binds capital + credit terms
  custody: CustodyContext;             // RFC-058 §6
  disclosureHash: string;              // RFC-058 §5 D4
  createdAt: number;
  nonce: string;
}

interface CreditPosition {
  version: 'eefi-credit-position/v1';
  positionId: string;
  agreementId: string;
  offerId: string;
  lender: string;
  borrower: string;
  asset: CreditAsset;
  creditLimit: CreditAmount;
  drawnPrincipal: CreditAmount;
  accruedInterest: CreditAmount;
  repaidPrincipal: CreditAmount;
  repaidInterest: CreditAmount;
  collateral: CreditCollateral[];
  lastAccrualHeight: bigint;
  openedAt: number;
  maturityHeight: bigint;
  channelId?: string;
  bondCoinId?: string;
  status: CreditPositionStatus;
  sequence: number;                    // monotonic; store CAS precondition
}

type CreditOfferStatus =
  | 'open' | 'accepted' | 'cancelled' | 'expired' | 'invalid';

type CreditPositionStatus =
  | 'proposed' | 'approved' | 'collateralized' | 'active'
  | 'repaid' | 'overdue' | 'cured' | 'defaulted'
  | 'resolved' | 'closed';
```

`EefiCapitalAgreement` and `CustodyContext` are reused, not duplicated. The
agreement's `termsHash` is a domain-separated digest over `{capital.termsHash, credit
terms, collateral, repayment, default, lender, borrower, asset}`.

### 4.4 Interest accounting

V0.1:

```text
annualRateBps       = rateBps
accrualAnchorHeight = lastAccrualHeight
elapsedBlocks       = currentHeight - accrualAnchorHeight
interestDelta       = floor(principal * rateBps * elapsedBlocks
                            / (10_000 * BLOCKS_PER_YEAR))
accruedInterest     = previousAccrued + interestDelta
lastAccrualHeight   = currentHeight
```

Rules:

- **Cumulative anchor, not per-step floors.** Recompute from the last anchor; never
  sum independently floored intervals (path-dependent undercharge).
- `BLOCKS_PER_YEAR` is a protocol parameter committed in the agreement. APR is
  **nominal** if block intervals vary; this MUST be documented. Do not silently
  pretend it is calendar APR.
- `currentHeight` is always an explicit caller/transition input. No `Date.now()` in
  deterministic logic.
- Lazy accrual: accrue only on draw, repay, collateral change, maturity check, close
  or default evaluation. Never emit an update every block.
- Prevent double accrual by persisting `lastAccrualHeight`/`lastAccrualSequence` in
  both the domain position and channel program state.
- Zero elapsed blocks → zero interest.

### 4.5 Repayment

Allocation order: contractual fees (none in v0.1) → accrued interest → principal.
Return a structured result:

```ts
interface RepaymentResult {
  position: CreditPosition;
  appliedToInterest: bigint;
  appliedToPrincipal: bigint;
  unused: bigint;                      // refunded, never burned
  remainingInterest: bigint;
  remainingPrincipal: bigint;
  fullyRepaid: boolean;
}
```

Overpayment is refunded or rejected per policy; it is never silently retained.

### 4.6 Default

Default is a **deterministic state transition**, not an admin action:

```text
maturity reached
+ grace expired
+ amountDue > amountRepaid
= eligible for overdue/default
```

The bond covenant (not the channel program) performs value resolution. The domain
records `defaulted`/`resolved` and the bond spend evidence.

### 4.7 Events

Every transition emits a normalized event suitable for MOKA Activity:

```ts
type CreditEventKind =
  | 'offer-created' | 'offer-cancelled' | 'offer-expired' | 'offer-accepted'
  | 'position-opened' | 'credit-drawn' | 'interest-accrued'
  | 'credit-repaid' | 'collateral-added' | 'collateral-released'
  | 'position-overdue' | 'position-cured' | 'position-defaulted'
  | 'position-resolved' | 'position-closed';

interface CreditEvent {
  eventId: string;                     // canonical digest
  positionId: string;
  agreementId: string;
  channelId?: string;
  bondCoinId?: string;
  sequence: number;
  kind: CreditEventKind;
  actor: string;
  amounts: { asset: CreditAsset; principal?: bigint; interest?: bigint; collateral?: bigint };
  stateHash: string;
  height: bigint;
  createdAt: number;
}
```

### 4.8 Store and concurrency

```ts
interface EefiCreditStore {
  saveOffer(offer: CreditOffer, expectedVersion?: number): Promise<void>;
  getOffer(id: string): Promise<CreditOffer | undefined>;
  listOffers(filter?: CreditOfferFilter): Promise<CreditOffer[]>;

  savePosition(position: CreditPosition, expectedVersion?: number): Promise<void>;
  getPosition(id: string): Promise<CreditPosition | undefined>;
  listPositions(filter?: CreditPositionFilter): Promise<CreditPosition[]>;
}
```

`expectedVersion` is mandatory for mutations to prevent two hosts clobbering each
other. Ship `MemoryEefiCreditStore`; durable adapters live outside the domain
package.

### 4.9 Non-goals

UI, wallet keys, RPC networking, oracle implementation, LP pooling, AMM, routing,
database implementation, Minima node, provider reputation, identity, governance,
automatic yield distribution.

---

## 5. Primitive B — `CreditProgram` in `@totemsdk/omnia`

### 5.1 Program identity

```ts
id: 'credit'
version: 1
```

It follows the existing built-in pattern (`packages/omnia/src/program.ts`):
`buildScript`, `buildStateVariables`, `validateTransition`, TS + Rust + WASM,
golden fixtures, parity tests.

### 5.2 Port allocation

The current `omnia-programs` band is `120–183` (`docs/STATE-PORT-REGISTRY.md`,
`scripts/state-port-registry.json`). The asset program occupies `180–183`. The
proposed credit block is:

| Port | State |
|---:|---|
| 190 | `CREDIT_LIMIT` |
| 191 | `PRINCIPAL_DRAWN` |
| 192 | `COLLATERAL_LOCKED` |
| 193 | `ACCRUED_INTEREST` |
| 194 | `RATE_BPS` |
| 195 | `MATURITY_HEIGHT` |
| 196 | `LAST_ACCRUAL_HEIGHT` |
| 197 | `STATUS` |
| 198 | `TOTAL_REPAID` |
| 199 | `TERMS_HASH` |

This requires:

- extending the `omnia-programs` band to `199` in the registry;
- updating `STATE-PORT-REGISTRY.md` and the port gate;
- proving the composite channel script remains within the KISSVM instruction budget
  (current `mash+omnia-channel` headroom is approximately 154 AST ops over eltoo);
- adding `LAST_ACCRUAL_HEIGHT` (the original proposal omitted it, which makes
  double-accrual prevention impossible on-channel).

Ports are per-coin; extending the channel band does not collide with the
factory/VTXO share band on different coin classes.

### 5.3 Actions

```text
initialize
draw
accrue
repay
add_collateral
release_collateral
mark_overdue
cure
default
resolve
close
```

### 5.4 Invariants (update path)

The program MUST enforce:

- `PRINCIPAL_DRAWN >= 0`;
- `PRINCIPAL_DRAWN <= CREDIT_LIMIT`;
- `ACCRUED_INTEREST >= 0`;
- `TOTAL_REPAID` monotonically non-decreasing;
- repayment cannot increase debt;
- `LAST_ACCRUAL_HEIGHT` monotonically non-decreasing;
- interest cannot accrue twice over the same interval;
- maturity cannot move backwards;
- `RATE_BPS`, `TERMS_HASH`, lender/borrower binding immutable after activation;
- terminal statuses cannot draw;
- status transitions are a closed, legal set;
- value conservation across channel balances + HTLCs.

### 5.5 The limit of the program

`CreditProgram` is **update-path** enforcement. It does not constrain the final
settlement payout. The collateral bond (§6) is the enforcement layer. Documentation
and tests MUST state this distinction; do not claim the channel program enforces
default.

---

## 6. Primitive C — Credit collateral bond in `@totemsdk/kissvm`

### 6.1 Why a separate UTXO

The bond is a distinct coin controlled by a covenant, not a channel balance. It
survives channel closure and gives both parties a unilateral on-chain path. It does
not modify the eltoo settlement branch, avoiding the RFC-039 §3.2 regression.

### 6.2 V0.1 bond shape (bullet repayment)

The bond is a **separate coin class**. It MUST register its own state-port band
(for example `eefi-credit-bond` at `140–159`) in
`scripts/state-port-registry.json`. Ports are per-coin namespaces, so this does not
collide with `omnia-programs` on channel coins; the bond MUST NOT be composed with
an Omnia channel on the same coin if that would overlap bands.

State committed at funding:

```text
MATURITY          absolute block height
GRACE_BLOCKS      default grace
OWED              principal + fixed interest (same asset)
COLLATERAL        bond amount (MUST be >= OWED)
LENDER_PK         lender public-key digest
BORROWER_PK       borrower public-key digest
TERMS_HASH        credit agreement digest
```

Branches (illustrative; the implementation uses the repository's KISSVM builder
conventions and explicit `LET` temporaries):

```text
LET MATURITY=PREVSTATE(140)
LET GRACE=PREVSTATE(141)
LET OWED=PREVSTATE(142)
LET DEFAULTBLOCK=MATURITY + GRACE
ASSERT SAMESTATE(140 142)

// 1. Borrower repayment + reclaim (unilateral, any time)
IF SIGNEDBY(BORROWER) THEN
  ASSERT @AMOUNT GTE OWED
  LET SURPLUS=@AMOUNT - OWED
  ASSERT VERIFYOUT(0 LENDER_ADDR OWED ASSET FALSE)
  RETURN VERIFYOUT(1 BORROWER_ADDR SURPLUS ASSET FALSE)
ENDIF

// 2. Lender default + surplus return (unilateral, after maturity + grace)
IF @BLOCK GTE DEFAULTBLOCK THEN
  IF SIGNEDBY(LENDER) THEN
    ASSERT @AMOUNT GTE OWED
    LET SURPLUS=@AMOUNT - OWED
    ASSERT VERIFYOUT(0 LENDER_ADDR OWED ASSET FALSE)
    RETURN VERIFYOUT(1 BORROWER_ADDR SURPLUS ASSET FALSE)
  ENDIF
ENDIF

RETURN FALSE
```

Both branches produce the same split: lender receives exactly `OWED`, borrower
receives the surplus. The borrower can repay early; the lender can only settle after
the deadline. Neither can take more than `OWED`; neither needs the other online.
This is non-custodial under RFC-039's test, provided the script is correctly
constrained and passes the custody canary.

Funding invariant: `COLLATERAL >= OWED` and `OWED > 0` MUST be enforced at bond
creation. A bond that cannot cover `OWED` is invalid; a `TERMS_HASH` mismatch is
invalid. The bond MUST be funded atomically with (or before) the credit channel
draw, so the borrower cannot draw uncollateralised.

Before activation, the bond MUST have a borrower-only refund branch
(`STATUS = pending`), so a failed or cancelled channel opening cannot strand the
borrower's collateral. Activation is an explicit state transition bound to the
funded credit channel and the agreement terms; after activation, only the two
repayment/default branches above apply.

### 6.3 Binding to the agreement

`TERMS_HASH` MUST commit:

- the `EefiCreditAgreement.termsHash`;
- lender, borrower, asset, principal, rate, maturity, grace, owed, collateral;
- channel id and program id/version.

The bond coin MUST be referenced from the credit agreement and position; a bond
with a different `TERMS_HASH` is invalid. This prevents term substitution between
the UI, channel and bond.

### 6.4 Current OMP-21 status

`buildCollateralBondScript` is a useful base but **not sufficient as-is** for
credit: its repayment release defaults to `SIGNEDBY(lender)` 
(`packages/kissvm/src/templates/collateral.ts`). That makes the borrower dependent
on the lender and is **trust-minimised**, not non-custodial. RFC-059 requires a new
template (or an extended mode) with the unilateral repayment branch above. Do not
relabel the existing template as non-custodial.

### 6.5 Custody classification

- **New credit-bond script** → `non-custodial` only after `validate-custody.mjs`,
  golden fixtures and the offline-counterparty canary pass.
- **Existing OMP-21 script** → `trust-minimised` (release needs lender) until
  extended.
- **Pre-signed default settlement in the channel** → `trust-minimised`; cure and
  repayment need co-signing.
- **In-channel cooperative collateral** → not enforceable credit.

### 6.6 Partial and revolving credit (v0.2)

Partial repayment requires the bond's `OWED`/`COLLATERAL` to change. The v0.2
design uses a stateful bond successor:

```text
spend bond → pay lender repayment → create successor bond
           → reduce outstanding, preserve terms hash, advance sequence
```

The successor transition MUST be unilateral for the borrower (pay-and-update) and
MUST NOT allow the lender to rewrite terms. The lender's default branch remains
time-gated and pays only the outstanding amount. This is materially more complex;
v0.1 bullet repayment is the safe first covenant.

---

## 7. Primitive D — `OpportunityManifest` and discovery in `@totemsdk/manifest`

### 7.1 No new package: fold into the manifest envelope

Do **not** build a second signing/identity/encoding stack, and do not create a new
package for pure discovery policy. An opportunity is a manifest kind, so it uses the
existing package exactly as apps, capabilities, dApps and edge services do:

| Concern | Owner |
|---|---|
| `OpportunityManifest` schema | `@totemsdk/manifest` |
| `type: 'opportunity'` in the `Manifest` union | `@totemsdk/manifest` |
| Stable logical ID (`computeManifestId`) | `@totemsdk/manifest` |
| Revision ID (`computeManifestEnvelopeId`) | `@totemsdk/manifest` |
| Wire encode/decode (`encodeManifest`/`decodeManifest`) | `@totemsdk/manifest` |
| WOTS signing/verification (`signManifest`/`verifyManifest`) | `@totemsdk/manifest` |
| Type guard (`isOpportunityManifest`) | `@totemsdk/manifest` |
| Topic derivation (`opportunityTopic`) | `@totemsdk/manifest` |
| Generic envelope/custody/expiry/sequence verification | `@totemsdk/manifest` |
| Ranking and filters (`rankOpportunities`) | `@totemsdk/manifest` |
| Product-specific proof checks (NAV, funding, provider score) | owning package / host adapter |
| Transport ports and adapters (Hyperswarm/relay/pubsub) | `@totemsdk/omnia-host` / `@totemsdk/connect` |
| Source adapters (pool/credit/router) | `@totemsdk/omnia-host` / `@totemsdk/connect` |

`@totemsdk/manifest` stays **network-free**: topic derivation is SHA3-256 over
`@totemsdk/core`; generic verification and ranking are pure functions. It MUST NOT
import `stream-transport`, `omnia`, `liquidity-bond`, `eefi-credit` or
`provider-bond`. Transport adapters and product-specific proof checks live in
`omnia-host`/`connect`, which may import the product packages. This preserves the
manifest package's foundational role (12 packages depend on it) and avoids cycles.

The discovery layer lets any publisher advertise a pool, credit offer, routing
inventory, swap inventory, channel/factory capital or settlement reserve; lets any
client verify and rank them; and lets MOKA display them without a central indexer.

It does **not** execute, custody, price or guarantee anything. It is a signed
manifest + topic + ranking layer.

### 7.2 Opportunity kinds

```ts
type OpportunityKind =
  | 'liquidity-pool'
  | 'credit-offer'
  | 'router-liquidity'
  | 'swap-inventory'
  | 'channel-capital'
  | 'factory-capital'
  | 'settlement-reserve'
  | 'vtxo-pool'
  | 'custom';
```

Kind-specific terms are referenced by `termsHash`/`termsRef` and resolved by the
owning package (`liquidity-bond`, `eefi-credit`, `omnia-router`, etc.). The generic
manifest MUST NOT embed product-specific credit schedules or pool accounting.

Existing sources map as follows; MOKA lists **all verified third-party manifests**,
not only MOKA-operated ones:

| Existing source | Opportunity kind | Terms / liquidity source |
|---|---|---|
| `liquidity-bond` pool manifest | `liquidity-pool` | pool manifest hash; `omnia-pool` NAV/utilisation |
| `eefi-credit` offer | `credit-offer` | credit `termsHash`; committed lender capacity |
| `omnia-router` rate announcement | `router-liquidity` / `swap-inventory` | rate/quote digest; advertised vs verified capacity |
| `omnia-factory` capacity | `factory-capital` | factory id; `liquidity-bond` allocation |
| `omnia-vtxo` pool | `vtxo-pool` | pool id; capacity/exit terms |
| `liquidity-bond` settlement reserve | `settlement-reserve` | allocation id; reserve terms |

The `opportunity` package defines adapters for these sources; the source packages
MUST NOT depend on `opportunity` (avoid dependency cycles).

### 7.3 Manifest

```ts
interface OpportunityManifest {
  type: 'opportunity';
  version: 'opportunity/v1';
  opportunityId: string;               // computeManifestId: stable logical ID
  kind: OpportunityKind;
  publisher: string;                   // operator address; verifyManifest binds it
  operator?: string;                   // operator address, if different
  asset: string;
  secondaryAsset?: string;

  termsHash: string;                   // canonical product terms digest
  termsRef?: string;                   // package-specific locator (optional)
  termsInline?: Record<string, unknown>; // optional; MUST be canonical/small

  custody: CustodyContext;             // RFC-058 §6; verified, not self-asserted
  disclosureHash: string;              // RFC-058 §5 D4

  liquidity: LiquidityDisclosure;
  risk: OpportunityRisk;
  provider?: OpportunityProviderRef;

  endpoints: OpportunityEndpoint[];
  topics: string[];                    // derived topic ids, for discovery
  sequence: number;
  createdAt: number;
  expiresAt: number;
  nonce: string;
}

/** Existing envelope; no new signing stack. */
type SignedOpportunity = SignedManifest<OpportunityManifest>;

interface LiquidityDisclosure {
  mode: 'exact' | 'bucketed' | 'range' | 'hidden';
  advertised?: string;                 // decimal atoms, advisory only
  verifiedAvailable?: string;          // only with proof
  committed?: string;
  allocated?: string;                  // pools only
  utilisationBps?: number;
  asOfHeight?: bigint;
  asOfTime?: number;
  proofRefs?: string[];                // chain proofs / signed NAV attestations
}

interface OpportunityRisk {
  providerScore?: number;
  collateralRatioBps?: number;
  termBlocks?: bigint;
  lockTermsRef?: string;
  warnings?: string[];
}
```

The signature, `authorAddress`, `signerPublicKey` and `signedAt` live in the
existing `SignedManifest` envelope, not in the manifest body. `OpportunityManifest`
is added to the `Manifest` union and to the exhaustive switches in
`computeManifestId`, `verifyManifest`, `guards.ts`, `encoding.ts` and
`constants.ts` (`type` byte `0x05`). The stable key for `computeManifestId` is:

```text
opportunity\0<publisher>\0<kind>\0<asset>\0<termsHash>
```

This keeps the logical ID stable across revisions; `computeManifestEnvelopeId`
provides the content-addressed revision used for dedup and ProofGraph retention.

`custody` MUST match the publisher's signed operator manifest. Missing, invalid or
stale custody fails closed and the opportunity is hidden by default.

### 7.4 Liquidity semantics

- `advertised` is **not** liquidity. It is an advisory claim.
- `verifiedAvailable` is set only when backed by a verified funding proof
  (`liquidity-bond` `funding.status === 'chain-confirmed'`), a signed NAV
  attestation, or an equivalent chain-backed proof.
- Pools use `computePoolNAV`/`getUtilisation` from `omnia-pool`; credit offers use
  committed lender capacity, not unfunded promises.
- `provider-bond` records and scores are **evidence only**. They are not collateral,
  do not imply on-chain enforcement, and MUST NOT be presented as slashing or
  recovery guarantees (RFC-048 §3.4, RFC-039 §3.5).
- MOKA MUST label `verified` vs `advertised` explicitly. Sorting uses verified
  available; advertised-only opportunities sort lower and carry a warning.
- Do not publish precise counterparty channel balances. Use `bucketed` or `range`
  by default (RFC-048 §3.5). `exact` is opt-in.

### 7.5 Topic derivation

Use the existing 32-byte Hyperswarm topic convention (`omnia/src/topic.ts`) with
domain separation:

```ts
opportunityTopic('index')                  // global index
opportunityTopic({ kind })                 // per kind
opportunityTopic({ asset })                // per asset
opportunityTopic({ kind, asset })          // per kind+asset
opportunityTopic({ custody: 'self' })      // optional custody filter
```

```text
topic = SHA3-256('totemsdk:opportunity:v1:' + canonicalKey)
```

Publishers announce to the index topic and the relevant kind/asset topics.
Subscribers join the index plus any filters. Deduplicate by `opportunityId`; keep
the highest `sequence`; discard expired or stale manifests.

### 7.6 Transport ports

The manifest package exports the transport **interface and filter types** only; it
does not implement a network adapter.

```ts
interface OpportunityTransport {
  announce(manifest: SignedOpportunity): Promise<void>;
  subscribe(filter: OpportunityFilter, onManifest: (m: SignedOpportunity) => void): Promise<() => void>;
  query?(filter: OpportunityFilter): Promise<SignedOpportunity[]>;
  close(): Promise<void>;
}
```

Adapters live in `omnia-host`/`connect`:

- **Hyperswarm** via `stream-transport`/`omnia` (native; extension/host only);
- **Relay** via `omnia-relay` (hosted or self-hosted);
- **Pub/Sub** via `pubsub-transport` (MQTT-compatible);
- **In-memory** for tests.

Browsers cannot join Hyperswarm directly. MOKA relies on the Totem extension (or an
Omnia host) to join topics and forward verified manifests. The extension is the
transport bridge, not a trusted indexer: it forwards signed manifests, and MOKA
verifies them itself.

### 7.7 Verification

Two layers:

**Generic (in `manifest`, pure, no product imports):**

1. `verifyManifest(signed).valid === true` (no second signature scheme);
2. `manifest.type === 'opportunity'` and schema/version are supported;
3. `opportunityId === computeManifestId(manifest)`;
4. publisher identity / signed operator manifest;
5. custody context matches the signed operator manifest (never dApp claims);
6. disclosure hash/version present and fresh;
7. expiry and sequence (replay protection);
8. topic binding.

**Product-specific (in `omnia-host`/`connect` adapters, which may import products):**

9. `termsHash` matches the referenced package's canonical digest
   (`eefi-credit`, `liquidity-bond`, routing, etc.);
10. liquidity proof refs where `verifiedAvailable` is claimed;
11. provider score/bond refs where claimed (evidence only).

Any failure → `invalid`; invalid manifests are not displayed. The generic layer MUST
fail closed on missing custody/disclosure; the product-specific layer MUST NOT
upgrade `advertised` to `verified` without proof.

### 7.8 Ranking

MOKA's default ordering:

```text
custody rank: self (0) < trust-minimised (1) < hosted (2) < unknown (hidden)
then verifiedAvailable descending
then providerScore descending
then cost/rate ascending (feeBps / rateBps)
then expiry ascending
```

The user can filter by custody, asset and kind. Hosted opportunities are visible
but always after self/trust-minimised and carry a persistent `Hosted` badge.
Selecting a hosted commitment triggers the RFC-058 disclosure gate before signing.
Unknown custody is hidden by default and cannot be signed.

### 7.9 Anti-spam and privacy

- Signed manifests only; unsigned announcements are dropped.
- Max manifest size and schema depth; reject oversized payloads.
- Per-publisher rate limits and optional provider-bond/identity requirements.
- Sequence/expiry replay protection.
- Liquidity disclosure defaults to bucketed; exact amounts are opt-in.
- No precise per-counterparty balances, no route topology leakage.
- Optional encrypted/private listings are out of scope for v1 but reserved.

---

## 8. MOKA — first consumer

### 8.1 Product shape

MOKA is a **web application** accessible through the Totem extension. It is not an
SDK package and owns no protocol logic. It connects via `@totemsdk/connect`, uses
the extension for signing and transport, and displays:

```text
Portfolio · Earn · Swap · Borrow · Provide · Channels · Activity
```

MOKA never holds keys, never custodies funds, and never asserts a custody mode. It
renders the signed manifest's custody classification.

### 8.2 Discovery screen

MOKA subscribes to the opportunity index and relevant asset/kind topics. For each
verified manifest it renders a card:

```text
MOKA Router Pool                [Self-custody]
MIN · liquidity-pool
Verified available: 42,500 MIN
Utilisation: 72% · Term: flexible · Provider score: 91
Status: pooled return disabled (RFC-050 §7.1) · realized fees: verified

MOKA Credit #12                 [Trust-minimised]
MIN · credit-offer
Available: 5,000 MIN · 30 days · 7.4% advertised APR
Collateral: 125% · Provider score: 88
```

Rules:

- sort by custody then verified liquidity (§7.8);
- show `Verified` only with proof; otherwise show `Advertised` and de-emphasise;
- show `Hosted` badge and require disclosure before any commitment;
- hide expired/invalid/unknown-custody entries;
- allow filters: asset, kind, custody, term, verified-only.

### 8.3 Actions

- **Read**: `totem_opportunityList` / subscription via Connect; no signing.
- **Announce**: signed by operator identity; uses `SignRequest` (manifest domain).
- **Credit open/draw/repay**: `SignRequest` domain `credit`; RFC-058 disclosure gate;
  host/Connect work deferred to Phase 2.
- **Pool deposit/allocate**: existing `omnia-pool` + Connect; RFC-058 gate; pooled
  capital blocked until RFC-050 §7.1.

### 8.4 No backend, no indexer

MOKA has no server-side index. Discovery is peer-to-peer via the extension/host.
Optional local caching is client-side and MUST re-verify on load. There is no MOKA
central registry and no privileged listing operator.

### 8.5 Yield presentation

RFC-058 D6: no pooled return and no public yield advertising in the non-custodial
default. MOKA MUST:

- show **realized, verified fees** rather than projected emissions;
- label any forward rate as `advertised`, not guaranteed;
- distinguish bilateral **contractual credit interest** from **pooled yield**; show
  credit APR as an advertised contractual rate, never as a guaranteed return;
- never present token emissions as yield;
- for hosted opportunities, defer to the operator's signed disclosure and
  regulatory wrapper.

### 8.6 Lender incentives and capital formation

MOKA does **not** invent a yield token or subsidise borrowing. The supply side is
compensated by the borrower, and the principal is protected by a pre-funded
collateral bond.

**Primary incentive: contractual interest.**

- The lender publishes a `CreditOffer` with a fixed APR, term, maximum principal,
  collateral policy and borrower policy.
- The borrower pays interest under the signed `EefiCreditAgreement`. This is a real
  cash flow, not an emission.
- Rates compete: MOKA lists offers; borrowers choose. There is no central rate
  setter.

**Secondary incentives and protections:**

| Mechanism | Effect |
|---|---|
| Term premium | Longer lockups command higher rates because lender liquidity is restricted. |
| Overcollateralisation | Same-asset collateral at ≥100% of `OWED`; no oracle, no price-liquidation race. |
| Objective default | Bond pays the lender only `OWED`; surplus returns to the borrower. |
| Borrower selection | Lenders set minimum provider score, identity requirements, collateral ratio and term. |
| Reputation evidence | `provider-bond` score/history is a selection signal; it is **not** collateral and implies no slashing. |
| Visibility | MOKA discovery gives offers distribution; ranking is by custody and verified liquidity, not paid placement. |
| Origination/match fee | Optional, disclosed, paid to MOKA/operator; it is a service fee, not lender yield. |

**Capital formation without pooled custody (v0.1):**

- Lenders publish bilateral offers; borrowers accept directly. No pooled user
  capital, no omnibus account, no NAV token.
- MOKA and partners may bootstrap by publishing offers from **their own treasury**
  (clearly labelled as counterparty capital), not by pooling user funds.
- Pooled credit (`omnia-pool` + `liquidity-bond`) is deferred until RFC-050 §7.1
  closes and `liquidity-bond` gains a `credit-capital` allocation type and a
  `credit-interest` fee source. Until then, MOKA MUST NOT advertise pooled credit
  or public yield.

**Lender liquidity:**

- v0.1 capital is locked until repayment/maturity; there is no secondary market.
  The term premium is the compensation.
- v0.2 may add assignment/transfer of a `CreditPosition` or a lender exit
  mechanism. It MUST preserve the borrower's terms and the bond binding.

**Why borrowers pay:**

- They need **usable Omnia channel/factory capacity**, routing working capital, or
  settlement liquidity without moving funds to L1.
- They may want to keep a provider bond, factory share or other position intact
  while obtaining capacity elsewhere.
- Interest is the price of that capacity and the lender's lockup.

**Honest demand limitation:** a fully collateralised, same-asset, bullet loan is
intentionally low-risk and therefore low-yield. It proves the credit primitive and
the collateral path; it is not yet a mass-market lending product. Demand expands
with provider-bond-backed credit, factory-share collateral, streaming-revenue
repayment and — only after the gates — cross-asset credit and pooled liquidity.

### 8.7 Collateral flow and no-double-recovery

The bond is the borrower's collateral; the lender's principal is the credit-channel
funding. They are separate value flows and MUST NOT be counted twice.

**Flow:**

1. Lender publishes a `CreditOffer`; borrower accepts and both sign the
   `EefiCreditAgreement` (`termsHash`).
2. Borrower funds the credit-bond UTXO with `COLLATERAL >= OWED`; the bond commits
   lender, borrower, asset, principal, rate, maturity, grace, `OWED`, collateral and
   the channel/agreement binding.
3. Lender funds the credit channel (or the agreed capacity source). Funding is
   atomic with, or precedes, activation; a pre-activation borrower refund branch
   prevents stranded collateral.
4. Borrower draws; `CreditProgram` enforces limit, principal, accrual and status.
   The bond remains locked.
5. **Repayment:** the borrower spends the bond through the unilateral
   repay-and-reclaim branch: lender receives `OWED`, borrower receives the surplus.
   The channel state records repayment and releases the debt. The bond is spent, so
   it cannot be claimed again.
6. **Default:** after maturity + grace, the lender spends the bond through the
   objective default branch: lender receives `OWED`, borrower receives the surplus.
   The channel settles the remaining balances net of the debt.

**No-double-recovery invariant:**

- The bond's `OWED` MUST be reduced by repayments already recorded in the credit
  position, or the bond MUST be released on repayment. The lender MUST NOT receive
  both the channel balance and the bond for the same principal.
- `TERMS_HASH` binds the bond to the agreement and channel; a mismatched bond is
  invalid.
- The channel settlement and bond spend are reconciled by the credit position's
  `repaidPrincipal`/`repaidInterest` and the bond's `OWED`; tests MUST prove
  conservation.

**Borrower downside:**

- Because the lender receives only `OWED` and the surplus returns to the borrower,
  the borrower's maximum loss is `OWED` (principal + interest), not the entire
  collateral. Default is a settlement mechanism, not a punitive liquidation.
- An explicit penalty, if configured, MUST be capped, disclosed in the agreement,
  and included in `OWED`; v0.1 defaults to no penalty.

**Collateral limitations:**

- `provider-bond`, factory shares and external proofs are **evidence/policy
  inputs**, not hard collateral, until a corresponding enforceable covenant exists.
  If a lender accepts them, the opportunity is `trust-minimised` at best.
- Cross-asset collateral requires an explicit valuation/oracle policy and is out of
  scope for v0.1.
- An unfunded, under-collateralised or terms-mismatched bond makes the credit
  invalid; no uncollateralised draw is permitted.

### 8.8 Bootstrap points instead of token emissions (v0.1 decision)

**No token is created or emitted for v0.1.** Instead, the ecosystem runs a
time-boxed **Bootstrap Points** programme across a small number of applications,
including MOKA. Points are a record of verified contribution, not money, not
yield, and not a transferable asset.

**Points vs credits:**

- **Bootstrap Points** — non-transferable, non-monetary, not redeemable for cash;
  used only to measure participation during the bootstrap window. They MAY be
  recognised in a future token genesis if a token is launched; that recognition is
  discretionary, not a promise.
- **Service Credits** — optional, spendable on fees/usage inside a product. They
  are not convertible to tokens and MUST NOT be presented as an investment.
  Do not mix the two ledgers.

**Programme shape:**

```text
Bootstrap Season 0
├── apps: MOKA, <partner apps>
├── window: fixed start/end (block height)
├── published weights, caps and exclusions
├── verified actions only
└── sunset: programme ends; no perpetual farming
```

**What earns points (examples):**

| App action | Weight basis |
|---|---|
| Credit offer drawn and performing | drawn principal × time × repayment performance |
| Liquidity allocated to a productive backend | verified allocated capital × time × utilisation |
| Swap/routing volume | verified settled volume × fee contribution |
| Channel/factory capital actually used | capacity × time × usage |
| Repayment/close completed | completion and reliability, capped |

**What does not earn points:** idle deposits, borrowed-back capital, recursive
leverage, self-dealing, wash volume, unverified/self-asserted liquidity, or
anything that only increases TVL without use.

**Ledger design (new reusable primitive):**

- `@totemsdk/points` (data-only): `BootstrapProgram`, `PointsAccount`,
  `PointsEvent`, `PointsEpochRoot`, `PointsBalance`, `ConversionPolicy`.
- Points events are canonical, signed by the app/host and content-addressed;
  balances are derived, not mutable rows.
- Per-epoch Merkle roots MAY be anchored to Minima (statechain/Omnia/MASH) for
  tamper-evidence; do not put every action on L1.
- App-scoped namespaces plus an ecosystem-wide aggregate keyed by root identity.
  One identity per beneficiary; no double counting across apps.
- Anti-farming: verified allocation, time weighting, per-account/per-provider caps,
  non-recursive rules, anomaly detection, and clawback for proven fraud.

**Future token recognition:**

- A `ConversionPolicy` MAY be published at token genesis: eligible apps, snapshot
  height, points-to-token ratio, caps, vesting, jurisdiction exclusions, KYC/AML
  requirements, claim deadline and unclaimed treatment.
- Until that policy is signed by the issuer/DAO and legally reviewed, points carry
  **no monetary value and no guaranteed conversion**.
- Do not market points as “APR”, “yield”, “pre-token”, or a guaranteed airdrop.
  In the UI they are “Bootstrap points — no value; future recognition not
  guaranteed.”
- If a firm conversion commitment is made, treat it as a token allocation and
  obtain jurisdiction-specific legal review; it is no longer a neutral points
  programme.

**Who runs it:** the Totem DAO/issuer, not MOKA. MOKA is one participating app and
displays points; it does not issue, custody, or guarantee them. A hosted operator
running its own programme is responsible for its disclosures and legal wrapper.

**Custody/regulatory:** the points ledger is data-only and holds no value. If an
operator holds or controls the ledger/claim, it is trust-minimised at best and
must disclose that. Public token-conversion marketing is an investment-marketing
risk (RFC-058 §14); keep points separate from fee/interest yield.

**Generic primitive:** the programme manifest, points events, rules, epoch roots,
anti-farming and conversion policy are defined in
**RFC-060 — Bootstrap Points and Future Token Recognition**. This section is
MOKA's participation policy, not a separate implementation.

---

## 9. Fit with RFC-058 and custody

### 9.1 Packaged custody classifications

| Package / artifact | Classification | Reason |
|---|---|---|
| `@totemsdk/eefi-credit` | `non-custodial` | data/digest library; holds no on-chain value |
| `CreditProgram` in `@totemsdk/omnia` | inherits `omnia` `non-custodial` | no new single-signer settlement branch |
| Credit-bond script in `@totemsdk/kissvm` | `non-custodial` **only after gate/canary** | borrower repay/reclaim and lender default are unilateral |
| Existing OMP-21 `buildCollateralBondScript` | `trust-minimised` until extended | release defaults to `SIGNEDBY(lender)` |
| `@totemsdk/manifest` (`OpportunityManifest` kind + pure discovery policy) | `non-custodial` | schema/ID/wire/sign-verify/topic/ranking library; holds no value |
| MOKA deployment | `self` by default; hosted listings disclosed | web app; extension is the signing boundary |

The credit-bond script MUST be registered in `scripts/workspace-gates.config.json`
with a `script` entry and golden fixtures, and MUST pass the offline-counterparty
canary before any `non-custodial` claim.

### 9.2 Credit is a liquidity commitment

RFC-058 §4 defines a liquidity commitment as a signature that puts capital at risk
or restricts withdrawal. Credit acceptance, draw, collateral lock and pool deposit
are liquidity commitments. Therefore:

- the offer/agreement schema carries `custody` and `disclosureHash` from v0.1;
- intent builders return `SignRequest`-ready context;
- the host/extension refuses missing custody metadata (fail closed);
- hosted credit requires a blocking disclosure acknowledgement;
- signatures are domain-separated with the disclosure hash so they cannot be
  replayed under different terms.

### 9.3 RFC-058 amendments required

This RFC proposes four additions to RFC-058:

1. Add `'credit'` (and `'manifest'`/`'opportunity'` for announcements) to
   `SignRequest.domain`.
2. Add credit acceptance/draw/collateral lock to the §4 liquidity-commitment list.
3. Add `eefi-credit` and `opportunity` to the §7 package impact table.
4. State explicitly that hosted credit listings are visible but gated at signing;
   viewing is not a commitment.

### 9.4 Sequencing gate

RFC-058 D0 requires custodial plumbing completeness before non-custodial
implementation work. Current blockers include no `SignRequest`/`SignerPort`, no
unilateral close/recovery host methods, no VTXO/pool host methods, no disclosure
gate, and no live Minima node (RFC-058 §5.0).

Consequences:

- **Phase 1 may start now:** pure domain, built-in program, bond covenant,
  manifest opportunity additions (schema/topics/ranking), unit/parity/golden tests.
  No host/Connect mutation methods, no live value.
- **Phase 2 is blocked** until RFC-058 P1/P2: `SignRequest`/`SignerPort`, host
  credit methods, Connect wrappers, disclosure gate, live E2E.
- **Phase 3 (MOKA)** follows Phase 2; read-only discovery can be prototyped
  earlier against the extension mock.
- **Pooled credit** is blocked twice: RFC-050 §7.1 and RFC-058 D6.

---

## 10. Security invariants

Credit domain:

- principal never negative; collateral never negative;
- draw never exceeds limit;
- repayment never creates value;
- interest cannot accrue twice over one interval;
- interest arithmetic is bigint-only and path-independent;
- maturity cannot move backwards;
- terms hash, lender, borrower and asset are immutable after activation;
- terminal positions cannot draw;
- collateral release cannot violate policy;
- overpayment is refunded or rejected, never burned;
- every transition is deterministic and serializable.

Program:

- update-path invariants from §5.4;
- sequence monotonic; stale state rejected;
- no silent change to program id/version;
- port band and instruction budget enforced by CI;
- TS/Rust/WASM parity unchanged.

Bond:

- borrower cannot reclaim without paying `OWED`;
- lender cannot seize before maturity + grace;
- neither party can take more than `OWED`;
- surplus always returns to the borrower;
- `TERMS_HASH` binds the bond to the agreement;
- no single-signer sweep; every branch has an output constraint;
- custody gate/golden/canary passes before any non-custodial claim.

Discovery:

- unsigned, invalid, expired, stale or custody-spoofed manifests are dropped;
- `advertised` is never treated as `verified`;
- exact liquidity disclosure is opt-in;
- replay/dedup by `opportunityId` + sequence;
- no central indexer, no privileged listing operator;
- hosted commitments fail closed without disclosure acknowledgement.

---

## 11. Testing and conformance

### 11.1 `eefi-credit`

- offer creation and hash stability; expiry/cancel;
- agreement terms hash stability; immutability after activation;
- draw, overdraw, multiple draws;
- zero-duration interest; known fixed-rate fixtures;
- path-independent interest (one accrual vs many);
- partial/full/overpayment (v0.2 for partial bond);
- collateral add/release; illegal release;
- premature and overdue transitions; cure; default resolution;
- serialization round-trip; malformed payloads; BigInt;
- stale sequence/state; crash/restart recovery;
- conservation and adversarial cases.

### 11.2 `CreditProgram`

- TS/Rust/WASM parity for every action;
- golden fixtures and recovery;
- port gate (`validate:ports`) and composite budget
  (`validate:composite-ports`);
- stale sequence/double-sign rejection;
- terminal-state draw rejection.

### 11.3 Credit bond

- borrower repay-and-reclaim with lender offline;
- lender default after maturity + grace with borrower offline;
- rejection before maturity/grace;
- rejection of underpayment and over-seizure;
- surplus return;
- wrong terms hash / wrong asset / wrong lender;
- real-VM execution (L4) before value-bearing deployment;
- custody canary and golden fixture.

### 11.4 Opportunity discovery

- topic derivation determinism;
- signature/custody spoof rejection;
- stale/expired/replayed manifest rejection;
- dedup and sequence ordering;
- verified vs advertised liquidity;
- sorting by custody then verified liquidity;
- Hyperswarm/relay/pubsub adapters;
- oversized manifest/rate-limit handling;
- privacy disclosure modes.

### 11.5 MOKA conformance

- extension-required connection;
- discovery list ordering and badges;
- hosted disclosure gate before signing;
- no pooled yield in non-custodial default;
- no backend/indexer dependency;
- verified vs advertised labels;
- end-to-end credit flow after Phase 2.

---

## 12. Implementation sequence

### Phase 1 — foundations (authorised now)

1. `@totemsdk/eefi-credit` package: types, canonical digests, validation, interest,
   lifecycle, events, intents, in-memory store. Data-only.
2. `CreditProgram` in `@totemsdk/omnia`: TS + Rust + WASM + fixtures + parity;
   port registry extension; composite budget check.
3. Credit-bond template in `@totemsdk/kissvm`: unilateral repay/reclaim + default;
   golden fixtures; custody classification pending canary.
4. `@totemsdk/manifest`: add `type: 'opportunity'` to the `Manifest` union, the
   `OpportunityManifest` schema, `isOpportunityManifest`, the exhaustive
   ID/verify/encoding/type-byte switches, `opportunityTopic`, generic
   `verifyOpportunity`, `rankOpportunities` and transport/filter types; reuse
   `signManifest`/`verifyManifest`. Keep the package network-free and product-free.
5. Documentation: RFC-058 cross-references; `docs/STATE-PORT-REGISTRY.md`;
   `SDK_MANIFEST.json` entries.

**No host/Connect mutation methods in Phase 1.** No live value.

### Phase 2 — signing and execution (after RFC-058 P1/P2)

6. `SignRequest`/`SignerPort` and custody schema in `core`.
7. `omnia-host` credit service + opportunity read/announce service.
8. `connect` credit/opportunity methods and capability flags.
9. Extension disclosure gate for credit commitments.
10. Live E2E: fund → bond → draw → repay/default → settle.

### Phase 3 — MOKA

11. MOKA web app: Connect integration, discovery list, custody badges, sorting,
    filters, credit flows, activity feed.
12. Hosted opportunity flow with disclosure gate.
13. No pooled yield; realized fees only.

### Phase 4 — extensions

14. Stateful bond for partial/revolving credit.
15. Provider-bond and factory-share collateral modes.
16. Cross-asset credit only with an explicit valuation/condition policy.
17. Pooled credit only after RFC-050 §7.1 and RFC-058 D6 close.

---

## 13. Open questions

1. Exact `BLOCKS_PER_YEAR` constant and whether Minima block intervals are stable
   enough for nominal APR; or use an explicit time input and document the trade-off.
2. Should v0.1 support partial repayment via a stateful bond, or ship bullet
   repayment first? (Recommendation: bullet first.)
3. Should the credit-bond script live in `kissvm/templates/credit-bond.ts` or be an
   extended mode of `collateral.ts`? (Recommendation: separate template, shared
   helpers.)
4. Exact topic naming and whether to use one global index or per-asset indices.
5. Spam mitigation: provider bond, identity allowlist, proof-of-work, or rate limit?
6. Should opportunity manifests be encrypted for private liquidity, and which
   selective-disclosure scheme?
7. Should MOKA show hosted opportunities by default or require an explicit
   "Show hosted" opt-in? (Recommendation: show, sorted last, with a badge and a
   signing gate.)
8. What is the exact mapper from `liquidity-bond` pool state and `eefi-credit`
   offers into `OpportunityManifest`? Owner: `opportunity` adapters, not the product
   packages.
9. Which RFC-058 P0 rows may be waived for a read-only MOKA discovery prototype?
   (Recommendation: none for signing; read-only discovery may use an extension mock.)
10. Does the credit channel need to exist at all for v0.1 bullet credit, or can the
    bond plus a direct funding transaction suffice? (Recommendation: keep the
    channel for accounting/activity; the bond is the enforcement.)

---

## 14. References

- `docs/CUSTODY-POLICY.md` — non-custodial test and package classifications.
- RFC-039 — custody conformance and the eltoo both-signed correction.
- RFC-048 — Omnia primitive completeness, bond semantics, privacy.
- RFC-049 — MASH × Omnia × Eefi, credit is Eefi.
- RFC-050 — Eefi product architecture, pooled-capital gate, credit sequence.
- RFC-053 — Eefi generic contracts.
- RFC-054 — Eefi Protocol 0.1 private spot exchange (bilateral scope precedent).
- RFC-058 — custody modes, `SignRequest`/`SignerPort`, disclosure gate.
- RFC-060 — Bootstrap Points and Future Token Recognition.
- `packages/manifest/src/types.ts`, `id.ts`, `verify.ts`, `sign.ts`, `encoding.ts`, `guards.ts`
- `packages/omnia/src/program.ts`, `script.ts`, `types.ts`
- `packages/omnia/rust/src/program.rs`, `wasm.rs`
- `packages/kissvm/src/templates/collateral.ts`, `exercise.ts`
- `packages/eefi/src/types.ts`, `digests.ts`
- `packages/liquidity-bond/src/pool-manifest.ts`, `types.ts`
- `packages/omnia-pool/src/nav.ts`, `fees.ts`
- `packages/provider-bond/src/policy.ts`, `types.ts`
- `packages/manifest/src/types.ts`, `verify.ts`
- `packages/omnia/src/topic.ts`, `swarm.ts`, `relay.ts`
- `packages/stream-transport`, `packages/pubsub-transport`
- `packages/omnia-host/src/api/methods.ts`
- `packages/connect/src/types.ts`

---

## 15. Authorisation

Phase 1 is authorised: `@totemsdk/eefi-credit` (data-only), `CreditProgram`
(TS/Rust/WASM + parity), the `@totemsdk/kissvm` credit-bond template, and the
`@totemsdk/manifest` additions (`OpportunityManifest` kind, schema/ID/wire/
sign-verify, topic derivation, generic verification and ranking). **No new
package.** These are library/program/covenant primitives and do not expose a
host/Connect mutation path.

Phase 2 is **not authorised** until RFC-058 P1/P2 lands (`SignRequest`/`SignerPort`,
custody/disclosure schema, host credit/opportunity services, Connect wrappers,
extension gate, live E2E). Phase 3 (MOKA) follows Phase 2. Pooled credit remains
blocked until RFC-050 §7.1 and RFC-058 D6 close.

### 15.1 Prerelease change policy

Because the SDK is prerelease with no users, this RFC is a clean-break design:

- **No new opportunity package.** The schema and pure discovery policy live in
  `manifest`; transport adapters live in `connect`/`omnia-host`. If a non-Omnia
  consumer later needs a transport-heavy layer, extract it then. Do not add aliases
  for old names.
- **`@totemsdk/manifest` may take a major bump** (for example `3.0.0`) for the new
  `opportunity` kind; no compatibility shims for the old union.
- **`@totemsdk/omnia` may reallocate ports and program IDs**; no dual IDs, no
  legacy program versions.
- **Host/Connect may replace methods**; no deprecated wrappers, no PWA parity
  shims.
- **OMP-21 may be changed in place or superseded by a new credit-bond template.**
  Choose the cleaner security shape, not the more compatible one; update golden
  fixtures and custody classifications intentionally.
- **No migration guides, deprecation windows, or compatibility tests.** Security,
  custody, parity and conformance tests are still mandatory.

The only compatibility constraint is **wire/state determinism within a deployed
test network**: if a test network already has live coins, changing a script/port
invalidates them. Since there are no users, discard and recreate test state rather
than carrying legacy paths.
