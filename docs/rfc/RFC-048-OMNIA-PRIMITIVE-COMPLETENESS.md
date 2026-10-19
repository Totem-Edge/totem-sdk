# RFC-048 — Omnia Primitive Completeness & SDK Reuse Specification

Status: Draft for architectural review — proposed, not merged for implementation
Created: 2026-10-16
Authors: Totem SDK Contributors
Reference revision: `b95efe9a8423188c176c0e3e639c53bfd24b0b1a` (15 October 2026, UTC)
Inventory: 65 package directories — eight `omnia*` packages + the rest reusable/specialized
Scope: Fundamental primitives for private, edge-native, independently operated financial coordination and settlement. Not a specification for an AMM, lending product, derivatives exchange, stablecoin issuer, or investment offering.
Audit caveat: Source-level review of architecture and selected implementations. This document does not claim that unexecuted chain scripts or multi-node workflows have passed live, adversarial conformance.

> **Numbering.** The working draft used `RFC-040`; `040`–`046` are the Canary repository and
> `047` is the Experience Spine. This document is **`RFC-048`**.
>
> **Positioning.** RFC-048 is a **precondition for Eefi, not the Eefi product specification** — it
> defines Omnia's completeness and reuse; the product/market/risk layer is RFC-050.
>
> **Package count.** The SDK_MANIFEST currently records **64 publishable packages**; the "65
> package directories" here = those 64 + the private `sdk-tests` directory. "Eight `omnia*`
> packages" is exact.

---

## 0. Executive decision

Omnia does not need 15 more financial packages. It needs **verifiable completeness of a small set
of cross-cutting contracts** across its current eight-package family, composed with existing
Totem primitives. Two major capabilities — **portable signed attestations** and **signed bilateral
negotiation** — already exist elsewhere in Totem and MUST be reused before creating new
implementations.

**Architectural partition:**

1. **Totem substrate** — cryptography, identity, signed proofs, provenance, policy, durable state, chain access, networking, negotiation and device adapters.
2. **Omnia financial execution** — commitment/custody, programmable state, funding, reservations, routing, multiparty coordination, settlement, dispute, exits and recovery.
3. **Eefi market protocols** — RFQ market semantics, pricing strategy, risk models, interest, loans, liquidations, insurance, auctions, netting and product governance.

An Omnia capability MUST NOT require VTXOs where channels, HTLCs, factories or another existing
primitive are more suitable. Transferable asset claims are optional, not a dependency of
channel-native exchange.

---

## 1. Normative vocabulary and maturity evidence

MUST / MUST NOT are required for the given readiness gate. SHOULD is recommended but permits an
explicit documented exception. MAY is optional.

**Implementation status:** `E` existing implementation; `P` partial/integration or safety gap;
`N` new protocol capability needed; `X` product-level, deliberately outside Omnia. `E` means
source exists — not audited production readiness.

**Proof ladder:**

- **L0** — source: type, function or draft exists.
- **L1** — deterministic unit: positive, negative, replay and arithmetic tests.
- **L2** — composition: real implementation across package boundaries, no mock of the invariant being claimed.
- **L3** — independent deployment: separate peers/wallets and an actual isolated Minima chain, actual signatures/proofs and recoverable outputs.
- **L4** — faults: process crash, reordering, duplication, partitions, stale tips, delayed blocks and non-responsive/malicious counterparties.
- **L5** — security: adversarial review, VM/reference parity for financial scripts, fuzz/property tests, independent custody review and reproducible evidence artifacts.

A README, source comment, static grep gate or mocked flow alone MUST NOT advance a
financial-security claim to L3.

**Capability-gate profiles:**

- **G0 — Safe bilateral value movement:** two independent self-custodied peers can fund, update, close, independently recover, and reconcile one channel with no operator liveness assumptions beyond the specified contest window. Requires the safety-critical requirements at L3/L4.
- **G1 — Safe routed payments:** three or more separately hosted peers safely forward, settle or expire HTLCs under adversarial delivery and expiry conditions; failures produce explicit recoverable residual states.
- **G2 — Private RFQ exchange:** binding signed quotes, durable capital reservation, cross-token conditional settlement, enforcement of price/fees/expiry and honest status reporting over independent peers; privacy claims scoped and tested.
- **G3 — Verifiable conditional execution:** fresh, source-authorized signed observations accepted under explicit quorum/deviation policies, with off-chain and, where advertised, enforceable on-chain behavior.
- **G4 — Third-party liquidity:** independently proven LP funds, no rehypothecation by bookkeeping error, verified fee entitlement, exact withdrawal ownership and confirmed payout reconciliation.
- **G5 — VTXO optional profile:** transfer to new owner and unilateral exit demonstrably enforceable, with no globally valid double-spend and bounded operator liveness dependence.
- **G6 — Advanced Eefi products:** collateral, credit, liquidation, market risk, lending/derivatives. Deliberately out of the Omnia baseline.

---

## 2. Full primitive registry

The table maps **required behavior, existing code and ownership**, rather than merely asking
whether a named package exists.

