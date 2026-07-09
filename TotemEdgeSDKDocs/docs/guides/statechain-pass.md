---
id: statechain-pass
title: Statechain Pass
sidebar_label: Statechain Pass
description: Transferable off-chain ownership of tickets, vouchers, and access rights with policy-enforced provenance.
---

# Statechain Pass

**Type:** Off-chain transferable asset  
**Audience:** Event platforms, access control systems, voucher issuers

Statechain Pass is a system for issuing and transferring **off-chain ownership records** — tickets, vouchers, door passes, or content licences — without touching the Minima chain for every transfer. Ownership is a chain of WOTS signatures; the current holder proves ownership by presenting the full chain. An `agent-policy` enforces approved recipients, expiry checks, and provenance auditing.

---

## Packages used

| Package | Role in Statechain Pass |
|---------|------------------------|
| `@totemsdk/statechain` | Core off-chain ownership chain — create, transfer, verify |
| `@totemsdk/agent-policy` | Enforces approved recipients, expiry, and provenance rules |
| `@totemsdk/wots-lease` | Manages signing key lifecycle for each transfer |
| `@totemsdk/chain-provider` | Anchors statechain roots on-chain for finality |
| `@totemsdk/connect` | Browser dApp bridge for customer wallet interactions |
| `@totemsdk/realtime` | Pushes transfer confirmations to issuer dashboard |

---

## Core integration path

### 1. Issue a pass

```typescript
import { createStatechain } from '@totemsdk/statechain';
import { createSharedLeaseStrategy } from '@totemsdk/wots-lease';

const leaseStrategy = createSharedLeaseStrategy({ storage, storageKey: 'issuer-lease' });
const signer = await leaseStrategy.getSigner();

// Issue a new event ticket
const pass = await createStatechain({
  assetId: `ticket:${eventId}:${seatNumber}`,
  issuer: ISSUER_ADDRESS,
  recipient: initialHolder,
  metadata: {
    event: 'Minima DevCon 2026',
    seat: 'A12',
    expiresAt: new Date('2026-06-01').getTime(),
  },
  signer,
});

console.log('Pass created:', pass.chainId);
```

### 2. Transfer to a new holder

```typescript
import { transferStatechain } from '@totemsdk/statechain';

async function transferPass(pass: Statechain, newHolder: string) {
  const proposal = {
    id: crypto.randomUUID(),
    intent: {
      type: 'asset_transfer' as const,
      assetId: pass.chainId,
      from: pass.currentHolder,
      to: newHolder,
      expiresAt: pass.metadata.expiresAt,
    },
    requestedBy: { id: 'statechain-pass-app', type: 'app' as const },
    createdAt: Date.now(),
  };

  const decision = await passPolicy.evaluate(proposal);
  if (decision.outcome === 'rejected') throw new Error(decision.reason);
  if (decision.outcome === 'requires_human') {
    const ok = await confirm(decision.prompt);
    if (!ok) return;
  }

  const transferSigner = await leaseStrategy.getSigner();
  return transferStatechain(pass, { newHolder, signer: transferSigner });
}
```

### 3. Policy: approved recipients and expiry

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const passPolicy: AgentPolicy = {
  async evaluate(proposal: AgentProposal) {
    const { intent } = proposal;
    if (intent.type !== 'asset_transfer') {
      return { outcome: 'rejected', reason: 'Only asset_transfer intents accepted' };
    }

    // Check expiry
    if (intent.expiresAt && Date.now() > intent.expiresAt) {
      return { outcome: 'rejected', reason: 'Pass has expired' };
    }

    // Check recipient allowlist (e.g. KYC'd wallets)
    const isApproved = await recipientRegistry.isApproved(intent.to);
    if (!isApproved) {
      return {
        outcome: 'requires_human',
        prompt: `Recipient ${intent.to} is not on the approved list. Transfer anyway?`,
      };
    }

    return {
      outcome: 'approved',
      receipt: buildReceipt(proposal, 'pass-policy-v1'),
    };
  },
};
```

### 4. Verify ownership at the gate

```typescript
import { verifyStatechain } from '@totemsdk/statechain';
import { connect } from '@totemsdk/connect';

const { address } = await connect(location.origin);
const pass = await fetchPassFromWallet(address);

const valid = await verifyStatechain(pass, {
  expectedIssuer: ISSUER_ADDRESS,
  currentHolder: address,
  checkExpiry: true,
});

if (valid) openGate();
else showError('Invalid or expired pass');
```

---

## Future QVAC hook

:::tip Future QVAC hook
A QVAC agent can automate bulk pass issuance from a ticket manifest, monitor secondary-market transfer rates, auto-expire passes at event end, and trigger on-chain anchoring for audit compliance — all through the `passPolicy` boundary. The human operator only reviews flagged edge cases.
:::

---

## API reference links

- [`@totemsdk/statechain`](/api/totemsdk-statechain)
- [`@totemsdk/agent-policy`](/api/totemsdk-agent-policy)
- [`@totemsdk/wots-lease`](/api/totemsdk-wots-lease)
- [`@totemsdk/chain-provider`](/api/totemsdk-chain-provider)
- [`@totemsdk/connect`](/api/totemsdk-connect)
- [`@totemsdk/realtime`](/api/totemsdk-realtime)
