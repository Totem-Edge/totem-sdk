# @totemsdk/server

**Core SDK wired for Node.js — server-side wallet operations.**

Re-exports everything from `@totemsdk/core` and adds `MinimaClient`, `MinimaWallet`, `MinimaProvider`, and `sendTransaction` for running a wallet on a server or in a bot/agent.

## Install

```bash
npm install @totemsdk/server
```

Requires Node.js ≥ 18 for native `fetch`. Dependencies: `ws`, `@totemsdk/storage`, `@totemsdk/txpow`.

## Scope: submission ≠ settlement

`sendTransaction()` returns as soon as the TxPoW is **submitted** for broadcast
(`status: 'submitted'`, `settlement: 'unverified'`) — it does **not** wait for the
transaction to be included in a block. To reach a settled outcome, use
`awaitConfirmation()` (or `sendAndConfirm()`), which polls the node until the
txpowid **is a block** (`isblock === true`) or the timeout elapses.

## What's inside

| Export | What it does |
|--------|-------------|
| `sendTransaction` | End-to-end send: fetch coins → build → sign → mine → submit (non-blocking) |
| `awaitConfirmation` | Poll the node until the TxPoW is included (opt-in settlement) |
| `sendAndConfirm` | `sendTransaction` + `awaitConfirmation` in one call |
| `MinimaClient` | HTTP/WebSocket client to Axia / a Minima node |
| `MinimaWallet` | Server-side wallet (sign, derive addresses, send transactions) |
| `MinimaProvider` | HTTP/WS client with a `request(method, params)` router |
| Everything from `@totemsdk/core` | Re-exported for convenience |

## Usage

### Send a transaction (high-level, submission only)

`sendTransaction` handles the full pipeline: it fetches spendable coins from
Axia, builds and signs a transaction using a per-address WOTS TreeKey, mines the
TxPoW in a `worker_threads` Worker (non-blocking), and submits the mined TxPoW to
Axia for broadcast.

```typescript
import { sendTransaction } from '@totemsdk/server';

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

console.log('TxPoW ID:', result.txpowId, result.status, result.settlement); // 'submitted' 'unverified'
```

> **WOTS one-time key warning** — WOTS keys must only be used once.
> Use a `WatermarkStore` from `@totemsdk/core` to track which `(l1, l2)`
> indices have been consumed and always advance to a fresh pair.

### Wait for settlement

```typescript
import { MinimaProvider, awaitConfirmation } from '@totemsdk/server';

const provider = new MinimaProvider({ apiUrl: 'https://api.axia.to', apiKey: 'totem-shared' });

const confirmation = await awaitConfirmation({
  txpowId: result.txpowId,
  provider,
  timeoutMs: 120_000,
  expect: { toAddress: 'MxABC...', tokenId: '0x00', minIncrease: '10' },
});

if (confirmation.status === 'confirmed') {
  console.log('Included in block', confirmation.blockHeight, 'delta', confirmation.balanceDelta);
} else {
  console.warn('Not confirmed:', confirmation.status, confirmation.reason);
}
```

`sendAndConfirm({ ...sendParams, provider })` runs both and returns the
`SendResult` with a nested `confirmation`.

### Connect to a node and sign

```typescript
import { MinimaClient, MinimaWallet } from '@totemsdk/server';

const client = new MinimaClient({ apiUrl: 'https://api.axia.to', apiKey: 'totem-shared' });

const wallet = new MinimaWallet({ client, storagePath: './wallet.json', password: 'secret' });
const phrase = wallet.generateSeedPhrase();      // store securely
await wallet.initialize(phrase);                 // or initialize() to load an existing wallet

const account = await wallet.createAccount('main');
console.log('Address:', account.address);

const sig = await wallet.signData(Buffer.from('hello world'), account.address);
console.log('Signature:', Buffer.from(sig).toString('hex'));
```

### Use the provider router

`MinimaProvider` is not a full `@totemsdk/chain-provider` `ChainStateProvider`;
it exposes a `request(method, params)` router over Axia/Minima RPC.

```typescript
import { MinimaProvider } from '@totemsdk/server';

const provider = new MinimaProvider({ apiUrl: 'https://api.axia.to', apiKey: 'totem-shared' });

const blockHeight = await provider.request('minima_getBlockHeight');
const utxos       = await provider.request('minima_getUTXOs', { address: 'Mx...' });
const txpow       = await provider.request('minima_getTxPow', { txpowId: '0x...' });
```

## See also

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — cryptographic primitives (re-exported by this package)
- [`@totemsdk/chain-provider`](https://www.npmjs.com/package/@totemsdk/chain-provider) — provider interface and composites
- [`@totemsdk/txpow`](https://www.npmjs.com/package/@totemsdk/txpow) — proof-of-work mining
- [`@totemsdk/tx-builder`](https://www.npmjs.com/package/@totemsdk/tx-builder) — raw transaction construction


## Testing

Tests live outside the published package in `tests/unit/server/`. Package `test:*` scripts are repository delegates.
