---
id: machinepay-edge
title: MachinePay Edge
sidebar_label: MachinePay Edge
description: Pay-per-use device gateway for Wi-Fi, solar, compute, and bandwidth with policy-enforced min price and auto-shutdown.
---

# MachinePay Edge

**Type:** IoT machine-economy gateway  
**Audience:** IoT developers, mesh network operators, renewable energy traders, compute rental platforms

MachinePay Edge turns any device into a pay-per-use service — Wi-Fi hotspot, solar inverter, GPU compute node, or bandwidth relay. Micro-payments flow over Omnia channels. Policy enforces minimum price per unit, maximum unpaid usage, and auto-shutdown when credit runs out.

---

## Packages used

| Package | Role in MachinePay Edge |
|---------|------------------------|
| `@totemsdk/omnia` | Off-chain payment channels for micro-payment streams |
| `@totemsdk/omnia-hyperswarm` | Peer-to-peer connectivity for device clients |
| `@totemsdk/statechain` | Off-chain ownership of prepaid service tokens |
| `@totemsdk/agent-policy` | Min price, max unpaid usage, auto-shutdown enforcement |
| `@totemsdk/pear` | Pear runtime for edge device deployment |
| `@totemsdk/wots-lease` | WOTS key lifecycle for device signing |
| `@totemsdk/txpow` | TxPoW calibration for on-chain settlement triggers |
| `@totemsdk/lookup-client` | Resolves client wallets from the lookup network |

---

## Core integration path

### 1. Initialise the edge device

```typescript
import { createPearRuntime } from '@totemsdk/pear';
import { HyperswarmTransport } from '@totemsdk/omnia-hyperswarm';

const pear = await createPearRuntime({
  appId: `machinepay-edge:${DEVICE_ID}`,
  storage: './device-data',
});

const transport = new HyperswarmTransport({ swarm: pear.swarm });

// Advertise this device on the lookup network
await lookupClient.announce({
  address: DEVICE_WALLET_ADDRESS,
  publicKey: DEVICE_PUBLIC_KEY,
  serviceType: 'wifi-hotspot',
  pricePerMB: 100n,  // 100 satoshis per MB
});
```

### 2. MachinePay policy

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const MIN_PRICE_PER_MB_SATOSHIS = 50n;    // Floor price
const MAX_UNPAID_MB = 5;                  // Grace buffer before shutdown

const machinePolicy: AgentPolicy = {
  async evaluate(proposal: AgentProposal) {
    const { intent } = proposal;

    // New client connecting — check their prepaid credit
    if (intent.type === 'service_access') {
      const prepaidCredit = await getClientCredit(intent.clientAddress);
      if (prepaidCredit <= 0n) {
        return { outcome: 'rejected', reason: 'No prepaid credit — top up your channel first' };
      }
    }

    // Usage tick — enforce min price and unpaid buffer
    if (intent.type === 'usage_tick') {
      const offeredPrice = BigInt(intent.pricePerUnit);
      if (offeredPrice < MIN_PRICE_PER_MB_SATOSHIS) {
        return { outcome: 'rejected', reason: `Price ${offeredPrice} is below floor ${MIN_PRICE_PER_MB_SATOSHIS}` };
      }

      const unpaidUsage = await getUnpaidUsage(intent.clientAddress);
      if (unpaidUsage >= MAX_UNPAID_MB) {
        return {
          outcome: 'rejected',
          reason: `Max unpaid buffer (${MAX_UNPAID_MB} MB) reached — service suspended`,
        };
      }
    }

    // Manual override — auto-shutdown
    if (intent.type === 'auto_shutdown') {
      return {
        outcome: 'requires_human',
        prompt: 'Auto-shutdown triggered by policy. Confirm service suspension?',
      };
    }

    return { outcome: 'approved', receipt: buildReceipt(proposal, `machine-policy:${DEVICE_ID}`) };
  },
};
```

### 3. Micro-payment stream over a channel

```typescript
import { openChannel, updateChannel } from '@totemsdk/omnia';

// Client opens a channel to the device
const channel = await openChannel({
  counterpartyKey: DEVICE_PUBLIC_KEY,
  localAmount: 10_000_000n,  // 10 MIN prepaid
  remoteAmount: 0n,
  transport,
  chainProvider,
  wotsLease: clientSigner,
});

// Every MB consumed triggers a channel update
device.on('mb_consumed', async ({ clientAddress, mb }) => {
  const proposal = buildProposal('usage_tick', {
    clientAddress,
    pricePerUnit: String(100n),   // 100 sat/MB
    units: mb,
  });

  const decision = await machinePolicy.evaluate(proposal);
  if (decision.outcome !== 'approved') {
    return device.suspend(clientAddress, decision.reason ?? 'policy_block');
  }

  await updateChannel(channel, { localDelta: -(100n * BigInt(mb)) });
});
```

### 4. Statechain prepaid pass

```typescript
import { createStatechain, verifyStatechain } from '@totemsdk/statechain';

// Issuer creates a 1-hour Wi-Fi pass as a statechain asset
const wifiPass = await createStatechain({
  assetId: `wifi:${DEVICE_ID}:${Date.now()}`,
  issuer: DEVICE_WALLET_ADDRESS,
  recipient: clientAddress,
  metadata: { durationMs: 3_600_000, maxMB: 500 },
  signer: deviceSigner,
});

// Client presents the pass — device verifies without an on-chain call
const valid = await verifyStatechain(wifiPass, {
  expectedIssuer: DEVICE_WALLET_ADDRESS,
  currentHolder: clientAddress,
  checkExpiry: true,
});

if (valid) device.grantAccess(clientAddress);
```

---

## Future QVAC hook

:::tip Future QVAC hook
A QVAC agent can adjust pricing dynamically based on demand (surge pricing during events, discounts at off-peak hours), automatically provision new devices into the lookup network when adding capacity, and aggregate multi-device revenue into a cooperative pool — all as proposals through `machinePolicy`. The device never exposes its signing keys to the agent.
:::

---

## API reference links

- [`@totemsdk/omnia`](/api/totemsdk-omnia)
- [`@totemsdk/omnia-hyperswarm`](/api/totemsdk-omnia-hyperswarm)
- [`@totemsdk/statechain`](/api/totemsdk-statechain)
- [`@totemsdk/agent-policy`](/api/totemsdk-agent-policy)
- [`@totemsdk/pear`](/api/totemsdk-pear)
- [`@totemsdk/wots-lease`](/api/totemsdk-wots-lease)
- [`@totemsdk/txpow`](/api/totemsdk-txpow)
- [`@totemsdk/lookup-client`](/api/totemsdk-lookup-client)
