# @totemsdk/agent-policy

**The interface seam between human wallets and AI agents.**

Defines the type contracts that allow an AI agent to propose and execute payments within bounded, auditable policies. Used by `@totemsdk/omnia` for channel-level governance and exposed through `@totemsdk/connect` for extension-level agent interactions.

## Install

```bash
npm install @totemsdk/agent-policy
```

This is a types-only package — no runtime, no dependencies.

## What's inside

| Type | Role |
|------|------|
| `PaymentIntent` | Structured description of what an agent wants to pay and why |
| `AgentProposal` | An agent's formal request to a wallet for funds |
| `AgentPolicy` | Rules governing what an agent is allowed to spend (limits, allowed intents, expiry) |
| `AgentReceipt` | Verifiable proof that a payment was executed per the agent's request |
| `AgentIdentity` | The cryptographic identity of an agent (public key + metadata) |

## Type definitions

```typescript
interface PaymentIntent {
  purpose: string;          // Human-readable reason for the payment
  recipient: string;        // Minima address or statechain ID
  amount: string;           // Amount as a decimal string
  tokenid: string;          // '0x00' for native MIN, or a token ID
  metadata?: Record<string, unknown>;
}

interface AgentProposal {
  agentIdentity: AgentIdentity;
  intent: PaymentIntent;
  requestedAt: number;      // Unix ms timestamp
  nonce: string;            // Replay protection
  signature: string;        // Agent's WOTS signature over the intent
}

interface AgentPolicy {
  agentId: string;
  allowedIntents: string[]; // e.g. ['payment', 'swap', 'tip']
  limits: Record<string, string>; // tokenid → max amount per session
  expiresAt: number;        // Unix ms
}

interface AgentReceipt {
  proposalNonce: string;    // Links back to the AgentProposal
  txpowid: string;          // On-chain transaction ID
  actualAmount: string;
  executedAt: number;
  walletSignature: string;  // Wallet's WOTS signature over the receipt
}

interface AgentIdentity {
  agentId: string;
  publicKey: string;        // Agent's WOTS public key
  name?: string;
  endpoint?: string;        // Optional HTTPS callback for receipts
}
```

## Usage

### Wallet: evaluate an incoming agent proposal

```typescript
import { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

function canApprove(policy: AgentPolicy, proposal: AgentProposal): boolean {
  if (Date.now() > policy.expiresAt) return false;
  if (!policy.allowedIntents.includes(proposal.intent.purpose)) return false;

  const limit = policy.limits[proposal.intent.tokenid] ?? '0';
  return parseFloat(proposal.intent.amount) <= parseFloat(limit);
}
```

### Agent: build a proposal

```typescript
import type { AgentProposal, PaymentIntent } from '@totemsdk/agent-policy';

const intent: PaymentIntent = {
  purpose: 'subscription_renewal',
  recipient: 'MxDEF456...',
  amount: '5',
  tokenid: '0x00',
};

const proposal: AgentProposal = {
  agentIdentity: myIdentity,
  intent,
  requestedAt: Date.now(),
  nonce: crypto.randomUUID(),
  signature: await agentSigner.sign(intent),
};
```

### Issue a receipt after payment

```typescript
import type { AgentReceipt } from '@totemsdk/agent-policy';

const receipt: AgentReceipt = {
  proposalNonce: proposal.nonce,
  txpowid: broadcastResult.txpowid,
  actualAmount: proposal.intent.amount,
  executedAt: Date.now(),
  walletSignature: await walletSigner.sign(broadcastResult.txpowid),
};
```

## See also

- [`@totemsdk/connect`](https://www.npmjs.com/package/@totemsdk/connect) — `totemAgentProposePayment`, `totemAgentCreateReceipt` extension methods
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — `AgentPolicy` integration for channel-level governance
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signatures used in proposals and receipts
