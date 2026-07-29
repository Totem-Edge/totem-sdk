# Totem Governance & Authority — Green Paper

**How devices, fleets, and institutions delegate authority, enforce policy, and govern themselves — from simple mandate chains to quadratic-voting DAOs, all modular, all composable, all cryptographically provable.**

**Version:** 1.0
**Date:** 2026-07-28
**Status:** Active

---

## Table of Contents

1. [The Control Plane](#1-the-control-plane)
2. [Authority: The Deterministic Kernel](#2-authority-the-deterministic-kernel)
3. [Recursive MAST: The Policy Coordination Layer](#3-recursive-mast-the-policy-coordination-layer)
4. [Governance: The Collective Decision Layer](#4-governance-the-collective-decision-layer)
5. [Agent Policy: The AI Seam](#5-agent-policy-the-ai-seam)
6. [How They Compose](#6-how-they-compose)
7. [Real-World Governance Examples](#7-real-world-governance-examples)
8. [The Modularity Principle](#8-the-modularity-principle)

---

## 1. The Control Plane

Every payment network needs a control plane. Who is allowed to spend? How much? To whom? Under what conditions? Who can change the rules? Who can revoke access?

In traditional finance, these questions are answered by legal contracts, compliance departments, and manual approval workflows. In Eefi — where devices make autonomous payments at machine speed — they must be answered by code. Cryptographic code. Deterministic code. Code that a regulator can audit, a counterparty can verify, and a device can execute without phoning home to a human.

The Totem Governance & Authority stack is that control plane. It spans four packages, each solving one layer of the problem:

| Package | Question It Answers | Analogy |
|---------|-------------------|---------|
| `@totemsdk/authority` | Is this specific action authorised? | The security guard at the door checking your ID badge |
| `@totemsdk/recursive-mast` | What is the policy tree that defines who can do what? | The company org chart and policy manual |
| `@totemsdk/governance` | How does the collective decide to change the rules? | The board of directors voting on a new policy |
| `@totemsdk/agent-policy` | Can an AI agent propose this action? | The executive assistant who can book travel but can't sign cheques |

**These packages are modular. You use only what you need.** A single device with one operator needs only `authority` — a simple mandate from the operator to the device. A fleet of 10,000 devices across 50 jurisdictions needs the full stack. A DAO of device operators needs `governance`. An AI-managed device fleet needs `agent-policy`. You compose them like building blocks, not like a monolith.

---

## 2. Authority: The Deterministic Kernel

`@totemsdk/authority` is the simplest and most fundamental package in the stack. It answers exactly one question:

> Given a mandate, an action, and a usage history — is this action authorised?

It is a **pure function**. No network calls. No database writes. No blockchain queries. Same inputs always produce the same decision. This is critical for auditability — an auditor can replay every decision and verify it independently.

### 2.1 Mandates: Cryptographic Permission Slips

A mandate is a WOTS-signed delegation from a grantor to a grantee, scoped to a principal. Think of it as a permission slip:

```typescript
const mandate = {
  grantor: 'MxFLEET_OWNER...',     // who delegated the authority
  grantee: 'MxINVERTER_7...',      // who received it
  principal: 'MxINVERTER_7...',     // who it applies to
  scope: 'payment:send',            // what actions are allowed
  constraints: [
    { field: 'amount', operator: 'lte', value: '100' },      // max 100 MIN per tx
    { field: 'recipient', operator: 'in', value: ['MxMAINT...', 'MxGRID...'] }
  ],
  usageLimit: {
    maxCount: 10000,                // lifetime transaction cap
    maxTotal: '500000',             // lifetime amount cap
    windowMs: 86400000,             // 24-hour rolling window
  },
  issuedAt: Date.now(),
  expiresAt: Date.now() + 90 * 86400000,  // 90 days
};
```

When Inverter 7 wants to send 5 MIN to the maintenance contractor, the authority engine checks every field:

1. **Is the mandate valid?** WOTS signature verified against the grantor's public key.
2. **Is the grantor authorised to delegate?** The grantor must be the principal's root address, controller address, or a delegate with `*` or `authority:grant` scope on the principal's identity graph.
3. **Does the scope match?** `payment:send` matches the action. Scopes are colon-delimited with wildcard support — `payment:*` matches `payment:send`, `payment:receive`, etc.
4. **Are the constraints satisfied?** 5 MIN ≤ 100 MIN. Recipient is in the allowed list.
5. **Has the usage limit been exceeded?** 2,341 of 10,000 lifetime transactions used. 45,000 of 500,000 lifetime amount used. 12 of 100 in the current 24-hour window.
6. **Has the mandate expired?** Issued 30 days ago, expires in 60 days.

All checks pass. The action is authorised. The decision is deterministic — anyone with the same inputs can verify it independently.

### 2.2 Delegation Chains

Authority flows through chains. The fleet owner delegates to the site controller. The site controller delegates to the device. The device delegates to a hot key for day-to-day operations. Each link is a WOTS-signed mandate. The authority engine walks the chain and verifies every link.

```
Fleet Owner ──mandate──→ Site Controller ──mandate──→ Inverter 7 ──mandate──→ Hot Key
   (root)        (scope: *)     (scope: payment:send)    (scope: payment:send, max 10 MIN)
```

The hot key can send payments up to 10 MIN. It cannot change the inverter's manifest. It cannot delegate further. Its authority is precisely scoped.

### 2.3 Revocation

Mandates can be revoked in two ways:

**Individual revocation:** The grantor issues a revocation for a specific mandate ID. The authority engine checks a `MandateStatusSnapshot` that includes a `revocationEpochs` map.

**Principal-wide epoch invalidation:** The grantor advances the principal's epoch. All mandates issued at earlier epochs become invalid. This is the "emergency brake" — one operation revokes every mandate for a compromised device.

### 2.4 Usage Tracking

Every authorised action produces a usage record. The authority engine tracks cumulative count and amount, with optional sliding time windows. A mandate that allows 100 transactions per day will be rejected on the 101st attempt within the window.

Usage records are content-addressed and Merkle-provably linked to their mandates. An auditor can verify that every action was authorised by a valid mandate and that no mandate exceeded its usage limits.

### 2.5 What Authority Does NOT Do

Authority does not store state. It does not manage identity graphs (it receives an `IdentityResolver` as input). It does not issue mandates (it only verifies them). It does not record decisions (it returns them for the caller to store). It is a pure verification kernel — the simplest possible component that can be composed into larger systems.

---

## 3. Recursive MAST: The Policy Coordination Layer

If authority answers "is this specific action allowed?", recursive MAST answers "what is the policy that defines what is allowed?" It is the policy coordination layer — the system that defines, distributes, verifies, and enforces the rules.

### 3.1 The 7-Layer Policy Stack

The canonical policy structure for any device is a 7-layer hierarchy. Each layer is maintained by a different authority. Each layer can be updated independently. Each layer is a separate MAST subtree with its own Merkle root.

```
Asset Root        → "This is a genuine SolarTech Inverter, model ST-3600"
Manufacturer      → "Manufactured by SolarTech GmbH, certified ISO 9001"
Product/Model     → "Model ST-3600, firmware v3.2.1, max output 3.6kW"
Regulatory        → "Certified by TÜV Rheinland, compliant with EU Grid Code 2024"
Owner/Fleet       → "Operated by GreenEnergy FleetCo, policy root #42"
Site              → "Installed at Solar Farm Brandenburg, Section C, Row 7"
Operator          → "Operated by Technician Müller, credential #T-8872"
Action            → "Sell power at €0.12/kWh, max 3.6kW, 06:00-22:00 only"
```

**This is modular.** A single device operated by its owner needs only the Owner and Action layers. A regulated device in a factory needs all 7. A prototype in a lab needs none. You add layers as your governance requirements grow.

### 3.2 MAST: Why It Matters

MAST (Merkle-ized Abstract Syntax Tree) compiles a set of KISSVM scripts into a Merkle tree. A transaction only needs to include the specific script being executed and its Merkle proof — not the entire policy. This has three critical properties:

**Privacy:** Inactive policy branches remain hidden. A transaction that executes the "normal payment" branch reveals nothing about the "emergency shutdown" or "regulatory override" branches.

**Efficiency:** A device only downloads the branch capsules relevant to its role. Inverter 7 needs the Site and Operator layers. It does not need the Manufacturer or Regulatory layers. The counterparty only needs the specific branch being executed.

**Upgradeability:** Individual layers can be updated without changing the entire policy. The manufacturer can update the firmware version. The regulator can update the compliance standard. The fleet owner can rotate the operator. Each update is a new Merkle root for that layer.

### 3.3 PREVSTATE: State That Survives Transactions

Minima's `PREVSTATE(port)` opcode reads the previous transaction's state variable. This enables stateful contracts — rules that depend on what happened before.

`recursive-mast` provides ready-to-use PREVSTATE templates:

| Template | What It Tracks | Example |
|----------|---------------|---------|
| Counter | How many times has this action occurred? | "This device has sent 47 of 100 allowed payments" |
| Vesting | How much has been released over time? | "340 MIN of 1,000 MIN vested, 120 MIN previously claimed, 220 MIN claimable now" |
| Timelock | Has enough time passed? | "No payments before block 500,000" |
| State machine | What state are we in? | "OFF → ON → OFF transitions only" |
| Round-based | Whose turn is it? | "Player 1's turn, round 3 of 10" |

### 3.4 Cross-Domain Trust

A device manufactured in Germany, certified by TÜV, operated by a Dutch fleet owner, selling power to a Japanese customer — how does each party verify the others' authority?

Cross-domain trust bridges solve this. One policy space can accept proofs from another. The Japanese customer's wallet verifies that the German inverter's TÜV certification is valid because the EU regulatory policy root is cross-signed by a bridge authority that the Japanese regulatory space trusts.

```
EU Regulatory Space                    Japanese Regulatory Space
        │                                        │
        │  cross-domain bridge                   │
        └────────────┬───────────────────────────┘
                     │
              Mutual recognition
              "I accept proofs from your policy roots"
```

### 3.5 Policy Distribution

Policies are not stored on-chain. Only the policy root (a 32-byte hash) is committed on-chain. The full policy material — scripts, proofs, manifests, branch capsules — is distributed off-chain through federated repositories.

Each authority maintains its own subtree material. The manufacturer maintains the product layer. The regulator maintains the compliance layer. The fleet owner maintains the operator layer. No single repository holds everything. This is federated governance — each authority controls its own data.

Branch capsules are self-contained packages that a counterparty can download and verify independently. A capsule includes the script, its Merkle proof against the policy root, the publisher's signature, and validity window metadata.

### 3.6 Policy Signing Sessions

When a multi-party policy action requires signatures from multiple authorities, a signing session coordinates the process:

```
draft → resolving → awaiting-evidence → awaiting-signatures → ready → submitted → confirmed
```

The coordinator is not trusted. Every signer independently verifies the transaction, the policy path, and the evidence before signing. The coordinator only facilitates the workflow — it cannot forge signatures or alter the transaction after signers have approved it.

---

## 4. Governance: The Collective Decision Layer

Authority answers "can this device do this action?" Governance answers "should this device be allowed to do this action in the first place?" It is the layer where collectives — DAOs, cooperatives, fleet operators, regulatory bodies — make decisions that become machine-enforceable rules.

### 4.1 Three Voting Algorithms, Pick One

`@totemsdk/governance` provides three voting algorithms. **You choose one. You are not required to use all three. You are not required to use any of them.** A single-operator fleet can skip governance entirely and use only authority mandates.

| Algorithm | How It Works | Best For |
|-----------|-------------|----------|
| **Linear** | 1 weight = 1 vote. Simple majority. | Small teams, co-ops, quick decisions |
| **Quadratic** | Cost = votes². 3 votes cost 9 credits. Sqrt-weighted tally. | Large DAOs, preventing whale dominance |
| **Liquid** | Delegate your vote to someone you trust. Recall anytime. | Busy operators, expert delegation |

**Linear voting** is the simplest. Each member's voting weight is their stake or membership weight. A proposal passes if yes votes exceed the threshold. This is what most DAOs use. It works well for small, aligned groups.

**Quadratic voting** protects minorities. A whale with 10,000 tokens can cast 100 votes (costing 10,000 credits) while a small holder with 100 tokens can cast 10 votes (costing 100 credits). The whale has 100× the tokens but only 10× the voting power. This prevents a single large fleet operator from dominating every decision.

**Liquid democracy** lets operators delegate their votes to experts. A small solar farm operator who doesn't have time to evaluate every proposal can delegate to a trusted industry association. They can recall the delegation at any time. They can delegate on treasury proposals but vote directly on device additions. Delegation chains can be multi-hop with configurable maximum depth.

### 4.2 The Proposal Lifecycle

```
draft → active → passed/failed → executed
                 ↓
              cancelled (by proposer)
              expired (voting period ended without quorum)
```

**Draft:** The proposer creates a proposal with one or more actions. Actions can be: `rotate_root` (update a policy root), `treasury_spend` (release funds), `member_add` / `member_remove` (change DAO membership), `policy_update` (change governance parameters), or `custom` (anything).

**Active:** After a configurable delay, voting begins. Members cast votes during the voting period.

**Passed/Failed:** At the end of the voting period, votes are tallied. If quorum is reached and the pass threshold is met, the proposal passes. Otherwise it fails.

**Executed:** After a configurable execution delay (giving time for challenges), the proposal's actions are executed. Each action produces a mandate that the authority engine can enforce.

### 4.3 The Mandate Bridge

This is the critical integration point between governance and authority. When a governance proposal passes, `createGovernedMandate()` produces an authority-compatible `MandateBody`:

```typescript
const mandate = createGovernedMandate(outcome, action, 0, governanceIdentity, executor, {
  membershipSnapshotHash: 'sha3:abc123...',
  voteTallyHash: 'sha3:def456...',
  outcomeProofId: 'totem:proof:789...',
});
```

The resulting mandate includes 6 constraint fields that cryptographically bind the execution to the specific proposal, action, membership snapshot, vote tally, and outcome proof. The authority engine verifies all of them. A rogue executor cannot claim "the DAO told me to" without a valid mandate that traces back to a specific passed proposal with a verified vote tally.

### 4.4 Event-Sourced Governance

Governance is not just voting. It is an append-only event log: `policy_published`, `mandate_issued`, `mandate_revoked`, `approval_granted`, `authority_decision_recorded`, `usage_recorded`, `appeal_opened`, `ruling_issued`, `checkpoint_created`.

The event log can be replayed to reconstruct the entire governance state at any point in time. Periodic checkpoints anchor the state hash to Minima L1 via Integritas, providing a tamper-evident constitutional anchor. If a dispute arises, the L1 checkpoint proves what the governance state was at a specific block height.

### 4.5 What Governance Does NOT Require

- **You do not need a DAO.** A single operator can issue mandates directly without any governance process.
- **You do not need quadratic voting.** Linear voting is simpler and works for small groups.
- **You do not need liquid democracy.** Direct voting is the default.
- **You do not need on-chain execution.** Governance events can be off-chain with L1 anchoring for constitutional truth.
- **You do not need Omnia.** Governance decisions that have no economic effect (policy updates, member changes) don't touch the payment network.

---

## 5. Agent Policy: The AI Seam

`@totemsdk/agent-policy` is the interface between AI agents and wallets. It is the thinnest package in the stack — pure types, zero dependencies, language-agnostic via Protobuf.

### 5.1 The QVAC Pipeline

QVAC is Tether's decentralised AI framework — an external inference engine that can observe on-chain and off-chain data, reason about it, and construct proposals. The pipeline is:

```
QVAC proposes → agent-policy evaluates → Totem signs → Minima settles
```

**QVAC proposes:** The AI agent observes market conditions, device telemetry, or user behaviour. It constructs an `AgentProposal` — a structured intent describing what it wants to do: send a payment, open a channel, adjust pricing.

**Agent-policy evaluates:** The proposal hits the policy chokepoint. A developer-supplied `AgentPolicy` evaluates it and returns one of three outcomes:
- `approved` — within bounds, execute automatically
- `rejected` — violates policy, block it
- `requires_human` — needs human review, show a prompt

**Totem signs:** If approved, the wallet builds the transaction and signs it with the device's WOTS key.

**Minima settles:** The transaction is broadcast and mined.

### 5.2 The Critical Property

**QVAC never touches a private key.** It proposes. It observes. It reasons. But it cannot sign. The `AgentPolicy` is the gate. If the policy says no, no transaction is built. This is the fundamental separation that makes autonomous device operation safe: intelligence is external, but authority remains local.

### 5.3 Composable Policies — Runtime Implementation

Policies are plain TypeScript classes that implement the `PolicyMiddleware` interface. They evaluate an `AgentProposal` and return a `PolicyEvalResult` — a three-state outcome (`approved`, `rejected`, `requires_human`) with a human-readable reason string.

The `@totemsdk/agent-policy` package ships built-in middleware primitives and a `ComposablePolicy` class that chains them with short-circuit semantics (first rejection stops the pipeline):

```typescript
import {
  ComposablePolicy,
  RateLimitPolicy,
  AmountCapPolicy,
  RecipientAllowlistPolicy,
  TimeWindowPolicy,
  RiskThresholdPolicy,
} from '@totemsdk/agent-policy';

const policy = new ComposablePolicy([
  new RateLimitPolicy(10, 60_000),              // max 10 proposals/min
  new AmountCapPolicy({ perTx: '500', perDay: '2000' }),  // caps
  new RecipientAllowlistPolicy(['MxSupplier1', 'MxSupplier2']),
  new TimeWindowPolicy(TimeWindowPolicy.hour(6), TimeWindowPolicy.hour(22)),
  new RiskThresholdPolicy('medium'),             // low/medium OK, high→human
]);

const result = await policy.evaluate(proposal);
// { outcome: 'approved' | 'rejected' | 'requires_human', reason: string }
```

`ComposablePolicy` also implements the legacy `AgentPolicy` interface (`canAutoApprove` / `requiresUserApproval`), so it works as a drop-in for `@totemsdk/omnia`'s `executeIntent`. Custom middleware layers can be written by implementing `PolicyMiddleware.evaluate()`.

### 5.4 The Autonomy Spectrum

| Level | Description | Example |
|-------|-------------|---------|
| **Fully manual** | Every action requires human approval | Technician manually approves every payment |
| **Policy-automated** | Deterministic rules auto-approve within bounds | "Auto-pay up to 10 MIN to whitelisted recipients" |
| **QVAC-augmented** | QVAC proposes based on market data, policy gates execution | QVAC suggests dynamic pricing, policy enforces caps |
| **QVAC-driven** | QVAC manages complex workflows, policy acts as safety rails | QVAC orchestrates channel rebalancing across a fleet |

---

## 6. How They Compose

### 6.1 The Minimal Stack: One Device, One Operator

A single solar inverter operated by its owner. No DAO. No voting. No AI.

```
Operator ──mandate──→ Inverter 7
           (scope: payment:send, max 100 MIN/day)
```

**Packages needed:** `@totemsdk/authority` only. The operator issues a mandate. The inverter's edge runtime calls `evaluateAuthority()` before every payment. Done.

### 6.2 The Fleet Stack: Many Devices, One Operator

A fleet of 50 inverters operated by a single company. Hierarchical authority. No voting needed.

```
Fleet Owner ──mandate──→ Site Controller ──mandate──→ Inverter 1..50
   (root)        (scope: *)     (scope: payment:send, constraints)
```

**Packages needed:** `@totemsdk/authority` + `@totemsdk/recursive-mast`. The recursive MAST policy tree defines the 7-layer structure. The authority engine enforces mandates at each level.

### 6.3 The Cooperative Stack: Many Operators, Shared Governance

A solar cooperative with 200 member-operators. They vote on fee changes, device additions, and treasury spends.

```
Cooperative DAO ──governance vote──→ Mandate ──authority──→ All 200 inverters
```

**Packages needed:** `@totemsdk/authority` + `@totemsdk/recursive-mast` + `@totemsdk/governance`. Members vote via quadratic voting. Passed proposals produce mandates via the mandate bridge. All inverters enforce the new rules.

### 6.4 The Autonomous Stack: AI-Managed Fleet

A fleet of 10,000 delivery robots managed by QVAC agents. The agents optimise routes, negotiate charging prices, and schedule maintenance. The policy layer ensures they never exceed their authority.

```
QVAC Agent ──proposal──→ Agent Policy ──approved──→ Authority ──authorised──→ Robot
```

**Packages needed:** All four. `agent-policy` gates QVAC proposals. `authority` enforces mandates. `recursive-mast` defines the policy tree. `governance` lets the fleet operator update rules.

### 6.5 The Full Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    GOVERNANCE LAYER                          │
│  @totemsdk/governance                                       │
│  Quadratic voting · Liquid democracy · Proposal lifecycle   │
│  Mandate bridge · Event log · L1 checkpoint anchoring       │
├─────────────────────────────────────────────────────────────┤
│                    POLICY COORDINATION LAYER                 │
│  @totemsdk/recursive-mast                                   │
│  7-layer policy stack · MAST compilation · PREVSTATE        │
│  Cross-domain trust · Migration paths · Signing sessions    │
│  Branch capsules · Federated storage · Availability audit   │
├─────────────────────────────────────────────────────────────┤
│                    AUTHORITY LAYER                           │
│  @totemsdk/authority                                        │
│  Mandate verification · Scope matching · Constraint checks   │
│  Usage tracking · Delegation chains · Revocation            │
│  Pure deterministic evaluation · Content-addressed IDs      │
├─────────────────────────────────────────────────────────────┤
│                    AI SEAM                                   │
│  @totemsdk/agent-policy                                     │
│  QVAC proposal evaluation · Composable policy middleware    │
│  Language-agnostic Protobuf schema · Zero dependencies      │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Real-World Governance Examples

### 7.1 The Single Device: A Home Battery

Alice installs a home battery. She wants it to buy power when prices are low and sell when prices are high. She issues one mandate:

```
Grantor: Alice's root address
Grantee: Battery's hot key
Scope: payment:send
Constraints: max 50 MIN per transaction, only to grid operator address
Usage limit: 100 transactions per day
```

The battery's edge runtime calls `evaluateAuthority()` before every trade. No governance. No voting. No policy tree. One mandate. Done.

### 7.2 The Factory Floor: Regulated Industrial Equipment

A pharmaceutical manufacturer operates 200 machines across 3 sites in 2 countries. Each machine must comply with FDA regulations, EU GMP standards, and corporate safety policies.

**The 7-layer policy stack:**

1. **Asset:** Each machine's unique identifier and serial number
2. **Manufacturer:** Siemens certified the machine
3. **Product:** Model X-2000, firmware v4.1
4. **Regulatory:** FDA 21 CFR Part 11, EU GMP Annex 11
5. **Owner:** PharmaCorp, policy root #17
6. **Site:** Building 3, Clean Room B, Singapore
7. **Operator:** Technician Chen, GMP certification #C-4421

When Technician Chen initiates a batch process, the machine verifies all 7 layers. The FDA auditor can verify the same 7 layers independently. If the EU updates GMP Annex 11, only the Regulatory layer changes — the other 6 layers remain valid.

### 7.3 The Cooperative: Community Solar Farm

A community solar farm with 200 member-investors. They vote on electricity prices, maintenance budgets, and new member admissions.

**Governance setup:**
- Voting algorithm: Quadratic (prevents the largest investor from dominating)
- Quorum: 20% of total voting weight
- Pass threshold: 60%
- Voting period: 7 days
- Execution delay: 2 days (time for challenges)

**A proposal in action:**
1. Member proposes: "Increase per-kWh price from €0.12 to €0.15"
2. 7-day voting period begins
3. 85 members vote. Largest investor casts 10 votes (costing 100 credits). Small investor casts 3 votes (costing 9 credits).
4. Tally: 62% yes, 38% no. Quorum reached (42%). Threshold met (62% > 60%). Proposal passes.
5. 2-day execution delay. No challenges filed.
6. `createGovernedMandate()` produces a mandate: "All inverters: update max price to €0.15/kWh"
7. All 200 inverters receive the mandate. Their authority engines verify it. The new price takes effect.

### 7.4 The Autonomous Fleet: QVAC-Managed Delivery Robots

A logistics company operates 500 delivery robots. QVAC agents optimise routes, negotiate charging prices at public stations, and schedule preventive maintenance. The company's policy layer ensures the agents never exceed their authority.

**Agent policy:**
```typescript
const robotPolicy = {
  async evaluate(proposal) {
    // Never pay more than €0.50/kWh for charging
    if (proposal.intent.type === 'payment' && proposal.intent.reason === 'charging') {
      if (parseFloat(proposal.intent.amount) > 0.50) {
        return { outcome: 'rejected', reason: 'Charging price exceeds €0.50/kWh cap' };
      }
    }
    
    // Maintenance payments under €200 auto-approved
    if (proposal.intent.reason === 'maintenance' && parseFloat(proposal.intent.amount) <= 200) {
      return { outcome: 'approved', receipt: { ... } };
    }
    
    // Everything else requires human approval
    return { outcome: 'requires_human', prompt: `Approve ${proposal.intent.reason} payment of ${proposal.intent.amount}?` };
  },
};
```

The QVAC agent finds a charging station at €0.35/kWh. It proposes a payment. The policy auto-approves. The robot charges. The agent never touched a signing key.

### 7.5 The Regulatory Bridge: Cross-Border Medical Device

A medical device manufactured in Germany, certified under EU MDR, deployed in a Japanese hospital. The Japanese regulator requires proof of EU certification.

**Cross-domain trust bridge:**
1. The EU regulatory authority publishes a policy root for MDR-certified devices
2. The Japanese regulatory authority publishes a cross-domain bridge: "I accept proofs from EU MDR policy root #X"
3. The device's policy tree includes the EU Regulatory layer with a Merkle proof against root #X
4. The Japanese hospital verifies: device → EU MDR certified → Japanese bridge accepts EU MDR → device is compliant
5. If the EU updates MDR, only the EU Regulatory layer changes. The Japanese bridge still accepts the new root if it's signed by the same EU authority.

---

## 8. The Modularity Principle

The most important thing to understand about the Totem Governance & Authority stack is that **nothing is mandatory.** Every package is independent. Every feature is optional. You compose what you need.

| If you have... | You need... | You can skip... |
|---------------|------------|----------------|
| One device, one operator | `authority` | `recursive-mast`, `governance`, `agent-policy` |
| A fleet with hierarchical authority | `authority` + `recursive-mast` | `governance`, `agent-policy` |
| A cooperative that votes on decisions | `authority` + `recursive-mast` + `governance` | `agent-policy` |
| AI-managed devices | `authority` + `agent-policy` | `recursive-mast`, `governance` |
| A regulated industry with multi-jurisdiction compliance | `authority` + `recursive-mast` | `governance`, `agent-policy` |
| A fully autonomous DAO of AI-managed devices | All four | Nothing |

**You do not need quadratic voting.** Linear voting is simpler and works for small groups. You can even skip voting entirely and have a single operator issue mandates directly.

**You do not need the full 7-layer policy stack.** A single device needs only the layers relevant to its context. A prototype in a lab needs none. A regulated medical device needs all 7.

**You do not need on-chain governance.** Governance events can be off-chain with periodic L1 checkpoints for constitutional anchoring. Only disputes or financial settlements need to touch the blockchain.

**You do not need QVAC.** Agent policy is optional. A fleet can operate entirely on deterministic mandates without any AI involvement.

The stack is a toolbox, not a framework. Pick the tools you need. Leave the rest.

---

## Appendix: Package API Reference

### `@totemsdk/authority`

| Function | Purpose |
|----------|---------|
| `evaluateAuthority(params)` | Pure evaluation: does this action have authority? |
| `verifyMandate(mandate, resolver, now)` | Full mandate verification |
| `matchScope(action, scope)` | Wildcard scope matching |
| `matchConstraints(action, constraints)` | Field-level constraint matching |
| `checkUsageLimit(snapshot, limit, now)` | Usage limit enforcement |
| `createAgentMandate(params)` | Build a MandateBody |
| `computeActionIntentId(intent)` | Deterministic intent ID |
| `computeMandateId(mandate)` | Deterministic mandate ID |

### `@totemsdk/recursive-mast`

| Function | Purpose |
|----------|---------|
| `buildPolicyTree(nodes)` | Build hierarchical policy tree |
| `buildLayeredPolicy(config)` | Build 7-layer policy with MAST proofs |
| `buildDelegationChain(links)` | Build authority delegation chain |
| `buildCrossDomainBridge(source, target)` | Build cross-domain trust bridge |
| `buildMigrationPath(steps)` | Build upgradeable policy migration path |
| `buildPolicyAnchorScript(config)` | Build KISSVM anchor coin script |
| `createSigningSession(config)` | Coordinate multi-party policy signing |
| `auditPolicyAvailability(config)` | Audit policy material availability |

### `@totemsdk/governance`

| Function | Purpose |
|----------|---------|
| `createProposal(params)` | Create a governance proposal |
| `createVote(params)` | Cast a linear vote |
| `createQuadraticVote(params)` | Cast quadratic votes |
| `createDelegation(params)` | Delegate voting power |
| `resolveDelegation(memberId, daoId)` | Resolve delegation chain |
| `tallyVotes(params)` | Tally votes with quorum check |
| `createGovernedMandate(outcome, action)` | Bridge governance to authority mandate |
| `executeProposal(proposal, tally)` | Execute passed proposal actions |

### `@totemsdk/agent-policy`

| Export | Purpose |
|--------|---------|
| `AgentProposal` | Structured AI agent intent |
| `AgentPolicy` (interface) | Policy evaluator — `evaluate(proposal) → PolicyDecision` |
| `AgentReceipt` | Cryptographically linkable audit record |
| `PaymentIntent` | What the agent wants to pay and why |

---

*The Totem Governance & Authority Green Paper. Modular, composable, cryptographically provable — the control plane for the machine economy.*
