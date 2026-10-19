# RFC-050 — Eefi Product Architecture: Programmable Capital Markets for Machines

Status: Draft for architectural review — proposed, not merged for implementation
Created: 2026-10-18
Authors: Totem SDK Contributors
Depends on: RFC-007 (Storage), RFC-017 (Decision Receipt Graph), RFC-019 (Governed Commerce), RFC-021–023 (Industrial/Physical), RFC-035 (Peer Coordination), RFC-036 (Settlement Verification), RFC-039 (Custody Conformance), RFC-047 (Experience), RFC-048 (Omnia Primitive Completeness), RFC-049 (MASH × Omnia × Eefi), RFC-051 (AI-Proposed Committed Facts)
Touches (proposed): generic contracts in `kissvm`/`recursive-mast`, `omnia`/`omnia-pool`, `authority`/`agent-policy`, `proof`/`proofgraph`, `identity`/`manifest`, `lookup-*`, `storage`; the Eefi product layer above them

> **Positioning.** RFC-047/048/049 are **preconditions**, not the Eefi product specification.
> This RFC is the Eefi **boundary and interface** spec: it defines the product/market/risk layer
> that composes MASH capital authorization, Omnia execution, and Totem evidence/governance — and
> it names the primitives that MUST exist before each Eefi product can be claimed.
>
> **Scope.** Architecture and interfaces only. No implementation is authorised by this RFC.

---

## 1. What Eefi is

Eefi is the **product economics, markets, risk and product-governance** layer above Omnia: RFQ
markets, pricing, liquidity leasing, machine credit, receivables/revenue finance, and (later)
derivatives and structured products. The SDK does **not** accumulate product-specific packages;
it provides **reusable contracts** beneath a thin Eefi product layer.

**Division of responsibility (unchanged from RFC-048):**

| System | Owns | Does NOT own |
|---|---|---|
| Totem substrate (`identity`, `proof`, `proofgraph`, `authority`, `agent-policy`, `storage`, `lookup-*`) | identity, evidence, policy, durability, discovery | money movement |
| MASH (node, MSHS-2) | **capital authorization** at OPEN/CLOSE boundaries | channel operation, product logic |
| Omnia (`omnia*`) | financial execution: funding, updates, routing, factories, splice, settlement, recovery | pricing, risk, product terms |
| **Eefi** (this RFC) | **product/market/risk economics** and product governance | identity, proofs, custody, execution |

---

## 2. Three enforcement stages (and after-close)

Financial conditions are enforced in three distinct places; conflating them is the common error.

| Stage | Enforcer | Boundary |
|---|---|---|
| **OPEN — Capital authorization** | MASH + MAST + KISSVM | which capital may enter, permitted assets/counterparties, collateral, maturity, caps |
| **UPDATE — Financial state machine** | Omnia programs + co-signed state + agent-policy | interest, repayments, meter readings, margin, credit drawdown, HTLCs |
| **CLOSE — Settlement rights** | Omnia dispute/settlement + MASH-controlled recipients | principal return, fee sharing, waterfall, escrow release, recovery |
| **After close** | MASH destination wallet | rollover / reinvestment / withdrawal policy (cannot retroactively change the close payout) |

**Critical:** MASH funding does **not** authorize Omnia's off-chain updates. Omnia updates and
settlement require **both** participants' signatures; a unilateral close broadcasts a
**previously co-signed** close package (RFC-039). An OPEN-stage MASH policy governs entry of
capital, not the channel's internal state machine.

### 2.1 Integration models

- **Model A — MASH-governed channel boundaries (first).** MASH controls funding and settlement
  destination wallets; existing Omnia scripts unchanged.
- **Model B — MASH-aware Omnia contracts.** Funding/update/settlement scripts embed MAST policy
  commitments and enforce additional invariants. More powerful; new protocol work + consensus
  tests + financial review.

---

## 3. The load-bearing gap: enforceable conditional settlement / unilateral exercise