| ID | Primitive / acceptance condition | Existing reuse / implementation | Status | Proper owner | Gate |
|---|---|---|---|---|---|
| OMP-01 | Canonical transaction and signed-message encoding; consistent token amount precision | core, core-wasm, tx-builder, txpow | E/P | Totem core | G0 |
| OMP-02 | WOTS-safe reservation, consume/burn and recovery; no one-time key reuse after crash | wots-lease, core, storage | E/P | Totem signing | G0 |
| OMP-03 | Cryptographic peer identity, rotation, revocation and authority | identity, root-identity, authority, manifest | E/P | Totem identity | G0 |
| OMP-04 | Authenticated discovery, peer capabilities and negotiation transport | lookup-*, manifest, pear, pubsub-transport, stream-transport, edge | E/P | Totem network | G1/G2 |
| OMP-05 | Chain tip, UTXO, inclusion, proof and confirmation truth | chain-provider, minima-rpc, server, realtime, lookup-* | E/P | Totem chain | G0 |
| OMP-06 | VM-verified, non-custodial channel funding and bilateral state transitions | omnia, kissvm, recursive-mast | P | Omnia | G0 |
| OMP-07 | Signed close packages; contest, challenge, timeout and unilateral final recovery | omnia, chain-provider, server | P | Omnia execution | G0 |
| OMP-08 | HTLC validation, claim/refund, safe per-hop deadline margin | omnia, omnia-router, kissvm | P | Omnia | G1 |
| OMP-09 | Route planning, explicit fee budget, liquidity bounds, authenticated topology | omnia-router, omnia-relay, lookup-* | P | Omnia router | G1 |
| OMP-10 | Durable multi-peer factory commitments and virtual-channel exits | omnia-factory, omnia, storage | P | Omnia factory | G1 |
| OMP-11 | Capital splicing and proof-backed channel reallocation | omnia-splice, omnia, chain-provider | P | Omnia splice | G1 |
| OMP-12 | Optional transferable claims, batch anchoring and non-custodial exit | omnia-vtxo, statechain, kissvm | P | Omnia VTXO | G5 |
| OMP-13 | Ledger-driven capital reservation with exclusive spend rights | storage, agent-policy reservations, edge purchasing CAS, omnia-pool | P | Omnia execution + ledger | G1/G2 |
| OMP-14 | Signed, finite, executable exchange quote, nonce and acceptance | edge TradeProposal/TradeAgreement, omnia-router announcements, identity | P | Shared edge negotiation + Omnia settlement binding | G2 |
| OMP-15 | Idempotent multi-step prepare/lock/fulfill/expire saga with durable recovery | edge outbox/replay, omnia coordination, storage | P | Omnia orchestration | G1/G2 |
| OMP-16 | Reliable finality evidence, recipient payout and economic reconciliation | chain-provider, server RFC-036, proofgraph, omnia-pool | P | Shared settlement port + Omnia | G0/G4 |
| OMP-17 | Signed observation with provenance and reference evidence | proof, proofgraph, manifest, identity | E (generic) | Totem evidence | G3 |
| OMP-18 | Oracle feed identity, schema, units, freshness, quorum, aggregation, challenge policy | proof, proofgraph, lookup-*, industrial-action units | N | Cross-domain Totem observation protocol | G3 |
| OMP-19 | Financial condition witness verifiable by specified execution venue | kissvm CHECKSIG example, recursive-mast, proof; **`buildOracleConditionScript`** (§3.1) | P → witness template | Totem KISSVM adapter + Omnia program | G3 |
| OMP-20 | Verifiable LP principal, ownership, allocation and fee claims | liquidity-bond, omnia-pool, proofgraph | P | Omnia pool | G4 |
| OMP-21 | Enforceable collateral bond, slashing/dispute/reclaim | provider-bond records, kissvm, recursive-mast, statechain | N (execution) | Shared Totem bond contract | G4/G6 |
| OMP-22 | Position solvency, explicit reserves and anti-double-counting | liquidity-bond, omnia-pool, chain-provider | P | Omnia pool accounting | G4 |
| OMP-23 | Per-hop forwarding confidentiality and metadata exposure declarations | omnia-router routing codec seam, omnia-relay, pear | P | Omnia router | G2 |
| OMP-24 | Deterministic bounded agent spend and delegated mandates | agent-policy, authority, decision, edge | E/P | Totem policy + Omnia binding | G2/G4 |
| OMP-25 | Durable recovery, operation outbox, WOTS watermark and audited restart | storage, wots-lease, edge, omnia-host | P | Totem infra + Omnia host | G0–G5 |
| OMP-26 | Auditable receipt/provenance linkage, artifact bytes and optional anchor | proof, proofgraph, proof-integritas, storage | E/P | Totem evidence | G0–G5 |
| OMP-27 | Typed asset metadata and economic unit validation (no binary float for settlement arithmetic) | chain-provider, core, industrial-action unit registry | P | Shared asset/type layer | G2/G3 |
| OMP-28 | Financial market risk, credit, interest, liquidations, auctions and netting | liquidity-bond risk scores only | X | Eefi | G6 |

**Interpretation:** the baseline blocker is overwhelmingly **conformance and composition**, not
absence of the named transaction primitives. The principal genuinely new shared abstraction is
**OMP-18** (trusted observations), with an enforceable collateral-contract profile under **OMP-21**.

---

## 3. Reuse composition, not duplication

### 3.1 Oracle observations

Pipeline: source adapter → canonical observation → `SignedProof(kind='attestation')` →
proofgraph/evidence store → independent verifier → authorized feed policy/quorum/aggregation →
verified condition witness → Omnia state transition / KISSVM commitment.

- `proof` already owns `createProof`, `signWithLease`, `verifyProof`, signed attestation proofs, evidence refs and expiry. Do not create a second signature scheme.
- `proofgraph` already owns `addProof`, `getProofLineage`, `findConflicts`, `resolveCurrentProofSet`, revocations, anchors and content-addressed evidence restoration. Do not build a parallel provenance graph.
- `manifest` + `identity` bind authorized publisher identity and advertised feed capabilities; `lookup-*` distributes feed announcements or finds publishers. The current lookup wire schema will need an explicitly versioned extension or application-level signed manifest; do not silently overload unrelated lookup message types.
- `wots-lease` enforces one-time-signing safety for attestations; `storage` preserves the issuance watermark and feed-replay journal.
- `industrial-action` provides a unit-registry pattern for sensors; financial values MUST use exact decimal/base-unit integer representations, **not** its floating `Quantity.value` for monetary arithmetic.
- `location-proof`, `spatial-proof`, `raster-proof` can enrich claims about the physical world; none turns measured data into ground truth by itself.
- `proof-integritas` MAY anchor feed history for third-party audit. Per-observation anchoring is NOT required in the fast execution path.

New data contract (illustrative, not current SDK API):

