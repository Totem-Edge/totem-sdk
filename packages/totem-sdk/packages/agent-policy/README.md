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

| Type | Role | Source |
|------|------|--------|
| `PaymentIntent` | Structured description of what an agent wants to pay and why | Proto message |
| `AgentProposal` | An agent's formal request to a wallet for funds | Proto message |
| `AgentPolicy` | Behavioral interface — `canAutoApprove` / `requiresUserApproval` | TypeScript only |
| `AgentReceipt` | Verifiable proof that a payment was executed | Proto message |
| `AgentIdentity` | Minimal agent identity for lookup-node registration | Proto message |
| `AgentPolicyConfig` | Serializable policy configuration (limits, allowed intents, expiry) | Proto message |

## Usage

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
