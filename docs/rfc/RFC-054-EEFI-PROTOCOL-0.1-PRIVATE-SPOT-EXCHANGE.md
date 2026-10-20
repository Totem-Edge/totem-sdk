# RFC-054 — Eefi Protocol 0.1: Verified Private Spot Exchange

Status: Draft — proposed; implementation authorised for the **bilateral spot-exchange profile (v1)** only; **not started**
Created: 2026-10-20
Authors: Totem SDK Contributors
Depends on: RFC-036 (Settlement Verification), RFC-048 (Omnia Primitive Completeness), RFC-050 (Eefi Product Architecture), RFC-053 (Eefi Generic Contracts)
References: RFC-035 (Peer Coordination), RFC-039 (Custody Conformance), RFC-038 (VTXO Operator — deferred), RFC-049 (MASH — **not required** for v1)

> **Positioning.** This RFC defines **Eefi Protocol 0.1**: a private, bilateral,
> atomic **spot exchange**. It **comes before** the RFC-050 §8 Gen-1 product order
> (conditional liquidity corridors, autonomous treasury, fixed-term leases,
> machine prepaid accounts). It amends the Gen-1 **sequencing**, not the
> architecture.
>
> **Scope.** Implementation is authorised for the bilateral spot-exchange profile
> only: signed RFQ quote → exclusive capital reservation → atomic HTLC swap →
> verified settlement evidence → recovery. Pooled liquidity, VTXO, factories,
> credit, maturity, oracle conditions and derivatives are out of scope.

---

## 1. Why exchange first

A spot swap is the simplest *real* financial obligation the substrate can express:

- two assets, two legs, **atomic** settlement (HTLC preimage), no maturity, no
  interest, no collateral, no oracle, no credit;
- it exercises the primitives the SDK has just standardised: signed quotes
  (RFC-053 `EefiMarketAgreement`), exclusive reservations (OMP-13), conditional
  funding (OMP-06) and settlement evidence (OMP-16 / RFC-036);
- it produces a genuine financial application rather than a machine-payment
  demo;
- it avoids MASH, P-EXIT, pooled VTXO and LP accounting entirely.

RFC-050 §8 is ordered around **capital authorisation** (MASH corridors, treasury,
leases). That ordering is sound for capital *deployment*, but it makes the first
milestone depend on the two least-proven layers: pooled custody and MASH. This
RFC adopts the exchange-first lens: **prove settlement truth and atomic exchange
first; capital allocation follows.**

| RFC-050 §8 item | RFC-054 sequencing |
|---|---|
| 1. Conditional Liquidity Corridors | after v1 (reuses reservation + funding) |
| 2. Autonomous Treasury | after v1 (reuses capital agreement) |
| 3. Private RFQ Exchange | **this RFC — moved first** |
| 4. Fixed-Term Liquidity Leases | after v1 (first true P-EXIT product) |
| Machine Prepaid Accounts (RFC-050 §7) | after v1 (orthogonal, statechain) |

## 2. Scope

**In scope (v1):**
- two independently operated peers (maker/taker), one pair of assets;
- direct Omnia channels / HTLCs — **no pool, no factory, no VTXO**;
- signed, expiring RFQ quotes and bilateral acceptance;
- exclusive capital reservation with expiry and abort;
- atomic swap with claim/refund and bounded recovery;
- verified settlement evidence and reconciliation;
- encrypted peer negotiation; off-chain settlement with on-chain fallback.

**Out of scope (v1):**
- AMMs, order books, pooled liquidity, LP fee accounting;
- VTXO transfers, factories, virtual channels, splicing;
- multi-hop routing (reserved for v1.1 behind Gate 3);
- MASH/MSHS-2 capital authorisation (v1 uses ordinary wallet custody);
- credit, interest, maturity, collateral, liquidation;
- oracle/price feeds, derivatives, structured products;
- anonymity/confidential amounts; route confidentiality.

> **Pooled-capital gate.** Pooled liquidity here is **blocked**, not merely
> deferred: it MUST NOT be enabled until RFC-050 §7.1 closes (real-VM L4 exit
> proof, state-continuity review, settlement-aware accounting, adversarial
> routing). Bilateral v1 is exempt because it uses no pooled output.

## 3. Actors and trust model

- **Maker** publishes a signed quote; **taker** accepts it. Either may be an
  agent operating under an `agent-policy` mandate.
- No central matcher, no privileged operator, no mandatory oracle, no global
  whitelist.
- Identity/discovery via `identity`/`manifest`/`lookup-*`; quotes are signed and
  bound to the counterparties and domain.
