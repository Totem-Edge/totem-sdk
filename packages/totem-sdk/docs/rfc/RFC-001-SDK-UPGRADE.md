# RFC-001: Totem SDK Upgrade - WOTS Lifecycle, Streaming & RPC

**Status:** Draft  
**Created:** 2025-11-26  
**Authors:** Axia Platform Team  
**Reviewers:** [Pending stakeholder assignment]

---

## 1. Summary

This RFC proposes a comprehensive upgrade to the Totem SDK to extract production-proven components from the Totem Wallet (browser extension) into platform-agnostic SDK modules. The upgrade enables external developers to build wallets, dApps, and services on the Axia/Minima blockchain with proper WOTS signature handling, real-time balance streaming, and quota management.

## 2. Motivation

### Current State
The Totem Wallet has evolved significantly with battle-tested features:
- WOTS Lease/Watermark lifecycle management
- MEG real-time balance streaming
- Production-grade RPC client with quota tracking
- Transaction orchestration (prepare → sign → finalize)

However, the current SDK (`packages/totem-sdk`) only exposes:
- Core WOTS cryptographic primitives
- Basic lease-client (prepare/finalize functions)
- Placeholder wallet/client classes

### Problem Statement
External developers cannot safely build transaction flows without:
1. Lease lifecycle management (TTL monitoring, expiry callbacks)
2. Watermark synchronization (multi-device safety, index reuse prevention)
3. Proper error handling and retry logic
4. Real-time balance updates

### Goals
1. Extract wallet components into platform-agnostic SDK modules
2. Define clean adapter interfaces for storage, networking, and auth
3. Enable React, Node.js, Chrome Extensions, and React Native support
4. Maintain backward compatibility with existing SDK consumers
5. **Critical:** Protect existing wallet initialization flow during migration

## 3. Proposed Architecture

### 3.1 Package Structure

```
packages/totem-sdk/
├── packages/
│   ├── core/                    # Platform-agnostic primitives (existing)
│   │   ├── src/
│   │   │   ├── wots/           # WOTS crypto (existing)
│   │   │   ├── mmr/            # Merkle Mountain Range (existing)
│   │   │   ├── lease/          # NEW: LeaseStore, WatermarkStore, LeaseMonitor
│   │   │   ├── tx/             # NEW: TransactionService, lifecycle
│   │   │   ├── adapters/       # NEW: Interface definitions
│   │   │   └── utils/          # Shared utilities
│   │   └── package.json
│   │
│   ├── client/                  # NEW: Axia API client layer
│   │   ├── src/
│   │   │   ├── rpc/            # AxiaRpcClient, JSON-RPC 2.0
│   │   │   ├── quota/          # QuotaTracker, rate limiting
│   │   │   └── errors/         # Typed error classes
│   │   └── package.json
│   │
│   ├── realtime/                # NEW: Real-time streaming
│   │   ├── src/
│   │   │   ├── balance/        # MegBalanceStreamManager
│   │   │   ├── cache/          # BalanceCache
│   │   │   └── events/         # Event streaming infrastructure
│   │   └── package.json
│   │
│   ├── browser/                 # Browser adapter implementations
│   │   ├── src/
│   │   │   ├── storage/        # chrome.storage / localStorage
│   │   │   ├── websocket/      # Native WebSocket
│   │   │   └── fetch/          # Native fetch
│   │   └── package.json
│   │
│   ├── node/                    # Node.js adapter implementations
│   │   ├── src/
│   │   │   ├── storage/        # fs / memory storage
│   │   │   ├── websocket/      # ws library
│   │   │   └── fetch/          # node-fetch
│   │   └── package.json
│   │
│   └── react-native/            # React Native adapters (follow-up)
│       └── package.json
│
├── examples/
│   ├── node-wallet/             # CLI wallet example
│   └── browser-dapp/            # Web dApp example
│
└── docs/
    └── rfc/
        └── RFC-001-SDK-UPGRADE.md
```

