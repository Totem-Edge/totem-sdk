---
id: channel-factory-wallet
title: Channel Factory Wallet
sidebar_label: Channel Factory Wallet
description: Group N-of-N factory channels with policy-defined roles, virtual channel limits, and emergency-close rules.
---

# Channel Factory Wallet

**Type:** Multi-party channel infrastructure  
**Audience:** DAOs, cooperatives, multi-sig wallet operators, liquidity providers

Channel Factory Wallet creates and manages **N-of-N group channels** — a single on-chain UTXO backing a factory from which unlimited virtual channels can be opened off-chain. Policy defines participant roles, virtual channel count limits, balance floors, and emergency-close triggers.

---

## Packages used

| Package | Role in Channel Factory Wallet |
|---------|-------------------------------|
| `@totemsdk/omnia-factory` | N-of-N group channel creation and virtual channel management |
| `@totemsdk/omnia` | Underlying eltoo state machine for each virtual channel |
| `@totemsdk/omnia-splice` | Resize factory capacity without closing |
| `@totemsdk/agent-policy` | Role-based access, virtual channel limits, emergency rules |
| `@totemsdk/wots-lease` | Per-participant WOTS key lifecycle |
| `@totemsdk/txpow` | TxPoW calibration for factory open/close |
| `@totemsdk/chain-provider` | On-chain factory anchoring and settlement |

---

## Core integration path

### 1. Create the factory channel

```typescript
import { createChannelFactory } from '@totemsdk/omnia-factory';
import { createSharedLeaseStrategy } from '@totemsdk/wots-lease';

// All N participants must call createChannelFactory with matching params
const factory = await createChannelFactory({
  participants: [
    { publicKey: alicePubKey, role: 'admin', quota: 10_000_000n },
    { publicKey: bobPubKey,   role: 'member', quota: 5_000_000n },
    { publicKey: carolPubKey, role: 'member', quota: 5_000_000n },
  ],
  totalCapacity: 20_000_000n,  // 20 MIN
  chainProvider,
  signers: participantSigners,
});

console.log('Factory channel ID:', factory.factoryId);
```

### 2. Open a virtual channel from the factory

```typescript
import { openVirtualChannel } from '@totemsdk/omnia-factory';

const virtualChannel = await openVirtualChannel(factory, {
  initiator: alicePubKey,
  responder: bobPubKey,
  localAmount: 2_000_000n,
  remoteAmount: 2_000_000n,
  signer: aliceSigner,
});
```

### 3. Factory policy: roles and limits

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const VIRTUAL_CHANNEL_LIMIT: Record<string, number> = {
  admin: 20,
  member: 5,
};

const factoryPolicy: AgentPolicy = {
  async evaluate(proposal: AgentProposal) {
    const { intent, requestedBy } = proposal;

    if (intent.type === 'virtual_channel_open') {
      const participant = factory.participants.find(p => p.publicKey === requestedBy.id);
      if (!participant) return { outcome: 'rejected', reason: 'Not a factory participant' };

      const currentCount = await countVirtualChannels(requestedBy.id);
      const limit = VIRTUAL_CHANNEL_LIMIT[participant.role] ?? 1;

      if (currentCount >= limit) {
        return { outcome: 'rejected', reason: `${participant.role} limit of ${limit} virtual channels reached` };
      }
    }

    if (intent.type === 'emergency_close') {
      if (requestedBy.id !== ADMIN_KEY) {
        return { outcome: 'rejected', reason: 'Only admin can trigger emergency close' };
      }
      return { outcome: 'requires_human', prompt: 'Confirm emergency close of ALL factory channels?' };
    }

    return { outcome: 'approved', receipt: buildReceipt(proposal, 'factory-policy-v1') };
  },
};
```

### 4. Splice capacity without closing

```typescript
import { spliceFactory } from '@totemsdk/omnia-splice';

// All participants sign a splice to increase factory capacity
const spliced = await spliceFactory(factory, {
  additionalCapacity: 10_000_000n,  // Add 10 MIN
  signers: allParticipantSigners,
  chainProvider,
});

console.log('New capacity:', spliced.totalCapacity);
```

---

## Future QVAC hook

:::tip Future QVAC hook
A QVAC agent can monitor factory utilisation and automatically propose capacity splices when utilisation exceeds a threshold, reallocate member quotas based on usage patterns, and coordinate cooperative close when all virtual channels are settled. The `factoryPolicy` is the boundary where every QVAC-proposed state change is approved or blocked.
:::

---

## API reference links

- [`@totemsdk/omnia-factory`](/api/totemsdk-omnia-factory)
- [`@totemsdk/omnia`](/api/totemsdk-omnia)
- [`@totemsdk/omnia-splice`](/api/totemsdk-omnia-splice)
- [`@totemsdk/agent-policy`](/api/totemsdk-agent-policy)
- [`@totemsdk/wots-lease`](/api/totemsdk-wots-lease)
- [`@totemsdk/txpow`](/api/totemsdk-txpow)
- [`@totemsdk/chain-provider`](/api/totemsdk-chain-provider)
