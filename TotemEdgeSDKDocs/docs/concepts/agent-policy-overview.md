---
id: agent-policy-overview
title: Agent Policy Overview
sidebar_label: Agent Policy (QVAC)
description: How the QVAC → agent-policy → Totem → Minima execution model works, and why it makes the SDK AI-ready without giving up key control.
---

# Agent Policy Overview

The **`@totemsdk/agent-policy`** package is the seam between AI agent toolchains and sovereign Minima transactions. It implements the **QVAC execution model** — a four-step pipeline that lets AI agents *propose* actions while ensuring humans (or deterministic policy rules) retain full authority over what actually gets signed.

---

## The QVAC pipeline

```
QVAC proposes → agent-policy evaluates → Totem signs → Minima settles
```

| Step | Actor | What happens |
|------|-------|--------------|
| **QVAC proposes** | AI agent / automation | Constructs an `AgentProposal` describing an intent: send payment, open channel, transfer asset, etc. |
| **agent-policy evaluates** | `@totemsdk/agent-policy` | Runs the proposal through a set of developer-defined `PolicyRule` functions. Returns `approved`, `rejected`, or `requires_human`. |
| **Totem signs** | Totem wallet / `@totemsdk/node` | If approved, builds the transaction and signs it with the user's WOTS TreeKey. |
| **Minima settles** | Minima network | Broadcasts and mines the TxPoW. |

The wallet's private keys never leave the client. QVAC never touches them directly.

---

## Core types

```typescript
import type {
  AgentProposal,
  AgentPolicy,
  AgentReceipt,
  AgentIdentity,
  PaymentIntent,
} from '@totemsdk/agent-policy';
```

### `AgentProposal`

The AI agent's intent, serialised before any key material is touched:

```typescript
interface AgentProposal {
  id: string;
  intent: PaymentIntent | ChannelIntent | AssetTransferIntent;
  requestedBy: AgentIdentity;
  createdAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}
```

### `AgentPolicy`

A developer-supplied evaluator. You implement this interface to express your app's business rules:

```typescript
interface AgentPolicy {
  evaluate(proposal: AgentProposal): Promise<PolicyDecision>;
}

type PolicyDecision =
  | { outcome: 'approved'; receipt: AgentReceipt }
  | { outcome: 'rejected'; reason: string }
  | { outcome: 'requires_human'; prompt: string };
```

### `AgentReceipt`

A cryptographically linkable record returned after approval — useful for audit trails:

```typescript
interface AgentReceipt {
  proposalId: string;
  approvedAt: number;
  approvedBy: AgentIdentity;
  policyHash: string;
}
```

---

## Writing a policy

A policy is just a function (or class) that returns a `PolicyDecision`. Here's a minimal merchant policy:

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const merchantPolicy: AgentPolicy = {
  async evaluate(proposal) {
    const { intent } = proposal;

    // Only allow payment intents
    if (intent.type !== 'payment') {
      return { outcome: 'rejected', reason: 'Only payment intents are allowed' };
    }

    // Auto-approve small payments under 10 MIN
    if (BigInt(intent.amount) <= 10_000_000n) {
      return {
        outcome: 'approved',
        receipt: {
          proposalId: proposal.id,
          approvedAt: Date.now(),
          approvedBy: { id: 'auto-policy-v1', type: 'policy' },
          policyHash: 'sha3:...',
        },
      };
    }

    // Require human confirmation for larger amounts
    return {
      outcome: 'requires_human',
      prompt: `Approve payment of ${intent.amount} MIN to ${intent.recipient}?`,
    };
  },
};
```

---

## Why this matters

### AI without key exposure

QVAC agents can orchestrate complex workflows — paying for API calls, settling channel balances, issuing access passes — without ever holding signing keys. The policy layer is the chokepoint: if the policy rejects a proposal, no transaction is built.

### Composable rules

The `@totemsdk/agent-policy` package ships built-in middleware primitives and a `ComposablePolicy` that chains them with short-circuit semantics:

```typescript
import {
  ComposablePolicy,
  RateLimitPolicy,
  AmountCapPolicy,
  RecipientAllowlistPolicy,
  RiskThresholdPolicy,
} from '@totemsdk/agent-policy';

const policy = new ComposablePolicy([
  new RateLimitPolicy(60, 60_000),                // max 60 per minute
  new AmountCapPolicy({ perTx: '500', perDay: '10000' }),
  new RecipientAllowlistPolicy(['MxSupplier1', 'MxSupplier2']),
  new RiskThresholdPolicy('low'),
]);

const result = await policy.evaluate(proposal);
if (result.outcome === 'approved') {
  // sign and broadcast
}
```

Custom middleware layers implement `PolicyMiddleware.evaluate()`. `ComposablePolicy` also satisfies the legacy `AgentPolicy` interface for backward compatibility with `@totemsdk/omnia`.

### Auditability

Every approval produces an `AgentReceipt`. Store receipts in your backend alongside the TxPoW ID to create a complete, auditable log of AI-initiated actions.

---

## Integration with example apps

Every example app in this documentation includes a **"Future QVAC hook"** callout showing exactly where agent-policy plugs in. Start with the simplest integration:

- [TESSA Pay](/guides/tessa-pay) — merchant auto-approve rule for small payments
- [KISSVM Studio](/guides/kissvm-studio) — policy as a script safety linter
- [MachinePay Edge](/guides/machinepay-edge) — policy enforcing min price and auto-shutdown

---

## See also

- [`@totemsdk/agent-policy` API reference](/api/totemsdk-agent-policy)
- [TESSA Pay guide](/guides/tessa-pay)
- [Minima Network documentation](https://docs.minima.global)
