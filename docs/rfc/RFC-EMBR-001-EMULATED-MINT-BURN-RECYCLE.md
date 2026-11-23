# RFC-EMBR-001: Emulated Mint, Burn & Recycle for Fixed-Supply Minima Tokens

| Field | Value |
|---|---|
| Status | **DRAFT — RESEARCH ONLY; NOT IMPLEMENTATION APPROVED** |
| Date | 2026-11-23 |
| Target | Minima L1 / Totem SDK |
| Proposed package | `@totemsdk/embr` (conditional) |
| Primary consumers | RICO and future fixed-supply synthetic assets |
| Related packages | `@totemsdk/kissvm`, `@totemsdk/connect`, `@totemsdk/txpow`, `@totemsdk/omnia` |
| Decision gate | Consensus-enforced circulation and atomic accounting demonstrated on real nodes |

## 1. Abstract

Minima custom tokens are created with an initial fixed supply. Applications requiring elastic *circulating* supply cannot assume native incremental token minting. EMBR proposes reserving a large fixed token allocation at creation, releasing units into circulation when an application authorizes issuance, and returning units to reserves on redemption. Total native supply remains constant; **mint**, **burn**, and **recycle** are application-level terms, not Minima consensus mint/burn operations.

This RFC **does not assume** that a coin state port is an enforceable property of a fungible token. It defines the threat model, candidate designs, conservation rules, executable tests, and an explicit go/no-go gate. It must be possible to demonstrate that arbitrary holders cannot manufacture effective circulation, bypass reserve restrictions, or defeat the accounting invariant. Otherwise the token model must change.

## 2. Motivation and non-goals

RICO needs collateral-backed issuance, repayment, liquidations, and auditable circulating supply. A one-time premint can provision capacity but is not itself a decentralized issuance mechanism.

Goals:
- Preserve the native token's fixed supply while adjusting *economically usable* supply.
- Prevent discretionary unbacked reserve release.
- Make issuance/recycling atomic with application-specific authorization and accounting.
- Support normal wallet transfers and independent third-party verification where possible.
- Avoid a globally serialized UTXO unless throughput measurements justify it.
- Provide generic SDK primitives without embedding RICO's monetary policy.

Non-goals:
- Changing Minima consensus or introducing genuine native incremental minting.
- Claiming a peg, collateral solvency, or price stability from supply conservation alone.
- Treating a UI/indexer LIVE label as a consensus restriction.
- Making an administrator's multisignature authorization equivalent to permissionlessness.
- Declaring Omnia balances equivalent to L1-settled, freely transferable tokens.

## 3. Terminology and units

- **S**: immutable native token supply at genesis, in the token's *actual native smallest units*.
- **R**: units locked in eligible reserve UTXOs, independently verifiable under the selected model.
- **C**: circulating units with enforceable transfer/redeem rights.
- **X**: units in explicitly defined escrow/retirement-in-flight states, if supported.
- **L**: ledger's claimed circulating supply (a derived assertion, not independent truth).
- **LIVE/DEAD**: proposed *protocol classifications*, not automatically native token attributes.
- **Issuance**: reserve-to-circulation transition.
- **Retirement**: circulation-to-reserve transition.
- **Recycling**: subsequent reuse of retired reserve units.

Do not assume 18 decimals or that `10^18` is an appropriate token amount. Minima's native token scale, precision, maximum supply, script budgets, and transaction encoding must be established from actual consensus code and test vectors. Use integer atoms / exact decimal arithmetic, never floating point for balances.

## 4. Prior assumptions requiring verification

The following claims are **unproven**, and code MUST NOT depend on them until tests confirm them:

1. A per-coin `STATE(0)` flag persists or is enforced across *all* arbitrary native token transfers.
2. A native token script executes for every relevant spend and can constrain all descendant outputs.
3. `SAMESTATE` globally preserves a token-level property; it may only compare transaction/coin state in its actual execution context.
4. A reserve covenant can inspect all relevant input/output states and scripts without omissions.
5. `SUMINPUTS(tokenid)` / `SUMOUTPUTS(tokenid)` can distinguish LIVE from DEAD; these totals are token-ID aggregates, not classification-aware.
6. A user wallet can accept nontrivial token scripts and still split/merge and transfer normally.
7. Any reserve/ledger pair can be co-spent atomically without unbounded contention.

Never use invented KISSVM opcodes. `SUMINPUTS_TOKEN_LIVE`, `SUMOUTPUTS_TOKEN_LIVE`, `STATEUPDATEOF`, `INPUTREF_BY_ADDRESS`, `ENFORCE_OUTPUT_SCRIPT`, and `MINT` from earlier design sketches are **not validated native opcodes**. The final specification must use syntax verified against the exact Minima node and `@totemsdk/kissvm` versions.

## 5. Threat model

Adversary may control arbitrary LIVE token units, construct raw transactions without EMBR wallets, choose output scripts and state ports, split/merge tokens, collude with keepers, submit concurrent transactions, replay stale transactions, censor or delay messages, and exploit oracle errors. Adversary may also obtain up to the assumed compromised signing threshold.

Trust boundaries:
- **Minima consensus:** only confirmed transaction validity and the actual VM semantics are authoritative.
- **Totem SDK:** prepares, simulates, submits, and audits transactions; cannot add consensus restrictions.
- **Indexers / UI:** may misclassify coins; cannot establish spend restrictions.
- **Signers / governance:** are a source of trust unless constrained by enforceable covenants.
- **Oracle / RICO:** supply authorization is separate from market valuation and solvency.

Safety properties must hold even if the entire SDK client is replaced by a malicious raw-transaction builder.

## 6. Candidate architectures

### A — Native token-script-enforced EMBR (preferred *if proven*)

Create a single native token with a nontrivial token script enforcing issuance, reserve and transfer conditions. Investigate whether the token script has sufficient access to the entire transaction, output scripts, amounts, state, and the authorization proof to prevent any unapproved circulation transition.

A candidate status bit in coin state is **not** an acceptable mechanism unless every possible token movement is consensus-constrained to preserve its meaning. Splits, merges, change outputs, self-transfers, and arbitrary script recipients are mandatory attack cases.

**Accept only if:** any holder can transfer ordinary circulating tokens without privileged cooperation, while no holder can create additional redeemable circulating units except through an authorized reserve-release transition.

### B — Covenant-controlled reserve, ordinary native token circulation

Keep preminted supply in tightly constrained reserve UTXOs; release ordinary fungible native tokens after application authorization. Recycling returns ordinary tokens to reserve custody. Circulation is measured as `S - provably reserve-held supply` (adjusted for rigorously defined escrow), not by a user-controlled LIVE flag.

This may be simpler and more wallet-compatible. However, released units may be indistinguishable from previously released units, and a holder may be able to send units into arbitrary scripts. The definition of circulating supply must account for permanently inaccessible/lost units and transfers to reserve-like addresses. Reserve deposits must not be counted as retired until enforceably locked.

**Accept only if:** reserve outflows are impossible without exact application authorization, retirement cannot be double-counted, and all reserve UTXOs can be enumerated and proven to be controlled by approved covenants. If release requires a discretionary signer, disclose that trust explicitly.

### C — Script-backed transferable claims / wrapped ledger

Represent circulating rights as contract-controlled claims, rather than treating all native token units as interchangeable LIVE tokens. This can provide tighter state control but may sacrifice native-wallet/DEX fungibility, impose a centralized bottleneck, or require an Omnia-like settlement/exit architecture.

**Accept only if:** claim ownership, transfers, redemptions, unilateral exits, and full collateral backing can be verified by independent participants without trusted host availability.

### Comparison and decision

