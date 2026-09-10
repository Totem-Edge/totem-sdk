# @totemsdk/agent-policy

**The interface seam between human wallets and AI agents.**

Defines the type contracts that allow an AI agent to propose and execute payments within bounded, auditable policies. Used by `@totemsdk/omnia` for channel-level governance and exposed through `@totemsdk/connect` for extension-level agent interactions.

## Language-Agnostic Schema

The canonical schema is defined in **Protobuf** at:

```
proto/totem/agent/policy/v1/agent_policy.proto
```

TypeScript, Python, Go, and Rust consumers all generate bindings from the same `.proto` file. This ensures the agent-wallet contract is identical across every language in the stack.

## Install

```bash
npm install @totemsdk/agent-policy
```

## What's inside

| Type / Class | Role | Source |
|------|------|--------|
| `PaymentIntent` | Structured description of what an agent wants to pay and why | Proto message |
| `AgentProposal` | An agent's formal request to a wallet for funds | Proto message |
| `AgentPolicy` | Legacy behavioral interface — `canAutoApprove` / `requiresUserApproval` | TypeScript only |
| `AgentReceipt` | Verifiable proof that a payment was executed | Proto message |
| `AgentIdentity` | Minimal agent identity for lookup-node registration | Proto message |
| `AgentPolicyConfig` | Serializable policy configuration (limits, allowed intents, expiry) | Proto message |
| `PolicyMiddleware` | Composable middleware interface — `evaluate()` returns `PolicyEvalResult` | TypeScript only |
| `PolicyEvalResult` | Three-state result (`approved` / `rejected` / `requires_human`) with reason | TypeScript only |
| `ComposablePolicy` | Chains multiple `PolicyMiddleware` layers with short-circuit semantics | TypeScript |
| `RateLimitPolicy` | Limits proposals per time window (e.g. max 10/min) | TypeScript |
| `AmountCapPolicy` | Caps amount per transaction and/or per day | TypeScript |
| `RecipientAllowlistPolicy` | Only allows proposals to approved addresses | TypeScript |
| `TimeWindowPolicy` | Only allows proposals during configurable daily window | TypeScript |
| `RiskThresholdPolicy` | Auto-approves up to a configurable risk level | TypeScript |
| `GrantBoundPolicy` | Grant-bound step coordination over signed mandates — resolve, verify scope/constraints/expiry/revocation, check budget, apply local bounds, reserve atomically | TypeScript |
| `GrantUsageStore` | Transactional grant usage accounting (reserve/commit/abort + run-level counts) | TypeScript |
| `GrantBoundAutonomyPolicy` | Run-level autonomy — `openRun`, `authorizeAndReserve`, `commit`/`abort`, receipt graph | TypeScript |
| `RunStateStore` | Atomic run session state (totals, concurrency, failure budget, nonce anti-replay) | TypeScript |
| `SqliteRunStateStore` | Durable SQLite (WAL) store implementing both `RunStateStore` and `GrantUsageStore` | TypeScript |
| `createAutonomyPolicy` | Configurable autonomy profiles (dynamic / declared_plan / locked_plan / single_step) | TypeScript |
| `reduceToCanonicalAction` | Reduce a prepared operation to canonical security facts (never agent hints) | TypeScript |

## Run-level autonomy

The run-level autonomy layer sits **over** existing signed mandates — it is not another grant format. The governing equation:

> Effective authority = signed mandate ∩ local autonomy profile ∩ verified operation effects ∩ current run state

### Open a run

```typescript
import { GrantBoundAutonomyPolicy, MemoryRunStateStore } from '@totemsdk/agent-policy';

const policy = new GrantBoundAutonomyPolicy({
  autonomyProfiles: {
    'channel-rebalance': {
      profileId: 'channel-rebalance',
      mode: 'dynamic',
      runLimits: {
        maxSteps: 20,
        maxParallel: 1,
        maxFailures: 3,
        maxDurationMs: 60 * 60_000,
        maxGrossSpend: { tokenId: '0x00', amount: '500' },
        maxFees: { tokenId: '0x00', amount: '10' },
      },
      transitions: [
        { from: 'start', to: ['simulate'] },
        { from: 'simulate', to: ['pay', 'requote'] },
        { from: 'pay', to: ['verify', 'compensate'] },
      ],
      obligations: { requireSimulation: true },
      boundaryFailure: 'request_narrow_grant',
    },
  },
  mandateResolver: async (id) => mandateProofs[id],
  identityResolver,
  stateStore: new MemoryRunStateStore(), // or new SqliteRunStateStore('./runs.sqlite')
});

await policy.openRun({
  runId: 'fleet-rebalance-42',
  agentId: 'qvac-rebalancer',
  principal: 'MxFleet',
  grantProofIds: ['proof:owner-grant', 'proof:operator-grant'],
  profileId: 'channel-rebalance',
});
```

