# RFC-064 — Omnia Off-Chain Extensions: Principles and Registry

**Status:** Proposed — principles and research registry; no implementation authorised
**Priority:** P1 (architecture) / P2 (research)
**Created:** 2026-10-21
**Authors:** Totem SDK Contributors
**Reference commit:** `8017cfcf77c975347a2c05478854c7560720e3fa`
**Depends on:** RFC-035 (peer coordination), RFC-039 (custody conformance), RFC-048 (Omnia primitive completeness), RFC-050 (Eefi product architecture), RFC-054 (private spot exchange), RFC-055 (routing architecture), RFC-058 (custody modes), RFC-061 (custody enforcement), RFC-063 (production readiness)
**Touches:** `docs/` only. This RFC authorises no package, wire, custody or release change.

> **Positioning.** Omnia already has programmable channels, factories, virtual
> channels, splicing, VTXOs, pools, routing and durable recovery helpers. The
> useful question is not "which channel paper can we implement?" but "which
> extension improves a named workload without weakening recovery or overstating
> maturity?"
>
> This RFC adopts a shared safety contract and a decision registry. Each
> near-term extension gets its own narrow implementation RFC. Every deferred
> profile stays a research note until a specific product justifies the custody,
> recovery and evidence cost.

---

## 1. Decisions

1. **Adopt the shared safety contract in §2 for any future Omnia extension.**
   It is normative only for profiles that are separately authorised.
2. **Adopt the registry and decisions in §3.** The registry is the public answer
   to "what are we doing, what are we researching, and what are we not building?"
3. **Authorise no implementation by this RFC.** RFC-065, RFC-066, RFC-067 and
   RFC-068 are separate proposals. Each requires its own review and gate.
4. **Keep OEX-05, OEX-06, OEX-08, OEX-09, OEX-10, OEX-11 and OEX-12 as research
   profiles.** They are tracked in
   [`docs/research/OMNIA-OFFCHAIN-RESEARCH-PROFILES.md`](../research/OMNIA-OFFCHAIN-RESEARCH-PROFILES.md).
5. **Do not create a new package.** Extend existing ownership boundaries unless a
   later implementation RFC demonstrates a dependency or runtime boundary that
   cannot be served by the current packages.
6. **No production or maturity claim changes.** Package levels remain governed by
   RFC-063 and `scripts/workspace-gates.config.json`.

---

## 2. Shared safety contract

Any profile adopted under this RFC MUST satisfy the following. These are
conditional requirements: they do not authorise a profile by themselves.

### 2.1 Authorisation and domain binding

- Every signed operation MUST bind protocol name and version, network/genesis
  identity, asset identity, operation ID, channel/factory/funding IDs, funding
  epoch, participants, expiry and the exact economic effect.
- A ticker is not an asset identity. Amounts MUST use canonical integer base
  units on the wire and exact integer arithmetic internally.
- Capabilities MUST be versioned identifiers, not ambiguous booleans. Unknown or
  unsupported modes MUST fail closed.
- A host MUST NOT silently substitute hosted custody or a different provider for
  a declined self-custody operation.

### 2.2 Reservations and enforceable backing

- For each asset, the sum of simultaneously enforceable claims MUST NOT exceed
  enforceable backing.
- Reservations MUST account for shared route edges, pending HTLCs, vouchers,
  virtual children, batch proposals and unconfirmed changes.
- A local allocation record is not proof that capital is locked. A signed plan is
  not proof that every participant can recover. A proof root is not proof that
  every represented liability remains independently recoverable.
- An irreversible obligation MUST have its durable recovery material before it is
  acknowledged. Removing a reservation requires fulfilment, acknowledged
  cancellation or a chain-safe timeout; a wall-clock timer alone is not enough.

### 2.3 WOTS and durable signing

- Reservation, signing and commit/burn MUST reuse `wots-lease` and the established
  signer interfaces.
- A retry MUST preserve the logical operation and exact signed bytes, or create a
  new operation with a new authorised signing reservation. A one-time signing
  leaf MUST NOT be reused for another digest.
- State required to prevent equivocation MUST be durable before a signature or
  voucher acknowledgement leaves the process.
- A restored backup with a stale signing watermark or exposure journal MUST stop
  signing until reconciliation determines the safe state.
- Corruption or missing state MUST NOT be interpreted as an empty account.

### 2.4 Recovery and custody

- The self-custody baseline requires a recovery path that does not depend on a
  third party becoming available to approve an already earned payout.
