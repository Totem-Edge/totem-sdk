---
id: omnia-pocket
title: Omnia Pocket
sidebar_label: Omnia Pocket
description: Mobile/Pear off-chain payment-channel wallet with policy guards on channel size, auto-pay limits, and settlement triggers.
---

# Omnia Pocket

**Type:** Mobile payment-channel wallet  
**Audience:** Mobile developers, Pear/Holepunch app builders, everyday payment apps

Omnia Pocket is a lightweight eltoo payment-channel wallet that runs on mobile (via Pear runtime) and enables near-instant off-chain payments. Policy guards set channel size limits, auto-pay caps, and trigger settlement when a channel balance dips below a safety floor.

---

## Packages used

| Package | Role in Omnia Pocket |
|---------|---------------------|
| `@totemsdk/omnia` | Core eltoo state machine — open, update, close channels |
| `@totemsdk/omnia-hyperswarm` | Peer discovery and transport for channel counterparties |
| `@totemsdk/agent-policy` | Guards on channel size, auto-pay limits, settlement triggers |
| `@totemsdk/pear` | Pear/Holepunch runtime integration for mobile/desktop |
| `@totemsdk/wots-lease` | Manages WOTS signing keys for each channel state update |
| `@totemsdk/txpow` | Calibrates TxPoW for on-chain open/close transactions |
| `@totemsdk/chain-provider` | Submits channel-open and settlement transactions |
| `@totemsdk/lookup-client` | Resolves counterparty addresses from the lookup network |

---

## Core integration path

### 1. Initialise the Pear runtime

```typescript
import { createPearRuntime } from '@totemsdk/pear';

const pear = await createPearRuntime({
  appId: 'omnia-pocket',
  storage: './wallet-data',
  network: 'mainnet',
});

await pear.ready();
```

### 2. Open a payment channel

```typescript
import { openChannel } from '@totemsdk/omnia';
import { HyperswarmTransport } from '@totemsdk/omnia-hyperswarm';
import { createSharedLeaseStrategy } from '@totemsdk/wots-lease';

const transport = new HyperswarmTransport({ swarm: pear.swarm });
const leaseStrategy = createSharedLeaseStrategy({ storage: pear.storage, storageKey: 'wots-lease' });

const channel = await openChannel({
  counterpartyKey: resolvedCounterparty.publicKey,
  localAmount: 50_000_000n,   // 50 MIN
  remoteAmount: 50_000_000n,
  transport,
  chainProvider: getChainProvider({ nodeUrl: NODE_URL }),
  wotsLease: await leaseStrategy.getSigner(),
});
```

### 3. Pocket payment policy

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const pocketPolicy: AgentPolicy = {
  async evaluate(proposal: AgentProposal) {
    const { intent } = proposal;
    if (intent.type !== 'channel_update') {
      return { outcome: 'rejected', reason: 'Omnia Pocket only handles channel_update intents' };
    }

    const amount = BigInt(intent.localDelta);

    // Block overspend — can't go negative
    if (amount > channel.localBalance) {
      return { outcome: 'rejected', reason: 'Insufficient channel balance' };
    }

    // Auto-pay up to 1 MIN per update
    if (amount <= 1_000_000n) {
      return { outcome: 'approved', receipt: buildReceipt(proposal, 'pocket-auto') };
    }

    // Require confirmation for larger amounts
    return {
      outcome: 'requires_human',
      prompt: `Approve channel payment of ${amount / 1_000_000n} MIN?`,
    };
  },
};
```

### 4. Send a payment over the channel

```typescript
import { updateChannel } from '@totemsdk/omnia';

async function pay(amountMin: bigint) {
  const proposal = buildProposal('channel_update', { localDelta: String(amountMin * 1_000_000n) });
  const decision = await pocketPolicy.evaluate(proposal);

  if (decision.outcome === 'rejected') throw new Error(decision.reason);
  if (decision.outcome === 'requires_human') await confirmDialog(decision.prompt);

  return updateChannel(channel, {
    localDelta: -(amountMin * 1_000_000n),
    signer: await leaseStrategy.getSigner(),
  });
}
```

---

## Future QVAC hook

:::tip Future QVAC hook
A QVAC agent can auto-top-up channels from the on-chain wallet when balance drops, negotiate routing paths for payments beyond direct peers, and schedule settlement windows during off-peak hours. All channel state mutations flow through `pocketPolicy` — the agent never touches keys directly.
:::

---

## API reference links

- [`@totemsdk/omnia`](/api/totemsdk-omnia)
- [`@totemsdk/omnia-hyperswarm`](/api/totemsdk-omnia-hyperswarm)
- [`@totemsdk/agent-policy`](/api/totemsdk-agent-policy)
- [`@totemsdk/pear`](/api/totemsdk-pear)
- [`@totemsdk/wots-lease`](/api/totemsdk-wots-lease)
- [`@totemsdk/txpow`](/api/totemsdk-txpow)
- [`@totemsdk/chain-provider`](/api/totemsdk-chain-provider)
- [`@totemsdk/lookup-client`](/api/totemsdk-lookup-client)