Every non-trivial Eefi product (lease return, credit default, option exercise, parametric payout,
tranche waterfall) requires a party to **exercise or settle without the counterparty's
cooperation**. Omnia's current both-signed settlement branch **cannot** provide this, and
RFC-049 already says so ("the option buyer MUST have an executable exercise right … cannot be
assumed from Omnia's current both-signed settlement branch").

Therefore RFC-050 makes the following **mandatory precondition** for Gen-2/3 products:

> **P-EXIT — Enforceable unilateral exercise/settlement covenant.** A KISSVM/`recursive-mast`
> covenant under which a party can, after an objective on-chain condition (maturity, timeout,
> oracle witness, default), spend to exactly its committed beneficiary path **without any third
> party's signature or liveness**, with no unilateral path for any counterparty to redirect value.

This is the Eefi analogue of the RFC-039 per-share exit. Without it, Eefi products are
trust-minimised at best and **must be labelled as such** (CUSTODY-POLICY).

**First shape — implemented.** The initial P-EXIT covenant is a KISSVM template,
`buildExerciseCovenant` + `exerciseCovenantStateVariables` in `@totemsdk/kissvm`
(`packages/kissvm/src/templates/exercise.ts`). It encodes: a committed time window (maturity /
recovery ports read from `PREVSTATE`, pinned by `SAMESTATE`); a **beneficiary branch** that opens
after the objective condition and pays *exactly* the committed beneficiary path, requiring only the
beneficiary's own signature (never the owner's); and a **recovery branch** that pays the owner's own
address only after the window. A caller-supplied `condition` expression (e.g. `MAST(0x…)`,
`SIGNEDBY(0x…)`) supports oracle-witness / liquidation shapes, and `requireSignature: false` gives a
permissionless trigger whose payout is still fixed to the beneficiary. It is validated by
`scripts/exercise-exec-vm.mjs` — real `TreeKey` signatures through **both** the TypeScript and
Rust/WASM VMs (beneficiary exercises; owner cannot redirect; recovery is time-bounded; tampered
digest rejected) — plus logic tests in `packages/kissvm/src/__tests__/exercise.test.ts`. Payouts may be
**whole-balance** or a **fixed `payout` with a remainder** (default: back to the owner). A companion
**OMP-21 collateral-bond covenant** (`buildCollateralBondScript`) implements objective-condition
liquidation with a borrower reclaim path and no operator discretion. An **OMP-19 oracle condition
witness** (`buildOracleConditionScript`) commits an observation and validates an authorized oracle
quorum, freshness and an objective value comparison — the **cooperative/attested** shape (this SDK's
`CHECKSIG` binds the oracle to the transaction digest). The **non-cooperative** path is
`buildOracleExerciseCovenant` (commit the observation at funding; the beneficiary exercises alone).
Still open: the product economics around the bond and the oracle policy/quorum runtime.

---

## 4. Gating primitives (must exist before Eefi products)

Mapping Eefi needs → the RFC-048 primitives that must land first:

| Eefi need | Required primitive | RFC-048 ref | Status |
|---|---|---|---|
| Bind funded capital to approved terms | Channel funding + VM-valid transitions | OMP-06 | Partial |
| Return of capital / loan repayment / derivative settle | Co-signed closes + executable settlement/recovery (P-EXIT) | OMP-07, **P-EXIT** | Partial / **new** |
| JIT credit, RFQ, no double-allocation | Capital reservation / anti-double-allocation | OMP-13 | Partial |
| Forwards/swaps/options binding | Signed bilateral financial quote | OMP-14 | Partial |
| Price-linked / parametric payouts | Trusted oracle observation policy + on-chain condition witness | OMP-18, OMP-19 | **New** / Partial → condition witness in `kissvm` (§3) |
| Secured lending, liquidation, loss recovery | Enforceable collateral bond (incl. **liquidation covenant**) | OMP-21 | **New** → first covenant in `kissvm` (§3) |
| Structured yield / LP entitlement | LP backing + exact withdrawal entitlement | OMP-20, OMP-22 | Partial |

Two RFC-048 details remain load-bearing: (a) Omnia program injection is update-path logic — a
credit/derivative program **must not assume** its predicates constrain the **final settlement
payout** (verify separately); (b) composite scripts need state-port + instruction-budget checks
(RFC-048 §12, RFC-049 §5) — MASH uses ports **230–255** and a large KISSVM budget, so the verifier
must be a canonical MAST dispatch (it MAY authorize updates, per R-MASH-5, but never inlined).

---