- All necessary pre-signed packages, proofs, ciphertext and secrets MUST be
  available to the entitled party.
- Monitoring obligations, contest periods, inclusion assumptions and maximum
  supported offline duration MUST be stated.
- Committee, TEE, hosted or quorum-dependent profiles MUST declare their trust and
  availability assumptions separately. They MUST NOT inherit the word
  "non-custodial" by analogy.
- A profile that can lose an earned claim when a quorum is unavailable is not
  equivalent to unilateral recovery and MUST NOT be presented as such.

### 2.5 Evidence and lifecycle

Every accepted operation MUST answer:

1. Which funds are encumbered?
2. What signed fact is irreversible?
3. Who can recover?
4. What event releases the encumbrance?

The minimum lifecycle is:

`prepared → reserved → authorised → exchanged → committed → reconciled`

with explicit `partially-resolved`, `recovering`, `aborted` and `indeterminate`
outcomes. A generic success boolean MUST NOT conceal partial settlement or
unresolved exposure.

The system MUST distinguish prepared, reserved, signed, accepted off-chain,
broadcast, included, confirmed, disputed and recovered. Evidence proves
authenticity and linkage under its verification rules; it does not prove physical
truth or the semantic quality of arbitrary computation.

### 2.6 Concurrency and retries

- Available channel balance MUST subtract all accepted concurrent reservations.
- Operations touching the same funding epoch MUST use a compatible state
  transition or retry from fresh state.
- A concurrent splice, factory close, child opening or portfolio mutation MUST NOT
  invalidate previously promised recovery.
- Compare-and-swap storage MUST protect the financial invariant, not merely the
  last writer's metadata.
- An unknown outcome MUST be reconciled before retrying with a new debit.
- Network messages may be duplicated; economic effects MUST be deduplicated by
  committed operation identity and funding state.

---

## 3. Registry and decisions

| ID | Capability | Decision | Owner |
|---|---|---|---|
| OEX-01 | Prefunded hash-chain voucher streams | Prototype in [RFC-067](RFC-067-OMNIA-HASH-CHAIN-STREAMS.md), gated on a real constrained-claim proof | `omnia`, `kissvm`, `wots-lease`, host/storage |
| OEX-02 | Multipart payments and flow control | Implement basic MPP in [RFC-065](RFC-065-OMNIA-MULTIPART-PAYMENTS.md); AMP deferred | `omnia-router`, `omnia-host` |
| OEX-03 | Atomic network rebalancing | Implement bounded cycles in [RFC-066](RFC-066-OMNIA-ATOMIC-REBALANCING.md) | `omnia-router`, `omnia`, `omnia-host` |
| OEX-04 | Transaction aggregation and netting | Research after RFC-066; matching stays in Eefi | Eefi + `omnia` execution |
| OEX-05 | Cross-relationship virtual funding | Research only; depth 1 first | `omnia-factory`, `omnia`, host |
| OEX-06 | Multi-asset portfolio channels | Research only; compare linked single-asset channels first | `omnia`, `tx-builder`, `kissvm` |
| OEX-07 | Submarine swaps | Same-chain profile in [RFC-069](RFC-069-OMNIA-SAME-CHAIN-SUBMARINE-SWAPS.md); external chains separate | `omnia`, `chain-provider`, Eefi quotes |
| OEX-08 | Forced-progression application channels | Research only; may require script/consensus work | `omnia`, `kissvm` |
| OEX-09 | Probabilistic micropayments | Deferred; WOTS issuance cost must be measured first | `omnia`, `wots-lease` |
| OEX-10 | Shared overflow reserves (Sluice) | Research only; not a default non-custodial reserve | `omnia-pool`, `omnia` |
| OEX-11 | Warden-protected virtual channels (Thunderdome) | Research only; separate committee profile | `omnia`, `omnia-relay` |
| OEX-12 | Atomic service exchange (A402/TEE) | Totem-native verifier profile first; TEE variant research | `proof`, `proofgraph`, `intelligence`, `omnia` |
| OEX-13 | Onion forwarding and blinded paths | Implement authenticated onion profile in [RFC-068](RFC-068-OMNIA-ONION-ROUTING.md) | `omnia-router`, transport |
| OEX-14 | Liquidity/fee/risk optimisation | Extend RFC-055 interfaces; benchmark only, no new service | `omnia-router`, `omnia-pool` |

### 3.1 What is authorised now

- RFC-065 (basic MPP) and RFC-066 (bounded rebalancing) are the only near-term
  implementation proposals. They may start after their own review.