### 3.2 Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│   (Totem Wallet, Partner Wallets, dApps, Backend Services)      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Platform Adapters                           │
│   ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐       │
│   │   browser   │  │    node     │  │   react-native   │       │
│   └─────────────┘  └─────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SDK Feature Packages                        │
│   ┌─────────────┐  ┌─────────────┐                              │
│   │   client    │  │  realtime   │                              │
│   │ (RPC/Quota) │  │ (Streaming) │                              │
│   └─────────────┘  └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SDK Core                                │
│   ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐  ┌────────┐ │
│   │  wots  │  │  lease │  │   tx   │  │ adapters │  │  utils │ │
│   └────────┘  └────────┘  └────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 MV3 Background Integration (Chrome Extension)

The Chrome Extension environment requires special consideration due to Manifest V3 (MV3) service worker constraints. This section documents the current production implementation and the path to SDK extraction.

#### 3.3.1 MV3 Service Worker Architecture

Chrome MV3 service workers have unique lifecycle characteristics:
- **Ephemeral execution:** Service workers can be terminated after 30 seconds of inactivity
- **No persistent WebSocket:** Connections must be re-established on wake
- **Port-based messaging:** UI (popup) communicates with background via `chrome.runtime.connect()`

The Totem Extension implements a port-based messaging architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Popup UI (React)                            │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  useBalanceStream hook                                   │   │
│   │  → chrome.runtime.connect({ name: 'balance-stream' })   │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Port Messages
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Background Service Worker                        │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  chrome.runtime.onConnect handler                        │   │
│   │  → balance-stream port handler                           │   │
│   │    → MegBalanceStreamManager singleton                   │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / HTTP Fallback
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MEG Balance API                               │
│   wss://api.axia.network/v1/meg/balance/ws                      │
│   https://api.axia.network/v1/meg/balance (fallback polling)    │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.3.2 Balance-Stream Port Contract

The `balance-stream` port uses a well-defined message protocol:

**Inbound Messages (UI → Background):**

| Message Type | Payload | Description |
|--------------|---------|-------------|
| `START_STREAM` | `{ addresses: string[] }` | Start streaming for addresses |
| `STOP_STREAM` | `{}` | Stop all streaming |
| `UPDATE_ADDRESSES` | `{ addresses: string[] }` | Update watched addresses |
| `GET_CACHED` | `{ address: string }` | Get cached balance |

**Outbound Messages (Background → UI):**

| Message Type | Payload | Description |
|--------------|---------|-------------|
| `BALANCE_UPDATE` | `BalanceUpdateEvent` | Real-time balance change |
| `TX_CONFIRMATION` | `TxConfirmationEvent` | Transaction confirmed |
| `CONNECTION_STATE` | `{ state: string, error?: string }` | Connection status change |
| `CACHED_BALANCE` | `{ address: string, balance: CachedBalance }` | Cached balance response |

**Connection States:**
- `connecting` - Establishing WebSocket connection
- `connected` - WebSocket active
- `polling` - Fallback to HTTP polling
- `disconnected` - No connection

#### 3.3.3 WebSocketFactory Realization

The current implementation uses a singleton `MegBalanceStreamManager` that owns the WebSocket connection. This differs from the adapter pattern proposed in Section 4.3.

**Current Implementation (Totem Extension):**
```typescript
// packages/totem-extension/src/core/balance/MegBalanceStreamManager.ts
class MegBalanceStreamManager {
  private ws: WebSocket | null = null;
  private pollInterval: number | null = null;
  
  async connect(addresses: string[]): Promise<void> {
    // Native WebSocket usage - not abstracted
    this.ws = new WebSocket(`${WS_URL}?addresses=${addresses.join(',')}`);
  }
}
```

**Future SDK Extraction (`@totem/sdk-realtime`):**
```typescript
// packages/totem-sdk/packages/realtime/src/MegBalanceStreamManager.ts
class MegBalanceStreamManager {
  constructor(
    private wsFactory: WebSocketFactory,  // Injected adapter
    private http: HttpClient,
    private tokenProvider: AuthTokenProvider,
    private timer: TimerAdapter
  ) {}
  
  async connect(addresses: string[]): Promise<void> {
    // Uses injected WebSocketFactory adapter
    this.ws = this.wsFactory.create(`${WS_URL}?addresses=${addresses.join(',')}`);
  }
}
```

#### 3.3.4 SDK Extraction Roadmap

The balance streaming integration is currently tightly coupled to the Chrome Extension. The extraction path:

1. **Phase 1 (Current):** Production-proven in Totem Extension
   - `MegBalanceStreamManager` in `packages/totem-extension/src/core/balance/`
   - Port handler in `background/index.ts`
   - Works independently of SDK migration flag

