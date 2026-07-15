# Totem Extension Architecture

> **Note:** This document describes the intended design and architecture for the Totem Agent. Some details may differ from the current implementation. For the authoritative specification, see [TOTEM_WALLET_SPEC.md](../../TOTEM_WALLET_SPEC.md) and [LEASE_WATERMARK_SPEC.md](../../LEASE_WATERMARK_SPEC.md).

## Overview
Totem is a quantum-resistant browser wallet extension for the Minima blockchain, implementing WOTS (Winternitz One-Time Signatures) with w=8 parameter (L=34 chains, 1,088-byte signatures). Built as a Chrome Manifest V3 extension with cross-browser compatibility for Firefox and Safari.

## Core Components

### 1. Background Service Worker (`src/background/index.ts`)
**Role**: Central coordinator for wallet operations, message routing, and lifecycle management

**Key Responsibilities**:
- Initialize bootstrap configuration from Axia API
- Handle wallet state management via `WalletManager`
- Route messages between popup UI, content scripts, and dapps
- Manage extension lifecycle events (install, startup, rehydration)

**Message Types**:
```typescript
// Wallet Management
- 'wallet:create' → Create new wallet with password
- 'wallet:import' → Import from mnemonic + password
- 'wallet:unlock' → Unlock with password
- 'wallet:lock' → Lock wallet
- 'wallet:getState' → Get current wallet state

// WOTS Operations
- 'wallet:requestLease' → Request WOTS key lease from Axia API
- 'wallet:signTransaction' → Sign with WOTS private key
- 'wallet:finalizeTransaction' → Finalize and broadcast

// Dapp Integration
- 'dapp:connect' → Connect dapp to wallet
- 'dapp:disconnect' → Disconnect dapp

// Config
- 'GET_RPC_ENDPOINT' → Get Axia RPC endpoint (supports PQ-TLS toggle)
```

### 2. Content Script (`src/content-script.ts`)
**Role**: Inject `window.totem` provider API into web pages

**Message Flow**:
```
Dapp (window.totem.request)
  ↓ postMessage
Content Script (window listener)
  ↓ chrome.runtime.sendMessage
Background Service Worker
  ↓ response
Content Script
  ↓ postMessage
Dapp (receives result)
```

**Provider API**:
```javascript
window.totem = {
  isTotem: true,
  request: ({ method, params }) => Promise,
  on: (eventName, callback) => void,
  removeListener: (eventName, callback) => void,
  enable: () => Promise, // Legacy alias for TOTEM_CONNECT
  disconnect: () => Promise
}
```

### 3. Popup UI (`src/ui/popup/`)
**Role**: User interface for wallet management

**Key Pages**:
- `Home.tsx` - Account overview, balances, token list
- `Send.tsx` - Send transactions
- `Activity.tsx` - Transaction history
- `Settings.tsx` - Security, connected dapps, preferences

**State Management**:
- Communicates with background via `chrome.runtime.sendMessage`
- Uses React hooks for local UI state
- Real-time balance updates via periodic polling

### 4. Core Wallet (`src/core/wallet.ts`)
**Role**: Wallet logic, key management, WOTS operations

**Architecture**:
```typescript
class WalletManager {
  // Encrypted seed stored in chrome.storage.local
  private encryptedSeed: string | null
  
  // Session keys (cleared on lock)
  private sessionKey: CryptoKey | null
  private sessionSeed: Uint8Array | null
  private sessionRootPublicKey: string | null
  
  // State
  private state: WalletState
}
```

**Key Features**:
- **Hierarchical WOTS**: Derives 64 addresses from single root seed
- **Encryption**: PBKDF2 (100,000 iterations) + AES-GCM for seed storage
- **Auto-lock**: Clears session keys on lock
- **View Modes**: 
  - `global` - Show all 64 addresses aggregated
  - `filtered` - Show single address balance

### 5. WOTS Implementation
**Location**: `@totemsdk/core` package

**Tree Structure**:
```
Root Seed (256-bit)
  ↓ derivePerAddressSeed(baseSeed, addressIndex)
64 Address Seeds (one per address)
  ↓ TreeKey (depth=3, 64 keys/level)
Per-address TreeKey with 4,096 signing slots
  ↓ MMR root → script → Mx address
64 Minima Addresses (Mx...)
```

**Signature Process**:
1. Request lease from Axia API (`POST /v1/wots-hardened/prepare`)
2. Derive per-address TreeKey from seed
3. Sign transaction with WOTS (3-proof chain: Root→L1→L2→DATA, 34 chains × 32 bytes = 1,088 bytes)
4. Attach signature + witness to transaction
5. Finalize via Axia API (`POST /v1/wots-hardened/finalize`) for broadcast to Minima network

### 6. Quota Management
**Role**: Track Axia API credit usage via response headers

**Features**:
- Method-specific credit weights
- Daily/monthly quota tracking via `X-Quota-*` response headers
- Persists usage in `chrome.storage.local`

### 7. Bootstrap Configuration (`src/core/config/bootstrap.ts`)
**Role**: Fetch dynamic configuration from Axia API