- RFC-068 (onion forwarding) may proceed in parallel with RFC-035 work. It does
  not require a new package.
- RFC-069 (same-chain submarine swaps) is a proposed composition extension after
  RFC-065/066. It does not authorise external-chain interoperability.
- RFC-067 (hash-chain streams) is a **feasibility prototype**, not an authorised
  production path. It stops if the constrained claim cannot be expressed and
  enforced within the real VM budget.
- OEX-14 remains inside RFC-055. It does not authorise a new routing engine or a
  mandatory coordination service.

### 3.2 What is not authorised

- No AMP-style atomicity claim.
- No recursive virtual funding beyond a proven depth-1 profile.
- No portfolio channel.
- No forced-progression adjudication.
- No probabilistic payout default.
- No Sluice overflow reserve, Thunderdome warden committee or TEE vault in the
  self-custody default.
- No new package name.
- No change to RFC-063 maturity levels.

---

## 4. Measurable gates and kill criteria

A profile may move from design to prototype only when its implementation RFC
defines a baseline, a target and a stop condition. The defaults below apply unless
the implementation RFC justifies a stricter one.

| Profile | Minimum evidence | Kill criterion |
|---|---|---|
| OEX-02 basic MPP | A 100-unit invoice succeeds over disjoint 40/35/25 paths; a single-route failure is completed by a multi-shard set at equal capital; no duplicate settlement or lost shard under crash/retry | No invoice succeeds that a single route could not, or reservation complexity causes a material regression on single-route payments |
| OEX-03 rebalancing | A three-party fully collateralised cycle restores directional capacity; a non-cooperative participant cannot strand honest funds outside the declared recovery bound | Cost or lock time is not better than splice-based replenishment, or the coordinator can gain control of principal |
| OEX-01 hash-chain streams | Last acknowledged voucher pays the correct incremental amount after payer disappearance; no double credit across checkpoints; worst-case redemption fits a measured VM budget | On-chain verification is infeasible for a useful epoch length, or the covenant cannot prevent checkpoint/redemption double credit |
| OEX-07 same-chain swap | Every claim/refund branch survives near-expiry inclusion and reorg scenarios; preimage bytes are exact | The refund path cannot be made chain-safe within the declared confirmation model |
| OEX-08 forced progression | Valid moves and timeout outcomes enforce the application rules; invalid single-party moves cannot redirect funds | It requires an unauthorised consensus/script change or cannot bound the application |
| OEX-09 probabilistic payments | Winner and aggregate redemption are replay-safe and funded; adversarial randomness tests pass; issuance cost is measured | WOTS issuance erases the benefit or the randomness model cannot resist grinding |
| OEX-10/11/12 research | Explicit trust model, recovery counterexamples and operational cost; separate custody label | The profile cannot meet the existing custody policy without changing its meaning |
| OEX-13 onion | An intermediary cannot recover the full downstream route from its own view; failure packets do not leak the route; replay and size bounds hold | Privacy requires a claim not supported by the selected crypto profile |
| OEX-14 optimisation | Results match an equivalent model on deterministic small graphs and improve a specified objective under churn | The improvement disappears against an equivalent baseline or stale observations are unsafe |

Additional shared gates:

- **Deterministic execution:** positive, negative, replay, concurrency and exact
  accounting tests.
- **Financial enforcement:** actual generated scripts and signatures; real-node
  execution; measured VM/resource bounds.
- **Independent operation:** separate processes, keys and stores; actual chain
  inclusion/recovery for financial paths.
- **Failure/load:** crash, partition, reorder, duplicate delivery, stale tip,
  reorg, storage failure and sustained contention.
- **Review:** internal review for composition work; independent review for new
  custody, recovery or cryptographic construction.

---

## 5. Custody boundaries

The baseline remains the RFC-039/RFC-058 self-custody model.

| Profile class | Custody treatment |
|---|---|
| Bilateral channel extensions (OEX-02, OEX-03, OEX-07 same-chain, OEX-13) | Non-custodial if each participant retains recoverable material and no third party can move principal |
| Prefunded streams (OEX-01) | Non-custodial only if the claim covenant gives the recipient unilateral redemption and the payer cannot reclaim committed increments |
| Recursive/virtual funding (OEX-05) | Non-custodial only for every enforceable child outcome; an unavailable intermediary must not erase an earned claim |
| Portfolio channels (OEX-06) | Per-asset backing must remain independently recoverable |
| Forced progression (OEX-08) | Non-custodial only if the on-chain adjudicator, not an off-chain callback, resolves the outcome |
| Probabilistic payments (OEX-09) | Non-custodial only if tickets are funded, replay-safe and redeemable without a trusted operator |
| Sluice overflow (OEX-10) | Research profile; quorum-dependent recovery is not the self-custody default |
| Thunderdome (OEX-11) | Research profile; committee security is a separate custody class |
| TEE/A402 (OEX-12) | Research profile; TEE attestation and vault custody are not equivalent to local self-custody |