2. **Phase 2 (Planned):** Extract to `@totem/sdk-realtime`
   - Refactor to use adapter interfaces (WebSocketFactory, TimerAdapter)
   - Create browser adapter that wraps native WebSocket
   - Maintain singleton pattern via dependency injection

3. **Phase 3 (Planned):** Extension Integration
   - Totem Extension imports from `@totem/sdk-realtime`
   - Port handler remains in extension (MV3-specific)
   - Adapters injected at initialization

**Key Consideration:** The port-based messaging layer (`balance-stream` handler) will remain in the extension codebase as it's specific to Chrome MV3 architecture. The SDK will expose the streaming logic, while the extension wires it to the MV3 port system.

## 4. Adapter Interfaces

### 4.1 StorageAdapter

```typescript
/**
 * Platform-agnostic storage interface
 * Implementations: ChromeStorageAdapter, NodeFsAdapter, MemoryAdapter
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  
  // Optional batch operations for performance
  getMultiple?<T>(keys: string[]): Promise<Record<string, T | null>>;
  setMultiple?<T>(entries: Record<string, T>): Promise<void>;
}
```

### 4.2 ConfigProvider

```typescript
/**
 * Provides API configuration (base URL, project ID, quotas)
 * Implementations: ChromeConfigProvider, EnvConfigProvider
 */
export interface ConfigProvider {
  getApiBase(): Promise<string>;
  getProjectId(): Promise<string>;
  getQuotas(): Promise<QuotaConfig | null>;
  getRateLimits(): Promise<RateLimitConfig | null>;
  
  // Observable for config changes (optional)
  onConfigChange?(callback: (config: FullConfig) => void): () => void;
}

export interface QuotaConfig {
  daily_requests: number;
  monthly_requests: number;
}

export interface RateLimitConfig {
  rpm: number;
  burst: number;
}
```

### 4.3 WebSocketFactory

```typescript
/**
 * Creates WebSocket connections
 * Implementations: BrowserWebSocketFactory, NodeWebSocketFactory
 */
export interface WebSocketFactory {
  create(url: string, protocols?: string[]): WebSocketLike;
}

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
}
```

### 4.4 HttpClient

```typescript
/**
 * HTTP request interface
 * Implementations: BrowserFetchClient, NodeFetchClient
 */
export interface HttpClient {
  fetch(url: string, options?: RequestOptions): Promise<HttpResponse>;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | object;
  timeout?: number;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  json<T>(): Promise<T>;
  text(): Promise<string>;
}
```

### 4.5 AuthTokenProvider

```typescript
/**
 * Provides authentication tokens for WebSocket/API calls
 * Implementations: JwtTokenProvider, ApiKeyProvider
 */
export interface AuthTokenProvider {
  getToken(): Promise<string | null>;
  refreshToken(): Promise<string>;
  onTokenExpiry?(callback: () => void): () => void;
}
```

### 4.6 TimerAdapter

```typescript
/**
 * Timer abstraction for cross-platform compatibility
 * Needed for MV3 service worker lifecycle considerations
 */
export interface TimerAdapter {
  setTimeout(callback: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  setInterval(callback: () => void, ms: number): TimerHandle;
  clearInterval(handle: TimerHandle): void;
}

export type TimerHandle = number | NodeJS.Timeout;
```

## 5. Core Module Specifications

### 5.1 Lease Module (`@totemsdk/core/lease`)

#### LeaseStore
```typescript
export interface StoredLease {
  leaseId: string;
  leaseToken: string;
  indices: WotsIndices;
  expiresAt: number;
  status: LeaseStatus;
  createdAt: number;
  txId?: string;
  leaseTTL: number;
}

export type LeaseStatus = 'pending' | 'active' | 'expired' | 'finalized' | 'cancelled';

/**
 * LeaseStore uses an in-memory cache backed by persistent storage.
 * 
 * Pattern:
 * - initialize() loads from storage into memory cache
 * - Sync getters read from memory cache (fast, no I/O)
 * - Mutators update memory cache AND persist to storage
 * - Caller MUST call initialize() before using sync getters
 */
export class LeaseStore {
  constructor(storage: StorageAdapter);
  
  // === Lifecycle (async - storage I/O) ===
  initialize(): Promise<void>;           // Load from storage → memory cache
  
  // === Persistence (async - storage I/O) ===
  save(lease: StoredLease): Promise<void>;
  updateStatus(leaseId: string, status: LeaseStatus): Promise<void>;
  delete(leaseId: string): Promise<boolean>;
  cleanupExpired(): Promise<number>;
  
  // === Cache Reads (sync - memory only, requires initialize()) ===
  get(leaseId: string): StoredLease | undefined;
  getByToken(leaseToken: string): StoredLease | undefined;
  getAll(): StoredLease[];
  getActive(): StoredLease[];
  getExpiringSoon(thresholdMs?: number): StoredLease[];
  
  // === Cache State ===
  isInitialized(): boolean;
}
```

