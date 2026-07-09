# @totemsdk/realtime

**Live portfolio streaming with graceful HTTP fallback.**

Maintains a persistent WebSocket connection to the Axia portfolio streaming endpoint with auto-reconnect, exponential backoff, and a TTL cache so your UI always has something to show even while reconnecting.

## Install

```bash
npm install @totemsdk/realtime
```

## What's inside

| Export | What it does |
|--------|-------------|
| `PortfolioStreamManager` | WebSocket client with auto-reconnect and connection state tracking |
| `createPortfolioStreamManager` | Factory for building a `PortfolioStreamManager` from platform adapters |
| `PortfolioCache` | TTL-based persistent portfolio cache with configurable storage adapters |
| `toPortfolioEntry` | Normalizer from raw balance shapes to `PortfolioEntry` |
| `classifyKind` | Classifies a token as `native`, `token`, or `nft` |

WebSocket events: `portfolio_snapshot` (on subscribe or resync) and `portfolio_delta` (on NEWTXPOW).

## Usage

### Subscribe to live portfolio updates

```typescript
import { PortfolioStreamManager } from '@totemsdk/realtime';

const manager = new PortfolioStreamManager(deps, {
  baseUrl: 'https://api.axia.to',
  projectId: 'your-project-id',
});

manager.addListener({
  onPortfolioUpdate(entries) {
    console.log('Portfolio:', entries);
  },
  onConnectionState(state) {
    console.log('Connection state:', state); // 'connecting' | 'connected' | 'reconnecting' | 'closed'
  },
});

manager.start(['Mx...']);

// Later
manager.stop();
```

### Using the factory function

```typescript
import { createPortfolioStreamManager } from '@totemsdk/realtime';

const manager = createPortfolioStreamManager(
  {
    websocket: new BrowserWsFactory(),
    http: httpAdapter,
    logger: loggerAdapter,
    timer: timerAdapter,
    storage: storageAdapter,
  },
  {
    baseUrl: 'https://api.axia.to',
    projectId: 'your-project-id',
  }
);
```

### Cache with fallback

```typescript
import { PortfolioCache } from '@totemsdk/realtime';

const cache = new PortfolioCache(
  { storage: storageAdapter, logger: loggerAdapter, timer: timerAdapter },
  { maxCacheAge: 30_000 }
);

// Cache is populated automatically by PortfolioStreamManager
const cached = await cache.get('Mx...');
if (cached) {
  renderPortfolio(cached); // cached is PortfolioEntry[]
}
```

### Normalize raw balance data

```typescript
import { toPortfolioEntry } from '@totemsdk/realtime';

const entry = toPortfolioEntry(
  { tokenid: '0x00', confirmed: '100', unconfirmed: '0' },
  'Mx...'
);
// entry.kind === 'native', entry.total === '100'
```

## PortfolioEntry shape

```typescript
interface PortfolioEntry {
  kind: 'native' | 'token' | 'nft';
  tokenid: string;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  total: string;
  decimals: number;
  name: string;
  ticker: string;
  artimage?: string;
  webvalidate?: string;
  address: string;
}
```

## See also

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — base adapters used by the cache
- [`@totemsdk/connect`](https://www.npmjs.com/package/@totemsdk/connect) — the extension's built-in portfolio stream for dApps