- Wallet consent uses `@totemsdk/connect/wallet` (approvals, trusted origin).
- Privacy claim is **private negotiation + off-chain settlement**, not anonymity.

## 4. Protocol flow

1. **Discovery & identity** — resolve counterparty identity and capabilities.
2. **Intent & mandate (optional)** — an agent obtains a bounded spend mandate
   (`agent-policy`) before quoting/accepting.
3. **RFQ quote** — maker issues an `EefiMarketAgreement` (RFC-053):
   - `quoteId` (canonical digest), `nonce`, `side`, base/quote assets and scales,
   - exactly one of `exactIn`/`exactOut`, `priceAtoms`, `feesBps`,
     `maxSlippageBps`, `venue`, `deadlineBlock`, `domain`,
   - `signatureRef` = the `@totemsdk/edge` TradeProposal/TradeAgreement digest
     (one signed financial message envelope; no second negotiation protocol).
4. **Acceptance** — taker signs the same quote identity; both parties hold the
   identical `quoteId`. A quote is executable only before `deadlineBlock`.
5. **Reservation** — each side reserves capacity exclusively (OMP-13:
   `agent-policy` grant-usage + ledger/edge CAS). The reservation is bound to
   `quoteId`, has its own expiry, and is released or burned on completion/failure.
   Reservation MUST be exclusive: no two in-flight swaps may consume the same
   capacity.
6. **Atomic swap** — the two legs are locked with HTLCs:
   - shared hashlock `H = SHA3(secret)`; the taker reveals the preimage to claim
     the counter-leg;
   - each leg has a refund timelock; claim/refund branches are mutually exclusive;
   - timelock margins are derived from worst-case communication, inclusion,
     contention and dispute recovery — **not** one block per hop;
   - invariant: **both legs settle or neither does**.
7. **Settlement evidence** — every leg progresses through explicit states:
   `prepared → authorized → broadcast → confirmed → reconciled`. No accounting
   mutation may occur before the required evidence exists.
8. **Cleanup** — release/burn reservations, emit receipts, update local
   reconciliation. Failed or ambiguous outcomes remain recoverable.

## 5. Commitments and digests

- Quote identity uses RFC-053: `quoteId = eefiMarketQuoteDigest(quote)`
  (excludes `quoteId` and `signatureRef`), `0x`-prefixed SHA3-256.
- `signatureRef` binds the financial quote to the signed `edge` negotiation
  digest; it MUST be verified before the quote is executable.
- The quote MUST commit: assets, scales, exact side/amount, price, fees,
  slippage, deadline, domain, maker/taker.
- No second quote/terms digest is permitted (RFC-050 §5).

## 6. Atomicity invariants

- **Atomicity** — after the swap begins, either both legs are claimable and
  claimed, or both are refundable and refunded. Partial settlement is a protocol
  violation and MUST be surfaced as an explicit recoverable state.
- **Exclusivity** — a reservation is consumed at most once and expires.
- **Quote binding** — settlement amounts/fees/assets MUST match the accepted
  `quoteId`; any mismatch aborts before broadcast.
- **Settlement truth** — a prepared/broadcast transaction is not settlement;
  accounting moves only on verified evidence (`confirmed`/`reconciled`).
- **No operator discretion** — recovery follows objective on-chain conditions
  and timelocks.
- **Live revalidation** — before locking HTLCs the executor confirms every hop
  against live channel state (exists, active, expected token, direction, sender
  balance). Failure returns `ROUTE_REVALIDATION_FAILED` with no locks.
- **Permissionless** — no global whitelist; eligibility is a product choice.

## 7. Settlement evidence and accounting

- Consume the RFC-036 / OMP-16 settlement port: prepared, broadcast, confirmed
  and off-chain-final are distinct states.
- Every deposit, payout and fee claim MUST reference verifiable funding or
  settlement evidence; a local record, proposal or intent is never evidence.
- Crash/retry/ambiguous-confirmation paths MUST be idempotent and reconcilable.
- The `omnia-pool` "prepared-as-settled" pattern is explicitly forbidden for
  this protocol (and should be corrected generally).

## 8. Failure and recovery matrix

| Failure | Required behaviour |
|---|---|
| Quote expired / wrong domain | Reject before reservation; no locks |
| Quote tampered / `signatureRef` invalid | Reject; abort |
| Reservation conflict / double-spend | Second attempt fails closed |
| Counterparty offline before lock | Release reservation; no funds move |
| HTLC timeout (one leg) | Refund path; reconcile; report |
| Counterparty withholds preimage | Refund after timelock; no partial accounting |
| Broadcast failure | Remain `authorized`/`prepared`; retry or abort |
| Ambiguous confirmation | Reconcile via chain evidence; never assume success |
| Crash/restart | Recover from durable states; no duplicate settlement |
| Replay/nonce reuse | Reject (`NONCE_REPLAY`) |
| Wrong asset/amount/fee | Abort before broadcast |

