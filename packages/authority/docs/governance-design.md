# `@totemsdk/governance` Design Plan

After reading the actual `@totemsdk/authority` implementation and its architecture note, the revised model:

> **`@totemsdk/governance` should be the stateful control plane around the pure `authority` engine. Governance should not live entirely on L1, and it should not be implemented primarily as an Omnia channel.**

The best design is:

```text
Signed off-chain governance event log
        │
        ├── materialized governance state
        ├── @totemsdk/authority evaluation
        ├── policy and approval workflows
        └── proofgraph projection
                 │
                 ▼
Periodic Minima L1 checkpoints
                 │
                 └── constitutional authority and enforceable outcomes

Optional Omnia integration
        └── payments, escrow, bonds and financial settlement
```

## 1. What `authority` actually is

The current package is version `0.1.1`. It depends directly on `@totemsdk/proof` and `@totemsdk/identity` and describes itself as a deterministic authority engine.

Its own boundary document is explicit:

* `authority` answers whether an action has verifiable authority;
* it does not determine whether a mandate should have been issued;
* it does not decide organizational policy;
* it does not choose appropriate limits.

It takes prepared inputs:

```typescript
evaluateAuthority({
  action,
  mandate,
  identityResolver,
  usageSnapshot,
  mandateStatus,
  evidence,
  policyVersion,
  now,
});
```

It then verifies the mandate, checks identity authority, matches scope and constraints, checks usage limits, and produces a deterministic decision plus a usage delta.

The output already has most of the right audit references:

```typescript
AuthorityDecision {
  allowed
  intentId
  mandateId
  decisionId
  evaluatedAt
  policyVersion
  mandateVerification
  usageSnapshot
  usageSnapshotHash
  evidenceIds
  usageDelta
}
```

That means `authority` should remain a small, pure kernel. It should not gain databases, networking, approval workflows, or blockchain calls.

## 2. What the Governance package should be

The repository's own design document assigns these responsibilities to the future Governance package:

* mandate issuance, renewal and revocation;
* multisig, quorum and approval chains;
* policy-as-code integration;
* historical authority queries;
* usage-window management;
* persistent usage stores;
* audit-log generation.

So `@totemsdk/governance` should be an **event-sourced orchestration layer**.

Its key operation would not merely be `evaluate()`. It should be something like:

```typescript
evaluateAndRecord({
  action,
  mandateProofId,
  evidenceIds,
  expectedUsageVersion,
});
```

Internally:

```text
1. Load current governance snapshot
2. Resolve the principal's identity
3. Resolve mandate and revocation status
4. Evaluate organizational policy
5. Call evaluateAuthority(...)
6. Atomically record decision and usage
7. Publish the resulting governance event
8. Optionally trigger economic settlement
```

The atomicity in step 6 is essential. Because `authority` evaluates a supplied usage snapshot without mutating it, two concurrent requests could otherwise both see the same remaining quota and both be allowed.

## 3. The package roles

| Package                            | Governance role                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `@totemsdk/identity`               | Who controls an identity, delegated signing authority, rotation and revocation        |
| `@totemsdk/proof`                  | Portable signed envelopes for mandates, approvals, decisions, revocations and rulings |
| `@totemsdk/authority`              | Pure deterministic authorization decision                                             |
| `@totemsdk/governance`             | Lifecycle, workflows, state, persistence, history and coordination                    |
| `@totemsdk/proofgraph`             | Queryable projection of proofs and their relationships                                |
| `@totemsdk/pear`                   | Optional replicated off-chain storage and networking                                  |
| `@totemsdk/pubsub-transport`       | Governance-event notification and synchronization                                     |
| `@totemsdk/proof-integritas`       | Optional timestamping/checkpoint anchoring on Minima                                  |
| `@totemsdk/chain-provider`         | Direct reading and submission of Minima state                                         |
| `@totemsdk/omnia`                  | Optional financial execution and settlement                                           |
| `provider-bond` / `liquidity-bond` | External trust, collateral and liquidity evidence                                     |
| `edge` / `edge-adapters`           | Runtime-facing governance enforcement at devices and services                         |
| `agent-policy`                     | Specialized wallet/AI payment proposal policy                                         |

### Identity

`@totemsdk/identity` already models permanent root identities, current controllers, scoped delegates, rotation and revocation. Its graph resolver returns the active authority set.

That means Governance should not invent another role-key system. It should:

```text
Governance role
    ↓
identityId
    ↓
resolved root/controller/delegates
    ↓
authorized signing address
```

The existing Authority implementation recognizes the root address, controller address, or a delegate carrying `*` or `authority:grant` as capable of issuing a mandate.

