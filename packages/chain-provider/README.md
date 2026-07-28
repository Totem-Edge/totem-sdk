# @totemsdk/chain-provider

**Unified abstraction over all chain data sources.**

A strategy pattern for chain access. Any Totem SDK tool that needs on-chain data accepts a `ChainStateProvider`. Swap implementations without changing application code.

## Install

```bash
npm install @totemsdk/chain-provider
```

## What's inside

### The interface

```typescript
interface ChainStateProvider {
  getCoins(query: CoinsQuery): Promise<Coin[]>;
  getCoin(coinId: string): Promise<Coin | null>;
  getProof(coinId: string): Promise<MMRProof>;
  getTip(): Promise<ChainTip>;
  getToken(tokenId: string): Promise<TokenInfo>;
  searchTokens(query: TokenSearchQuery): Promise<TokenInfo[]>;
  getTokensByCreator(address: string): Promise<TokenInfo[]>;
  broadcastTxPoW(txpowHex: string): Promise<BroadcastResult>;
}
```

### Concrete implementations

| Class | Connects to |
|-------|------------|
| `HostedProvider` | Axia / MEG hosted API (requires project credentials) |
| `PureMinimaRpcProvider` | A local or self-hosted PureMinima node directly |
| `LookupClientProvider` | A personal lookup node over Hyperswarm DHT (via `@totemsdk/lookup-client`) |
| `CompositeProvider` | Fans out across multiple providers with fallback logic |

Five other packages (`omnia`, `statechain`, `lookup-node`, `lookup-client`, `chain-provider` itself) accept `ChainStateProvider` — this is the pivot point between the upper SDK and chain data.

## Usage

### Hosted provider (fastest setup)

```typescript
import { HostedProvider } from '@totemsdk/chain-provider';

const provider = new HostedProvider({
  baseUrl: 'https://api.axia.to',
  projectId: 'your-project-id',
  projectSecret: process.env.AXIA_SECRET,
});

const tip   = await provider.getTip();
const coins = await provider.getCoins({ address: 'Mx...' });
```

### Self-hosted node

```typescript
import { PureMinimaRpcProvider } from '@totemsdk/chain-provider';

const provider = new PureMinimaRpcProvider({
  nodeUrl: 'http://localhost:9005',
});
```

### Personal lookup node (sovereign, zero-Axia-dependency)

Connect directly to your own lookup node over Hyperswarm DHT. No hosted infrastructure required.

```typescript
import { LookupClientProvider } from '@totemsdk/chain-provider';
import { connectLookupNode } from '@totemsdk/lookup-client';

// Connect to your personal lookup node
const client = await connectLookupNode({ hyperswarmTopic: 'deadbeef...' });

const provider = new LookupClientProvider(client);

const tip   = await provider.getTip();
const coins = await provider.getCoins({ address: 'Mx...' });

// Clean up when done
client.disconnect();
```

`@totemsdk/lookup-client` is a peer dependency — install it separately:

```bash
npm install @totemsdk/lookup-client
```

### Composite with fallback

Fan out across providers: try sovereign first, fall back to hosted on any error.

```typescript
import { CompositeProvider, HostedProvider, LookupClientProvider } from '@totemsdk/chain-provider';
import { connectLookupNode } from '@totemsdk/lookup-client';

const client  = await connectLookupNode({ hyperswarmTopic: 'deadbeef...' });
const hosted  = new HostedProvider({ baseUrl: 'https://api.axia.to', projectId: '...' });

const provider = new CompositeProvider(
  new LookupClientProvider(client), // primary — sovereign, no Axia dependency
  hosted,                           // fallback — hosted, always available
);

// Queries hit the lookup node first; fall back to hosted on error
const tip = await provider.getTip();
```

## LookupClientLike interface

`LookupClientProvider` accepts any object that satisfies the `LookupClientLike` structural interface exported from this package. This allows testing with a mock without importing `@totemsdk/lookup-client`:

```typescript
import { LookupClientProvider } from '@totemsdk/chain-provider';
import type { LookupClientLike } from '@totemsdk/chain-provider';

const mockClient: LookupClientLike = {
  getTip: async () => ({ block: 100, hash: '0x...' }),
  getCoins: async () => [],
  // ... etc
};

const provider = new LookupClientProvider(mockClient);
```

## See also

- [`@totemsdk/pureminima-rpc`](https://www.npmjs.com/package/@totemsdk/pureminima-rpc) — the RPC client used by `PureMinimaRpcProvider`
- [`@totemsdk/lookup-client`](https://www.npmjs.com/package/@totemsdk/lookup-client) — connect to a personal lookup node over Hyperswarm DHT
- [`@totemsdk/node`](https://www.npmjs.com/package/@totemsdk/node) — Node.js `MinimaProvider`
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — uses `ChainStateProvider` for coin queries
