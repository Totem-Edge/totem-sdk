# Omnia Off-Chain Research Profiles

**Status:** Research notes — no implementation authority
**Created:** 2026-10-21
**Parent:** [RFC-064](../rfc/RFC-064-OMNIA-OFFCHAIN-EXTENSIONS-PRINCIPLES-AND-REGISTRY.md)
**Reference commit:** `8017cfcf77c975347a2c05478854c7560720e3fa`

These profiles are tracked so they do not disappear into a backlog, and so they
are not mistaken for authorised work. Each is a research note, not an RFC. A
profile moves to an implementation RFC only when a named product, owner and
evidence plan exist.

The shared safety contract in RFC-064 §2 applies to any future implementation.

---

## OEX-04 — Transaction aggregation and netting

**Capability.** Execute a compatible set of signed obligations using net balance
changes rather than every gross flow sequentially.

**Decision.** Deferred until RFC-066 establishes durable multi-channel
reservations and recovery.

**Why deferred.** Netting changes settlement semantics, not just throughput. It
can conceal contingent delivery obligations, create legal/accounting finality
questions and encourage unsafe reuse of already-settled payments.

**Boundary.** Matching and market policy belong to Eefi. Omnia may own atomic
execution and funding proofs. A coordinator must not control principal.

**Prerequisites.** Signed intent format, compatible asset/deadline/venue matching,
per-participant net-delta verification, explicit treatment of contingent
obligations, and a durable batch state machine.

**Kill criterion.** Stop if a batch cannot preserve delivery obligations, if a
coordinator can equivocate on the matched set, or if the added latency and
disclosure outweigh the liquidity benefit.

**Custody label.** Non-custodial only if every participant retains a recoverable
claim for the batch outcome and no matcher can move principal.

---

## OEX-05 — Cross-relationship virtual funding and recursive subchannels

**Capability.** Fund a child channel through enforceable reservations in existing
bilateral or factory relationships, including endpoints that do not share a
directly funded channel.

**Decision.** Research only. First milestone is depth 1 with one intermediary.

**Why deferred.** Recursive funding compounds dispute, splice and epoch-rotation
complexity. A parent recording a child ID is not protection; the parent must be
unable to settle away capital needed by an enforceable child outcome.

**Boundary.** Extends `omnia-factory` and `omnia`; does not replace factory-backed
virtual channels. The existing 102-participant script bound remains.

**Prerequisites.** Funding-reference model for bilateral parents, encumbrance
graph, depth/fan-out bounds, parent-close freeze, splice/epoch handling, child
liability accounting and actual chain recovery through one intermediary.

**Kill criterion.** Stop if an unavailable intermediary can erase an earned child
claim, or if depth-1 recovery cannot be demonstrated on a real node.

**Custody label.** Non-custodial only when every enforceable child outcome remains
independently recoverable.

---

## OEX-06 — Multi-asset portfolio channels

**Capability.** One logical relationship spanning several real assets with
separate balances and per-asset solvency.

**Decision.** Research only. Compare two linked single-asset channels first.

**Why deferred.** A common off-chain hash is insufficient if individual funding
coins can be spent against incompatible states. Per-output covenants, bundle-level
funding and cross-asset recovery are not yet proven.

**Boundary.** Reuses `omnia`, `tx-builder` and `kissvm`; no new package.

**Prerequisites.** Ordered asset list, per-asset funding UTXO set, common-state
commitment, per-output settlement/recovery rules, atomic cooperative settlement
and recoverable partial progress.

**Kill criterion.** Stop if linked single-asset channels are simpler and adequate,
or if any asset can settle against an incompatible portfolio state.

**Custody label.** Non-custodial only if every asset remains independently
recoverable.

---

## OEX-08 — Forced-progression application channels

**Capability.** An agreed application can advance a valid state or reach a
deterministic timeout outcome when a participant refuses further signatures.

**Decision.** Research only. May require script or consensus work.

**Why deferred.** An off-chain `validateTransition` callback is not an on-chain
adjudicator. Removing `BOTHSIGNED` from the generic channel script is not an
implementation.

**Boundary.** Reuses `ChannelProgram`, KISSVM and MAST/policy trees. A financial
transition does not authorise a physical operation; industrial-action and
authority policies still govern devices.

**Prerequisites.** Bounded application/version registry, on-chain move verifier,
challenge states, evidence availability, deadlines and terminal payout rules.

**Kill criterion.** Stop if it requires an unauthorised consensus/script change,
if invalid single-party moves can redirect funds, or if the application cannot be
bounded.