### Proofs

A mandate is already encoded as a WOTS-signed `SignedProof` using schema:

```text
totem:authority:mandate/v1
```

Governance events should follow the same pattern rather than defining an unrelated signature envelope. Likely event schemas include:

```text
totem:governance:policy/v1
totem:governance:approval/v1
totem:governance:revocation/v1
totem:governance:decision/v1
totem:governance:usage/v1
totem:governance:appeal/v1
totem:governance:ruling/v1
totem:governance:checkpoint/v1
```

`@totemsdk/proof` already supports evidence, links, expiry, revocation and delegation proof kinds, as well as deterministic anchor commitments.

Governance should also require WOTS leasing for every signed event. The Authority package itself warns that reusing a WOTS key index can leak the private key and recommends lease-based signing.

## 4. The off-chain governance ledger

The primary operational record should be an append-only sequence of signed events:

```typescript
interface GovernanceEvent {
  eventId: string;
  domainId: string;
  sequence: bigint;
  previousEventId?: string;

  kind:
    | 'policy_published'
    | 'mandate_issued'
    | 'mandate_renewed'
    | 'mandate_revoked'
    | 'approval_granted'
    | 'authority_decision_recorded'
    | 'usage_recorded'
    | 'appeal_opened'
    | 'ruling_issued'
    | 'checkpoint_created';

  actorIdentityId: string;
  subjectId: string;
  occurredAt: number;

  payloadHash: string;
  proof: SignedProof;
}
```

A materialized snapshot can then be rebuilt by replaying events:

```typescript
interface GovernanceState {
  domainId: string;
  sequence: bigint;

  policyVersion: string;
  policyRoot: string;

  activeMandates: Record<string, MandateRecord>;
  revocations: Record<string, RevocationRecord>;
  usage: Record<string, AuthorityUsageSnapshot>;

  pendingApprovals: Record<string, ApprovalWorkflow>;
  pendingAppeals: Record<string, AppealState>;

  eventRoot: string;
  proofGraphId: string;
  latestCheckpoint?: GovernanceCheckpoint;
}
```

### Where `proofgraph` fits

`@totemsdk/proofgraph` is a very good **materialized relationship index**. It already understands:

* proofs and identities;
* evidence;
* anchors;
* revocations and supersessions;
* delegation;
* proof lineage;
* resolving the currently active proof set.

But it should not be the sole audit ledger.

Its `graphId` is intentionally content-deterministic and excludes creation timestamps and metadata. Identical logical graph content gets the same ID regardless of when it was constructed.

Therefore, I would use:

```text
Governance event hash chain or MMR
    = chronology and append-only audit

ProofGraph
    = relationship query and current-state projection
```

The Governance checkpoint should commit to both:

```typescript
interface GovernanceCheckpoint {
  domainId: string;
  sequence: bigint;

  eventRoot: string;       // ordered event history
  proofGraphId: string;    // relationship projection

  policyRoot: string;
  authorityRoot: string;
  revocationRoot: string;
  usageRoot: string;

  previousCheckpoint?: string;
  signedBy: string[];
  anchor?: AnchorRef;
}
```

## 5. What goes on Minima L1

L1 should contain **small canonical commitments and enforceable constitutional state**, not the whole governance history.

A checkpoint could anchor:

```text
governanceDomainId
checkpointSequence
eventRoot
policyRoot
authorityRoot
revocationRoot
previousCheckpointHash
```

For higher-assurance domains, L1 may additionally hold:

* the identity or quorum permitted to publish checkpoints;
* emergency suspension authority;
* a domain-wide revocation epoch;
* adjudicator or appeal authority;
* escrow and bond rules;
* final enforceable rulings;
* governance upgrade rules.

The full policies, evidence, deliberations, usage events and decision records remain off-chain.

### Integritas versus direct L1 governance

`@totemsdk/proof-integritas` can already stamp arbitrary hashes or signed-proof commitments on Minima and later verify their existence.

That provides:

```text
existence
timestamping
tamper-evident commitment
Minima transaction reference
```

It does **not** provide:

```text
mandate revocation enforcement
quorum verification
policy execution
collateral redistribution
appeal handling
constitutional upgrade logic
```

So Integritas is an excellent initial `GovernanceAnchorPort` implementation, but a later direct Minima adapter would be needed for actual governance covenants:

```text
@totemsdk/governance-integritas
    checkpoint timestamping

@totemsdk/governance-minima
    direct KISSVM/UTXO constitutional enforcement
```

`@totemsdk/chain-provider` is already the correct abstraction for reading coins and proofs, obtaining the chain tip and broadcasting transactions.