#### WatermarkStore
```typescript
export interface WotsIndices {
  l1: number;
  l2: number;
  l3: number;
}

export interface WatermarkState {
  next_l1: number;
  next_l2: number;
  next_l3: number;
  usedIndices: Array<[number, number, number]>;
  lastSyncTimestamp?: number;
  serverWatermark?: WotsIndices;
}

export interface SyncResult {
  updated: boolean;
  drift: number;
  hasConflict: boolean;
}

/**
 * WatermarkStore uses an in-memory cache backed by persistent storage.
 * 
 * Pattern:
 * - initialize() loads from storage into memory cache (or creates default)
 * - Sync getters read from memory cache (fast, no I/O)
 * - Mutators update memory cache AND persist to storage
 * - Caller MUST call initialize() before using sync getters
 */
export class WatermarkStore {
  constructor(storage: StorageAdapter);
  
  // === Lifecycle (async - storage I/O) ===
  initialize(): Promise<WatermarkState>;   // Load/create from storage → memory cache
  load(): Promise<WatermarkState | null>;  // Load only, no create
  save(state: WatermarkState): Promise<void>;
  clear(): Promise<void>;
  
  // === Persistence (async - storage I/O) ===
  markUsed(indices: WotsIndices): Promise<void>;
  advanceWatermark(indices: WotsIndices): Promise<void>;
  updateFromServer(serverWatermark: WotsIndices): Promise<SyncResult>;
  
  // === Cache Reads (sync - memory only, requires initialize()) ===
  getCurrent(): WatermarkState | null;
  getNextIndices(): WotsIndices | null;
  isExhausted(): boolean;
  hasAvailableIndices(): boolean;
  
  // === Cache State ===
  isInitialized(): boolean;
}
```

#### LeaseMonitor
```typescript
export interface LeaseExpiryEvent {
  leaseId: string;
  leaseToken: string;
  expiresAt: number;
  remainingMs: number;
}

export class LeaseMonitor {
  constructor(leaseStore: LeaseStore, timer: TimerAdapter);
  
  start(): void;
  stop(): void;
  onExpiry(callback: (event: LeaseExpiryEvent) => void): void;
}
```

### 5.2 Transaction Module (`@totemsdk/core/tx`)

```typescript
export interface PrepareRequest {
  to: string;
  amount: string;
  tokenId?: string;
  burn?: string;
  txId?: string;
}

export interface PrepareResponse {
  l1: number;
  l2: number;
  l3: number;
  leaseToken: string;
  digestTx: string;
  txId: string;
  rootPublicKey: string;
  leaseId: string;
  leaseTTL: number;
}

export interface FinalizeResponse {
  ok: boolean;
  leaseId: string;
  txpowid: string;
}

export class TransactionService {
  constructor(
    rpcClient: RpcClient,
    leaseStore: LeaseStore,
    watermarkStore: WatermarkStore
  );
  
  prepare(params: PrepareRequest, rootPublicKey: string): Promise<PrepareResponse>;
  sign(request: SignRequest, seed: Uint8Array, paramSet?: string): Promise<SignResult>;
  finalize(leaseToken: string, signedHex: string): Promise<FinalizeResponse>;
  
  // Full flow helper
  sendTransaction(params: SendParams): Promise<string>;
}
```

### 5.3 Client Module (`@totem/sdk-client`)

