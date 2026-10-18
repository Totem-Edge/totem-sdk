# RFC-049 — MASH × Omnia × Eefi: Programmable Capital on a Permissionless Network

Status: Draft for architectural review — proposed, not merged for implementation
Created: 2026-10-18
Authors: Totem SDK Contributors
Depends on: RFC-007 (Storage), RFC-008 (Federated Statechain), RFC-009 (KISSVM signature fidelity), RFC-012 (Decision), RFC-014 (Wallet/Connect), RFC-017 (Decision Receipt Graph), RFC-019 (Governed Commerce), RFC-021–023 (Industrial/Physical), RFC-032/033 (Lookup identity + Go WOTS), RFC-048 (Omnia Primitive Completeness)
Touches (proposed): `@totemsdk/omnia*` (funding/settlement boundaries), `@totemsdk/authority`, `@totemsdk/agent-policy`, `@totemsdk/identity`, `@totemsdk/manifest`, `@totemsdk/kissvm`, `@totemsdk/recursive-mast`, `@totemsdk/proof`/`proofgraph`; node-side MASH (MSHS-2) in `totem-node-new-crypto`

> **Scope.** Where MASH (MSHS-2 stateless post-quantum authorization) fits in the SDK, and how
> MASH-governed **capital commitments** compose with Omnia execution and the future Eefi product
> layer — **without** making Omnia permissioned. Architecture only; no implementation is
> authorised by this RFC.
>
> **Positioning.** RFC-049 defines the **capital-authorization boundary** (a precondition); the
> Eefi product/market/risk architecture is **RFC-050**.

---

## 1. What MASH is (grounded)

MASH is **MSHS-2** — a *stateless* post-quantum signature/authorization scheme implemented in the
C++ node (`totem-node-new-crypto/org/minima/utils/mshs2/`, commands under
`system/commands/scripts/mashnewaddress|mashretire|mashrootstatus|mashuses`).

- A **PK_ROOT** is derived from the wallet seed; an on-chain MSHS-2 **verifier branch** (a MAST
  policy) commits the authorization. `mashnewaddress` *"derives a post-quantum public key from
  your wallet seed and builds the canonical MSHS-2 verifier branch."*
- Roots are **one-time-use** with a durable counter (`mshs2_<PK_ROOT>_uses.dat`) and a durable
  **retire marker** (`..._retired`), so a root cannot sign after retirement (crash-durable).
- MSHS-2 occupies a **reserved state-port band**: per the node's RFC-0001 draft, *"first proof
  port 234"* through the highest MSHS port (reported `230..255`), and a normative rule:
  **Direct-Mode scripts MUST NOT include ports `BASE(k)..max` in any `SAMESTATE` range.**

MASH is therefore node-side. The SDK does **not** re-implement it; it consumes it as an
on-chain authorization/script primitive. That is the same posture as RFC-008/009/032/033
(WOTS/lookup/MSHS parity between the TS SDK and the native node).

---

## 2. Permissionless is the invariant; MASH is *voluntary constraint*

Omnia is a **permissionless financial execution network**. MASH lets a participant place
**cryptographically enforceable conditions on its own assets and commitments**. Those conditions
govern *individual economic agreements* and **MUST NOT become global network admission
requirements**.

This RFC deliberately replaces an earlier "OPEN — Capital authorization (who may fund / permitted
counterparties)" framing — which read like a network-wide admission controller — with:

> **OPEN — Sovereign Capital Commitment.** Any participant may offer capital and negotiate Omnia
> channel terms. A participant MAY optionally use MASH/MAST/KISSVM to enforce self-selected
> conditions on the deployment of **its own** capital (exposure limits, collateral requirements,
> contract maturity, counterparty criteria).

### 2.1 Normative invariants (MUST)

- **No global MASH requirement.** Standard Omnia participation MUST remain possible without a
  MASH wallet.
- **No protocol-wide participant whitelist.** Counterparty restrictions are optional,
  contract-level or participant-level choices.
- **No mandatory central policy issuer.** Participants create their own policies and hold their
  own authorization keys.
- **No mandatory oracle/governance approval** for ordinary channels.
- **No privileged liquidity operator.** Anyone meeting the publicly specified terms of an offer
  may participate, subject to the counterparty's agreement.
- **Unilateral recovery is preserved.** A policy MUST NOT introduce an administrator whose
  cooperation is required to recover funds from a product advertised as non-custodial
  (cf. RFC-039).

### 2.2 Policy-constrained ≠ permissioned

The RFCs MUST distinguish these terms. *Policy-constrained liquidity* = an LP bounds its own
risk; the network is unchanged. *Permissioned liquidity* = a market excludes participants; it is
a product choice on top of the same permissionless substrate. Three participants — permissionless,
self-restricted, and a restricted financial product — coexist on identical Omnia infrastructure.