## 6. Where Omnia actually fits

This is the part I would correct most strongly from the earlier discussion.

The current `@totemsdk/omnia` package is explicitly an Eltoo **payment-channel** implementation. Its normal update API takes `newBalances`, and its state commitment is built from sequence, balances and pending HTLCs.

Although `SignedChannelState` contains Minima state variables, the exposed channel state machine is currently centered on:

* funding;
* balances;
* HTLCs;
* update sequence;
* cooperative settlement;
* unilateral dispute.

Therefore:

> **Do not make Omnia the mandate registry, revocation registry or governance audit store.**

Use Omnia only when a governance decision has an economic effect:

```text
Authority decision allowed
    → accrue metered payment

Mandate issued
    → establish spending capacity

Agent violates ruling
    → settle a predefined bond penalty

Provider completes work
    → release escrow

Dispute ruling issued
    → allocate channel balance
```

An Omnia-related receipt can reference:

```text
decisionId
mandateId
governanceCheckpointId
usageCommitId
rulingId
```

But those IDs refer back to the Governance ledger. They should not be the only copies of the underlying records.

A useful interface is:

```typescript
interface GovernanceEconomicPort {
  reserve(params: {
    mandateId: string;
    amount: bigint;
    asset: string;
  }): Promise<EconomicReference>;

  accrue(params: {
    decisionId: string;
    usageCommitId: string;
    amount: bigint;
  }): Promise<EconomicReference>;

  settleRuling(params: {
    rulingId: string;
    allocation: Record<string, bigint>;
  }): Promise<EconomicReference>;
}
```

An Omnia adapter can implement that interface without coupling Governance core to channel internals.

## 7. Provider and liquidity packages

`@totemsdk/provider-bond` and `@totemsdk/liquidity-bond` establish a useful architectural pattern: deterministic domain records and policy checks are kept separate from live execution.

Provider Bond models identities, bond proofs, probes, incidents and deterministic scores, but explicitly does not execute Omnia channels, custody funds, enforce covenants or provide networking.

Liquidity Bond records commitments, positions, receipts, allocations, fee records and withdrawal intentions, while leaving actual channel and factory execution to Omnia.

Governance should consume these as facts or evidence:

```text
provider score
open incidents
bond proof
liquidity position
risk haircut
withdrawal status
```

For example:

```typescript
policy:
  permit provider:use only when
    provider.score >= 80
    and provider.hasActiveMinimaBond
    and provider.maxIncidentSeverity <= "medium"
```

Governance owns the organizational rule. Provider Bond owns the deterministic provider facts.

## 8. Runtime and storage integration

### Pear

`@totemsdk/pear` supplies Pear-native storage, Hyperswarm/Hyperdrive networking and an append-only distributed filesystem.

That makes it a good implementation for:

```text
GovernanceEventStore
EvidenceBlobStore
CheckpointStore
PeerReplicationPort
```

But Governance core should define interfaces so it can also run with:

* in-memory storage for tests;
* SQLite for a local application;
* Redis or PostgreSQL for managed deployments;
* Pear/Hyperdrive for sovereign peer replication.

### Pub/sub

`@totemsdk/pubsub-transport` provides a generic MQTT-style transport abstraction.

It should disseminate notifications such as:

```text
mandate issued
mandate revoked
policy updated
checkpoint available
appeal opened
ruling issued
```

It should not be treated as persistent storage or consensus.

### Edge runtime

`@totemsdk/edge` is the right enforcement integration point because it composes identity, policy, proof and payment capabilities through injected ports.

I would add either:

```typescript
interface EdgeGovernancePort {
  evaluateAndRecord(input: {
    action: string;
    principal: string;
    agent: string;
    target?: string;
    constraints?: Record<string, unknown>;
    evidenceIds?: string[];
  }): Promise<GovernanceOutcome>;

  getMandate(id: string): Promise<MandateRecord | undefined>;
  isRevoked(id: string): Promise<boolean>;
}
```

or expose Governance through an enhanced `EdgePolicyPort`.

The existing policy adapter only wraps `AgentPolicy.canAutoApprove()` and reduces actions to payment versus receipt. That is too narrow to represent mandate verification, identity resolution, usage accounting and governance history.

## 9. Recommended Governance API

A reasonable public API could be:

```typescript
const governance = createGovernance({
  eventStore,
  snapshotStore,
  evidenceStore,

  identityResolver,
  policyEvaluator,

  signer,
  leaseProvider,
  clock,

  proofGraphStore,
  transport,

  anchorProvider,
  economicPort,
});
```

Core commands:

```typescript
await governance.publishPolicy(...);

await governance.issueMandate({
  mandate,
  approvalWorkflow,
});

await governance.renewMandate(...);

await governance.revokeMandate({
  mandateId,
  reason,
  effectiveAt,
});

const result = await governance.evaluateAndRecord({
  action,
  mandateProofId,
  evidenceIds,
});

await governance.openAppeal(...);
await governance.recordRuling(...);

await governance.createCheckpoint({
  anchor: true,
});
```

Queries:

```typescript
governance.getCurrentMandate(mandateId);
governance.getUsage(mandateProofId);
governance.getDecision(decisionId);
governance.getEvidenceTrail(decisionId);

governance.wasAuthorized({
  action,
  principal,
  agent,
  at,
});

governance.reconstructStateAt(sequence);
```

## 10. Revocation needs one design correction

The Authority types contain both:

```typescript
MandateBody.revocationEpoch
MandateStatusSnapshot.currentEpoch
MandateStatusSnapshot.revocationEpochs
```

But the current verifier only checks whether the mandate ID is present in the `revocationEpochs` map and marks it revoked. It does not currently perform a defined monotonic comparison between the mandate's epoch and a current domain or principal epoch.

Governance should formally define one or both models:

### Individual mandate revocation

```text
revocations[mandateId] = {
  epoch,
  effectiveAt,
  revocationProofId
}
```

### Principal-wide epoch invalidation

```text
principalEpoch[principalId] = 15
```

A mandate issued at epoch `14` becomes invalid when the principal epoch advances to `15`.

The latter allows emergency revocation of a class of existing mandates without publishing every mandate ID individually. Authority may eventually need a small versioned update to consume those semantics directly.

## 11. The resulting end-to-end flow

```text
1. Identity
   @totemsdk/identity resolves principal and authorized grantors

2. Mandate creation
   Governance runs approval/quorum workflow

3. Signing
   @totemsdk/proof + @totemsdk/wots-lease produce the mandate proof

4. Persistence
   Governance appends mandate_issued to its ordered event log

5. Projection
   @totemsdk/proofgraph indexes mandate, identity, evidence and relationships

6. Action request
   Edge runtime sends ActionIntent to Governance

7. Policy
   Governance evaluates organizational policy and approval requirements

8. Authority
   @totemsdk/authority deterministically verifies mandate, scope and usage

9. Commit
   Governance atomically records AuthorityDecision and usage delta

10. Distribution
    Pub/sub announces the event; Pear or another adapter replicates it

11. Economic effect
    Optional Omnia adapter accrues payment, escrow or bond consequences

12. Checkpoint
    Governance commits eventRoot + authorityRoot + revocationRoot

13. L1
    Integritas timestamps the checkpoint, or a direct Minima contract
    enforces constitutional or financial consequences
```

## Recommended package boundary

I would keep `@totemsdk/governance` itself relatively dependency-light:

**Core dependencies**

```text
@totemsdk/authority
@totemsdk/proof
@totemsdk/identity
@totemsdk/proofgraph
```

**Injected or optional adapters**

```text
@totemsdk/wots-lease
@totemsdk/chain-provider
@totemsdk/proof-integritas
@totemsdk/pubsub-transport
@totemsdk/pear
@totemsdk/omnia
@totemsdk/provider-bond
@totemsdk/liquidity-bond
```

That preserves the design philosophy already visible across the SDK: deterministic domain logic in small packages, with networking, persistence and execution supplied through adapters.

## Final architecture

```text
                    ORGANIZATIONAL GOVERNANCE
                  policy / quorum / approvals
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                 @totemsdk/governance                    │
│ event log · lifecycle · usage · history · checkpoints   │
└──────────────┬───────────────────────┬──────────────────┘
               │                       │
               ▼                       ▼
   @totemsdk/authority         @totemsdk/proofgraph
   deterministic decision      evidence relationships
               │
        ┌──────┴──────┐
        ▼             ▼
 @totemsdk/identity  @totemsdk/proof
 authority graph     signed records

               OFF-CHAIN INFRASTRUCTURE
         Pear / SQLite / pubsub / evidence storage
                              │
                         checkpoint roots
                              ▼
                    MINIMA L1 / INTEGRITAS
       timestamp · canonical authority · final enforcement
                              │
                              ▼
                    OPTIONAL OMNIA CHANNELS
            payment · escrow · collateral · settlement
```

So the governing principle is:

> **Governance is off-chain-first, proof-native and event-sourced; L1 anchors constitutional truth and final enforcement; Omnia supplies optional economic execution. `authority` remains the pure deterministic decision kernel at the center.**
