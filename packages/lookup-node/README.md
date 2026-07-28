# @totemsdk/lookup-node

**Run your own always-on personal lookup node.**

The server-side complement to `@totemsdk/lookup-client`. A full Node.js daemon that indexes chain state, pushes real-time coin updates to connected clients, relays transactions, coordinates WOTS leases, and maintains a peer registry — all over the Hyperswarm DHT with no central server.

## Install

```bash
npm install @totemsdk/lookup-node
```

Requires Node.js ≥ 18. Uses `better-sqlite3` for persistent storage.

## What's inside

| Class | What it does |
|-------|-------------|
| `LookupNode` | Main node instance — connection management, start/stop lifecycle |
| `SqliteStore` / `SqliteStorageAdapter` | `better-sqlite3`-backed persistent storage |
| `WatchlistManager` | Tracks subscribed addresses; pushes `COIN_UPDATE` events to connected clients |
| `TxPoWRelay` | Relays transactions to the broader Minima network |
| `LeaseCoordinator` | Coordinates WOTS key leases across connected clients |
| `AppRegistry` / `AgentRegistry` | Discovery registries for dApps and AI agents |
| `TrustIndex` | Peer trust scoring |
| `HyperswarmManager` / `HyperswarmTransport` | P2P connectivity over the Hyperswarm DHT |

## Usage

### Start a lookup node

```typescript
import { createLookupNode } from '@totemsdk/lookup-node';

const node = await createLookupNode({
  // Path to SQLite database file
  dbPath: './lookup-node.db',

  // Minima node to index from
  minimaNodeUrl: 'http://localhost:9005',

  // Optional: listen on a specific Hyperswarm topic key
  // (auto-generated if omitted; clients use your public key to find you)
  seed: process.env.LOOKUP_NODE_SEED,
});

await node.start();
console.log('Lookup node public key:', node.publicKey);
// Share this key with clients that want to connect

process.on('SIGINT', () => node.stop());
```

### Access internal services

```typescript
// Register an app in the discovery registry
await node.appRegistry.announce({
  appId: 'my-dapp',
  name: 'My DApp',
  url: 'https://my-dapp.example.com',
});

// Check peer trust score
const trust = node.trustIndex.getScore(peerPublicKey);

// Relay a signed transaction
await node.txPoWRelay.broadcast(signedTxHex);
```

## See also

- [`@totemsdk/lookup-client`](https://www.npmjs.com/package/@totemsdk/lookup-client) — the client that connects to this node
- [`@totemsdk/lookup-protocol`](https://www.npmjs.com/package/@totemsdk/lookup-protocol) — shared wire protocol types
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — WOTS key safety coordinated by `LeaseCoordinator`
- [`@totemsdk/pureminima-rpc`](https://www.npmjs.com/package/@totemsdk/pureminima-rpc) — RPC used to index from a Minima node
