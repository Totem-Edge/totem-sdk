# @totemsdk/omnia-factory

**Scale payment channels — N-of-N funded factory channels with virtual sub-channels.**

Enables a Lightning-like channel factory pattern: a single on-chain UTXO funds a factory, and virtual channels between factory participants open and close off-chain. Dramatically reduces on-chain footprint for active participants.

## Install

```bash
npm install @totemsdk/omnia-factory
```

## What's inside

- **N-of-N MULTISIG funding** — one on-chain UTXO funds the factory; all participants co-sign the funding transaction
- **Virtual channel management** — open sub-channels between any factory participants without any on-chain transactions
- **Factory settlement** — settle multiple virtual channels in a single on-chain transaction when participants exit
- **Reduced footprint** — 10 participants with 45 active channels = still just 1 on-chain UTXO

## Usage

### Create a factory

```typescript
import { createChannelFactory } from '@totemsdk/omnia-factory';

const factory = await createChannelFactory({
  participants: [
    { address: 'MxAAA...', publicKey: '0x...' },
    { address: 'MxBBB...', publicKey: '0x...' },
    { address: 'MxCCC...', publicKey: '0x...' },
  ],
  fundingAmount: '1000',
  tokenid: '0x00',
  signer,
  provider,
  leaseProvider,
});

console.log('Factory ID:', factory.id);
console.log('Funding TxPoW ID:', factory.fundingTxpowId);
```

### Open a virtual channel inside the factory

```typescript
const virtualChannel = await factory.openVirtualChannel({
  from: 'MxAAA...',
  to: 'MxBBB...',
  amount: '50',
});

// Use like a regular OmniaChannel
await virtualChannel.pay({ amount: '5', tokenid: '0x00', recipient: 'MxBBB...' });
```

### Settle and exit

```typescript
// Settle all virtual channels involving a participant in one on-chain tx
const settlementHex = await factory.settle({ exitParticipant: 'MxAAA...' });
await provider.broadcastTxPoW(settlementHex);
```

## See also

- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — core channel state machine used by virtual channels
- [`@totemsdk/omnia-router`](https://www.npmjs.com/package/@totemsdk/omnia-router) — route payments across factory and direct channels
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — WOTS key safety for factory signing
- [`@totemsdk/tx-builder`](https://www.npmjs.com/package/@totemsdk/tx-builder) — builds the N-of-N funding transaction