---

## 3. Where MASH sits in the SDK (reuse-first)

The node is *"a purpose-built C++ Minima node … the native backend for the `@totemsdk/*`
ecosystem"* (it replaces `@totemsdk/lookup-node` and implements `@totemsdk/lookup-protocol`;
node profile format RFC-0012 consumes SDK-defined `authority`/`agent-policy`).

| Concern | Owner | Notes |
|---|---|---|
| MSHS-2 authorization / verifier branch | **node** (MASH) | one-time PK_ROOT, durable counter + retire |
| Identity / manifests / publisher binding | `identity`, `root-identity`, `manifest` | MASH root ⇒ identity binding (reuse, don't reinvent) |
| Policy / mandates / spend bounds | `authority`, `agent-policy` | MASH reference in a mandate; **no** new policy engine |
| Executable conditions / recovery branches | `kissvm`, `recursive-mast` | MASH verifier composes as a MAST branch |
| Capital-movement / settlement | `omnia*` (RFC-048) | unchanged execution; **no** MASH inside high-frequency updates |
| Evidence / provenance | `proof`, `proofgraph` | MASH authorization as a proof/evidence reference |
| Product economics (risk, credit, pricing) | **Eefi** (outside Omnia) | rate/margin/liquidation/collateral models |

**Conclusion:** a `@totemsdk/mash` package is **not** warranted now. MASH is a node capability
consumed through the existing script/identity/policy/evidence seams. A thin SDK *adapter* (e.g.
`@totemsdk/identity/mash` for root↔identity binding, or a KISSVM MASH-verifier template) is the
correct shape if a consumer need appears — mirroring how `@totemsdk/identity` consumes WOTS.

---

## 4. Three enforcement stages (unchanged distinction)

| Stage | Enforced by | Boundary |
|---|---|---|
| **OPEN — Sovereign Capital Commitment** | MASH + MAST + KISSVM | Which *own* capital may enter, under self-selected conditions; the funded channel must independently embody the agreed terms |
| **UPDATE — Financial state machine** | Omnia programs + co-signed state + agent-policy | Interest, repayments, meter readings, margin, HTLCs — **not** governed by MASH automatically |
| **CLOSE — Settlement rights** | Omnia dispute/settlement + MASH-controlled recipients | Enforced payouts, principal return, fee sharing, escrow release, recovery |

Critically (per RFC-039): an Omnia channel's update/settlement requires both participants'
signatures; a unilateral close broadcasts a **previously co-signed** close package — it does not
let one participant invent a payout. MASH funding does **not** confer authority over an Omnia
channel's internal updates.

### 4.1 Integration models

- **Model A — MASH-governed channel boundaries (recommended first).** MASH controls funding and
  the destination wallets used for settlement; existing Omnia scripts are unchanged.
- **Model B — MASH-aware Omnia contracts.** Omnia funding/update/settlement scripts incorporate
  MAST policy commitments and enforce extra financial invariants. Far more powerful; requires new
  protocol work, consensus-compatible tests and financial review.

Model A yields Eefi products quickly; Model B is where richer contracts live.

---

## 5. STATE-port collision analysis: MASH × MAST × Omnia

This is the concrete engineering risk. Composite transactions that carry **both** MSHS-2
authorization state and Omnia program state must not overlap ports, and must respect the MSHS
`SAMESTATE` prohibition.

### 5.1 Port bands in play

| Band | Owner | Notes |
|---|---|---|
| 0 | reserved (legacy state scripts) | MSHS: `SAMESTATE(0 N)` allowed only for `N ≤ BASE(k)-1` |
| 100 / 101 / 102 | Omnia channel (`SETTLEMENT`, `SEQUENCE`, `COMMITMENT_V2`) | `transactions.ts` |
| 103 / 110 | Omnia factory escape block; VTXO exit-delay | factory/`exit-tx` |
| 120–183 | Omnia programs (COUNTER 120–122, METER 130–133, HTLC 140–144, VAULT 150–152, TREASURY 160–164, MEMBERSHIP 170–172, ASSET 180–183) | `program.ts` |
| 200 + k | Omnia **factory shares** and **VTXO pool shares** | `FACTORY_BALANCE_PORT_BASE`, `POOL_SHARE_PORT_BASE` |
| ≥ 234 … max | **MSHS-2 / MASH** (proof ports from 234) | node RFC-0001 |

### 5.2 Concrete collisions / hazards

1. **`200+k` overlaps MSHS 234–255 for `k ≥ 34`.** The Omnia factory and VTXO pool *share* band
   (`200+k`) runs into the MSHS proof band. **Rule:** relocate the share band to a registered
   sub-234 range with headroom (e.g. base `128` → ~106 slots) — party count is an **encoding
   choice**, not a MASH limit — or re-parameterise in Model B. Ports are per-coin namespaces, so
   factory and VTXO can each carry their own large band below 234.
2. **`SAMESTATE` across the MSHS band is forbidden.** MSHS Direct-Mode scripts MUST NOT place
   `BASE(k)..max` inside a `SAMESTATE(from,to)` span. Omnia uses single-port `SAMESTATE(102 102)`
   / `SAMESTATE(103 103)` — safe today — but any **range** `SAMESTATE` that spans ≥234 would
   break MSHS. Composite scripts MUST keep `SAMESTATE` ranges entirely ≤ BASE(k)-1.
3. **MAST / KISSVM templates are port-parameterised.** Templates (agent-policy, data-privacy,
   rwa-lifecycle, provider-bond, temporal, …) take **caller-supplied** port configs, so collisions
   are a *composition-time allocation* problem, not a fixed overlap. A composite MASH+Omnia+template
   transaction needs an explicit **port-allocation table**.
4. **Instruction budget.** MSHS-2's verifier is instruction-heavy; placing the full MASH verifier
   inside every Omnia channel update would blow the KISSVM budget and is explicitly **not**
   recommended. MASH's strongest role is on-chain **capital control and settlement authorization**
   (OPEN and CLOSE), not the high-frequency UPDATE path.
5. **State encoding.** MASH state and Omnia state must use one canonical encoding; a composite
   must not silently reinterpret a port. Confirm canonicalization at composition.

### 5.3 Required rules

- **R-MASH-1:** MASH state MUST live inside the MSHS band (≥234); no other package may allocate
  there.
- **R-MASH-2:** Omnia's variable-length bands (party shares, etc.) MUST be allocated within a
  registered **sub-234** range, driven by a per-coin-class port registry (see RFC-048 §12.6); the
  current `200+k` base yields only 34 slots and SHOULD be relocated lower. **Model A imposes no
  cap** — a cap exists only for same-coin (Model B) composites.
- **R-MASH-3:** No `SAMESTATE` range may span the MSHS band.
- **R-MASH-4:** Any composite (MASH + Omnia + MAST) transaction MUST publish a port-allocation
  table and pass an instruction-budget check.
- **R-MASH-5:** Omnia scripts MUST NOT embed the full MASH verifier in the update path; MASH
  authorization belongs at funding (OPEN) and settlement (CLOSE) boundaries.

Phase 0 must confirm the **exact** MSHS range endpoints and produce a machine-checked port
registry (extending the custody gate lineage) for composite scripts.

### 5.4 What MAST/MASH do — and do not — add to party count

| Per party | Where it lives | MAST | MASH |
|---|---|---|---|
| Authorization / static terms | script (MAST branches) — scales | **yes** | authorization branch only |
| Mutable balances / shares | state ports, unless a committed set-root | no | no (same-coin it *consumes* 234–255) |

- **MAST** adds real flexibility to the **participant/authorization** count: per-party escape/close
  branches scale in script space at ~zero port cost (`MULTISIG(N keys)` already does this).
- **MASH** adds **none**: it is an authorization branch and, same-coin, reserves 234–255.
- **Balances require a committed set-root** (Merkle/MMR) to scale — the VTXO batch root already
  commits the holder set at `STATE(100)`; the factory SHOULD adopt the same.

**Non-removal custody constraint (normative).** Any committed-set encoding MUST preserve
**per-holder non-removal** — a holder's entitlement cannot be reduced or removed without that
holder's signature — **and** a timelocked, operator-independent on-chain exit; otherwise it is
custodial/trust-minimised and fails the RFC-039 gate. The current all-holders
`MULTISIG(operator + holders)` update satisfies non-removal but **does not scale**; scaling requires
**per-leaf authorization** (accumulator / sparse tree). Here *"chain of custody"* means the
**verification chain** of state commitments and proofs — **not** a custodian holding funds. See
RFC-048 §12.5.

**Code gap (tracked).** `omnia-vtxo`/`omnia-factory` currently bound the party count only from below
(`holders.length < 1`, `participants.length < 2`) and can emit ports ≥234; relocate the share base
below the MSHS floor with an explicit upper bound and add the `check-state-ports` gate (RFC-048
§12.6/§12.8).

---

## 6. The shared contract: `EefiCapitalAgreement`

Rather than a new Omnia package per product, a shared contract binds MASH funding authorization
to Omnia execution terms and settlement rights:

```ts
interface EefiCapitalAgreement {
  version: 'eefi-capital/v1';
  termsHash: string;                       // MUST be bound where enforcement occurs, not just stored
  funding: {
    mashPolicyRoot: string;
    allowedProgramHash: string;
    assetId: string;
    maxAmountAtoms: string;
    counterparties?: string[];             // OPTIONAL — absent ⇒ open to anyone (permissionless)
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
```

`termsHash` MUST be committed wherever enforcement depends on it (funding script hash, channel
program, payout covenant) — not merely recorded in metadata.

---

## 7. Eefi product generations

- **Gen 1 — Capital control & autonomous liquidity:** Autonomous Treasury; Conditional Liquidity
  Corridors; Private RFQ Exchange; Term Liquidity Leasing; Machine Prepaid Accounts. Channels,
  HTLCs, routing, factories and MASH-governed funding already supply the structure (VTXOs not
  required). Highest-value: **just-in-time conditional liquidity** — bounded tranches deploy only
  when signed trade terms, reservations and funding constraints are satisfied.
- **Gen 2 — Credit & productive-asset finance:** Machine Credit Lines; Streaming Revenue Finance;
  Machine Receivables Financing. Physical productivity generates cryptographic evidence → ties
  proof-backed repayment to real devices. Meter attestations establish provenance, not independent
  truth; fraud handling and recoverable collateral are required.
- **Gen 3 — Derivatives & structured products:** Collateralized Forwards; Options; Parametric
  Coverage; Senior/Junior LP Tranches; Interest-Rate Swaps; Cash-Settled Futures. MASH can supply
  multiple committed authorization/recovery branches, but derivative math, margin, price discovery,
  collateralization and liquidation remain **Eefi**, not Omnia.

A fully collateralized, fixed-expiry **option** is the natural first derivative — but the buyer
MUST have an executable exercise right that does **not** require the writer to cooperate at
exercise time (Omnia's both-signed settlement branch cannot be assumed to provide this).

---

## 8. What RFC-048 already flags as missing (statuses)

| Requirement | RFC-048 status | MASH × Eefi relevance |
|---|---|---|
| Channel funding & VM-valid transitions | Partial | Binding funded capital to approved terms |
| Co-signed closes & recovery | Partial | Loan repayment / derivative settlement |
| Capital reservation / anti-double-allocation | Partial | Just-in-time credit, RFQ |
| Signed bilateral financial quotes | Partial | Forwards / swaps |
| Trusted oracle observation policy | New | Price-linked / parametric payouts |
| On-chain-verifiable condition witnesses | Partial | Non-cooperative condition claims |
| Enforceable collateral bonds | New execution | Secured lending & loss recovery |
| LP backing & exact withdrawal entitlement | Partial | Trustworthy structured yield |

Two implementation details called out by RFC-048 remain load-bearing here: (a) Omnia's program
injection is predominantly **update-path** logic — a credit/derivative program must not assume its
predicates constrain the final **settlement payout**; (b) composite state-port/instruction checks
(§5).

---

## 9. First integration test (the decisive one)

```
MASH treasury → conditional Omnia funding → repeated channel updates →
counterparty disappears → unilateral close using the agreed recoverable state →
proceeds returned to a MASH vault → independent balance reconciliation
```

Plus adversarial cases: funding rejected outside the agreed terms; a splice that preserves the
recovery right; a settlement whose payout can only reach the committed beneficiaries.

---

## 10. Explicit deferrals

Derivative mathematics, margin engines, price discovery, collateral ratios, liquidation auctions,
interest models, AMMs, netting and insurance are **Eefi**, not Omnia and not this RFC. A
`@totemsdk/mash` package is deferred (node capability consumed via existing seams). Full
MASH-aware Omnia contracts (Model B) are deferred behind Model A validation. Gen 3 products are
deferred behind Gen 1–2 gates and RFC-048's oracle/collateral work.

---

## 11. Open questions

1. Exact MSHS-2 port range endpoints and the machine-checked composite port registry (§5).
2. Mandate representation: does a MASH root bind into `authority`/`agent-policy` mandates, or a
   new `identity` subpath? (Prefer reuse.)
3. `termsHash` binding: which scripts/covenants must commit to it (funding, program, payout,
   recovery) for Model A vs Model B?
4. Just-in-time conditional liquidity: which reservations are hashlock-committed vs need
   bilateral credit limits (§ RFC-048 OMP-13)?
5. MASH-root lifecycle in a channel: one root per channel-open, or per capital tranche — and how
   does retirement interact with an already-funded channel?
6. Unilateral recovery: which settlement covenant makes the promised exit executable without the
   counterparty (the gating question for Gen 4+ products)?

---

**Bottom line.** MASH is not "another signature on a channel". It makes the **economic rights
surrounding an Omnia channel** precise, conditional, independently enforceable and recoverable —
at the capital boundaries (OPEN/CLOSE) — while Omnia stays a permissionless execution substrate
and Eefi supplies the product economics. The hard engineering constraints are the **state-port
partition** (§5) and keeping MASH out of the high-frequency update path.