```typescript
export class AxiaRpcClient {
  constructor(
    config: ConfigProvider,
    http: HttpClient,
    quotaTracker?: QuotaTracker
  );
  
  call<T>(method: string, params?: any): Promise<RpcResult<T>>;
  getWatermark(rootPublicKey: string): Promise<WotsIndices>;
}

export class QuotaTracker {
  constructor(storage: StorageAdapter);
  
  trackQuota(headers: QuotaHeaders): Promise<void>;
  getQuotaStatus(): Promise<QuotaStatus>;
  onQuotaWarning(callback: (status: QuotaStatus) => void): void;
}
```

### 5.4 Realtime Module (`@totem/sdk-realtime`)

```typescript
export interface BalanceUpdate {
  address: string;
  tokenId: string;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  timestamp: number;
}

export class MegBalanceStreamManager {
  constructor(
    wsFactory: WebSocketFactory,
    http: HttpClient,
    tokenProvider: AuthTokenProvider,
    cache: BalanceCache,
    timer: TimerAdapter
  );
  
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(address: string): void;
  unsubscribe(address: string): void;
  
  onBalance(callback: (update: BalanceUpdate) => void): () => void;
  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void;
  
  getConnectionStatus(): ConnectionStatus;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'polling' | 'disconnected';

export class BalanceCache {
  constructor(storage: StorageAdapter);
  
  get(address: string, tokenId?: string): Promise<CachedBalance | null>;
  set(address: string, balance: BalanceUpdate): Promise<void>;
  getAll(): Promise<CachedBalance[]>;
}
```

## 6. Migration Safety Strategy

### 6.1 Feature Flag Infrastructure

```typescript
// In wallet config
export type InitMode = 'legacy' | 'sdk';

export interface WalletConfig {
  initMode: InitMode;
  enableTelemetry: boolean;
  fallbackOnError: boolean;
}

// Feature flag check
async function getInitMode(): Promise<InitMode> {
  const config = await storage.get<WalletConfig>('walletConfig');
  return config?.initMode ?? 'legacy';
}
```

### 6.2 Dual Code Path

```typescript
// background.ts
async function initializeWallet() {
  const mode = await getInitMode();
  
  if (mode === 'sdk') {
    try {
      await initializeWithSdk();
      telemetry.track('init_success', { mode: 'sdk' });
    } catch (error) {
      telemetry.track('init_error', { mode: 'sdk', error: error.message });
      
      if (config.fallbackOnError) {
        console.warn('SDK init failed, falling back to legacy');
        await initializeWithLegacy();
      } else {
        throw error;
      }
    }
  } else {
    await initializeWithLegacy();
    telemetry.track('init_success', { mode: 'legacy' });
  }
}
```

### 6.3 Parity Testing

```typescript
// test/parity/initialization.test.ts
describe('Initialization Parity', () => {
  it('produces identical wallet state', async () => {
    const seed = generateTestSeed();
    
    const legacyState = await initializeWithLegacy(seed);
    const sdkState = await initializeWithSdk(seed);
    
    expect(sdkState.addresses).toEqual(legacyState.addresses);
    expect(sdkState.watermark).toEqual(legacyState.watermark);
    expect(sdkState.leases).toEqual(legacyState.leases);
  });
});
```

### 6.4 Rollback Procedure

1. **Automatic rollback:** If error rate > 5% within 1 hour, auto-disable SDK mode
2. **Manual override:** `chrome.storage.local.set({ walletConfig: { initMode: 'legacy' } })`
3. **Emergency extension:** Pre-built legacy extension available for sideloading
4. **Recovery CLI:** Tool to restore watermark/lease state from backup

## 7. Acceptance Criteria

### Phase 1: Core Extraction (Tasks 5-7)
- [ ] LeaseStore, WatermarkStore, LeaseMonitor extracted with storage adapter
- [ ] TransactionService extracted with injectable RPC client
- [ ] 100% unit test coverage on extracted modules
- [ ] Parity tests pass comparing legacy vs SDK outputs

### Phase 2: Client & Realtime (Tasks 8-9)
- [ ] AxiaRpcClient with typed errors, retry logic, quota tracking
- [ ] MegBalanceStreamManager with WebSocket + HTTP fallback
- [ ] Integration tests for all network scenarios

### Phase 3: Platform Adapters (Tasks 10-11)
- [ ] Browser adapters (chrome.storage, WebSocket, fetch)
- [ ] Node.js adapters (fs, ws, node-fetch)
- [ ] Cross-platform compatibility tests pass