```ts
interface OracleObservationV1 {
  domain: 'totem:oracle:observation:v1';
  feedId: string;          // e.g. minima/usdt:spot or device/123:kwh
  publisherId: string;     // authorized identity, not transport socket
  subjectId: string;
  valueAtoms: string;      // canonical signed integer decimal
  scale: number;           // defined in feed manifest
  unit: string;
  observedAtMs: number;
  validUntilMs: number;
  sequence: string;        // anti-replay per feed/publisher
  contextHash: string;     // domain/market/chain scope
  evidenceHash: string;    // raw source evidence commitment
}

interface VerifiedObservationSetV1 {
  feedId: string;
  policyId: string;
  sourceProofIds: string[];
  valueAtoms: string;
  scale: number;
  acceptedAtMs: number;
  expiresAtMs: number;
  aggregationMethod: 'median' | 'threshold-agreement' | 'single-trusted';
  provenanceGraphId: string;
  status: 'accepted';
}
```

Wrap these as the payload of existing `UnsignedProof`/`SignedProof` objects. Do not make a
separate signature property or pretend the graph's integrity check proves the market price
correct. A threshold of N signatures from one upstream API is still one correlated source; quorum
SHOULD operate over independently defined failure domains.

Oracle verification MUST: check domain separation; canonical representation; proof ID and WOTS
signature; publisher authority at observation time; feed schema/asset IDs/unit/scale; identity
rotation/revocation policy; max age; max future drift; monotone sequence; proof/evidence byte
binding; source-independence policy; threshold; deviation and confidence band; override/freeze
policy on disagreement; and execution-venue-specific witness format. A verifier MUST fail closed
on unknown feed, untrusted signer, missing evidence where mandated, or stale observation.

**On-chain/HTLC caveat:** `proof.verifyProof()` executed on a host does not automatically make an
arbitrary observation on-chain enforceable. If a unilateral state transition requires an oracle
condition, KISSVM MUST cryptographically validate an appropriate commitment/witness, or the
contract MUST explicitly disclose that the decision is cooperative/off-chain. Confirm KISSVM
signature format and witness semantics with the actual Minima VM before advertising unilateral
enforceability.

**L4 finding (2026-10).** Running the custody escape through the **real node KISSVM**
(`docs/audits/kissvm-node-validity-l4-2026-10.md`) shows the SDK's generated scripts are **not
node-parseable** — the node tokenizer requires `^[a-z]+$` variable names, a lowercase `0x` prefix,
and `+`/`-` arithmetic (not `SUB`/`ADD`) — and that `VERIFYOUT` compares the output coin's **address
data** while the SDK uses a raw pubkey digest as the address. Branch logic is sound; syntax and
address representation are the gap. Tracked as follow-ups in the audit.

**Packaging:** first implement a small versioned observation protocol/profile built around `proof`
and `proofgraph`; create a dedicated `@totemsdk/oracle` only if independent consumers (e.g. Omnia
and industrial-action) require reusable quorum/aggregation runtime and the interface stabilizes.
Oracles are infrastructure, not `omnia-oracle`.

**Implemented witness.** A first on-chain condition witness exists:
`buildOracleConditionScript` + `oracleConditionStateVariables` in `@totemsdk/kissvm`
(`packages/kissvm/src/templates/oracle.ts`). It commits the observation (value, freshness window,
feed/schema hash) to state; requires the authorized oracle(s) via `MULTISIG(threshold …)` (so a
quorum is expressible); enforces the freshness window and the objective value comparison; and
**fails closed** on a stale observation, an untrusted signer or a mutated feed commitment. Because
this SDK's `CHECKSIG`/`SIGNEDBY` verify against the **transaction digest** (and the transaction
commits the observation), this is the **cooperative/attested** shape: a non-cooperative exercise
MUST instead commit the observation at funding and use the P-EXIT exercise covenant (RFC-050 §3).
Validated with real `TreeKey` signatures across the TypeScript and Rust/WASM VMs. The
**non-cooperative** path is the composed `buildOracleExerciseCovenant`: the observation is committed
at funding and, after maturity, the beneficiary exercises **alone** — with only its own signature —
when the committed observation is fresh and satisfies the value condition. No oracle liveness is
required at exercise time.

### 3.2 Negotiation and RFQ

Reuse `edge/src/purchasing`:

- `TradeProposal` is WOTS-signed, includes `proposalId`, `negotiationId`, `manifestId`, peer identities, timestamps/expiry, immutable terms and counteroffer ancestry.
- `TradeAgreement` binds accepted exact terms and signatures of buyer and seller.
- `NegotiationEngine` already has CAS, replay/expiry/round limits, counterproposal history and signed acceptance.
- `NegotiationTransport` distinguishes durable delivery from economic acceptance; its outbox/replay store patterns should be reused.

Do **not** simply interpret service `TradeTerms.price` as a full executable financial swap. Create
a financial term profile or canonical extension whose signed digest commits to at least: input/output
token IDs, token atomic scales, exact-in/exact-out semantics, quantity, quote rate, fees, maximum
slippage, settlement venue, reserve/HTLC IDs, deadline in chain blocks, optional oracle policy ID,
proposer, counterparty, quote nonce and chain/network domain. All security-relevant fields MUST be
inside an existing signed canonical terms structure or a new properly versioned financial quote
digest — never appended unsigned after proposal acceptance.

`omnia-router.SwapAnnouncement` remains a **discovery hint**, not proof that liquidity is reserved
or a signed, executable offer. An accepted agreement MUST bind a verified reserve and an executable
settlement plan. **Eefi owns maker pricing, markets and matching strategy; Totem edge owns generic
negotiation; Omnia owns reserve/commit/settlement enforcement.**

### 3.3 Reserve, settle and reconcile

Reuse `storage` transactional/CAS snapshots, `edge` durable message idempotency and `agent-policy`
budget reservations. These are patterns and shared contracts, not proof that Omnia liquidity
reservation already has the right semantics.

Canonical operation lifecycle:

```
CREATED → TERMS_ACCEPTED → RESERVED → FUNDED/LOCKED
       → EXECUTING → CLAIMED/SETTLEMENT_BROADCAST
       → VERIFIED_FINAL → RECONCILED
          \→ REFUND_PENDING → REFUND_FINAL → RECONCILED
          \→ RECOVERY_REQUIRED → CHALLENGED/EXITED → RECONCILED
```