### Authorize actual effects, not agent descriptions

The wallet builds (or simulates) the transaction FIRST, then reduces it to canonical security facts. Agent-supplied `amount`, `recipient`, `risk`, or metadata remain explanatory hints — never security facts.

```typescript
import { reduceToCanonicalAction } from '@totemsdk/agent-policy';

const canonical = reduceToCanonicalAction('fleet-rebalance-42', 'MxFleet', 'qvac-rebalancer', preparedStep, {
  simulation: { ok: true },
});
// canonical.effects.spends / fees / channels are the REAL operation effects.
```

### Atomic authorize → execute → commit / abort

One reservation atomically covers mandate usage, run budgets, concurrency capacity, and the operation nonce:

```typescript
const authorization = await policy.authorizeAndReserve({
  runId: 'fleet-rebalance-42',
  stepId: 'pay-1',
  nonce: 'pay-1', // unique per run — anti-replay
  action: canonical,
  evidence: { simulation: { ok: true } },
});

if (authorization.outcome === 'approved') {
  try {
    const result = await execute(preparedOperation);
    await policy.commit({ reservationId: authorization.reservationId, executionProof: result });
  } catch (error) {
    await policy.abort(authorization.reservationId, error);
  }
}
```

### Boundary escalation issues authority

When a step exceeds existing bounds, the policy returns a structured request — never a silent bypass:

```typescript
{
  outcome: 'requires_human',
  reason: 'maxGrossSpend exceeded',
  boundaryError: { kind: 'escalate', boundary: 'run.maxGrossSpend', remaining: '25', requested: '40' },
  suggestedGrant: {
    scope: 'omnia:channel:pay',
    maxTotal: '15',
    expiresInMs: 300_000,
    bindToRunId: 'fleet-rebalance-42',
  },
}
```

Human approval should produce a narrow, expiring, run-bound mandate amendment.

### Receipt graph

`getRunReceiptGraph(runId)` returns the full audit trail: run identity, every step's canonical action digest, mandates used, authority decision IDs, reservations and usage deltas, execution proofs, failures, and final run totals — making an autonomous workflow reconstructable and auditable.

### Durable atomic store

`SqliteRunStateStore` implements both `RunStateStore` and `GrantUsageStore` on a single SQLite database (WAL). Every reservation is one atomic transaction covering mandate usage, run budgets, concurrency slot, and nonce — durable across restarts. Pass `':memory:'` for ephemeral tests.

## Usage

### Composable policy pipeline (recommended)

Chain multiple policy layers together — the pipeline short-circuits on the first rejection:

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
  // 1. Max 60 proposals per minute (anti-DoS)
  new RateLimitPolicy(60, 60_000),

  // 2. Max 500 MIN per tx, 10_000 MIN per day
  new AmountCapPolicy({ perTx: '500', perDay: '10000' }),

  // 3. Only allow known supplier addresses
  new RecipientAllowlistPolicy(['MxABC...', 'MxDEF...']),

  // 4. Only during business hours (06:00–22:00 UTC)
  new TimeWindowPolicy(TimeWindowPolicy.hour(6), TimeWindowPolicy.hour(22)),

  // 5. Low/medium risk auto-approved, high → requires human
  new RiskThresholdPolicy('medium'),
]);