## 5. The reusable Eefi contract surface (SDK-owned, generic)

Generic contracts live in the SDK (kissvm templates + thin types); **products** live in the Eefi
layer. Proposed:

```ts
// 1) Capital: binds MASH authorization to Omnia terms + settlement rights.
interface EefiCapitalAgreement {
  version: 'eefi-capital/v1';
  termsHash: string;                 // MUST be bound wherever enforcement occurs, never stored-only
  funding: {
    mashPolicyRoot: string;
    allowedProgramHash: string;
    assetId: string;
    maxAmountAtoms: string;
    counterparties?: string[];       // OPTIONAL — absent ⇒ open to anyone (permissionless)
  };
  operation: {
    channelProgramId: string;
    maturityBlock: string;
    stateRulesHash: string;
    conditionPolicyId?: string;
  };
  settlement: {
    payoutPolicyHash: string;
    recoveryPolicyHash: string;
    collateralCommitment?: string;
  };
}

// 2) Market: a signed, finite, executable quote (distinct from the capital agreement).
interface EefiMarketAgreement {
  version: 'eefi-market/v1';
  quoteId: string;
  nonce: string;
  side: 'buy' | 'sell';
  baseAssetId: string; quoteAssetId: string;
  baseScale: number; quoteScale: number;
  exactIn?: string; exactOut?: string;
  priceAtoms: string;
  feesBps: number;
  maxSlippageBps?: number;
  venue: string;                     // reserve / channel / HTLC plan reference
  deadlineBlock: string;
  conditionPolicyId?: string;        // oracle policy, if price-linked
  makerId: string; takerId: string;
  domain: string;                    // chain/network domain
  signatureRef: string;              // reuses edge TradeProposal/Agreement canonical digest
}

// 3) Risk: declarative policy referenced by products (never a discretionary engine).
interface EefiRiskPolicyRef {
  version: 'eefi-risk/v1';
  policyId: string;
  maxExposureAtoms: string;
  collateralRatioBps?: number;
  haircutBps?: number;
  liquidationConditionId?: string;   // objective witness → on-chain covenant
  oraclePolicyIds?: string[];
}

// 4) Exercise / liquidation covenants (kissvm templates, the P-EXIT primitive).
interface EefiExerciseCovenant {
  kind: 'unilateral-exercise' | 'liquidation' | 'maturity-redemption';
  conditionId: string;               // objective on-chain condition
  beneficiaryPolicyHash: string;     // exact payout path(s)
  recoveryPolicyHash: string;        // fallback / owner reclaim
  timelockBlocks: number;
}
```

**Rules:** one canonical digest per concept (no competing term digests); agreements reuse
`edge`'s signed-negotiation canonicalization and `proofgraph` for evidence relationships; the
market agreement and the capital agreement are **layered**, not merged.

---

## 6. Normative invariants

- **Funding invariant.** A MASH funding authorization can only deploy the approved amount and
  asset into the **exact** committed channel or escrow terms.
- **Operation invariant.** Every valid Omnia state transition preserves the applicable financial
  obligations, balances, collateral and sequence rules.
- **Settlement invariant.** Every reachable close, timeout, dispute, liquidation or recovery path
  pays only the rightful beneficiaries and **never depends on an unavailable counterparty** for a
  promised unilateral exit (P-EXIT).
- **Permissionless (RFC-049 §2).** No global MASH requirement; no protocol-wide whitelist; no
  mandatory central policy issuer; no mandatory oracle for ordinary channels; no privileged
  operator. *Policy-constrained ≠ permissioned.*
- **Non-removal (RFC-048 §12.5).** Any committed-set entitlement encoding preserves per-holder
  non-removal + a timelocked unilateral exit.
- **No operator-discretion liquidation.** Liquidation MUST be triggered by an **objective,
  on-chain-verifiable condition** and executed by covenant — never by an operator's say-so.
- **No fabricated financial facts.** A signed quote/invoice/receipt is not a payout; a meter
  attestation establishes provenance, not independent truth; a memory/quote claim is not value.

---

## 7. Product generations

**Generation 1 — Capital control & autonomous liquidity** (shortest path; VTXOs not required):
Autonomous Treasury · Conditional Liquidity Corridors · Private RFQ Exchange · Term Liquidity
Leasing · Machine Prepaid Accounts. Highest-value improvement: **just-in-time conditional
liquidity** (bounded tranches deploy only when signed terms + reservations + funding constraints
match).