- A prepared draft is not a completed payout; a submitted TxPoW is not inclusion; inclusion is not necessarily the product's declared finality depth; a routing fee receipt hash is not proof of economic receipt.
- Every RESERVED operation binds `operationId`, owner, asset, amount, expiry, risk cap, unique inventory reference and source-state revision; concurrent operations cannot double-allocate an amount.
- All stages are idempotent and persisted; indefinite RESERVED and RECOVERY_REQUIRED states MUST have explicit recovery logic.
- Refund is a conditional on-chain/contract right or a proven cooperative reversal, not an in-memory compensation call. Distributed HTLC settlement cannot be described as instant all-or-nothing atomic rollback after irreversible per-hop fulfillment.
- `server.awaitConfirmation` / `sendAndConfirm` (RFC-036), `chain-provider` proof interfaces, independent `lookup-client` reads and `proofgraph` evidence provide existing confirmation ingredients.
- **`omnia-pool.executePoolPayout` MUST stop recording `'settled-externally'` and decrementing LP capital on mere exit-draft or settlement-proposal creation.** Change the intent and position only after a verifiable settlement artifact or explicit off-chain final state acknowledgment matching the agreed finality policy.

Proposed shared receipt shape:

```ts
type SettlementOutcomeV1 =
  | { status: 'prepared'; operationId: string; draftHash: string }
  | { status: 'broadcast'; operationId: string; txpowId: string }
  | { status: 'confirmed'; operationId: string; txpowId: string;
      blockHeight: number; depth: number; chainProofRef: string }
  | { status: 'offchain-final'; operationId: string;
      stateDigest: string; signaturesRef: string; recoveryPackageRef: string }
  | { status: 'refunded' | 'exited'; operationId: string;
      finalityEvidenceRef: string }
  | { status: 'recovery-required'; operationId: string; reason: string };
```

`confirmed` and `offchain-final` are different guarantees. Both require a clear dispute and
recoverability policy. Canonical signing wire schemas SHOULD encode amounts as strings; in-process
`bigint` is fine, never implicit float coercion.

### 3.4 Custody and enforceable obligations

`provider-bond` and `liquidity-bond` are explicitly **data-only records**. Verification of a
publisher's signed claim that a bond exists is NOT proof that a recoverable escrow is locked, nor
evidence of a functioning slash transaction.

The security substrate (`kissvm`, `recursive-mast`, `chain-provider`, `statechain`) SHOULD support
an enforceable **`BondCovenant`** profile with: identified owner and beneficiary, exact asset and
amount, immutable terms hash, verifiable deposit and escrow output, objective violation or
adjudication witness, challenge period, capped loss/slash path, maturity, and unilateral owner
reclaim if no valid claim. Bond-contract semantics should live in reusable KISSVM templates and not
be duplicated as a lending-market package.

Generalized risk engines, credit underwriting, collateral ratios, liquidation auctions, interest
rates and derivatives cashflows belong to **Eefi**. Omnia only needs programmable reserves/locks,
typed external condition witnesses and correct state enforcement.

### 3.5 Privacy

Treat off-chain, peer-to-peer, confidential-path, confidential-amount and anonymous-counterparty as
separate claimed properties.

- Complete an authenticated per-hop encrypted `RoutingEnvelopeCodec` (existing seam in `omnia-router/forward.ts`).
- Do not allow a route announcer to publish precise counterparty channel balance if that conflicts with privacy policy; use intentionally limited or opt-in capacity disclosures.
- Authenticate routing messages and protect against replay/flow correlation where practicable; document unavoidable adjacent-hop visibility and chain settlement leakage.
- A privacy gate MUST specify the attacker model: external chain observer, adjacent peer, malicious router, oracle publisher, pool operator and local device compromise.
- ZK-style product claims are outside baseline until end-to-end verifier and performance tests exist.

---

## 4. Safety invariants (MUST)

| ID | Invariant | Test obligation |
|---|---|---|
| INV-01 | No transfer or change of beneficiary without valid authorized witnesses | Malicious signature/owner/recipient mutation rejected by executable VM and peers |
| INV-02 | Per-token value conservation, explicit fees, output caps, no hidden inflation | Property tests + actual script execution for all paths |
| INV-03 | Durable single spend: nonce, key lease, inventory reservation and settlement are replay safe | Duplicate/reorder/restart and two-peer concurrency tests |
| INV-04 | Backed claim never exceeds verified available collateral; encumbrances counted once | Cross-package collateral-ledger comparison against chain state |
| INV-05 | Proposal, submission, inclusion, finality and recipient payout never conflated | Failure-injected payout and stale-chain tests |
| INV-06 | Every claimed non-custodial holder has an executable operator-independent recovery path | Isolated chain with all other participants offline |
| INV-07 | Both final outcomes for conditional payment are executable: claim or refund after correct timeout | Real HTLC chain tests around boundary blocks |
| INV-08 | Upstream HTLC expiry accommodates downstream claim and confirmation margin | Multi-hop boundary/fault tests with time skew and failed links |
| INV-09 | Accepted quote exactly commits asset IDs, quantities, fees, deadlines and settlement method | Signed digest mutation negative tests |
| INV-10 | Oracle observations verified against authorized source, schema, freshness, threshold and replay policy | Stale, equivocation, source-collusion and extreme-outlier tests |
| INV-11 | Automated spending can never bypass owner mandate, caps, allowance or approval | Adversarial action/decision/canonicalization tests |
| INV-12 | Accounting matches the cryptographic settlement outcome, even after interrupted operation | Rebuild all balances from independent event and chain evidence |
| INV-13 | Any branch that exits or settles preserves required root, epoch, timeout and unrelated share state | KISSVM executable tests for malformed successor outputs |
| INV-14 | An LP or newly transferred VTXO owner can recover only their rightful share; no owner-binding confusion | Two-principal transfer/exit and LP withdrawal tests |
| INV-15 | Privacy claims are demonstrated under a written threat model | Path envelope and metadata analysis with malicious router |
| INV-16 | Unrecognized protocol version, conflicting source truth or irrecoverable evidence corruption fails closed | Mixed-version, chain-fork, missing-artifact negative tests |

---

## 5. Existing Omnia package-specific work

