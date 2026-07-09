# SDK Package Audit Report

**Date:** November 2025 (Updated February 2026)  
**Auditor:** Agent  
**Purpose:** Document SDK structure, package health, and known parity gaps

## February 2026 Updates

### Current Architecture (v2.1.0)

- **Per-Address TreeKey** architecture matching Minima `Wallet.java` exactly
- **ESM-first** module system with `.js` import extensions
- **`@noble/hashes`** as sole crypto dependency (replaced `js-sha3`)
- **High-level Verification API** (`verifySignature`, `deriveAddressFromPublicKey`, replay protection)
- **`@totem/connect`** client-side dApp SDK for typed wallet communication
- **WOTS test vectors** shipped for integrator validation
- 29+ Java byte-exact parity tests

### Serialization Architecture (January 2026)

- **Streamable.ts** is the canonical source for all byte-exact Java-compatible serialization
- All primitives use `bigint` for precision to match Java BigInteger behavior
- **javaStreamables.ts** refactored to thin wrappers that delegate to Streamable.ts

### WOTS Parameter Unification (January 2026)

- Single unified param set: `minima` (w=8, L=34, signature size 1088 bytes)
- Legacy aliases `WOTS_V1_DEV` and `WOTS_V2_SPEC` resolve to `WOTS_MINIMA`

---

## Current Package Structure

### Root Package: `@totem/sdk` (v2.1.0)
- **Location:** `packages/totem-sdk/`
- **Type:** Private workspace root (not published)
- **Workspaces:** `packages/*`, `examples/*`

### Active Packages (v2.x)

| Package | Version | Description | Status |
|---------|---------|-------------|--------|
| `@totem/sdk-core` | 2.2.0 | WOTS cryptography, MMR, TreeKey, verify API, serialization (ESM) | **Active, production-tested** |
| `@totem/sdk-node` | 2.0.1 | Node.js MinimaWallet with full TreeKey parity | **Active** |
| `@totem/connect` | 2.1.0 | Client-side dApp SDK (WalletDiscovery / totem:announce wrappers) | **Active** |
| `@totemsdk/node` | 1.0.7 | Node.js MinimaWallet with full TreeKey parity | **Active** |

### Legacy Packages (v1.0, November 2025)

These packages were created during the initial SDK buildout and have **not** been updated for the v2.x architecture (per-address TreeKeys, ESM, SmartRouter endpoints).

| Package | Description | Status |
|---------|-------------|--------|
| `@totem/sdk-realtime` | MegBalanceStreamManager | **Legacy v1.0** — extension has its own streaming now |
| `@totem/sdk-tests` | Parity and chaos tests | **Legacy v1.0** — doesn't cover v2.x features |

### Removed Packages

| Package | Reason |
|---------|--------|
| `@totem/sdk-react-native` | Was an empty shell (no source code), removed Feb 2026 |
| Legacy `src/` root | Contained placeholder `script.ts`, `crypto/wots.ts`, `crypto/minimaTrees.ts` from pre-monorepo era, removed Feb 2026 |
| `@totem/sdk-browser` | Legacy v1.0 browser adapters (LocalStorage, chrome.storage, fetch, WebSocket) — superseded by `@totemsdk/connect` and the Totem extension; removed May 2026 |
| `@totem/sdk-client` | Legacy v1.0 AxiaRpcClient using relative `../../core/src` imports and original REST patterns — superseded by current `@totemsdk/*` architecture; removed May 2026 |

---

## Active Package Details

### `@totem/sdk-core` (v2.1.0)

| Module | File | Production Ready | Notes |
|--------|------|------------------|-------|
| WOTS Signatures | `wots.ts` | ✅ Yes | Extensive test vectors, Java parity |
| MMR | `mmr.ts` | ✅ Yes | Oracle tests, golden tests |
| TreeKey | `treekey.ts` | ✅ Yes | Per-address architecture, depth=3 |
| Serialization | `Streamable.ts` | ✅ Yes | Canonical Java wire format |
| Verification API | `verify.ts` | ✅ Yes | `verifySignature`, `deriveAddressFromPublicKey`, replay protection |
| Base32 | `base32.ts` | ✅ Yes | Minima-compatible Mx encoding |
| Address | `derive.ts` | ✅ Yes | `scriptToAddress`, `addressToRoot` |
| Lease Client | `lease-client.ts` | ✅ Yes | `prepareLease`, `finalizeLease`, `flatIndexFromLanes` |
| Lease Stores | `lease/` | ✅ Yes | `LeaseStore`, `WatermarkStore` (v2 per-address), `LeaseMonitor` |
| Transaction | `tx/` | ✅ Yes | `TransactionService`, `TransactionReceiptStore`, lifecycle management |

