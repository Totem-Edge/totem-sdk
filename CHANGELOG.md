# Changelog

All notable changes to the Totem SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-20

### Added

- **`@totemsdk/core-wasm` 1.0.0** — Rust/WASM cryptographic core reaches v1 (WOTS+, SHA3-256, TreeKey, TxPoW mining, BIP39).
- **`@totemsdk/kissvm` 1.0.0** — KISSVM evaluator reaches v1 (Rust/WASM-backed, Java byte-exact parity).
- **`@totemsdk/wots-lease` 1.0.0** — WOTS key-use coordination reaches v1 with all five provider layers implemented:
  - Layer 4 `P2PQuorumLeaseProvider` — multi-device quorum attestation over the same signing slot; slots are burned on quorum failure or conflict so they are never reused.
  - Layer 5 `OnchainWatermarkProvider` — on-chain watermark anchoring via a dedicated watermark coin whose STATE(0) holds the flat cursor.
  - `LocalLeaseProvider.reserveSpecificKeyUse` / `advanceToRemoteWatermark` / `listTrees` / `getJournal`.
  - New errors: `QuorumUnavailableError`, `QuorumConflictError`, `OnchainWatermarkError`, `IndicesUnavailableError`.
- **`@totemsdk/omnia` 1.0.0** — eltoo payment channels reach v1 (186 TS tests, 27 Rust tests, 11 WASM-parity suites, 8 built-in programs).
- **`@totemsdk/core` 1.2.9** — republished against `@totemsdk/core-wasm@^1.0.0`.

### Fixed

- **Stale compiled artifacts removed from `packages/core/src`** — 56 committed `.js`/`.d.ts` files that shadowed the TypeScript sources under jest's default module resolution, breaking `@totemsdk/tx-builder`'s ts-jest tests.
- **`@totemsdk/tx-builder` promoted to publishable** (0.1.9) — tests now run against the TS sources.
- **`@totemsdk/se-server` promoted to publishable** (0.1.3) — 24 new tests covering WOTS sign/verify, reclaim-TX encryption, config validation, and the full HTTP router flow.
- **`@totemsdk/lookup-protocol` 0.1.6** — `LEASE_RESERVE` accepts explicit indices for quorum attestation.
- **`@totemsdk/lookup-node` 0.1.9** — `LeaseCoordinator` honours explicit indices.
- **`@totemsdk/lookup-client` 0.1.7** — `leaseReserve` / `leaseCommit` / `leaseBurn` wire methods.

## [2.2.0] - 2026-03-08

### Added

- **`HierarchicalWitnessBundle` now a first-class export**
  - Exported from `@totemsdk/core/tx` and the root `@totemsdk/core` barrel
  - Replaces the deprecated flat `WitnessBundle` type; `WitnessBundle` alias retained for backward compatibility

- **Private project support in `AxiaRpcClient`**
  - New `projectSecret?: string` field in `AxiaClientConfig`
  - `x-axia-project-secret` header now sent on all `call()` requests and `getWatermark()` when a secret is configured
  - Enables use of private Axia projects from Node.js SDK consumers

### Fixed

- **`leaseTTL` double-multiplication bug** — `TransactionLifecycle` was computing `expiresAt = Date.now() + (leaseTTL * 1000)` but the backend sends `leaseTTL` already in milliseconds. Fixed to `Date.now() + leaseTTL`. A 5-minute lease was incorrectly stored as expiring in ~83 hours, preventing lease expiry checks from ever firing.

- **`TransactionService` endpoint URLs corrected** — all three endpoints updated to the live path prefix:
  - `/prepare` → `/v1/wots-hardened/prepare`
  - `/finalize` → `/v1/wots-hardened/finalize`
  - Watermark → `/v1/wots-hardened/watermark`

- **`addressIndex` now required in `/prepare` request body** — the backend validates this field (0–63) and uses it to allocate the signing indices for the correct address. `TransactionService.prepare()` now throws early if `params.addressIndex` is missing or out of range.

- **`paramSet` default corrected** — changed from `'minima'` to `'v2-spec'` to match the backend's accepted value.

- **Structured 429 handling in `TransactionService.prepare()`** — a 429 response now throws with `.code = 429`, `.limit`, `.used`, `.retryAfter` instead of an opaque HTTP error.