| Package | Preserve / reuse | Required hardening before profile claim |
|---|---|---|
| omnia | Signed channels, programs (meter/HTLC/vault/treasury/etc.), close packages | State/VM parity, contest-window watcher, complete independent exit + confirmed settlement |
| omnia-router | Graph, swap announcements, cross-token HTLCs, pathfinding, forwarding seam | Signed/executable quote binding, reservation, safe timeout margin, durable partial-failure recovery, onion codec |
| omnia-factory | Group commitments and virtual channels | Real N-peer opening/exit on isolated chain, custody constraints and crash replay |
| omnia-splice | Channel capital resizing and coordination | Funding UTXO and signature handoff safety, mid-splice crash replay, confirmed reallocation |
| omnia-relay | Wallet-facing relay client and first-hop payment paths | Full independent relay protocol integration and truthful per-method capabilities |
| omnia-host | Durable node daemon and exposed RPC methods | Autonomous watch/recovery service, operation state machine, durable cross-peer reconciler |
| omnia-pool | LP position and allocation orchestration, NAV and rebalance | No draft-as-settlement, enforce exact LP ownership, verified fee claims and complete capital reconciliation |
| omnia-vtxo | Merkle proofs, split/transfer/merge, signer and anchor builders | Dynamically transferred holder exit, global anti-double-spend, proof-to-chain inclusion, VM-valid withdrawal |

**Source-level safety issues — found, fixed, and gated (was "suspected").** The exit/escape
share branches originally read `SHARE_k` from `STATE(200+k)` — the **NEW/current** state per
`@totemsdk/kissvm` (`state` = "Current state") — and then asserted the *same* `STATE(200+k) EQ 0`,
which is self-contradictory: the unilateral exit was **unsatisfiable** (`omnia-vtxo`,
`omnia-factory`). They also verified the remainder at `VERIFYOUT(@INPUT …)` = output 0, colliding
with the payout (`VERIFYOUT(0 payout SHARE)`), so partial withdrawals were unsatisfiable and
contradicted the SDK's own `exit-tx.ts` layout (payout@0, remainder@1). **Both are fixed**:
committed values are read from `PREVSTATE(...)` (exit block / escape block / shares) and the
successor is constrained via `STATE(...)`; the remainder is output **1**. A new `custody-exec` gate
**executes** the escape branches via the SDK KISSVM evaluator (proof-ladder **L1/L2**). A
`custody-exec-vm` gate runs the **same branches through the Rust/WASM KISSVM** with **real Minima
`TreeKey` signatures** — every `SIGNEDBY`/`MULTISIG` is satisfied by an actual tree signature over the
transaction digest, with no `simulationMode` — and confirms the Rust VM agrees with the TS evaluator;
the Rust VM verifies via `totemsdk_core_wasm::treekey::verify_tree_signature`, the same engine the
node and JS bridge use. A `custody-signature-parity` gate pins TS↔Rust verifier agreement for both
flat WOTS and tree signatures over multiple vectors (incl. tamper). A full isolated Minima **node**
run (real chain inclusion) remains the **L4** bar. Still open: dynamic transferred-owner
exit (static on-chain holder keys vs `transferVtxo`); and the `200+k` share band's relationship to
the MSHS port band (see **§12**).

---

## 6. Conformance scenarios / Canary test suite

Each test MUST produce a machine-readable report containing: code SHA, chain genesis and tip,
participants/keys (public only), signed intents, submitted/broadcast/confirmed tx IDs, key lease
watermarks, transcript hashes, resulting balances, UTXO proofs, failure injection and explicit
PASS/FAIL per invariant.

| Test | Scenario | Minimum proof | Gates |
|---|---|---|---|
| CT-01 | Two independently hosted devices open bilateral channel; make updates; cooperative close | Real signed funding/close and independent balance equality | G0 |
| CT-02 | A closes with counterparty offline; B later challenges with newer state | Correct winning state and recovered outputs | G0 |
| CT-03 | Crashes between WOTS reserve, sign, broadcast and journal commit | No reused leaves, no lost recoverable funds | G0 |
| CT-04 | Three hosts A→B→C with one hop refusing fulfillment | Safe expiry, explicit residual accounting; no claim of instant rollback | G1 |
| CT-05 | Factory opens with all independent participants; one exits alone | Exact share and preserved others' funds | G1 |
| CT-06 | Splice interrupted before/after broadcast | No phantom capacity and exact final backing | G1 |
| CT-07 | Buyer and maker negotiate signed cross-token RFQ; race two buyers | Exactly one inventory claim; correct rate/fees/timelock | G2 |
| CT-08 | Signed quote rate/recipient/deadline altered after acceptance | Authentication or contract validation rejects | G2 |
| CT-09 | Independent source feeds agree within policy; observation stale or revoked | Accept correct quorum, reject stale/revoked/unknown, fail safe on disagreement | G3 |
| CT-10 | Single oracle equivocation and shared upstream data source masquerading as independent | Deviation / source-independence policy enforces rejection | G3 |
| CT-11 | Physical meter observation causes conditional channel payment | Proof authentic, reading bound, units correct, payment conserved | G3 |
| CT-12 | LP commits real chain-verified UTXO, earns verified fee, withdraws | Receipt owner matches payee, final proof, NAV and backing reconcile | G4 |
| CT-13 | Pool tries to settle approved withdrawal with draft only | Intent remains pending, capital unchanged | G4 |
| CT-14 | VTXO transfers to a previously unknown recipient and operator disappears | New owner can exit exact share, no double exit | G5 |
| CT-15 | Router with onion codec and malicious intermediate node | Intermediate cannot see full downstream path; adjacent-hop metadata scope stated | G2 |
| CT-16 | Chain reorg / stale lookup node / missing MMR proof | No false confirmation and explicit recovery/retry | G0–G4 |
| CT-17 | Malicious agent suggests exceeding approved exposure | Deterministic policy blocks and leaves funds unchanged | G2/G4 |
| CT-18 | Full restart: rebuild commitments from journal, receipts and chain | Same obligations, allocations and recoverability as before crash | G0–G5 |

**No mocks of the guarantee:** a `passFundingVerifier` is fine for a narrow unit composition test
but cannot establish CT-12. VM scripts need execution tests against an actual isolated Minima
chain, not merely checks that script text includes `VERIFYOUT`.

---

## 7. Minimal proposed cross-package ports

