# @totemsdk/lookup-client

**Connect to your personal lookup node from any app.**

Provides a typed client over the Hyperswarm DHT (or a direct transport for testing) that lets your app query chain state, subscribe to real-time coin updates, and broadcast transactions — without a local Minima node and without Axia servers.

## Install

```bash
npm install @totemsdk/lookup-client
```

## What's inside

| Export | What it does |
|--------|-------------|
| `connectLookupNode(config)` | Returns a connected `LookupClient` over Hyperswarm or direct transport |
| `getCoins(query)` | Fetch coins for an address |
| `subscribeCoinUpdates(callback)` | Real-time push events on UTXO changes |
| `watchAddress(address)` | Register an address for push notifications |
| `LookupClientProvider` | Implements `ChainStateProvider` — plugs into `@totemsdk/chain-provider` |
| `createInMemoryPair()` | In-process transport pair for unit testing |

## Usage

### Connect and query coins

```typescript
import { connectLookupNode } from '@totemsdk/lookup-client';

const client = await connectLookupNode({
  publicKey: '...your-lookup-node-public-key...',  // the node's Hyperswarm identity
});

const coins = await client.getCoins({ address: 'Mx...' });
console.log('Coins:', coins);
```

### Subscribe to real-time UTXO updates

```typescript
const unsubscribe = client.subscribeCoinUpdates((event) => {
  if (event.type === 'COIN_UPDATE') {
    console.log('Coin changed:', event.coinId, event.status);
  }
});

// Watch a specific address
await client.watchAddress('Mx...');

// Clean up
unsubscribe();
await client.disconnect();
```

### Plug into chain-provider

```typescript
import { LookupClientProvider } from '@totemsdk/lookup-client';
import { CompositeProvider, HostedProvider } from '@totemsdk/chain-provider';

const lookupProvider = new LookupClientProvider({
  publicKey: '...lookup-node-pubkey...',
});

// Use as primary; fall back to hosted
const provider = new CompositeProvider([lookupProvider, new HostedProvider({ ... })]);
```

### In-process testing

```typescript
import { createInMemoryPair } from '@totemsdk/lookup-client';

const [clientTransport, serverTransport] = createInMemoryPair();
// Wire serverTransport into a test LookupNode and clientTransport into LookupClient
```

## See also

- [`@totemsdk/lookup-node`](https://www.npmjs.com/package/@totemsdk/lookup-node) — the server this client connects to
- [`@totemsdk/lookup-protocol`](https://www.npmjs.com/package/@totemsdk/lookup-protocol) — shared message type definitions
- [`@totemsdk/chain-provider`](https://www.npmjs.com/package/@totemsdk/chain-provider) — `ChainStateProvider` interface