**Fetches**:
```typescript
{
  AXIA_PROJECT_ID: string,
  AXIA_BASE: string, // RPC endpoint
  quota: { daily, monthly, methods },
  features: string[]
}
```

**Caching**:
- Stored in `chrome.storage.local` as fallback
- Fetched on every service worker start
- 1-hour TTL for fresh config

## Message Flow Diagrams

### Transaction Signing Flow
```
Dapp
 │ totem.request({ method: 'TOTEM_SEND_TRANSACTION', params: [tx] })
 ↓
Content Script
 │ chrome.runtime.sendMessage({ method: 'TOTEM_SEND_TRANSACTION', params: [tx] })
 ↓
Background Worker
 │ 1. Validate transaction
 │ 2. Request user approval (opens popup)
 ↓
Popup UI (Approval Screen)
 │ User clicks "Approve"
 ↓
Background Worker
 │ 3. Prepare lease from Axia API
 │    → POST /v1/wots-hardened/prepare
 │    ← { addressIndex, l1, l2, leaseToken (JWT), digestTx, leaseTTL }
 ↓
Background Worker
 │ 4. Sign with WOTS (client-side only)
 │    → Derives per-address TreeKey from seed
 │    → setUses(l1*64 + l2) + sign(digestTx)
 │    → Produces 3-proof chain (Root→L1→L2→DATA)
 │    → 1,088-byte WOTS signature (34 chains × 32 bytes)
 ↓
Background Worker
 │ 5. Finalize via Axia API
 │    → POST /v1/wots-hardened/finalize
 │    ← { ok: true, leaseId, txpowid }
 ↓
Axia API → Minima Network
 │ Transaction broadcast
 ↓
Dapp
 │ Receives { success: true, txpowid }
```

### Wallet Unlock Flow
```
Popup UI
 │ User enters password
 │ chrome.runtime.sendMessage({ method: 'wallet:unlock', params: [password] })
 ↓
Background Worker
 │ walletManager.unlock(password)
 │ 1. Fetch encrypted seed from chrome.storage.local
 │ 2. Derive AES key from password (PBKDF2)
 │ 3. Decrypt seed
 │ 4. Store in sessionSeed (memory only)
 │ 5. Derive root public key
 │ 6. Generate all 64 addresses
 ↓
Background Worker
 │ Returns { success: true }
 ↓
Popup UI
 │ Navigate to Home screen
 │ Start polling balances
```

## Storage Schema

### chrome.storage.local
```typescript
{
  // Wallet Setup
  walletSetup: boolean,
  encryptedSeed: string, // AES-GCM encrypted
  
  // Addresses (cached for quick load)
  addresses: string[], // 64 addresses
  activeAddress: string,
  
  // View Mode
  viewMode: 'global' | 'filtered',
  filteredAddressIndex: number | null,
  
  // Quota
  quotaUsage: {
    daily: { used: number, limit: number, resetAt: number },
    monthly: { used: number, limit: number, resetAt: number }
  },
  
  // Connected Dapps
  connectedDapps: DappConnection[],
  
  // Bootstrap Config
  bootstrapConfig: {
    AXIA_PROJECT_ID: string,
    AXIA_BASE: string,
    fetchedAt: number,
    ttl: number
  },
  
  // PQ-TLS Toggle
  totem_use_pq: boolean
}
```

## Security Model

### Encryption
- **Seed**: AES-GCM 256-bit, PBKDF2 600k iterations
- **Session**: Seed only in memory when unlocked
- **Auto-lock**: 30-minute inactivity timer

### WOTS Key Lifecycle
- **Generation**: On-demand via lease system
- **Usage**: Single-use per transaction
- **Tracking**: Signature count tracked in state
- **Rotation**: Not implemented (future: new root after 262k sigs)

### Permissions
- `storage` - Local encrypted seed
- `activeTab` - Inject provider into current tab
- `alarms` - Auto-lock timer
- `https://api.axia.network/*` - API calls

## Dependencies

### Core Libraries
- `@noble/hashes` - SHA3-256 for WOTS
- `bip39` - Mnemonic generation/validation
- `@totem-sdk/core` - WOTS implementation, MMR trees

### UI Libraries
- `react` - Popup UI framework
- `tailwindcss` - Styling (custom brutalist theme)
- `lucide-react` - Icons

### Build Tools
- `vite` - Bundler for popup
- `webpack` - Bundler for background/content scripts
- `typescript` - Type safety

## File Structure
```
packages/totem-extension/
├── src/
│   ├── background/        # Service worker
│   │   └── index.ts
│   ├── content/          # Content script
│   │   └── index.ts
│   ├── core/             # Wallet logic
│   │   ├── wallet.ts
│   │   ├── quota/
│   │   ├── config/
│   │   ├── transaction/
│   │   └── api/
│   ├── ui/               # Popup UI
│   │   ├── popup/
│   │   ├── approval/
│   │   ├── components/
│   │   └── styles/
│   └── keyring.ts        # WOTS keyring
├── icons/                # Extension icons
├── manifest.json         # Chrome MV3 manifest
├── popup.html           # Popup entry point
└── vite.config.ts       # Build config
```
