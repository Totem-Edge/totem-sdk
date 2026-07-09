# @totemsdk/pear

**Run Totem SDK apps inside Holepunch's Pear/Bare runtime.**

Pear (formerly Hypercore Protocol) is a peer-to-peer application runtime. This package adapts the Totem SDK to it so you can build fully decentralised Minima dApps that run without any servers — not even a web server.

## Install

```bash
npm install @totemsdk/pear
```

## What's inside

Six sub-modules, each importing cleanly from its own path:

| Sub-module | Import path | What it provides |
|-----------|-------------|-----------------|
| **storage** | `@totemsdk/pear/storage` | Pear-native key-value and structured storage adapters for `StorageAdapter` |
| **network** | `@totemsdk/pear/network` | Hyperswarm and Hyperdrive networking adapters |
| **lifecycle** | `@totemsdk/pear/lifecycle` | Pear app lifecycle hooks (startup, shutdown, reload) |
| **hyperdrive** | `@totemsdk/pear/hyperdrive` | Hyperdrive filesystem integration (append-only distributed file system) |
| **config** | `@totemsdk/pear/config` | Pear-aware configuration management |
| **logger** | `@totemsdk/pear/logger` | Pear-compatible structured logging (`LoggerAdapter`) |

## Usage

### Start a Pear app with Totem SDK

```typescript
import { PearLifecycle } from '@totemsdk/pear/lifecycle';
import { PearStorageAdapter } from '@totemsdk/pear/storage';
import { PearLoggerAdapter } from '@totemsdk/pear/logger';
import { createLookupNode } from '@totemsdk/lookup-node';

const lifecycle = new PearLifecycle();

lifecycle.onStartup(async () => {
  const storage = new PearStorageAdapter({ prefix: 'totem' });
  const logger  = new PearLoggerAdapter({ level: 'info' });

  // All SDK modules accept these standard adapter interfaces
  const node = await createLookupNode({
    dbPath: './data/lookup.db',
    storage,
    logger,
  });

  await node.start();
  console.log('Lookup node running in Pear:', node.publicKey);
});

lifecycle.onShutdown(async () => {
  await node.stop();
});

lifecycle.start();
```

### Pear storage adapter

```typescript
import { PearStorageAdapter } from '@totemsdk/pear/storage';

const storage = new PearStorageAdapter({ prefix: 'my-app' });

await storage.setItem('wallet-seed', encryptedSeed);
const seed = await storage.getItem('wallet-seed');
```

### Hyperdrive integration

```typescript
import { HyperdriveAdapter } from '@totemsdk/pear/hyperdrive';

const drive = new HyperdriveAdapter({ key: drivePublicKey });
await drive.ready();

// Read / write files to a distributed, append-only filesystem
const data = await drive.get('/tokens/metadata.json');
```

### Config management

```typescript
import { PearConfig } from '@totemsdk/pear/config';

const config = new PearConfig({ namespace: 'totem-wallet' });
const nodeUrl = config.get('minimaNodeUrl', 'http://localhost:9005');
```

### Structured logging

```typescript
import { PearLoggerAdapter } from '@totemsdk/pear/logger';

const logger = new PearLoggerAdapter({ level: 'debug' });
logger.info('Node started', { publicKey: node.publicKey });
```

## See also

- [`@totemsdk/lookup-node`](https://www.npmjs.com/package/@totemsdk/lookup-node) — personal lookup node that runs inside Pear
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — payment channel swarm also Bare/Pear compatible
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — `StorageAdapter` and `LoggerAdapter` interfaces implemented here