Evaluate A/B/C on consensus enforceability, arbitrary-wallet transfer compatibility, trust assumptions, independent exits, throughput, composability, audit complexity, and recovery. **No design is selected by this RFC.** A is preferred only conditionally; B is a legitimate fallback; C is a different asset product and must be named accordingly.

## 7. Normative invariants

All quantities use exact integer units. A verifier MUST independently reconstruct them from confirmed chain data, not rely on mutable API counters.

**I-01 Native conservation:** `sum(inputs[token]) == sum(outputs[token])` for transfers, except consensus-defined creation/burn rules. No protocol operation may increase `S`.

**I-02 Partition:** where categories are mutually exclusive and consensus-verifiable, `S = R + C + X`. If classification is not consensus-verifiable, this equation is *not* a valid security invariant and the design fails its claimed model.

**I-03 Issuance authorization:** every `ΔC > 0` must correspond to a unique, authorized, confirmed issuance transition; issuance amount and beneficiary must match an application authorization bound to the same transaction or cryptographically committed output set.

**I-04 Retirement authorization:** every `ΔC < 0` must correspond to confirmed movement into provably restricted reserve/escrow. Merely paying an address or setting a UI flag is insufficient.

**I-05 No double counting:** a coin may occupy exactly one recognized partition at a given confirmed chain state. Reorgs, mempool conflicts, and pending transactions must not change confirmed totals.

**I-06 No privileged discretionary issuance:** reserve operators cannot release units merely by reaching a multisignature threshold unless the chosen trust model explicitly declares them as issuers. Emergency powers must be narrowly scoped and documented.

**I-07 Atomic application binding:** for RICO integration, issuance must be coupled to a valid vault debt transition and collateral policy; retirement to a valid debt/settlement transition. The application must not rely on asynchronous best-effort ledger updates.

**I-08 Output completeness:** every output relevant to the token must be checked, including extra outputs, change, mixed-token transactions, and nonstandard script recipients. Aggregate amount equality alone is insufficient.

**I-09 Replay/reorg safety:** authorizations bind to domain, token ID, operation, amount, destination, relevant input/coin identifiers, expiry, and unique nonce/transition identifier as feasible; reorg-aware indexers reconcile state.

**I-10 Exactness:** rounding, scaling, fees and dust never create more redeemable claims than the reserve/accounting model permits.

**I-11 Recoverability:** authorized funds remain independently spendable/redeemable under documented operator failure and signer-loss scenarios, or the residual trust/custody risk is explicitly disclosed.

**I-12 Observability:** independent auditors can compute the same confirmed circulating total from chain data and protocol configuration; any reported ledger value is cross-checked, never assumed.

Supply conservation does **not** imply collateral solvency or a stable market price. Those are RICO-layer properties.

## 8. Transaction families to prototype

1. **Genesis:** create fixed-supply token with the candidate token script and reserve placement; record token ID, precision, reserve root, script hashes, and immutable protocol parameters.
2. **Reserve rebalance:** split/merge reserve UTXOs without increasing circulation.
3. **Issue:** consume reserve UTXO(s) and authorization-bearing vault/state input(s); produce exact circulating recipient outputs and valid reserve change.
4. **Transfer:** arbitrary holder spends circulating units, including splits/merges and change; no issuance authorization required.
5. **Retire:** consume circulating units; create provably restricted reserve units and update debt/settlement in the same transaction.
6. **Recycle:** reissue previously retired units via the same issuance gate.
7. **Emergency:** pause new issuance without confiscating ordinary circulating units or preventing valid redemptions, subject to explicit liveness assumptions.

For each family, record actual KISSVM source, compiled script/hash, serialized transaction, exact input/output/state layout, VM traces, node acceptance/rejection, and post-state verification. The RFC deliberately contains no purportedly executable KISSVM until opcode semantics are proven.

## 9. Ledger and concurrency model