### `@totem/sdk-node` (v2.0.1)

| Module | File | Production Ready | Notes |
|--------|------|------------------|-------|
| MinimaWallet | `wallet.ts` | ✅ Yes | Per-address TreeKey, `signData`, `signMinimaTransaction` |
| Adapters | `adapters.ts` | ✅ Yes | File storage, console logger, node timers |

### `@totem/connect` (v2.1.0)

| Module | File | Production Ready | Notes |
|--------|------|------------------|-------|
| Provider API | `index.ts` | ✅ Yes | `connect`, `requestSignature`, `getAccounts`, `sendTransaction` |
| Event Listeners | `index.ts` | ✅ Yes | `onAccountsChanged`, `onConnect`, `onDisconnect` |
| Type Definitions | `types.ts` | ✅ Yes | Full TypeScript types for all request/response shapes |

---

## Known Parity Gaps vs Totem Extension

The SDK `@totem/sdk-node` MinimaWallet provides signing parity with the extension, but the following extension features are **not yet available** in the SDK:

| Feature | Extension | SDK Node | Gap |
|---------|-----------|----------|-----|
| Per-address TreeKey signing | ✅ | ✅ | None |
| Address derivation | ✅ | ✅ | None |
| Seed phrase generation/validation | ✅ | ✅ | None |
| `signMinimaTransaction` (canonical wire format) | ✅ | ✅ | None |
| CoinProof extraction from blockchain | ✅ | ❌ | SDK doesn't fetch CoinProofs from RPC |
| Transaction preflight validation | ✅ | ❌ | No burn validation, script checking |
| Balance streaming integration | ✅ | ❌ | Extension has `BalanceStreamManager` |
| Coin selection algorithm | ✅ | ❌ | Extension selects optimal UTXOs |
| Full transaction assembly pipeline | ✅ | ❌ | Extension handles prepare→sign→finalize→post |

These gaps mean the SDK is suitable for **signing** and **verification** workflows, but full end-to-end transaction construction still requires either the extension or a backend integration via the Axia API.

---

## Examples Status

| Example | Status | Notes |
|---------|--------|-------|
| `examples/node-wallet/` | ✅ Updated Feb 2026 | Demos `MinimaWallet` with address derivation, signing |
| `examples/browser-dapp/` | ✅ Updated Feb 2026 | Uses `@totem/connect` for wallet interaction |

---

## Documentation

| Document | Status | Notes |
|----------|--------|-------|
| `INTEGRATION_GUIDE.md` | ✅ Current | Server-side verification, replay protection |
| `CHANGELOG.md` | ✅ Current | Full version history through v2.1.0 |
| `SDK_STAGED_ROLLOUT.md` | 📜 Historical | v1.0.0 migration era — preserved as record |
| `SDK_ROLLBACK_RUNBOOK.md` | 📜 Historical | v1.0.0 migration era — preserved as record |
| `RECOVERY_CLI.md` | 📜 Historical | v1.0.0 migration era — preserved as record |
| `RFC-001-SDK-UPGRADE.md` | 📜 Historical | Original SDK upgrade proposal |

---

## Stale Reference Sweep (February 2026)

| Pattern | Hits | Resolution |
|---------|------|------------|
| `window.minima` | 0 | Fixed in browser-dapp example (→ `@totem/connect`) |
| `@axia/sdk-core` | 0 | Clean — no references found |
| `js-sha3` | 2 (test scripts) | `gen_wots_pkdigest_vectors.cjs` and `length.test.ts` — these are standalone test utilities, not production code |
| `flatIndexFromLanes` | Present in lease modules | Correct — this is a lease utility, not the deprecated flat signing architecture |
| Legacy flat signing (`l1*64*64`, `fullPublicKey`, `treePkdigest`) | 0 in production code | Only in CHANGELOG.md as historical record |