Proposed seams, not names of existing exports. Add them at the narrowest existing ownership
boundary.

```ts
interface FinancialConditionVerifier {
  verify(input: { proofId: string; policyId: string; atBlock?: bigint }):
    Promise<{ accepted: boolean; witnessRef?: string; reason?: string }>;
}

interface CapitalReservationPort {
  reserve(input: { operationId: string; owner: string; tokenId: string;
    amountAtoms: string; inventoryRef: string; expiresAtBlock: string;
    expectedRevision: string }): Promise<{ reservationId: string; stateDigest: string }>;
  release(input: { reservationId: string; reason: string }): Promise<void>;
  commit(input: { reservationId: string; settlementEvidenceRef: string }): Promise<void>;
}

interface SettlementEvidencePort {
  resolve(operationId: string): Promise<SettlementOutcomeV1>;
  reconcile(operationId: string, finalityPolicyId: string):
    Promise<{ balanced: boolean; proofGraphId: string; discrepancies: string[] }>;
}

interface RecoverySchedulerPort {
  register(input: { operationId: string; stateDigest: string;
    deadlineBlock: string; recoveryPackageRef: string }): Promise<void>;
  resumeAll(): Promise<void>;
}
```

The reservation port MUST make `reserve` linearizable within one inventory authority.
Cross-authority atomicity is not automatically guaranteed by CAS; it requires HTLC/escrow logic
and a failure-safe distributed saga. `release()` cannot substitute for an on-chain refund when
value has already been locked. The recovery scheduler MUST operate from a chain-block deadline
(with observed wall-clock triggers only advisory) and survive host restart.

---

## 8. Work order and merge gates

**Phase A — custody and truth (blocking all financial releases)**
- A1 Reproduce and fix suspected `omnia-vtxo` / `omnia-factory` unilateral-exit contradictions and state continuity. Add exact VM test vectors and independent-peers proof of recovery.
- A2 Normalize operation settlement receipts and distinguish prepared, broadcast, confirmed, offchain-final and recovered.
- A3 Fix `omnia-pool.executePoolPayout` and fees/NAV so accounting cannot close out against a draft, user-supplied verified flag or missing payout proof.
- A4 Durable host watch/recovery and WOTS-key crash atomicity. Complete G0 test report.

**Phase B — independent exchange**
- B1 Replay/timeout-hardened 3-node HTLC routing with proper safety margins and honest partial-settlement reports.
- B2 Use edge signed trade negotiation to define a financial terms profile and bind a unique capital reservation to executable HTLC plan.
- B3 Multi-host factory/splice recovery and route-discovery authenticity. Complete G1–G2 execution tests without inventory double-allocation.
- B4 Authenticated per-hop confidential envelopes and audited privacy threat model; never promise stronger privacy than tests show.

**Phase C — observations and real-world conditions**
- C1 Define schema/publisher manifest and signed proof envelope; place observation bytes in proofgraph evidence storage.
- C2 Implement independent verifier + policy: freshness, units, sequence, source independence, quorum/deviation, fail-closed.
- C3 Compile the accepted witness into compatible Omnia condition update or VM-verifiable contract branch, explicitly distinguishing cooperative from unilateral paths.
- C4 Demonstrate market price condition and independently attested energy meter settlement. Complete G3.

**Phase D — productive liquidity**
- D1 End-to-end LP deposit verification, typed entitlement, fee accrual/claim and exact beneficiary withdrawal.
- D2 Prove backing and liabilities at each operation boundary; test crash, disputes and payout shortfalls.
- D3 Add enforceable security-bond covenant only when an application requires objective slashing or reclaim. Complete G4.

**Phase E — optional extensions**
- E1 VTXO global spent-set, dynamic owner recovery, valid anchor inclusion and operator-offline exits. Complete G5.
- E2 Eefi product-level modules: lending, rates, margin, liquidation, clearing; only after their relevant gates are secure.

**Release rule:** the descriptor of any exposed feature MUST declare its readiness profile,
finality basis, custody model, whether a third party is needed for liveness, metadata privacy scope
and evidence artifacts from conformance tests. An unmet capability MUST return `unsupported` or
`pending`, not fabricated success.

---

## 9. Exhaustive SDK reuse index

Classification: **Direct** is expected in the Omnia/financial substrate; **Conditional** for
specific physical-world, agent or advanced-product scenarios; **Supporting** for dev, integration
or operations. All packages are accounted for below, so a new RFC MUST first check existing
ownership.

| Group | Package(s) | Reuse decision |
|---|---|---|
| Omnia core (8) | omnia, omnia-factory, omnia-host, omnia-pool, omnia-relay, omnia-router, omnia-splice, omnia-vtxo | Direct: financial state and settlement; repair missing invariants, don't proliferate siblings |
| Cryptography (3) | core, core-wasm, wots-lease | Direct: canonical hashes, crypto parity, key safety |
| Covenants (2) | kissvm, recursive-mast | Direct: executable conditions, recoveries and bond templates |
| Identity, policy and governance (6) | identity, root-identity, manifest, authority, agent-policy, governance | Direct for first five; Conditional governance for DAO/LP policy |
| Chain and wallet (8) | chain-provider, minima-rpc, server, tx-builder, txpow, wallet-adapter, connect, realtime | Direct: chain truth, signing surfaces, confirmation and tx construction |
| Provenance / evidence (6) | proof, proofgraph, proof-integritas, location-proof, spatial-proof, raster-proof | Direct first two; Conditional anchoring and physical evidence families |
| Network and discovery (6) | lookup-client, lookup-node, lookup-protocol, pear, pubsub-transport, stream-transport | Direct: authenticated discovery, peer transport, evidence and capability announcements |
| General edge and adapters (15) | edge, edge-adapters, edge-bacnet, edge-ble, edge-can, edge-coap, edge-email, edge-grpc, edge-lorawan, edge-matter, edge-modbus, edge-mqtt, edge-nfc, edge-opcua, edge-ros2 | Direct edge negotiation and runtime; Conditional adapters for physical metering, service delivery and offline connectivity |
| Intelligence and machine control (4) | decision, intelligence, qvac, industrial-action | Conditional: provider choice, dynamic risk proposals, meters and safe unit conversion; never final spending authority |
| Finance-adjacent (4) | liquidity-bond, provider-bond, statechain, se-server | Direct accounting / collateral-record reuse, Conditional statechain/SE operator topology |
| Common persistence (1) | storage | Direct: CAS, journals, durable artifacts and recovery |
| Test and developer surface (2) | sdk-tests, mcp-server | Supporting: proof-ladder scenarios, developer inspection / demos |