- **`TransactionService.sign()` rewritten to use per-address TreeKey architecture** — replaced the old flat signing model (which required injected `deps.wotsSign`) with direct use of `createPerAddressTreeKey(seed, addressIndex)` → `setUses(l1*64+l2)` → `sign(digestBytes)`. Produces 3 Java-compatible proofs (Root→L1→L2→DATA) exactly matching the Totem extension and Minima `Wallet.java`.

### Changed

- **`WotsSigningDependencies` deprecated** — the `deps` argument to `TransactionService.sign()` is now ignored (`_deps`). The function derives all signing material internally from `seed` and indices. The interface type is kept for backward compatibility and will be removed in v3.0.

- **`hardened-flow.ts` deleted** — the stale placeholder file containing `"0x<fill-with-real-signature>"` stub output has been removed. It was not exported from the package.

---

## [2.1.0] - 2026-02-09

### Added

- **ESM-First Module System**
  - Migrated `@totemsdk/core` to ESM (`"type": "module"`, `"module": "nodenext"` in tsconfig)
  - All relative imports now use `.js` extensions for ESM compatibility
  - Removed invalid CJS `require` entries from package.json exports map
  - Vite and other modern bundlers now resolve the SDK without workarounds

- **High-Level Verification API (`verify.ts`)**
  - `verifySignature(address, message, signatureHex, publicKeyHex): boolean` — one-liner signature verification for integrators
  - `verifySignatureDetailed(address, message, signatureHex, publicKeyHex): { valid, error? }` — same with descriptive error messages for debugging
  - `deriveAddressFromPublicKey(publicKeyHex): string` — server-side address/pubkey validation to prevent address-spoofing
  - `verifyTreeSignatureDetailed(data, signature, expectedRootPk): { valid, error? }` — low-level TreeSignature verification with error reporting
  - `normalizeHex(hex): string` — strips `0x` prefix and lowercases for defensive hex handling
  - `createChallenge(domain, nonce?): string` — generates time-limited JSON challenge string for replay protection
  - `validateChallenge(challenge, options?): VerificationResult` — validates challenge freshness, domain, and format

- **@totem/connect Client-Side Package**
  - New package at `packages/connect/`
  - Typed TypeScript wrappers: `connect()`, `requestSignature()`, `getAccounts()`, `sendTransaction()`
  - Event listener helpers: `onAccountsChanged()`, `onConnect()`, `onDisconnect()`
  - `isTotemInstalled()` detection and `getProvider()` access
  - Custom error classes: `TotemNotInstalledError`, `TotemConnectionError`
  - Full TypeScript declarations for the Totem provider API

- **WOTS Test Vectors**
  - Generated test vectors in `packages/core/test-vectors.json`
  - 2 passing + 1 intentionally-failing case for integrator validation
  - Exportable via `@totemsdk/core/test-vectors.json` package export

- **Integration Guide Documentation**
  - Comprehensive guide at `packages/core/docs/INTEGRATION_GUIDE.md`
  - Server-side verification walkthrough with full auth round-trip example
  - Hex encoding conventions (no `0x` prefix in Minima)
  - TreeSignature format specification (structure, WOTS count, serialization)
  - Session/nonce replay-protection guidance with `createChallenge`/`validateChallenge` pattern

- **npm Publish Readiness**
  - All packages (`sdk-core`, `sdk-node`, `connect`) have `publishConfig`, `prepublishOnly` scripts, and proper exports maps
  - `engines` field specifying Node.js >=16

### Changed

- **Unified Crypto Dependency**
  - Replaced `js-sha3` with `@noble/hashes/sha3` across all source files (`mmr.js`, `minima32.ts`, and pre-compiled `.js` counterparts)
  - `@noble/hashes` is now a `peerDependency` (>=1.3.0) in both `sdk-core` and `sdk-node`, giving consumers control over their version
  - Single crypto dependency tree reduces bundle size and eliminates version conflicts

### Fixed

- `normalizeHex()` now lowercases output to match documented behavior
- Removed redundant `new Uint8Array()` wrapping in `minima32.js` checksum computation

---

## [2.0.1] - 2026-02-05

### Added

- **Per-Address TreeKey Architecture**
  - Each address now has its own independent TreeKey (size=64, depth=3), matching Minima `Wallet.java` exactly
  - `derivePerAddressSeed(baseSeed, addressIndex)` using `hashObjects(baseSeed, MiniData(BigInteger(index)))`
  - Address public key derived from TreeKey MMR root (not a child node)
  - Signature capacity: 64 addresses x 4,096 signatures each = 262,144 total one-time signatures