### Phase 4: Migration (Tasks 16-17)
- [ ] Feature flag infrastructure deployed
- [ ] Telemetry instrumentation active
- [ ] Rollback runbook documented and tested
- [ ] Internal testing complete (Designer builds)
- [ ] Canary rollout stable for 48 hours
- [ ] Full rollout with monitoring

### Phase 5: Documentation (Task 18)
- [ ] SDK README updated with new modules
- [ ] Integration examples for Node.js and browser
- [ ] API reference documentation generated

## 8. Security Considerations

1. **JWT Token Handling:** Tokens stored in memory only, never persisted to storage
2. **Seed Material:** Never logged, cleared after use, no persistence outside secure storage
3. **URL Validation:** Maintain allow-list validation for RPC endpoints
4. **Feature Flag Security:** Flag cannot be toggled by untrusted origins

## 9. Backward Compatibility

- Existing `@totemsdk/core` exports remain unchanged
- New modules added as additional exports
- Existing `lease-client.ts` functions deprecated but maintained
- Version bump to 2.0.0 with migration guide

## 10. Timeline Estimate

| Phase | Tasks | Estimated Duration |
|-------|-------|-------------------|
| RFC & Approval | 1-2 | 2-3 days |
| Audit & Interfaces | 3-4 | 2-3 days |
| Core Extraction | 5-7 | 5-7 days |
| Client & Realtime | 8-9 | 3-4 days |
| Platform Adapters | 10-11 | 3-4 days |
| Testing Infrastructure | 12-14 | 4-5 days |
| Documentation | 15 | 1-2 days |
| Migration | 16-17 | 5-7 days |
| Examples & Docs | 18 | 2-3 days |
| **Total** | | **~4-5 weeks** |

## 11. Open Questions

1. Should we publish SDK packages to npm or keep internal for now?
2. What's the versioning strategy for the new packages?
3. Should we support Deno/Bun runtimes in initial release?
4. What telemetry should we collect during rollout?

## 12. Appendix

### A. Current Wallet Initialization Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Extension Load                                 │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  background.ts: chrome.runtime.onInstalled / onStartup           │
│  → connectionMonitor.start()                                      │
│  → performStartupRecovery()                                       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  bootstrap.ts: initializeBootstrap()                              │
│  → Fetch AXIA_BASE, AXIA_PROJECT_ID from bootstrap endpoint      │
│  → Cache to chrome.storage.local                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  stores/index.ts: Initialize stores                               │
│  → leaseStore.initialize()                                        │
│  → watermarkStore.initialize()                                    │
│  → leaseMonitor.start()                                           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  keyring.ts: Keyring initialization                               │
│  → Load encrypted vault from chrome.storage.local                │
│  → PBKDF2 key derivation on unlock                               │
│  → AES-GCM decryption of seed                                     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  UI: KeyringInitLoader.tsx → WalletSetup.tsx                     │
│  → Check keyring status                                           │
│  → Show onboarding or unlock screen                               │
│  → wallet:import / wallet:create RPC                              │
└──────────────────────────────────────────────────────────────────┘
```

### B. Files to Extract

| Source (totem-extension) | Target (totem-sdk) |
|--------------------------|-------------------|
| `core/stores/LeaseStore.ts` | `core/src/lease/LeaseStore.ts` |
| `core/stores/WatermarkStore.ts` | `core/src/lease/WatermarkStore.ts` |
| `core/monitoring/lease.ts` | `core/src/lease/LeaseMonitor.ts` |
| `core/sync/watermark.ts` | `core/src/lease/watermarkSync.ts` |
| `core/transaction/service.ts` | `core/src/tx/TransactionService.ts` |
| `core/transaction/lifecycle.ts` | `core/src/tx/lifecycle.ts` |
| `core/api/AxiaRpcClient.ts` | `client/src/rpc/AxiaRpcClient.ts` |
| `core/api/QuotaTracker.ts` | `client/src/quota/QuotaTracker.ts` |
| `core/balance/MegBalanceStreamManager.ts` | `realtime/src/balance/StreamManager.ts` |
| `core/balance/BalanceCache.ts` | `realtime/src/cache/BalanceCache.ts` |

---

**Next Steps:**
1. Review this RFC with stakeholders
2. Address open questions
3. Proceed to Task 3 (SDK package audit)