const result = await policy.evaluate(proposal);
if (result.outcome === 'approved') {
  const reservation = await policy.reserve(proposal);
  if (reservation.outcome !== 'approved') throw new Error(reservation.reason);
  try {
    // sign and broadcast
    await policy.commit(proposal.id);
  } catch (error) {
    await policy.release(proposal.id);
    throw error;
  }
} else if (result.outcome === 'requires_human') {
  // route to user approval UI
}
```

`evaluate()` is read-only. Use `reserve()` before execution, then call
`commit()` after a successful broadcast or `release()` when execution fails or
is cancelled. Reservations are idempotent by `proposal.id`; rate and amount
limits are scoped by agent and token.

`ComposablePolicy` also implements the legacy `AgentPolicy` interface so it works
seamlessly with `@totemsdk/omnia`'s `executeIntent`:

```typescript
if (await policy.canAutoApprove(proposal)) {
  // backward-compatible with executeIntent
}
```

### Standalone primitive policies

Each policy works independently too:

```typescript
const rateLimit = new RateLimitPolicy(10, 60_000);          // 10/min
const amountCap = new AmountCapPolicy({ perTx: '500' });     // max 500
const allowlist = new RecipientAllowlistPolicy(['MxABC']);   // known address
const timeWindow = new TimeWindowPolicy(360, 1320);           // 06:00–22:00 UTC
const riskGate = new RiskThresholdPolicy('low');              // only low risk
```

### Legacy AgentPolicy interface (backward-compatible)

### TypeScript — Wallet: evaluate an incoming agent proposal

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const myPolicy: AgentPolicy = {
  async canAutoApprove(proposal: AgentProposal): Promise<boolean> {
    if (proposal.intent.risk === 'high') return false;
    if (proposal.confidence < 0.9) return false;
    return true;
  },
  async requiresUserApproval(proposal: AgentProposal): Promise<boolean> {
    return !(await this.canAutoApprove(proposal));
  },
};

const proposal: AgentProposal = {
  id: 'prop-001',
  agentId: 'invoice-agent-v1',
  intent: {
    type: 'payment',
    amount: '5',
    tokenId: '0x00',
    recipient: 'MxDEF456...',
    reason: 'subscription_renewal',
    risk: 'low',
  },
  explanation: 'Monthly API subscription renewal',
  confidence: 0.95,
  createdAt: Date.now(),
};

if (await myPolicy.canAutoApprove(proposal)) {
  // sign and broadcast
}
```

### TypeScript — Using proto-generated enums

```typescript
import { IntentType, RiskLevel, ReceiptStatus } from '@totemsdk/agent-policy';

const intent = {
  type: IntentType.PAYMENT,
  risk: RiskLevel.LOW,
  // ...
};

const receipt = {
  status: ReceiptStatus.APPROVED,
  txpowId: '0xabc...',
  // ...
};
```

### Python — MCP server consuming the same schema

```python
# Generate from proto:
#   protoc --python_out=. proto/totem/agent/policy/v1/agent_policy.proto

from totem.agent.policy.v1 import agent_policy_pb2

proposal = agent_policy_pb2.AgentProposal()
proposal.id = "prop-001"
proposal.agent_id = "invoice-agent-v1"
proposal.intent.type = agent_policy_pb2.INTENT_TYPE_PAYMENT
proposal.intent.amount = "5"
proposal.intent.token_id = "0x00"
proposal.intent.recipient = "MxDEF456..."
proposal.intent.reason = "subscription_renewal"
proposal.intent.risk = agent_policy_pb2.RISK_LEVEL_LOW
proposal.explanation = "Monthly API subscription renewal"
proposal.confidence = 0.95
proposal.created_at = int(time.time() * 1000)

# Serialize to send to the TypeScript wallet bridge
payload = proposal.SerializeToString()
```

### Rust — Core SDK consuming the same schema

```rust
// Generate from proto:
//   prost-build in build.rs

use totem::agent::policy::v1::{AgentProposal, PaymentIntent, IntentType, RiskLevel};

let proposal = AgentProposal {
    id: "prop-001".into(),
    agent_id: "invoice-agent-v1".into(),
    intent: Some(PaymentIntent {
        r#type: IntentType::Payment.into(),
        amount: "5".into(),
        token_id: "0x00".into(),
        recipient: "MxDEF456...".into(),
        reason: "subscription_renewal".into(),
        risk: RiskLevel::Low.into(),
        ..Default::default()
    }),
    explanation: "Monthly API subscription renewal".into(),
    confidence: 0.95,
    created_at: std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64,
};
```

## Regenerating bindings

```bash
# Install protobuf-ts plugin (one-time)
npm install

# Generate TypeScript + Python types
npm run generate:proto

# Build TypeScript
npm run build
```

## See also

- [`@totemsdk/connect`](https://www.npmjs.com/package/@totemsdk/connect) — `agentProposePayment`, `agentCreateReceipt` extension methods
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — `AgentPolicy` integration for channel-level governance
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signatures used in proposals and receipts
- [`@totemsdk/core-wasm`](https://www.npmjs.com/package/@totemsdk/core-wasm) — Rust/WASM cryptographic engine