## 9. Privacy scope

- Negotiation is encrypted peer-to-peer; quotes are authenticated and private to
  the parties.
- On-chain information is minimised to the settlement that is actually needed.
- v1 makes **no** route-confidentiality or anonymity claim. Multi-hop forwarding
  (RFC-048 §3.2) remains cleartext until an onion codec lands; that is a v1.1
  concern behind Gate 3.
- Selective disclosure of financial records uses the proof/proofgraph layer, not
  public-chain metadata.

## 10. Entry gates (normative)

**Gate 0 — bilateral script proof.** Exercise the channel and HTLC scripts used
by v1 in the real VM: honest swap, refund before/after timelock, wrong preimage,
wrong amount/asset, and counterparty withholding.

**Gate 1 — custody (blocking for pooled paths only).** Re-run the static
findings against **current `main`** (the assessment examined `661d5ad`):
`STATE(n)` vs `PREVSTATE(n)` in the VTXO pool and factory scripts, and the
exit-clock ordering. v1 MUST NOT depend on pooled VTXO/factory scripts; any use
of them is blocked until honest and malicious exits are proven in the real VM.

**Gate 2 — settlement-aware accounting.** Every accounting mutation is bound to
verified evidence; no prepared-as-settled.

**Gate 3 — adversarial routing (v1.1).** Three separately hosted peers; kill an
intermediary during lock, fulfilment and refund; verify balances and recovery.
Required before multi-hop.

**Gate 4 — VTXO operator protocol (deferred).** Required before pooled VTXO
liquidity (RFC-038): round trips, durable spent-set, verified funding proofs,
proof-carrying exits.

**Gate 5 — bounded liquidity (later).** Pooled/market liquidity with transparent
LP accounting, after Gates 1–4. Gate 5 is additionally blocked by the
pooled-capital gate in RFC-050 §7.1.

## 11. Conformance tests

- honest bilateral swap (both legs settle);
- quote expiry, tamper, domain mismatch, replay;
- reservation conflict and expiry;
- refund path on withheld preimage;
- counterparty offline at each stage;
- broadcast failure and ambiguous confirmation;
- crash/restart between every state transition;
- wrong asset/amount/fee;
- wallet consent: missing/untrusted origin, rejected approval;
- evidence: no accounting before confirmed/reconciled.

## 12. Sequencing (normative)

1. **RFC-054 (this RFC) is the first Gen-1 milestone.**
2. RFC-050 §8 items 1, 2 and 4 (corridors, treasury, fixed-term leases) and
   Machine Prepaid Accounts are **subsequent** milestones. They MAY reuse the
   quote, reservation, funding and settlement primitives defined here, but MUST
   NOT be presented or implemented as the first Gen-1 deliverable.
3. The RFC-050 §8 ordering that places Private RFQ at #3 is **superseded for
   sequencing** by this RFC.
4. Pooled liquidity, VTXO, credit, derivatives and structured products require
   later RFCs and the gates above. **Pooled liquidity is additionally blocked by
   RFC-050 §7.1** (L4 exit proof, state continuity, settlement-aware accounting,
   adversarial routing) regardless of RFC-054 status.
5. Multi-hop spot exchange is a v1.1 extension behind Gate 3; v1 is bilateral.

## 13. Open questions

1. Single channel carrying a two-asset HTLC vs two channels with one HTLC each?
2. Who pays settlement fees, and how is fee provenance recorded?
3. Does the maker's identity need selective disclosure to the taker, or is the
   quote bound only to a pubkey digest?
4. Which side owns the reservation when both provide capacity?
5. Minimum timelock margin formula (communication + inclusion + contention +
   recovery) and its configuration.
6. Evidence format for disputes and receipts (proofgraph schema reuse).
7. Monitoring: the eltoo contest window (currently 256 blocks) creates an
   offline bound; v1 needs a documented bound and, later, delegated monitoring.

## 14. Authorisation

This RFC authorises implementation of the **v1 bilateral spot-exchange profile**:
signed quote/acceptance, exclusive reservation, atomic HTLC swap, settlement
evidence, recovery, and the conformance tests above. It authorises no pooled
liquidity, VTXO/factory use, MASH, credit, maturity, oracle or derivative
product. Those remain governed by RFC-050 and later RFCs.