**Custody label.** Non-custodial only if the on-chain adjudicator resolves the
outcome and the entitled party retains recovery material.

---

## OEX-09 — Probabilistic micropayment channels

**Capability.** Issue tickets that occasionally produce a larger reward,
approximating compensation in expectation across many trials.

**Decision.** Deferred. Measure deterministic stream and signed-update costs first.

**Why deferred.** Randomness can be ground or selectively aborted, reserves may
not cover promised liabilities, and signing every ticket with WOTS may leave the
signature bottleneck unchanged.

**Boundary.** Reuses signed commitments, hash primitives, receipts, funding and
recovery. Not a default for consumer balances or exact invoices.

**Prerequisites.** Unbiased outcome construction, issuance limits, durable
anti-replay state, aggregation semantics and a constrained redemption path.

**Kill criterion.** Stop if WOTS issuance erases the benefit, if the randomness
model cannot resist grinding, or if reserves cannot cover promised payouts.

**Custody label.** Non-custodial only if tickets are funded, replay-safe and
redeemable without a trusted operator.

---

## OEX-10 — Shared overflow liquidity reserves (Sluice)

**Capability.** Per-channel exclusive bases plus a common overflow reserve,
controlled by capacity-weighted draw certificates.

**Decision.** Research only. Not a default non-custodial reserve.

**Why deferred.** The published construction assumes a bound on
adversary-controlled signing capacity and requires sufficient signers to be
reachable for overflow recovery. Those assumptions differ from Omnia's unilateral
recovery baseline.

**Boundary.** `omnia-pool` can allocate and account for capital; it does not make
independent claims against a shared reserve collectively bounded.

**Prerequisites.** A recovery mechanism that preserves an independently
enforceable claim for every accepted draw, plus Sybil, epoch, certificate-chain and
simultaneous-draw analysis.

**Kill criterion.** Stop if a quorum failure can lose an earned claim, or if the
design cannot be labelled without changing the meaning of non-custodial.

**Custody label.** Quorum-dependent research profile. Not self-custody by analogy.

---

## OEX-11 — Warden-protected virtual channels (Thunderdome)

**Capability.** Virtual channels protected by incentivised watchtower committees,
for intermittently connected or sleeping devices.

**Decision.** Research only. Complete ordinary delegated monitoring first.

**Why deferred.** Committee participation is part of the security architecture,
not merely a watchtower submitting an already-authorised recovery action.
Correlated outages, collusion and stale appointments are unresolved.

**Boundary.** Totem can supply identities, service manifests, signed appointments,
chain observation, compensation channels and protection records. Existing
data-only bonds are not automatically enforceable slashing collateral.

**Prerequisites.** Exact committee protocol, collateral/incentive model,
replacement rules, quorum behaviour, appointment freshness and dispute
settlement.

**Kill criterion.** Stop if committee churn, equivocation or correlated outage can
lose an earned claim outside the declared model, or if operational cost is not
measured.

**Custody label.** Committee-protected research profile. Not equivalent to
unilateral recovery.

---

## OEX-12 — Atomic service exchange (A402 / TEE)

**Capability.** Bind service-result delivery and payment using a named execution
verifier.

**Decision.** Totem-native digital-result profile first. TEE/adaptor/vault design
remains research.

**Why deferred.** The cited A402 construction depends on TEE-assisted adaptor
signatures and a TEE-managed liquidity vault. Adaptor signatures are not a
currently available WOTS operation, and a confidential vault is not automatically
self-custodial.

**Boundary.** Reuses `proof`, `proofgraph`, `manifest`, `identity`,
`intelligence`, `qvac`, purchasing agreements, `industrial-action`,
`agent-policy` and Omnia conditional payments.

**Prerequisites.** Request/result/payment ID binding through every stage, explicit
verifier profile (hash equality, public computation, accepted observation or TEE
attestation), refund path and delivery evidence.

**Kill criterion.** Stop if an invalid or missing result can be labelled verified
delivery, if the verifier assumption is hidden, or if the TEE compromise policy is
undefined.

**Custody label.** Totem-native profile may be non-custodial if the conditional
payment and verifier are self-contained. TEE vault profile is a separate custody
class.

---

## Promotion rule

A research profile may become an implementation RFC only when:

1. a named product or workload requires it;
2. an owner and evidence plan exist;
3. the RFC-064 shared safety contract can be satisfied without changing its
   meaning;
4. the custody class is explicit;
5. a kill criterion and measurable baseline are defined.

Publication of a paper is a research lead, not promotion evidence.