A singleton SupplyLedger UTXO may serialize all issuance and retirement, create contention, and increase liveness risk. Compare:
- **Global singleton:** simplest proof surface, worst contention.
- **Sharded reserve/ledger:** partitioned issuance capacities with deterministic shard accounting and a global sum computed by indexers.
- **Per-vault accounting + constrained reserve:** independent vault lineages, with global circulation derived from confirmed reserve balances.

No off-chain indexer may authorize issuance by itself. Test simultaneous issues/retirements, shard exhaustion, double-spends, reorgs, and fragmented reserve UTXOs. Publish observed transactions per block, conflicts, latency, transaction weight, VM instruction usage, and mobile feasibility. Avoid ungrounded throughput claims.

## 10. Required adversarial conformance matrix

Every test requires a malicious raw transaction (not only a compliant SDK builder), expected consensus result, actual node result, VM trace, and independent post-state check.

| ID | Attack / property | Expected |
|---|---|---|
| A01 | LIVE transfer to output lacking status | Rejected under A; otherwise A fails |
| A02 | Split LIVE into LIVE and DEAD outputs | Cannot increase/decrease effective C without authorization |
| A03 | Merge LIVE and reserve/DEAD units | No laundering or status bypass |
| A04 | Spend reserve without debt/issuance authorization | Rejected |
| A05 | Add unchecked token output after legitimate outputs | Rejected if it changes authorized allocation |
| A06 | Preserve amounts but substitute recipient/script | Rejected |
| A07 | Retire same units twice / replay retired input | Rejected by consensus; ledger unchanged |
| A08 | Concurrent issuance against same reserve/shard | At most authorized nonconflicting issues confirm |
| A09 | Issue without debt or create debt without issue | Rejected atomically for RICO-bound operation |
| A10 | Stale, spoofed or contradictory oracle authorization | Rejected by RICO policy, or issue halted |
| A11 | Route units through Omnia and exit with bypassed restrictions | No excess claims or unauthorized circulation |
| A12 | Exploit scale, rounding, dust, overflows | Conservation and authorization hold exactly |
| A13 | Arbitrary change-output script and extra output count | No bypass |
| A14 | Direct raw transaction bypassing Totem wallet | Same consensus safety |
| A15 | Reorg, mempool replacement and delayed confirmations | Confirmed supply reconciles |
| A16 | Compromised keeper / multisig signer threshold | No unbacked discretionary release under trustless claim |
| A17 | Permanent loss of reserve operator or host | Documented recoverability/liveness result |
| A18 | Transfer to unknown wallet, script or DEX | Explicit compatibility outcome |
| A19 | Exhaust token supply / reserve fragmentation | Predictable fail-closed behavior |
| A20 | Forged indexer ledger or missing historical UTXO | Independent verifier detects mismatch |

Positive controls: ordinary transfers, splits, merges, issue, repay/retire, recycle, partial reserve change, two simultaneous nonconflicting issues, and recovery after restart.

## 11. Verification methodology

**Stage F0 — source semantics:** pin exact Minima Java/C++ node commit(s), SDK commit, KISSVM version, tokencreate encoding, token script evaluation entry point, script execution context, state semantics, and transaction output introspection. Produce line-linked evidence. Do not infer native behavior solely from SDK documentation.

**Stage F1 — VM fixtures:** use `@totemsdk/kissvm` to compile/evaluate each candidate transaction and its malicious variants. Check interpreter parity with node behavior, especially `SAMESTATE`, `PREVSTATE`, `VERIFYOUT`, `GETOUTTOK`, `SUMINPUTS`, and `SUMOUTPUTS`.

**Stage F2 — real consensus:** submit positive and adversarial transactions to isolated Minima nodes/testnet, including raw-transaction paths independent of Totem. A locally simulated rejection is not proof of consensus rejection.

**Stage F3 — wallet/Omnia:** verify transfers through native wallets, Totem Connect, and Omnia channels/factories, including unilateral exit and hostile counterparties. Omnia is optional for EMBR core; incompatibility must not silently weaken token security.