A profile that changes the custody class requires an RFC-058 disclosure update.
Disclosure does not make an unsafe recovery model acceptable.

---

## 6. Dependencies and sequencing

### 6.1 Repository prerequisites

- **RFC-063 gates are not yet fully satisfied.** `storage` is currently alpha,
  `omnia-host` and the lookup/edge production candidates are rc. Durable host and
  storage wiring is a prerequisite for any claim that stream, batch or virtual
  funding state survives restart.
- `omnia-router`'s forwarding codec is cleartext. RFC-068 completes the existing
  seam; it does not retrofit confidentiality into the current profile.
- RFC-054 bilateral spot exchange is not started. RFC-066 and OEX-04 must not
  reorder or absorb that work.
- RFC-055 Phase 1 is landed; Phase 2+ is not authorised. OEX-14 stays within the
  existing bounded-search and cost-model interfaces.

### 6.2 Sequence

1. **RFC-065 basic MPP** — payment sets, durable reservations, receiver assembly.
2. **RFC-066 bounded rebalancing** — reuses the reservation/recovery foundation.
3. **RFC-068 onion forwarding** — parallel with RFC-035 completion.
4. **RFC-067 hash-chain prototype** — only after the constrained-claim proof.
5. **RFC-069 same-chain swap** — after MPP and rebalancing; external chains remain separate.
6. **OEX-04 netting** — after RFC-066, with Eefi owning matching policy.
7. **Research profiles** — on a product trigger, not a calendar.

---

## 7. Non-goals

- A general EVM-style execution environment.
- A universal layer-2 or a new consensus protocol.
- Replacing the both-signed Omnia script with an unconstrained single-signer path.
- Recursive funding before depth-1 recovery is proven.
- Portfolio channels before linked single-asset channels are compared.
- A default committee, warden, TEE or quorum custody model.
- New package names created for organisational convenience.
- Production promotion of any package by this RFC.

---

## 8. Open decisions

1. Which production workload provides the first MPP baseline?
2. What is the maximum useful stream epoch under the real VM budget?
3. Is basic MPP sufficient for the first product, or is an independently reviewed
   AMP-style construction required?
4. Which batch primitive serves both rebalancing and netting without conflating
   their economic semantics?
5. What parent-close and splice rules make depth-1 virtual funding recoverable?
6. Which service predicates can Totem verify without a TEE or trusted observer?
7. What maximum offline period does ordinary delegated monitoring support?
8. Which privacy profile is required: forwarding confidentiality, blinded
   receiving paths, or a separately reviewed PQ/hybrid construction?

---

## 9. References

- [RFC-035 — Omnia Peer Coordination](RFC-035-OMNIA-PEER-COORDINATION-PROTOCOL.md)
- [RFC-039 — Custody Conformance](RFC-039-CUSTODY-CONFORMANCE.md)
- [RFC-048 — Omnia Primitive Completeness](RFC-048-OMNIA-PRIMITIVE-COMPLETENESS.md)
- [RFC-050 — Eefi Product Architecture](RFC-050-EEFI-PRODUCT-ARCHITECTURE.md)
- [RFC-054 — Private Spot Exchange](RFC-054-EEFI-PROTOCOL-0.1-PRIVATE-SPOT-EXCHANGE.md)
- [RFC-055 — Omnia Routing Architecture](RFC-055-OMNIA-ROUTING-ARCHITECTURE.md)
- [RFC-058 — Custody Modes and Disclosure Gate](RFC-058-CUSTODY-MODES-AND-DISCLOSURE-GATE.md)
- [RFC-063 — Production Readiness](RFC-063-PRODUCTION-READINESS-AND-MATURITY-PROMOTION.md)
- [RFC-069 — Same-Chain Submarine Swaps](RFC-069-OMNIA-SAME-CHAIN-SUBMARINE-SWAPS.md)
- [Off-chain research profiles](../research/OMNIA-OFFCHAIN-RESEARCH-PROFILES.md)

This RFC is design guidance. It does not establish production readiness, custody
eligibility or implementation authority.