**Generation 2 — Credit & productive-asset finance:** Machine Credit Lines · Streaming Revenue
Finance · Machine Receivables Finance. Physical productivity produces cryptographic evidence →
proof-backed repayment. Requires explicit **evidence policy, fraud handling, and recoverable
collateral**; a time-based lease earns nothing by itself (fees/revenue must be earned; a promised
fixed return is a separate counterparty/collateral obligation).

**Generation 3 — Derivatives & structured products:** Collateralized Forwards · Options ·
Parametric Coverage · Senior/Junior LP Tranches · Interest-Rate Swaps · Cash-Settled Futures.
MASH supplies multiple committed authorization/recovery branches; derivative math, margin, price
discovery, collateralization and liquidation remain **Eefi**, and all depend on P-EXIT + oracle +
collateral covenants. Earliest viable: a **fully collateralized, fixed-expiry option** (bounded
obligation) — but only with a non-cooperative exercise right.

---

## 8. Recommended product sequence

| # | Product | Rationale |
|---|---|---|
| 1 | MASH Conditional Liquidity Corridors | Best reuse (channels, routing, funding, agent-policy) |
| 2 | Autonomous Treasury & Liquidity Manager | Governed machine capital deployment/rebalancing |
| 3 | Private RFQ Exchange | Extends signed negotiation + HTLC execution |
| 4 | Fixed-Term Liquidity Leases | First true entitlement needing a return-of-capital covenant |
| 5 | Collateralized Machine Credit | Adds interest/debt/repayment + enforceable default |
| 6 | Streaming Revenue Finance | Proof-backed repayment from productive assets |
| 7 | Collateralized Forwards & Options | First bounded derivatives (needs P-EXIT) |
| 8 | Parametric Coverage & Structured LP Tranches | Needs oracle + loss-waterfall + collateral |
| 9 | Leveraged / Perpetual Derivatives | Highest risk; needs mature margin/liquidation/recovery |

Generic reservation, proof verification, recovery and settlement contracts stay **beneath** the
product layer and are shared across products.

---

## 9. The decisive integration test (gates Gen-1)

```
MASH treasury → conditional Omnia funding → repeated channel updates →
counterparty disappears → unilateral close using the agreed recoverable state →
proceeds returned to a MASH vault → independent balance reconciliation
```

Adversarial variants: funding rejected outside the agreed terms; splice preserves the recovery
right; settlement pays only committed beneficiaries; a Gen-3 precursor where the buyer exercises
**without** the writer online (P-EXIT).

Must run against the **real Minima execution path** (RFC-048 proof-ladder L3/L4), not merely a
KISSVM-evaluator simulation.

---

## 10. Relationship to Experience (RFC-047)

Eefi products SHOULD be reconstructable as Experience Episodes (funding, terms, updates,
settlement, evidence). Eefi does not require Experience, but each product's lifecycle should be
**externally correlatable** per RFC-047 §7. Memory (RFC-047 §30) may inform risk/pricing; it never
authorizes.

---

## 11. Open questions

1. **P-EXIT design.** *First shape chosen:* a **condition-branch covenant** (§3) rather than a
   single pre-signed exercise tx, because it generalises to oracle-witness / liquidation conditions
   and needs no writer liveness or pre-commitment at exercise time; the exact payout path is bound
   by `VERIFYOUT` to the committed beneficiary. Open: partial payouts/remainders, the
   oracle-witness covenant, and whether exercise should ever be signature-free (permissionless).
2. **Aggregation/liquidation.** Who, if anyone, may call a liquidation covenant once the objective
   condition holds — and can it be permissionless (anyone pays, beneficiary fixed)?
3. Marketplace protocol: reuses `edge` signed negotiation verbatim, or a financial profile?
4. Where do `EefiCapitalAgreement`/`EefiMarketAgreement` live — SDK types + kissvm templates, or an
   Eefi package? (Recommend SDK generic contracts; products elsewhere.)
5. Risk-policy determinism: does `decision`/`agent-policy` ever gate a drawdown, and how is that
   kept deterministic + non-discretionary?