Count: 8 + 3 + 2 + 6 + 8 + 6 + 6 + 15 + 4 + 4 + 1 + 2 = **65** (the 64 publishable packages plus
the private `sdk-tests` directory).

**Reuse guidance:** `industrial-action` owns typed physical units but not precise financial token
arithmetic; `decision` proposes choices but cannot authorize financial spend; `proofgraph`
authenticates evidence lineage but not factual truth of upstream measurements; `provider-bond`
records bond assertions but does not escrow capital; `statechain` has a relevant independent
owner-reclaim pattern but is not by itself an Omnia liquidity pool.

---

## 10. Evidence sources reviewed

Source-level review of: Omnia channels/programs, Omnia router execution, router route/quote types,
the forwarding codec, Omnia Pool payout, the VTXO pool covenant, trade proposal/agreement, the trade
negotiation engine, signed proof types, ProofGraph exports and durable evidence, liquidity risk
bookkeeping, the custody policy, RFC-035 (peer coordination), RFC-036 (settlement verification),
RFC-039 (custody conformance) and the temporal framework design. Pinned links in the original
attachment reference revision `b95efe9`; re-check against current `main` before implementation.

---

## 11. Open design decisions

1. Should oracle policy live as a versioned profile within `proof` + `proofgraph`, or become a tiny cross-domain `@totemsdk/oracle` runtime after two consumers use it?
2. Does generic edge `TradeTerms` need a typed financial extension, or is a versioned `FinancialTerms` binding via the existing signed canonical extras sufficient without compromising runtime safety?
3. Which settlement outcome can be represented as an off-chain final and immediately usable balance, and what deterministic challenge/recovery package must accompany it?
4. Where is the single authority for inventory reservations when liquidity spans multiple independently run nodes? Which reservations can be committed with hashlocks and which require trusted bilateral credit limits?
5. What exact non-custodial guarantee is deliverable for a VTXO transfer that changes owner between L1 anchors and changes the on-chain holder keys?
6. How can a live recovery service remain effective through disconnection longer than an Omnia contest window? Are passive guardians allowed, and what can they see or execute?
7. What is the required confirmation-depth and reorg policy for each chain-backed market class? (Configure explicitly, never silently equate inclusion to irreversible economic finality.)
8. How should real collateral slashing handle ambiguous external facts, corrupt oracle sources and false accusations without violating non-custodial recovery rights?

---

**Bottom line:** First establish Omnia as a provably safe substrate for bilateral and routed
programmable settlement. Reuse Totem's existing signed proofs, ProofGraph, negotiation and policy
engines. Add the minimum missing typed contracts for oracle policy, capital reservation, financial
quote binding and durable settlement reconciliation. Keep lending, liquidations, pricing
algorithms, AMMs and derivatives in **Eefi**, not the Omnia package family.

---

## 12. Amendment — Port allocation, party scaling and the non-removal custody constraint

This amendment adds the state-port/party-count analysis and the committed-set custody constraint
(also referenced by RFC-049 §5), and records the resolved safety fixes.

### 12.1 Ports are bytes; allocation is scarce

State ports serialize as a MiniByte (**0–255**) — hence `MiniByte value must be 0-255, got 300`.
There are only **256 ports**, and MSHS-2 (MASH) occupies **230–255** (`bundleBase = 256 − (4 + k) =
230`: header `R/ROOTS_BLOB/SECRETS_BLOB/TREE_SIG` at 230–233, `PROOF` at 234–255). Omnia currently
uses 100–102, 103 (factory escape), 110 (VTXO exit delay), 120–183 (channel programs), and `128+k`
(factory/VTXO shares).

### 12.2 Ports are per-coin namespaces

A **channel coin**, a **factory coin** and a **VTXO pool coin** are different coins with different
scripts; their ports do **not** collide with each other. A coin must only avoid the bands its *own*
script (plus any MASH branch on that coin) uses. Factory and VTXO can each have a large band — they
need not share one.

### 12.3 `200+k` is a small-N shortcut, not a constraint

The 30-slot ceiling is purely because the share base is 200. On factory/VTXO coins, ports 104–199
are unused (they carry no eltoo programs), so relocating the base (e.g. **128**) yields ~102 slots
and keeps clear of the MSHS floor. **Party count is an encoding choice, not a MASH constraint.**

### 12.4 Encoding — not MAST/MASH — sets party capacity

| Per party | Where it lives | MAST | MASH |
|---|---|---|---|
| Authorization / static terms | script (MAST branches) — scales | **yes** | authorization branch only |
| Mutable balances / shares | state (ports), unless a committed set-root | no | no (and same-coin it consumes 230–255) |

MAST ⇒ the **authorization** side scales without port cost. MASH ⇒ authorization only (same-coin it
*consumes* the top ports). **Balances require a committed set-root (Merkle/MMR) to scale** — the
VTXO batch root already does this (`STATE(100)=root`); the factory now commits its **party-set root**
at `STATE(111)` (`factoryPartySetRoot` / `factoryPartyRootStateVariable`, pinned by `SAMESTATE`) — a
Minima-native MMR root over the participant digests, padded to a power of two with the zero-digest
sentinel so it handles arbitrary N. This is the anchor for per-leaf (proof-based) scaling; balances
still enumerate per-party ports (base 128, max 102). The **balance set-root** now exists as a
committed off-chain distribution: `factoryBalanceSetRoot` (MMR over `(pubkey, balance)` leaves, leaf
sum = balance, `rootSum` = total) + `factoryBalanceProof`, verified on-chain by
`buildMmrMembershipCovenant` with runtime sum ports.

