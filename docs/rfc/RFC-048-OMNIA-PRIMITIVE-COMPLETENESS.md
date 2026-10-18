# RFC-048 — Omnia Primitive Completeness & SDK Reuse

Status: Draft — proposed specification (not yet reviewed for implementation)
Created: 2026-10-16
Authors: Totem SDK Contributors
Depends on: RFC-007 (Storage), RFC-012 (Decision), RFC-014 (Wallet/Connect), RFC-017 (Decision Receipt Graph), RFC-019 (Governed Commerce), RFC-021–023 (Industrial/Physical), RFC-034/035 (Relay + Peer Coordination), RFC-038/039 (VTXO + Custody)
Touches (proposed): `@totemsdk/omnia`, `@totemsdk/omnia-*` (reuse-first across the SDK)

> **Numbering.** `RFC-040`–`046` belong to the Canary repository, and `RFC-047` is the
> Experience Spine. This document is therefore **`RFC-048`**. (The original working draft used
> `RFC-040`; renumbered to avoid a cross-repo collision.)

> **Completeness of this copy.** This is the **architecture, reuse decisions and completion
> gates** of the draft. The canonical detailed document — *28 primitive requirements, 16 safety
> invariants, 18 conformance scenarios, proposed TypeScript interfaces, a full package reuse
> index, and a phased implementation roadmap* — is a separate attachment and is **not included
> here**. Add it before this RFC is reviewed for implementation.

---

## 1. Purpose

Define what "complete" means for the Omnia primitive family, and how much of it can be achieved
by **reusing** the rest of the SDK rather than adding new Omnia machinery.

> **Central design rule.** Reuse the other SDK packages wherever they already provide a sound
> abstraction. Only extend Omnia for capabilities genuinely belonging to **multiparty financial
> state, capital movement and settlement**.

At the reviewed snapshot the SDK has **64 publishable packages**. (The original draft said 65;
the current manifest total is 64.)

---

## 2. What "complete" means — eight questions

Completeness is defined around eight questions. The SDK answers substantial parts of 1, 4 and 5
and has components for the others, but does not yet **demonstrate all eight together**.

1. Can participants discover one another and establish **authenticated economic relationships**?
2. Can they agree to **precise, binding terms**?
3. Can they **prove sufficient funds and reserve them** against concurrent commitments?
4. Can they **execute programmable transfers and conditions** safely?
5. Can they **verify external facts** without blindly trusting a single publisher?
6. Can they **settle, dispute and independently recover funds**?
7. Can they **reconcile every change in economic ownership against the underlying capital**?
8. Can all of this **survive device crashes, malicious peers and network partitions**?

---

## 3. Principal reuse decisions

| Required capability | Reuse from the SDK | What we add |
|---|---|---|
| Verifiable oracle observations | `proof`, `proofgraph`, `identity`, `manifest`, `lookup-*`, `storage` | Feed semantics, quorum, aggregation, freshness, financial guardrails |
| Economic negotiation and signed RFQs | `edge` purchasing/negotiation, `authority`, `agent-policy` | Financial quote profile, executable terms, reservation binding |
| Financial contracts | `kissvm`, `recursive-mast`, `omnia` | Financial covenant templates and cross-package conformance |
| Settlement truth | `chain-provider`, `server`, `tx-builder`, `txpow`, `realtime` | Uniform finality evidence and reconciliation lifecycle |
| Liquidity ownership and accounting | `liquidity-bond`, `omnia-pool`, `storage` | Enforceable accounting invariants and confirmed payouts |
| Bonds, obligations and recovery | `provider-bond`, `statechain`, `omnia`, `kissvm` | Real collateral locking, claim conditions and recovery execution |
| Automated financial decisions | `decision`, `intelligence`, `qvac`, `agent-policy` | Financial risk rules kept deterministic and mandatory |
| Edge-native transport | `pear`, `pubsub-transport`, `stream-transport`, `lookup-*`, `omnia-relay` | Private forwarding, robust multi-peer coordination |

**Two high-value reuse discoveries (verified in-repo):**

- `@totemsdk/edge` **purchasing** already implements role-neutral **signed trade proposals**
  (WOTS signature over the canonical proposal digest), **immutable trade agreements**, negotiation
  **expiry** (`expiresAt`), counterproposal linking and durable message-delivery semantics →
  specialize this for **financial RFQs** rather than introduce a second exchange-negotiation stack.
- `@totemsdk/proof` already supports **signed attestations** (`SignedProof`), and
  `@totemsdk/proofgraph` supports **provenance, conflicting evidence, revocation and durable
  evidence storage** (`derived_from`, `supports`, `contradicts`, `revokes`, `conflicts_with`,
  `supersedes`, `references`) → this substantially reduces the work for an oracle protocol.

---

## 4. The six completion gates

| Gate | What must be demonstrated |
|---|---|
| **G0 — Bilateral custody** | Two independent peers can move and recover funds correctly |
| **G1 — Distributed payments** | Safe routing, factories, splicing and failure recovery |
| **G2 — Private exchange** | Signed RFQs bound to reserved liquidity and executable settlement |
| **G3 — Verifiable conditions** | Trusted oracle observations triggering programmable financial actions |
| **G4 — Productive liquidity** | Actual LP funds, enforceable claims, verified fees and payouts |
| **G5 — VTXO extensions** | Transferable ownership and unilateral exits under adversarial conditions |

**G5 is deliberately optional.** A meaningful private, edge-native exchange does not require
VTXOs as a prerequisite.

---

## 5. Architectural decisions to lock in

1. **Oracle evidence rests on `proof` + `proofgraph`.** Add only feed validation, publisher
   policies, freshness, aggregation and execution witnesses — not a new evidence graph.
2. **Reuse `edge`'s negotiation engine for signed financial RFQs.** Do not create a second
   negotiation protocol inside Omnia.
3. **Keep deterministic settlement and reserve enforcement in Omnia; keep financial *market
   rules* (lending, margin, liquidation, interest, AMMs) in Eefi.** Omnia settles; Eefi prices.
4. **Conformance evidence is a release requirement.** A package *exposing a function* is not the
   same as *demonstrating that independently hosted peers can safely execute it*.

---

## 6. First engineering milestone

**G0 — real custody, settlement and independent recovery — before extending the economic
feature set.**

---

## 7. Caveats

- This RFC is a **proposed document**, not a commit. Its findings are **source-level** until the
  specified conformance tests have been run.
- The detailed primitive requirements, invariants, conformance scenarios, proposed interfaces,
  reuse index and roadmap are held in the separate attachment (§ header note) and must be added
  before implementation review.
- Consistent with RFC-047's reuse-first philosophy: prefer extending an existing owner's
  abstraction (or documenting that the capability already exists) over adding a parallel one.