6. VTXO vs channel for Gen-1 liquidity — confirm channels/HTLCs suffice (G5 optional).

---

## 12. Deferrals / authorisation

Derivative mathematics, margin engines, price discovery, AMMs, auctions and netting are Eefi
product-level protocols, not SDK packages. This RFC authorises **no implementation**; it defines
the boundary, the generic contract surface, the gating primitives (P-EXIT, oracle witness,
collateral/liquidation covenant, reservation, RFQ binding) and the sequence.

---

## 13. Integration seams (Eefi composition, with the rest of the SDK)

RFC-050's core (stages, models, contracts, sequencing) is completed by the **SDK seams** below —
the places Eefi touches other packages. The **AI-side seams** (Decision/Inference/Memory/Mandate)
are defined in **RFC-051** (a dependency of this RFC); the seams here are the Eefi-specific
composition. A seam earns "establish now" if it is committed to on-chain state/digests, touches
identity/authorization, or is an inter-package message the two sides must agree on.

| Seam | Packages | Contract | Invariant | Why now |
|---|---|---|---|---|
| LP capital → Eefi treasury | `liquidity-bond`, `storage` | `LiquidityPosition ↔ EefiCapitalAgreement ↔` treasury vaults | **one** LP ledger | entitlement is the source of truth; avoid two ledgers |
| Operator / oracle accountability | `provider-bond`, `kissvm` | bond covenant (OMP-21) — `buildCollateralBondScript` (§3) | slashing/liquidation by **objective covenant**, never discretion | interacts with capital authorization |
| Machine Prepaid Accounts | `statechain`, `se-server` | prepaid-pass lifecycle ↔ product | non-custodial owner reclaim | protocol-level; Eefi doc §4 |
| Physical → revenue finance | `location-proof`, `spatial-proof`, `raster-proof`, `industrial-action` | attestation → settlement condition (OMP-18/19) | exact-integer units; attestation is **provenance, not truth** | Gen-2 has no proof path otherwise |
| Transport / message envelope | `edge` purchasing, `pubsub-transport`, `stream-transport`, `realtime`, `pear` | **one** signed financial message envelope | no second negotiation protocol (RFC-048 §3.2) | fragmentation risk |
| Finality | `chain-provider`, `minima-rpc`, `server`, `realtime` | `SettlementEvidencePort` (RFC-048 §7) | prepared ≠ broadcast ≠ confirmed ≠ offchain-final | every product needs it |
| Covenant construction | `tx-builder`, `kissvm` | covenant drafts (exercise / liquidation / settlement) | P-EXIT **reused**, not hand-rolled | enables P-EXIT across products |
| Multi-branch policy | `recursive-mast` | drawdown / recovery / liquidation / emergency branches | no operator-discretion path | P-EXIT shape |
| Product governance | `governance` | `governanceRef` in the settlement policy | governs the **product**, not the network | structured LP tranches |
| Consent surface | `connect`, `wallet-adapter` | financial approval request | human/agent consent with terms context | user-facing protocol |
| Key / root lifecycle | `wots-lease`, MASH (node) | key-use budget + rotation; MASH-root lifecycle | no key exhaustion; roots bound per stage | liveness failure risk (RFC-049 Q5) |
| Evidence home | `proof`, `proofgraph`, `proof-integritas` | financial facts / lineage / anchoring | **single** home, no parallel evidence | avoid duplication (RFC-048 OMP-17/18/26) |
| Discovery / eligibility | `lookup-*`, `manifest`, `identity` | counterparty/device discovery + manifest eligibility | permissionless; eligibility is a **product choice** | Eefi doc §2 |

Cross-reference: the **AI-proposes** seams (Decision binding, Inference evidence, Memory provenance,
Mandate chain) are **RFC-051** and MUST be applied to every committed Eefi outcome (RFC-051 CFR-1).

---

**Bottom line.** Eefi is not "more Omnia packages". It is a thin product layer over a substrate
that already provides identity, proofs, policy, storage and (with MASH) capital authorization and
(with Omnia) execution. The breakthrough is making the **economic rights around an Omnia channel
precise, conditional, independently enforceable and recoverable** — which reduces to **P-EXIT +
objective conditions + non-removal custody**. Build those first; the products follow.
