# @totemsdk/node

**Core SDK wired for Node.js — server-side wallet operations.**

Re-exports everything from `@totemsdk/core` and adds `MinimaClient`, `MinimaWallet`, `MinimaProvider`, and `sendTransaction` for running a wallet on a server or in a bot/agent.

## Install

```bash
npm install @totemsdk/node @noble/hashes
```

Requires Node.js ≥ 16. Dependencies: `node-fetch`, `ws`.

## What's inside

| Export | What it does |
|--------|-------------|
| `sendTransaction` | End-to-end send: fetch coins → build → sign → mine → submit |
| `MinimaClient` | WebSocket/HTTP client to a running Minima node |
| `MinimaWallet` | Server-side wallet (sign, derive addresses, send transactions) |
| `MinimaProvider` | Node.js `ChainStateProvider` implementation |
| Everything from `@totemsdk/core` | Re-exported for convenience |

## Usage

### Send a transaction (high-level)

`sendTransaction` handles the entire lifecycle: it fetches spendable coins from
Axia, builds and signs a transaction using a per-address WOTS TreeKey, mines
the TxPoW in a `worker_threads` Worker (non-blocking), and submits the mined
TxPoW to Axia for broadcast on the Minima network.

```typescript
import { sendTransaction } from '@totemsdk/node';

const result = await sendTransaction({
  seed: 'word1 word2 ... word24', // 24-word Minima seed phrase
  addressIndex: 0,                // account index (0-63)
  toAddress: 'MxABC...',          // recipient (Mx or hex)
  amount: '10',                   // amount in MIN (decimal string)
  tokenId: '0x00',                // optional, defaults to native MIN
  axiaBaseUrl: 'https://api.axia.to',
  apiKey: 'ak_live_...',          // Axia API key
  signingIndices: { l1: 0, l2: 0 }, // WOTS one-time indices — must be unique per tx!
});

console.log('TxPoW ID:', result.txpowId);
console.log(`Mined in ${result.elapsedMs}ms via ${result.miningSource}`);
```

> **WOTS one-time key warning** — WOTS keys must only be used once.
> Use a `WatermarkStore` from `@totemsdk/core` to track which `(l1, l2)`
> indices have been consumed and always advance to a fresh pair.

### Connect to a node and sign

```typescript
import { MinimaClient, MinimaWallet } from '@totemsdk/node';

const client = new MinimaClient({ nodeUrl: 'http://localhost:9005' });
const wallet = new MinimaWallet({ client });

// Initialize a fresh wallet (or pass a 24-word phrase to restore)
const seedPhrase = await wallet.initialize();
console.log('Seed phrase (store securely!):', seedPhrase);

// Derive an address
const account = await wallet.createAccount('main');
console.log('Address:', account.address);

// Sign arbitrary data
const sig = await wallet.signData(Buffer.from('hello world'), account.address);
console.log('Signature:', Buffer.from(sig).toString('hex'));
```

### Use as a chain provider

```typescript
import { MinimaClient, MinimaProvider } from '@totemsdk/node';

const client   = new MinimaClient({ nodeUrl: 'http://localhost:9005' });
const provider = new MinimaProvider(client);

const tip   = await provider.getChainTip();
const coins = await provider.getCoins({ address: 'Mx...' });
```

## See also

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — cryptographic primitives (re-exported by this package)
- [`@totemsdk/chain-provider`](https://www.npmjs.com/package/@totemsdk/chain-provider) — provider interface and composites
- [`@totemsdk/txpow`](https://www.npmjs.com/package/@totemsdk/txpow) — proof-of-work mining
- [`@totemsdk/tx-builder`](https://www.npmjs.com/package/@totemsdk/tx-builder) — raw transaction construction