**Stage F4 — invariant/indexer:** independent verifier scans confirmed UTXOs and transaction history, reconstructs R/C/X (where meaningful), and cross-checks all transitions under reorg and concurrency.

**Stage F5 — review:** independent security review and explicit recorded decision selecting A, B, C, or no viable architecture.

Each result must be marked **unimplemented**, **simulated**, **node-verified**, or **independently reproduced**. Do not label a simulated result as production proven.

## 12. Acceptance gates

**G0: Evidence baseline** — exact node and SDK versions pinned; token-script execution semantics sourced and reproduced.

**G1: Enforceable circulation** — A or B has a defensible, chain-verifiable circulation definition; A01–A06, A13, A14 pass against real node consensus. Failure means no native fungible EMBR claim.

**G2: Atomicity** — A07–A09, A12, A15 pass; no confirmed issuance without authorized matching state transition.

**G3: Trust transparency** — A16–A17 pass under the declared threat model; any administrator discretionary release downgrades classification to *permissioned reserve issuance*, not trustless EMBR.

**G4: Compatibility** — A11 and A18 establish exact native-wallet/Omnia/DEX behavior, with unsupported paths blocked rather than silently accepted.

**G5: Operability** — A08, A19–A20 and positive controls show acceptable resource use, independent verification and restart/reorg recovery.

**Go:** only after all gates pass, a separate RFC-EMBR-002 may specify implementation and audited contracts. **No-go:** if unrestricted native transfers allow bypass of claimed circulation controls, if arbitrary reserve release remains possible, or if accounting depends on a trusted indexer. A permissioned alternative may be proposed but must be explicitly reclassified.

## 13. Proposed SDK work (conditional)

Potential `@totemsdk/embr` API:
- `inspectTokenCapabilities(tokenId, nodeVersion)`
- `buildReservePlan(...)`, `buildIssuePlan(...)`, `buildRetirePlan(...)`
- `verifyTransition(confirmedTx, previousState, policy)`
- `reconstructCirculation(chainSnapshot, genesisManifest)`
- `auditReserveLineages(...)`

API calls must return structured evidence and an explicit trust classification, not just a boolean. Avoid promising generic LIVE balance queries until a consensus-enforced classification exists. `@totemsdk/kissvm` provides VM testing; `connect` and `txpow` assist transaction construction/broadcast; Omnia is an optional integration subject to its own proof obligations.

## 14. RICO integration boundary

EMBR must remain monetary-policy agnostic. RICO's Vat owns debt and collateral rules; Vox owns the par controller; Vow owns liquidation losses and surplus; Feed owns oracle evidence; Flow owns auctions. RICO invokes issuance/retirement only through a proven EMBR transition bound to authorized debt state. A pre-minted RISK recapitalization reserve is a separate risk-bearing mechanism and must not be assumed to guarantee solvency.

## 15. Open questions

1. Precisely when and with which state context does Minima evaluate a custom token script?
2. Can a token script constrain *every* relevant output script/state, including splits and merges?
3. Does `keepstate` preserve the properties required, or only the particular coin's state?
4. Can native wallets transfer script-constrained tokens without a privileged operator?
5. What native precision and supply bounds apply to `tokencreate`?
6. What minimum independent verification data are available to mobile clients?
7. Can per-vault or sharded reserve lineages eliminate singleton contention without weakening invariants?
8. Are fee payment, transaction weight, and script instruction budgets practical for issuance/retirement?
9. What emergency pause/recovery model is acceptable without granting arbitrary issuance?
10. What guarantees do Omnia exits provide for tokens with nontrivial token scripts?

## 16. Decision record

**2026-11-23:** Initiate Phase 0. No architecture selected. No claim of trustlessness, native token status enforcement, or mainnet readiness is approved. Next action: inspect the Minima consensus token-script validation path, then implement adversarial fixtures and run them on actual nodes. Publish findings and a signed-off G0–G5 gate report before RFC-EMBR-002.
