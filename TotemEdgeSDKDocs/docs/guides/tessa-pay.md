---
id: tessa-pay
title: TESSA Pay
sidebar_label: TESSA Pay
description: Edge-native merchant POS with policy-controlled payments and auto-approve rules on Minima.
---

# TESSA Pay

**Type:** Edge merchant point-of-sale  
**Audience:** Retail developers, market operators, kiosk builders

TESSA Pay is a browser-based merchant POS that accepts Minima payments via the Totem wallet extension. An `agent-policy` layer auto-approves small transactions (configurable threshold) and flags larger ones for human confirmation, making it safe to run unattended on a tablet at a market stall.

---

## Packages used

| Package | Role in TESSA Pay |
|---------|------------------|
| `@totemsdk/connect` | Connects the POS browser tab to the customer's Totem wallet |
| `@totemsdk/agent-policy` | Evaluates each payment intent — auto-approve or escalate |
| `@totemsdk/wots-lease` | Manages the merchant's WOTS key lease for signing receipts |
| `@totemsdk/tx-builder` | Assembles the payment transaction from the POS inputs |
| `@totemsdk/txpow` | Calibrates TxPoW difficulty for the transaction |
| `@totemsdk/chain-provider` | Submits transactions to the merchant's local Minima node |
| `@totemsdk/lookup-client` | Resolves customer addresses from the Lookup network |
| `@totemsdk/realtime` | Streams confirmed payment events back to the POS display |

---

## Core integration path

### 1. Customer connects wallet

```typescript
import { isTotemInstalled, connect, onEvent } from '@totemsdk/connect';

if (!isTotemInstalled()) throw new Error('Totem wallet not found');

const { address: customerAddress } = await connect(location.origin);

onEvent('accountsChanged', ([newAddress]) => {
  customerAddress = newAddress;
});
```

### 2. Define the merchant policy

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const AUTO_APPROVE_THRESHOLD = 10_000_000n; // 10 MIN in satoshis

const tessaPolicy: AgentPolicy = {
  async evaluate(proposal: AgentProposal) {
    if (proposal.intent.type !== 'payment') {
      return { outcome: 'rejected', reason: 'TESSA Pay only processes payment intents' };
    }

    const amount = BigInt(proposal.intent.amount);

    if (amount <= AUTO_APPROVE_THRESHOLD) {
      return {
        outcome: 'approved',
        receipt: {
          proposalId: proposal.id,
          approvedAt: Date.now(),
          approvedBy: { id: 'tessa-auto-policy', type: 'policy' },
          policyHash: 'sha3:auto-v1',
        },
      };
    }

    return {
      outcome: 'requires_human',
      prompt: `Confirm payment of ${amount / 1_000_000n} MIN from ${proposal.intent.recipient}?`,
    };
  },
};
```

### 3. Build and submit the payment request

```typescript
import { buildPaymentTx } from '@totemsdk/tx-builder';
import { calibrateTxPoW } from '@totemsdk/txpow';
import { getChainProvider } from '@totemsdk/chain-provider';

async function requestPayment(amountMin: number, itemDescription: string) {
  const proposal = {
    id: crypto.randomUUID(),
    intent: {
      type: 'payment' as const,
      amount: String(BigInt(amountMin) * 1_000_000n),
      recipient: MERCHANT_ADDRESS,
      memo: itemDescription,
    },
    requestedBy: { id: 'tessa-pos', type: 'app' as const },
    createdAt: Date.now(),
    expiresAt: Date.now() + 120_000, // 2-minute payment window
  };

  const decision = await tessaPolicy.evaluate(proposal);

  if (decision.outcome === 'rejected') {
    throw new Error(`Payment blocked: ${decision.reason}`);
  }

  if (decision.outcome === 'requires_human') {
    const confirmed = await showConfirmDialog(decision.prompt);
    if (!confirmed) throw new Error('Payment cancelled by operator');
  }

  const tx = await buildPaymentTx({
    from: customerAddress,
    to: MERCHANT_ADDRESS,
    amount: proposal.intent.amount,
    tokenId: '0x00',
  });

  const powered = await calibrateTxPoW(tx);
  const chainProvider = getChainProvider({ nodeUrl: MERCHANT_NODE_URL });
  return chainProvider.submit(powered);
}
```

### 4. Stream payment confirmations to the display

```typescript
import { createRealtimeClient } from '@totemsdk/realtime';

const realtime = createRealtimeClient({ wsUrl: 'ws://localhost:9004' });

realtime.on('balance', ({ address, confirmed }) => {
  if (address === MERCHANT_ADDRESS) {
    updateBalanceDisplay(confirmed);
  }
});

realtime.subscribe(MERCHANT_ADDRESS);
```

---

## Future QVAC hook

:::tip Future QVAC hook
When a QVAC agent is attached, it can drive TESSA Pay autonomously — generating payment requests from an IoT weight sensor, applying dynamic pricing from a market feed, and reconciling daily receipts against an off-chain ledger. The `tessaPolicy` above is the exact boundary where QVAC proposals enter: no changes are needed to the wallet or chain layers.
:::

---

## API reference links

- [`@totemsdk/connect`](/api/totemsdk-connect) — wallet connection
- [`@totemsdk/agent-policy`](/api/totemsdk-agent-policy) — policy evaluation
- [`@totemsdk/wots-lease`](/api/totemsdk-wots-lease) — key lease management
- [`@totemsdk/tx-builder`](/api/totemsdk-tx-builder) — transaction assembly
- [`@totemsdk/txpow`](/api/totemsdk-txpow) — proof-of-work calibration
- [`@totemsdk/chain-provider`](/api/totemsdk-chain-provider) — node submission
- [`@totemsdk/lookup-client`](/api/totemsdk-lookup-client) — address resolution
- [`@totemsdk/realtime`](/api/totemsdk-realtime) — balance streaming