**On-chain single-party exit against a committed balance set is blocked on root recomputation — and
that is not expressible in KISSVM.** Zeroing a claimant's leaf and committing the successor root
requires reproducing `MMRData.CreateMMRDataParentNode` in-script, whose hash includes the serialized
**MiniNumber sum**. KISSVM has no MiniNumber serializer (and the SDK KISSVM has no `SETLEN` at all;
the node's `SETLEN` only length-prefixes MiniData). So the successor root cannot be recomputed
on-chain today. The scalable single-party escape is therefore a **pre-signed all-party
distribution**: at funding the parties co-sign one distribution tx paying each its committed balance
(`factoryDistributionOutputs`), and after the timeout **any** party broadcasts it — a unilateral
trigger with no counterparty liveness, no per-party balance ports, and no on-chain recomputation.
The balance set-root is the committed evidence; the distribution's correctness is enforced by the
co-signatures, not by re-deriving the root.

**Committed mode.** MSHS-2 also ships a **committed-owner-v1** deployment that commits the state root
**into the locking script** (`LET stateroot=… MAST …`) and carries it in ports **0–1**
(`mash-committed-state`, `STATE(0)`=current / `STATE(1)`=successor). It is **1-in/1-out, no recovery
branches, preserve-amount** (RFC-049 §5.5) — so it is **not composable** with Omnia multi-party
scripts and is excluded from the composite table (which uses wallet mode). It is a standalone
single-owner state carrier (and a home for RFC-051 committed facts).

The **per-leaf inclusion primitive** now exists: `buildMmrMembershipCovenant` in `@totemsdk/kissvm`
verifies `PROOF(leaf leafSum rootHash rootSum proof)` on-chain, binds `SIGNEDBY(leaf)` and pays the
leaf — so a party can prove membership against the committed root in a **single** branch instead of
one branch per party (O(N)). `factoryPartyProof(participants, i)` produces the witness. Fixing this
surfaced a **VM parity gap**: the Rust/WASM KISSVM implemented a 3-arg MAST-style `PROOF`, whereas
the node's `org.minima.kissvm.functions.sha.PROOF` (`requiredParams() == 5`) and the TS evaluator
both use the canonical 5-arg MMR form; the Rust now matches (verified by the membership gate across
both VMs).

### 12.5 Normative custody constraint (non-removal)

Any committed-set share encoding MUST preserve **per-holder non-removal** and a **timelocked
unilateral on-chain exit**:

- a holder's entitlement **cannot be reduced or removed without that holder's signature**; and
- a timelocked, operator-independent on-chain exit exists (prove `leaf ∈ PREVSTATE(100)`,
  `RETURN SIGNEDBY(holder)` after `EXITBLOCK`).

Otherwise the encoding is **custodial/trust-minimised** and fails the RFC-039 custody gate. A single
root the operator can rewrite unilaterally would let the operator eject/reduce a holder — a custody
regression. The current all-holders `MULTISIG(operator + holders)` update satisfies non-removal but
**does not scale**; scaling requires **per-leaf authorization** (accumulator / sparse tree) so a
leaf cannot change without its holder. Here *"chain of custody"* means the **verification chain** of
state commitments and proofs — **not** a custodian holding funds.

### 12.6 Port registry + gate (implemented)

Machine-checked registry: [`docs/STATE-PORT-REGISTRY.md`](../STATE-PORT-REGISTRY.md) (human) +
[`scripts/state-port-registry.json`](../../scripts/state-port-registry.json) (machine) +
[`scripts/check-state-ports.mjs`](../../scripts/check-state-ports.mjs) (`npm run validate:ports`, in the
spirit of `validate-custody`): per-coin-class bands; MSHS reserved **230–255**; **no `SAMESTATE` range may
span the MSHS band**; fail on out-of-band or MSHS-spanning ports; declared share bases checked against
package constants.

Finalized bands: `0–99` general/legacy (incl. `statechain`) · `100–119` Omnia channel/factory control ·
`120–183` Omnia channel programs · `128–229` Omnia share band on factory/VTXO coins (**base 128**,
max 102 parties) · `230–255` MSHS-2. (Ports are per-coin namespaces, so `omnia-programs` and
`omnia-share` overlap across coin classes.)

### 12.7 Registry additions

- **OMP-29** — State-port allocation / composite port registry (owner: shared settlement/state ports).
- **INV-17** — Committed-set non-removal + timelocked unilateral exit; no `SAMESTATE` spans the MSHS band.
- **CT-19** — Composite MASH+Omnia state-port test (registry respected; exit satisfiable against the committed root).

### 12.8 Code gap (tracked)

`omnia-vtxo`/`omnia-factory` enforce only **lower** bounds on party count (`holders.length < 1`,
`participants.length < 2`) and can emit ports ≥230. Fix: relocate
`POOL_SHARE_PORT_BASE` / `FACTORY_BALANCE_PORT_BASE` below the MSHS floor with an explicit upper
bound, add the `check-state-ports` gate, and add a boundary case to `custody-exec`.

### 12.9 Reuse-index addition

| Group | Package / capability | Reuse decision |
|---|---|---|
| MASH / MSHS-2 (node) | `totem-node-new-crypto` MSHS-2 verifier | **Conditional direct** for capital authorization at the OPEN/CLOSE boundary; node-side, consumed via `kissvm`/`identity`/`authority`/`agent-policy`; not a package (see RFC-049) |

### 12.10 Signature-model fidelity (implemented)

The node's `SIGNEDBY` is **membership of a witness's tree-signature root public key**
(`SignatureProof::getRootPublicKey`, `Contract::checkSignature`), not a flat single WOTS key. The
Rust/WASM KISSVM witness now carries canonical `TreeSignature`s (`treeSignatures`, RFC-009) keyed by
root public key and verifies them with `totemsdk_core_wasm::treekey::verify_tree_signature`; the flat
single-key WOTS path remains only as the degenerate/compat case. To consume the engine natively,
`core-wasm` is linked into the VM as an rlib and its per-crate `#[wasm_bindgen(start)]` is
feature-gated (`wasm-start`, default-on) so the generated `init`/`__wbindgen_describe_init` symbols
do not collide. Gates: `custody-exec-vm` (real-signature escape + cooperative `MULTISIG`, Rust↔TS)
and `custody-signature-parity` (flat + tree verifier parity, incl. tamper).