- **Java Parity Tests**
  - 29 parity tests verifying byte-exact compatibility with Minima Java implementation
  - Test vectors for key generation, signature creation, and address derivation
  - Reference Java test files for cross-implementation validation

- **Complete CoinProof Extraction**
  - `extractCoinDataFromCoinProof()` extracts ALL coin fields from CoinProof with pre-serialized bytes
  - Includes `rawMmrEntryBytes`, `rawBlockCreatedBytes`, `RawStateVariable[]` for byte-exact serialization
  - Fixes transaction ID mismatch caused by hardcoded defaults (mmrEntryNumber=0, blockCreated=0)

- **Seed Fingerprint Verification**
  - Wallet creation now verifies seed fingerprint for security

### Changed

- **Per-Address Signing Flow**
  - Signing now uses `setUses(l1*64+l2)` + `sign(data)` producing 3 proofs (Root→L1→L2→DATA)
  - Matches Java's `TreeKey.sign()` exactly
  - Index mapping: Legacy (l1, l2, l3) → Per-address (addressIndex=l1, l1=l2, l2=l3)

- **WatermarkStore v2**
  - Per-address tracking with `(addressIndex, l1, l2)` tuples
  - Legacy format detection triggers automatic migration

- **LeaseStore**
  - Updated for `SigningIndices` with `(addressIndex, l1, l2)` tuples

### Fixed

- **Critical Double-Hashing Bug** — WOTS verification was double-hashing messages; removed redundant hash to match Java/BouncyCastle behavior
- **WOTS Internal Hashing** — Corrected hash chain computation for parity with Java `WinternitzOTSignature`
- **Public Key Digest** — Fixed WOTS public key digest computation
- **Signature Proof Serialization** — Corrected field ordering to match Minima's expected format

### Removed

- **Legacy Flat Architecture** — All legacy flat architecture code paths removed from transaction signing (`treeIndex = l1*64*64 + l2*64 + l3`, `fullPublicKey`, `treePkdigest`)
- Deprecated placeholder files (`encode.deprecated.ts`, `serialize.deprecated.ts`) quarantined

---

## [2.0.0] - 2026-01-18

### Added

- **Canonical Serialization Architecture**
  - `Streamable.ts` as the single source of truth for byte-exact Java-compatible serialization
  - Uses `bigint` for precision in all numeric serialization
  - `javaStreamables.ts` wrappers for backward compatibility
  - `writeMiniData`, `writeMiniNumber`, `writeMiniString`, `writeMiniInteger` primitives

- **MEG Balance Streaming Background Integration**
  - Wired `MegBalanceStreamManager` to background service worker via dedicated `balance-stream` port handler
  - Implemented port message protocol: `START_STREAM`, `STOP_STREAM`, `UPDATE_ADDRESSES`, `GET_CACHED`
  - Event forwarding: `BALANCE_UPDATE`, `TX_CONFIRMATION`, `CONNECTION_STATE`
  - Proper cleanup on port disconnect to prevent memory leaks
  - Balance streaming works independently of SDK migration flag (`initMode`)

### Documentation

- Updated RFC-001-SDK-UPGRADE.md with Section 3.3: MV3 Background Integration
- Added Balance Streaming Integration section to SDK_ROLLBACK_RUNBOOK.md
- Updated docs/developers/extension/websocket-lifecycle.md

---

## [1.0.0] - 2025-11-26

### Added

- SDK Upgrade Initiative (RFC-001) implementation complete
- Feature flag infrastructure with `walletInitMode` and `SdkMigrationManager`
- Auto-rollback mechanism (3 errors/hour, 24h cooldown)
- Canary rollout support (10% bucket assignment via extension ID hash)
- Extracted `LeaseStore`, `WatermarkStore`, `LeaseMonitor` with adapter-driven architecture
- Platform-agnostic adapter interfaces: `StorageAdapter`, `AuthTokenProvider`, `WebSocketFactory`, `TimerAdapter`, `LoggerAdapter`, `MetricsAdapter`
- 69 parity tests validating SDK vs legacy output equivalence
- 37 chaos tests for graceful degradation scenarios
- Playwright E2E tests for staged rollout
- Node.js wallet example in `examples/node-wallet/`

### Documentation

- RFC-001-SDK-UPGRADE.md: Complete SDK upgrade specification
- SDK_AUDIT.md: Existing package reconciliation plan
- SDK_ROLLBACK_RUNBOOK.md: Three-tier rollback procedures
- Staged rollout guide with canary progression
- Recovery CLI reference
