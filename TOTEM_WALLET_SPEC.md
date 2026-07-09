# Totem Wallet WOTS Implementation Specification

**Version:** 3.0  
**Last Updated:** 2026-02-18  
**Status:** Active

This document describes the Winternitz One-Time Signature (WOTS) implementation and architecture used by the Totem wallet extension for the Minima blockchain.

## Table of Contents

1. [WOTS Parameters](#wots-parameters)
2. [Per-Address TreeKey Architecture](#per-address-treekey-architecture)
3. [Signing Process](#signing-process)
4. [Transaction Building](#transaction-building)
5. [Serialization Architecture](#serialization-architecture)
6. [Witness Structure](#witness-structure)
7. [Coin Selection](#coin-selection)
8. [Extension Architecture](#extension-architecture)
9. [Token Metadata Pipeline](#token-metadata-pipeline)
10. [Announcement System](#announcement-system)
11. [Source File References](#source-file-references)
12. [End-to-End Flows](#end-to-end-flows)
13. [Version History](#version-history)

---

## WOTS Parameters

The Totem wallet uses a **single unified parameter set** matching Minima's Java implementation (BouncyCastle compatible).

### Parameter Set: `minima`

| Parameter | Value | Description |
|-----------|-------|-------------|
| `name` | `'minima'` | Parameter set identifier |
| `n` | `256` | Hash output bits (SHA3-256) |
| `w` | `8` | Winternitz parameter - **8 BITS per digit** (not base-8) |
| `L` | `34` | Total chains: 32 message + 2 checksum |
| `messageSize` | `32` | Number of message digits |
| `checksumSize` | `14` | Checksum bits |
| `checksumDigits` | `2` | Number of checksum digits |
| `maxDigit` | `255` | Maximum digit value (2^w - 1) |

### Signature Size

```
Signature size = L × 32 bytes = 34 × 32 = 1088 bytes
```

### Chain Count Calculation

From `WinternitzOTSignature.java` constructor:

```java
messagesize = ((mdsize << 3) + w - 1) / w = (256 + 7) / 8 = 32
checksumsize = getLog((messagesize << w) + 1) = getLog(8193) = 14 bits
keysize = messagesize + (checksumsize + w - 1) / w = 32 + (14 + 7) / 8 = 34
```

### CRITICAL: Deprecated Aliases

The following are **deprecated aliases** that resolve to the same `minima` parameter set:

- `WOTS_V1_DEV` → `WOTS_MINIMA`
- `WOTS_V2_SPEC` → `WOTS_MINIMA`

**There is only ONE parameter set.** All code paths use `getParamSet()` which returns `WOTS_MINIMA`.

---

## Per-Address TreeKey Architecture

*Introduced 2026-02-05, matching Minima's `Wallet.java` exactly.*

The Totem wallet uses **per-address TreeKeys** where each wallet address has its own independent TreeKey. This replaces the legacy flat architecture.

### Seed Derivation

```
baseSeed = SHA3-256(cleaned mnemonic phrase)   // via phraseToSeed()
addressSeed[i] = derivePerAddressSeed(baseSeed, i)
             = hashObjects(baseSeed, MiniData(BigInteger(i)))
```

### Per-Address Tree Structure

Each address has its own 3-level TreeKey (size=64, depth=3):

```
Address TreeKey (Root TreeKeyNode)
├── L1 Child 0 (TreeKeyNode with 64 WOTS keys)
│   ├── L2 Child 0 (64 one-time signature leaves)
│   ├── L2 Child 1
│   └── ... (64 L2 children)
├── L1 Child 1
│   └── ... (64 L2 children)
└── ... (64 L1 children)
```

### Address Public Key

The address public key is the **TreeKey's MMR root** (not a child node):

```typescript
addressPublicKey = deriveAddressPublicKey(baseSeed, addressIndex)
                 = createPerAddressTreeKey(derivePerAddressSeed(baseSeed, addressIndex)).getPublicKey()
```

### Capacity

| Level | Count per Address | Description |
|-------|-------------------|-------------|
| Root | 1 | Per-address root node |
| L1 | 64 | Child nodes of Root |
| L2 | 64 × 64 = 4,096 | Child nodes of L1 |
| Leaves | 64 × 64 × 64 = 262,144 | One-time signature keys |

**Per address: 262,144 one-time signatures (64³)**  
**Per wallet: 64 addresses × 262,144 = 16,777,216 total one-time signatures**

### Index Mapping (Legacy → Per-Address)

| Legacy Index | Per-Address Index | Description |
|-------------|-------------------|-------------|
| `l1` | `addressIndex` | Which address (0-63) |
| `l2` | `l1` | L1 index within per-address TreeKey (0-63) |
| `l3` | `l2` | L2 index within per-address TreeKey (0-63) |

### Key Derivation

Each `TreeKeyNode`:
1. Contains 64 Winternitz keys derived from a deterministic seed
2. Builds an MMR tree from all 64 **full WOTS public keys** (1088 bytes each)
3. **Public Key = MMR root** (32 bytes) - hash of the tree built from full keys
4. Can derive child nodes for the next level

**CRITICAL:** MMR leaves are built from **full 1088-byte public keys**, NOT 32-byte digests. The 32-byte digest is used ONLY for address derivation (Mx encoding).

### WatermarkStore v2

Per-address watermark tracking ensures WOTS key reuse prevention:

```typescript
interface SigningIndices {
  addressIndex: number;  // Which address/TreeKey (0-63)
  l1: number;            // Signing node within that TreeKey (0-63)
  l2: number;            // Leaf key within signing node (0-63)
}

interface AddressWatermark {
  l1: number;   // Next available L1 index
  l2: number;   // Next available L2 index within current L1
}
```

- Each address tracks its own `(l1, l2)` watermark independently
- Legacy `WotsIndices { l1, l2, l3 }` format triggers automatic migration
- LeaseStore updated to use `SigningIndices` tuples

### Architecture Version

`ARCHITECTURE_VERSION=3` marker forces re-initialization for wallets with incorrect pubkey derivation.

### Legacy Flat Architecture (Removed)

All legacy flat architecture code paths have been removed from transaction signing (2026-02-05):
- Old `treeIndex = l1*64*64 + l2*64 + l3` flat derivation removed
- `fullPublicKey`, `treePkdigest`, and legacy signature formats no longer used
- Methods `getPkdigestForIndex()`, `getPkdigestForAddress()`, and `deriveAddress()` now throw errors if called

---

## Signing Process

*Updated 2026-02-05 to produce 3 proofs matching Java's TreeKey.sign() exactly.*

### `setUses()` + `sign()` Pattern

The signing process converts `(l1, l2)` indices to a flat `uses` counter:

```
uses = l1 * 64 + l2
```

Then calls `TreeKey.sign(data)` which produces a **3-proof signature chain**:

1. **Root→L1 Proof**: Root node signs L1 child's public key
2. **L1→L2 Proof**: L1 child signs L2 leaf's public key
3. **L2→DATA Proof**: L2 leaf signs the actual transaction data

### SignatureProof Structure

Each `SignatureProof` contains:
- `leafPubkey`: **1088-byte FULL WOTS public key** (34 chains × 32 bytes) — NOT the digest
- `signature`: 1088-byte Winternitz signature (34 × 32 bytes)
- `mmrProof`: Proof linking the leaf to the tree node's MMR root

**CRITICAL:** Java's `SignatureProof.mPublicKey` stores the FULL 1088-byte key. Using the 32-byte digest causes MegaMMR to reject transactions with "not signed by publickey" errors.

### Parent-Child Signature Caching

For efficiency, the wallet caches parent-child signatures via `ParentChildSigCache`:
- Root→L1 and L1→L2 signatures are reusable until the child key is consumed
- Reduces signing latency for subsequent transactions
- Cache is invalidated when keys are rotated

### Parity Verification

29 parity tests verify byte-exact compatibility with Minima Java implementation across all signing operations.

---

## Transaction Building

*Added 2026-02-06.*

### MinimaTransactionBuilder

`MinimaTransactionBuilder.ts` handles client-side transaction construction:

1. **Coin Selection**: Selects spendable coins from wallet addresses
2. **Input Construction**: Builds transaction inputs from selected coins with full CoinProof data
3. **Output Construction**: Creates outputs for recipient and change addresses
4. **CoinID Precomputation**: Computes output CoinIDs before transaction digest
5. **Transaction Digest**: Computes SHA3-256 digest for signing
6. **Witness Assembly**: Attaches WOTS signature proofs

### Output CoinID Precomputation

**CRITICAL FIX (2026-02-06):** Java's `txnsign` calls `TxPoWGenerator.precomputeTransactionCoinID(txn)` BEFORE `calculateTransactionID()`. Output coins get their real CoinIDs computed as:

```
outputCoinID = SHA3-256(writeMiniData(input[0].coinID) || writeMiniNumber(outputIndex))
```

Without this, Totem signed a different digest than what the node verifies, causing `allsignaturesvalid=false`.

### Complete CoinProof Extraction

`extractCoinDataFromCoinProof()` extracts ALL coin fields from on-chain CoinProof data with pre-serialized bytes:

| Field | Description |
|-------|-------------|
| `coinId` | Coin identifier |
| `address` | Owner address |
| `rawAmountBytes` | Pre-serialized amount (byte-exact) |
| `rawMmrEntryBytes` | Pre-serialized MMR entry number |
| `rawBlockCreatedBytes` | Pre-serialized block creation number |
| `RawStateVariable[]` | Pre-serialized state variables |

This ensures byte-exact transaction serialization matching Java's computation of transaction IDs from the complete coin data as stored on the blockchain.

### Transaction Lifecycle

The `TransactionLifecycle` class orchestrates the full flow:

1. **Prepare**: Validates watermark, requests lease from backend, acquires signing indices
2. **Sign**: Client-side WOTS signature generation (private keys never leave the extension)
3. **Finalize**: Submits signed transaction to backend, updates watermark, stores receipt
4. **Error Handling**: Maps backend error codes (403, 409, 410, 502) to user-friendly messages

### Backend Finalize Endpoint

- `txncheck` validation checks `allsignaturesvalid`, `valid.basic`, `valid.mmrproofs`, `valid.scripts`, and `validtransaction` individually
- Burn parameter validated with strict regex (`/^\d+(\.\d+)?$/`) to prevent RPC command injection
- `txnpost mine:true` parameter for immediate mining

---

## Serialization Architecture

### Canonical Source: `Streamable.ts`

`Streamable.ts` is the **SINGLE SOURCE OF TRUTH** for all byte-exact serialization matching Minima's Java `Streamable` interface.

#### Core Functions

| Function | Description | Format |
|----------|-------------|--------|
| `writeMiniNumber(bigint)` | Serialize number | 1-byte scale + 1-byte length + BigInteger bytes |
| `writeMiniData(Uint8Array)` | Serialize raw bytes | 4-byte big-endian length + raw bytes |
| `writeMiniString(string)` | Serialize UTF-8 string | MiniData encoding of UTF-8 bytes |
| `writeMiniByte(number\|boolean)` | Serialize single byte | 1 byte |
| `writeHashToStream(Uint8Array)` | Serialize hash | 4-byte length + hash bytes |

#### BigInteger Compatibility

`bigIntToByteArray(value: bigint)` converts to Java's `BigInteger.toByteArray()` format:
- Uses two's complement representation
- Zero encodes as `[0x00]`
- Positive values with high bit set get a leading `0x00` byte

### Backward Compatibility: `javaStreamables.ts`

`javaStreamables.ts` provides **thin wrappers** with a number-based API for backward compatibility:

```typescript
serializeMiniNumber(n: number): Uint8Array
serializeMiniData(data: Uint8Array): Uint8Array
hashAllObjects(...items: Uint8Array[]): Uint8Array
```

### Key Derivation Functions

```typescript
derivePerAddressSeed(baseSeed: Uint8Array, addressIndex: number): Uint8Array
deriveChainSeedJava(privateSeed: Uint8Array, index: number): Uint8Array
deriveChildTreeSeedJava(childSeed: Uint8Array, childIndex: number): Uint8Array
```

### Java Parity

All serialization functions produce **byte-for-byte identical output** to Minima Java classes:
- `MiniData.writeDataStream()`
- `MiniNumber.writeDataStream()`
- `MiniString.writeDataStream()`
- `MiniByte.writeDataStream()`
- `Crypto.writeHashToStream()`
- `Crypto.hashAllObjects()`

---

## Witness Structure

### SigningIndices

```typescript
interface SigningIndices {
  addressIndex: number;  // Which address/TreeKey (0-63)
  l1: number;            // Signing node within per-address TreeKey (0-63)
  l2: number;            // Leaf key within signing node (0-63)
}
```

### SignatureProof

Each `SignatureProof` in the witness:

```typescript
interface SignatureProof {
  leafPubkey: Bytes;   // 1088-byte FULL WOTS public key (L=34 chains × 32 bytes)
  signature: Bytes;    // 1088-byte Winternitz signature (L=34, 32 bytes each)
  mmrProof: MMRProof;  // MMR proof from leaf to root
}
```

### HierarchicalWitnessBundle

The full witness bundle used for transaction signing:

```typescript
interface HierarchicalWitnessBundle {
  addressIndex: number;      // Per-address TreeKey index (0-63)
  l1: number;                // L1 key index within per-address TreeKey
  l2: number;                // L2 leaf index
  rootPublicKey: string;     // Hex-encoded TreeKey root public key
  proofs: SignatureProofHex[];  // Array of 3 signature proofs (Root→L1→L2→DATA)
}
```

### Hex Transport Types

For transport/storage, signatures use hex encoding:

```typescript
type Signature34Hex = Hex[];  // Array of 34 × 0x..32-byte elements

interface SignatureProofHex {
  leafPubkey: Hex;       // 1088-byte public key as hex
  signature: Hex;        // 1088-byte signature as hex
  mmrProof: MMRProofHex; // MMR proof as hex
}
```

### Wire Serialization: `minimaWireSerializer.ts`

`serializeHierarchicalWitness()` converts the bundle to Minima wire format:

1. Witness signature count (MiniNumber: 1)
2. Proof count (MiniNumber: N proofs, typically 3)
3. For each proof:
   - MiniData(publicKey)
   - MiniData(signature)
   - Pre-serialized MMR proof bytes

**Critical**: Uses double-nesting to match Java format:
- `Witness.writeDataStream()` → `[signatureCount][Signature[0]...]`
- `Signature.writeDataStream()` → `[proofCount][SignatureProof[0]...]`

---

## Coin Selection

### CoinSelectionService

`CoinSelectionService.ts` manages coin selection for WOTS transactions with two modes:

| Mode | Description |
|------|-------------|
| `global` | Selects coins across all wallet addresses |
| `focused` | Selects coins from a specific address only |

### Selection Options

```typescript
interface CoinSelectionOptions {
  mode: SendMode;           // 'global' or 'focused'
  targetAmount: string;     // Amount to send (decimal string)
  tokenId?: string;         // Token ID (default: Minima native)
  focusedAddress?: string;  // Address for focused mode
  excludedAddresses?: string[];
}
```

### Selection Process

1. Fetches spendable coins from backend via `POST /v1/wallet/coins` endpoint (MegaMMR-backed)
   - Requires header `x-project-id: totem-shared` (bypasses credits, uses MegaMMR)
   - Request body: `{ addresses: string[], tokenId?: string }`
   - Backend queries with `megammr:true` flag for accurate chain-wide data
2. Filters by address mode (global vs focused)
3. Orders coins by amount (largest first for fewer inputs)
4. Accumulates until target amount is reached
5. Calculates change amount
6. Returns `CoinSelectionResult` with selected coins, total, change, and source addresses

---

## Extension Architecture

### MV3 Service Worker Constraints

The Totem extension runs as a Manifest V3 Chrome extension with service worker limitations:
- Service workers can be terminated at any time
- No persistent in-memory state
- Must handle interruptions gracefully

### Auto-Resume for Interrupted Address Generation

If the browser terminates mid-generation:
1. Partial state is saved to extension storage
2. Subsequent unlocks detect partial state
3. Generation resumes from saved count (not regenerated)
4. Includes concurrency guards and inconsistent state detection/correction

### Hybrid Address Generation

Two-phase unlock strategy for optimal UX:

| Phase | Addresses | Purpose |
|-------|-----------|---------|
| Fast Unlock | 4 | Immediate wallet access |
| Background | 60 | Full capacity (generated asynchronously) |

**Total: 64 addresses generated per wallet**

### Fresh Install Storage Clear

Extension clears all local storage on fresh install (`chrome.runtime.onInstalled` with `reason='install'`) to ensure clean wallet state.

### Client-Side WOTS Signing

**Security guarantee: The server NEVER sees private keys.**

Signing flow:
1. Extension derives WOTS private keys from encrypted seed
2. Transaction is built locally via `MinimaTransactionBuilder`
3. Output CoinIDs are precomputed matching Java's `TxPoWGenerator`
4. Transaction digest is computed locally
5. WOTS signature is generated client-side (3-proof chain)
6. Only the signed transaction hex is sent to the server for finalization
7. Private key material is cleared from memory after signing

### Key Security Features

- Encrypted seed storage using Web Crypto API
- Session-based key derivation
- Automatic session timeout
- Memory clearing after cryptographic operations
- Strict CSP in manifest: `script-src 'self' 'wasm-unsafe-eval'`

---

## Token Metadata Pipeline

*Added 2026-02-08.*

End-to-end token metadata flows from backend through to the wallet UI.

### Backend Token Parsing

`parseTokenMetadata` extracts from Minima RPC:

| Field | Description |
|-------|-------------|
| `ticker` | Token ticker symbol |
| `name` | Token display name |
| `description` | Token description |
| `url` | Token website URL |
| `icon` | Token icon URL |
| `type` | `NFT` or `STANDARDTOKEN` |
| `webvalidate` | Verification URL |
| `owner` | Token creator address |
| `decimals` | Token decimal places |

### Balance Streaming (V2)

`BalanceStreamManager.pollBalances()` maps all fields to `StreamTokenBalance` including per-token `isAggregated` flag. Events:

- `TOKEN_SNAPSHOT`: Initial hydration of all token balances on connection
- `BALANCE_UPDATE_V2`: Incremental updates with token metadata

### Balance Cache

`CachedTokenBalance` preserves all metadata through round-trips:

```typescript
interface CachedTokenBalance {
  tokenid: string;
  token: string;
  ticker?: string;
  name?: string;
  description?: string;
  icon?: string;
  url?: string;
  decimals?: number;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  coins?: number;
  type?: string;
  webvalidate?: string;
  owner?: string;
  isAggregated?: boolean;
}
```

### UI Display

- `TokenRow` component: Token icons, NFT badges, verified stars, coins count, pending amounts
- `BrutalistTokenDetail` page: Full token detail with icon, balance breakdown (confirmed/sendable/pending/coins), Send/Receive actions, metadata display
- `BrutalistHome`: Handles both pre-aggregated (bulk endpoint) and per-address aggregation modes via `isAggregated` flag detection

---

## Announcement System

*Added 2026-02.*

Real-time notification system for wallet-wide announcements.

### Architecture

1. **Admin Dashboard**: Create/edit/schedule announcements with image uploads (resized to max 200x200px)
2. **Backend API**: PostgreSQL storage, WebSocket broadcast via `totem:announcements` topic
3. **Extension WebSocket**: `wsSubscriber.ts` connects to announcement channel with auto-reconnect
4. **Store**: `chrome.storage.local` persistence with dismiss tracking

### Event Types

| Event | Description |
|-------|-------------|
| `snapshot` | Full list of active announcements (on connection) |
| `upsert` | New or updated announcement |
| `archive` | Announcement removed |

### UI Components

- `AnnouncementBanner`: Renders announcements with image, title, body, CTA button, dismiss action
- `useAnnouncements` hook: Subscribes to store changes, filters dismissed announcements
- Image URLs resolved from Object Storage via `https://api.axia.to/objects/...`

---

## Source File References

### SDK Core (`packages/totem-sdk/packages/core/src/`)

| File | Purpose |
|------|---------|
| `params.ts` | WOTS parameter set definitions |
| `wots.ts` | Core WOTS implementation (sign, verify, key derivation) |
| `treekey.ts` | TreeKey/TreeKeyNode hierarchical key structure, `derivePerAddressSeed()`, `createPerAddressTreeKey()` |
| `mmr.ts` | Merkle Mountain Range implementation |
| `Streamable.ts` | **Canonical** byte-exact serialization primitives |
| `javaStreamables.ts` | Number-based wrappers for backward compatibility |
| `minimaWireSerializer.ts` | High-level witness bundle serialization |
| `script.ts` | Script generation from WOTS public keys |
| `derive.ts` | Address derivation from scripts |

### Extension Core (`packages/totem-extension/src/core/`)

| File | Purpose |
|------|---------|
| `wallet.ts` | WalletManager with per-address TreeKey integration |
| `wots/witness.ts` | Witness bundle assembly |
| `stores/ParentChildSigCache.ts` | Parent-child signature caching |
| `stores/WatermarkStore.ts` | Per-address WOTS index tracking (v2) |
| `stores/LeaseStore.ts` | Transaction lease management with SigningIndices |
| `stores/TransactionReceiptStore.ts` | Transaction receipt persistence |
| `transaction/MinimaTransactionBuilder.ts` | Client-side transaction construction |
| `transaction/CoinSelectionService.ts` | Coin selection for WOTS transactions |
| `transaction/lifecycle.ts` | Transaction prepare/sign/finalize orchestration |
| `transaction/useSendTransaction.ts` | React hook for send transaction UI flow |
| `balance/BalanceStreamManager.ts` | WebSocket balance streaming with V2 token support |
| `balance/BalanceCache.ts` | Token balance caching with full metadata |
| `announcements/wsSubscriber.ts` | WebSocket announcement subscription |
| `announcements/store.ts` | Announcement persistence and dismiss tracking |
| `verify/ChallengeBuilder.ts` | Sign-In With Wallet (SIWE) challenge verification |

### Extension UI (`packages/totem-extension/src/ui/`)

| File | Purpose |
|------|---------|
| `popup/BrutalistApp.tsx` | Main app shell with state-based navigation |
| `popup/pages/BrutalistHome.tsx` | Home page with balance card and token list |
| `popup/pages/BrutalistTokenDetail.tsx` | Token detail page with metadata display |
| `popup/components/AnnouncementBanner.tsx` | Announcement notification banner |
| `components/molecules/BalanceCard.tsx` | Balance display with Minima logo |
| `components/molecules/TokenRow.tsx` | Token list row with icon/badge/metadata |
| `hooks/useAnnouncements.ts` | Announcement subscription hook |
| `assets/MinimaLogo.tsx` | Base64-encoded Minima logo component |

### Java Reference Files (`attached_assets/`)

| File | Purpose |
|------|---------|
| `WinternitzOTSignature_bouncycastle.java` | WOTS signing/verification (BouncyCastle) |
| `TreeKey_*.java` | TreeKey hierarchical signature structure |
| `TreeKeyNode_*.java` | TreeKeyNode with WOTS keys and MMR |
| `SignatureProof_*.java` | SignatureProof structure |
| `Signature_*.java` | Container for multiple SignatureProofs |
| `Witness_*.java` | Transaction witness with signatures and MMR proofs |
| `Wallet_*.java` | Per-address TreeKey wallet implementation |

---

## End-to-End Flows

*Added 2026-02-18. These flows describe the complete lifecycle for each major wallet operation, enabling other builders to replicate Totem on any platform.*

### Flow 1: Wallet Creation

```
User clicks "Create Wallet"
  │
  ├─ 1. Generate BIP39 mnemonic (24 words)
  │     └─ generateMnemonic() → random entropy → word list
  │
  ├─ 2. Derive base seed
  │     └─ baseSeed = SHA3-256(cleanSeedPhrase(mnemonic))
  │     └─ NOTE: No PBKDF2, no HKDF — direct hash produces 32-byte seed
  │
  ├─ 3. Encrypt and store seed + mnemonic
  │     ├─ encryptAndStoreSeed(baseSeed, password) → chrome.storage.local
  │     └─ encryptAndStoreMnemonic(mnemonic, password) → chrome.storage.local
  │     └─ Uses Web Crypto API (AES-GCM) with password-derived key
  │
  ├─ 4. Generate addresses (hybrid 2-phase)
  │     ├─ Phase 1 (Fast Unlock): Generate first 4 addresses synchronously
  │     │   └─ For each addressIndex 0..3:
  │     │       ├─ addressSeed = derivePerAddressSeed(baseSeed, addressIndex)
  │     │       ├─ treeKey = createPerAddressTreeKey(addressSeed)  // depth=3, keysPerLevel=64
  │     │       ├─ publicKey = treeKey.getPublicKey()  // 32-byte MMR root
  │     │       ├─ script = "RETURN SIGNEDBY(0x<publicKey>)"
  │     │       └─ address = deriveAddress(script)  // Mx... format
  │     │
  │     └─ Phase 2 (Background): Generate remaining 60 addresses asynchronously
  │         └─ For each addressIndex 4..63:
  │             └─ Same derivation as Phase 1
  │             └─ If service worker terminates, partial state saved for resume
  │
  ├─ 5. Set session state
  │     ├─ sessionSeed = baseSeed (held in memory)
  │     ├─ state.locked = false
  │     └─ setRootPublicKeyAndIdentity(rootPublicKey)
  │         ├─ sessionRootPublicKey = "0x<hex>"
  │         ├─ identityHash = SHA3-256(rootPublicKeyHex) → hex string
  │         └─ rpcClient.setUserIdentityHash(identityHash)
  │
  └─ 6. Return { mnemonic, address: accounts[0].address }
       └─ UI shows mnemonic for backup, then navigates to home
```

**Import Wallet** follows the same flow but skips step 1 (mnemonic is provided by user) and validates with `validateMnemonic()`.

### Flow 2: Unlock / Lock

```
UNLOCK (password entry):
  │
  ├─ 1. Decrypt seed from storage
  │     └─ baseSeed = decryptSeed(password) from chrome.storage.local
  │
  ├─ 2. Fast unlock (Phase 1): Generate first 4 TreeKeys
  │     └─ For addressIndex 0..3:
  │         ├─ Create per-address TreeKey from baseSeed
  │         └─ Derive address and public key
  │
  ├─ 3. Set session state
  │     ├─ sessionSeed = baseSeed
  │     ├─ state.locked = false
  │     ├─ setRootPublicKeyAndIdentity(rootPublicKey)
  │     └─ setSessionActive(true) → chrome.storage.session
  │
  ├─ 4. Restore parent-child signature cache
  │     └─ parentChildSigCache.loadCacheForWallet(rootPublicKey)
  │
  ├─ 5. Background: Generate remaining 60 addresses (Phase 2)
  │
  └─ 6. Start balance streaming + periodic watermark sync

LOCK (manual or auto-timeout):
  │
  ├─ 1. Cancel background address generation
  ├─ 2. Stop periodic watermark sync
  ├─ 3. Save parent-child signature cache to storage
  ├─ 4. Clear all sensitive memory:
  │     ├─ sessionSeed.fill(0) → zero out
  │     ├─ sessionKey = null
  │     ├─ sessionRootPublicKey = null
  │     ├─ sessionIdentityHash = null
  │     ├─ rpcClient.clearUserIdentityHash()
  │     ├─ sessionTreeKey = null
  │     └─ clearPerAddressTreeKeyCache()
  ├─ 5. state.locked = true
  └─ 6. Clear session storage flags

SESSION RESTORE (service worker restart):
  │
  ├─ Check chrome.storage.session for sessionActive flag
  ├─ If active but seed not in memory → sessionExpired = true
  │   └─ UI shows unlock prompt (re-enter password)
  └─ Auto-lock if inactivity timeout exceeded
```

### Flow 3: Send Transaction (End-to-End)

```
User enters recipient, amount, and clicks Send
  │
  ├─ PHASE 1: PREPARE (client → server)
  │   │
  │   ├─ 1. Validate watermark (ensure signing capacity remains)
  │   │     └─ validateWatermarkBeforePrepare(rootPublicKey)
  │   │
  │   ├─ 2. POST /v1/wallet/prepare
  │   │     ├─ Body: { to, amount, tokenId?, burn?, rootPublicKey }
  │   │     └─ Server returns:
  │   │         ├─ leaseId, leaseToken (transaction lock)
  │   │         ├─ addressIndex, l1, l2 (signing indices)
  │   │         ├─ txId (transaction hex for signing)
  │   │         ├─ leaseTTL (seconds until lease expires)
  │   │         └─ inputCoins (CoinProof data for inputs)
  │   │
  │   ├─ 3. Persist lease to LeaseStore (chrome.storage.local)
  │   │     └─ { leaseId, indices: {addressIndex, l1, l2}, expiresAt, status: 'active' }
  │   │
  │   └─ 4. Return PrepareResponse with metadata
  │
  ├─ PHASE 2: SIGN (client-side only — private keys never leave extension)
  │   │
  │   ├─ 1. Get or create per-address TreeKey
  │   │     ├─ addressSeed = derivePerAddressSeed(baseSeed, addressIndex)
  │   │     └─ treeKey = createPerAddressTreeKey(addressSeed)
  │   │
  │   ├─ 2. Build transaction locally
  │   │     ├─ MinimaTransactionBuilder constructs inputs/outputs
  │   │     ├─ precomputeTransactionCoinID() — matches Java's TxPoWGenerator
  │   │     └─ digestTx = SHA3-256(serialized transaction)
  │   │
  │   ├─ 3. WOTS signing (3-proof chain)
  │   │     ├─ uses = l1 * 64 + l2
  │   │     ├─ treeKey.setUses(uses)
  │   │     ├─ signature = treeKey.sign(digestBytes)
  │   │     └─ Returns 3 SignatureProofs:
  │   │         ├─ Proof 0: Root → L1 (Root signs L1 child pubkey)
  │   │         ├─ Proof 1: L1 → L2 (L1 signs L2 child pubkey)
  │   │         └─ Proof 2: L2 → DATA (L2 signs transaction digest)
  │   │
  │   ├─ 4. Serialize witness (Minima wire format)
  │   │     └─ serializeHierarchicalWitness({
  │   │           addressIndex, l1, l2, rootPublicKey,
  │   │           proofs: [proof0hex, proof1hex, proof2hex]
  │   │         })
  │   │
  │   └─ 5. Clear TreeKey material from memory
  │
  ├─ PHASE 3: FINALIZE (client → server)
  │   │
  │   ├─ 1. POST /v1/wallet/finalize
  │   │     ├─ Body: { leaseId, leaseToken, signedTxHex, witnessHex }
  │   │     └─ Server performs:
  │   │         ├─ txncheck: validates signatures, scripts, MMR proofs
  │   │         ├─ txnpost mine:true: submits to network
  │   │         └─ Returns { txpowId, status }
  │   │
  │   ├─ 2. Update watermark (PERMANENT — never decremented)
  │   │     └─ watermarkStore.advance(addressIndex, l1, l2)
  │   │
  │   ├─ 3. Store transaction receipt
  │   │     └─ transactionReceiptStore.save({ txpowId, to, amount, timestamp })
  │   │
  │   └─ 4. Clear lease from LeaseStore
  │
  └─ ERROR HANDLING:
      ├─ 403: Lease expired → re-prepare
      ├─ 409: Watermark conflict → re-sync watermark from server
      ├─ 410: Transaction gone → notify user
      └─ 502: Node unreachable → retry with backoff
```

### Flow 4: Balance Loading

```
On wallet unlock or UI mount:
  │
  ├─ 1. BalanceStreamManager connects via WebSocket
  │     ├─ URL: wss://<api-base>/v1/ws/balance-stream
  │     ├─ Auth: JWT token in query parameter
  │     └─ Addresses: all 64 wallet addresses registered
  │
  ├─ 2. Server sends TOKEN_SNAPSHOT event
  │     └─ Contains all token balances for all addresses
  │         ├─ tokenid, token name, confirmed, unconfirmed, sendable
  │         ├─ Token metadata: ticker, icon, decimals, type (NFT/STANDARDTOKEN)
  │         └─ isAggregated flag (true if pre-aggregated across addresses)
  │
  ├─ 3. BalanceCache stores balances per address
  │     └─ CachedTokenBalance preserves all metadata through round-trips
  │
  ├─ 4. UI subscribes via useBalanceStream hook
  │     ├─ Home page: Aggregates balances across all addresses
  │     │   └─ Uses addDecimalStrings() for precise decimal math (no parseFloat)
  │     ├─ Total Minima balance shown in BalanceCard
  │     └─ Token list rendered via TokenRow components
  │
  ├─ 5. Incremental updates via BALANCE_UPDATE_V2 events
  │     └─ Real-time balance changes streamed as they occur
  │
  └─ FALLBACK: HTTP polling if WebSocket fails
      └─ GET /v1/wallet/balances?addresses=<comma-separated>
      └─ ConnectionState transitions: connected → error → fallback
```

### Flow 5: Receive Flow

```
User navigates to Receive page:
  │
  ├─ 1. Display current receive address
  │     └─ accounts[0].address (Mx... format)
  │     └─ Address is derived from RETURN SIGNEDBY(0x<rootPublicKey>)
  │
  ├─ 2. Generate QR code containing address
  │
  ├─ 3. Copy address to clipboard on tap
  │
  └─ 4. Address selection (optional)
      └─ User can select any of the 64 addresses for receiving
      └─ Each address has independent signing capacity
```

### Flow 6: DApp Provider API

The Totem extension exposes 12 methods to DApps via `chrome.runtime.onMessage`:

```
DApp ──message──→ content-script ──relay──→ background service worker
                                                    │
                                            isDAppSender(sender)?
                                            DAPP_ALLOWED_METHODS.has(method)?
                                                    │
                                            ┌───────┴──────────┐
                                            │ Allowed Methods  │
                                            └──────────────────┘
```

**Reserved Auth Address Index:** Address index `63` (`TOTEM_AUTH_ADDRESS_INDEX`) is permanently reserved for `TOTEM_VERIFY` authentication signing. It never holds funds and is never used for transaction signing. The wallet always uses this index when producing a WOTS proof for identity verification, regardless of which spend address a dApp connected to. This ensures that repeated logins consume leaves from the auth key pool and never erode spending capacity. A guard in the transaction signing path rejects any attempt to use index 63 for send operations.

| # | Method | Intent | Description |
|---|--------|--------|-------------|
| 1 | `TOTEM_CONNECT` | - | Request wallet connection |
| 2 | `TOTEM_CONNECT_APPROVE` | - | User approves connection |
| 3 | `TOTEM_VERIFY` | - | Sign-In With Wallet (SIWE) verification. Signs using reserved auth key (index 63). Response includes `authKeyIndex: 63`. After server validates the proof, it issues a session token — subsequent connects within the token TTL skip TOTEM_VERIFY (see TOTEM_CONNECT.md §4.3.1). |
| 4 | `TOTEM_GET_ACCOUNTS` | - | Get connected wallet addresses |
| 5 | `TOTEM_SEND_TRANSACTION` | `simple_send` | Simple send (to, amount, tokenId) |
| 6 | `TOTEM_GRANT_TX_PERMISSION` | - | Grant transaction permission to DApp |
| 7 | `TOTEM_REVOKE_TX_PERMISSION` | - | Revoke transaction permission |
| 8 | `TOTEM_GET_TX_PERMISSIONS` | - | Query current permissions |
| 9 | `TOTEM_GET_COINS` | `utxo_read` | Permission-gated UTXO queries |
| 10 | `TOTEM_SEND_COMPLEX` | `complex_send` | Full ScriptDescriptor support (MAST/multisig/HTLC/exchange/vault) |
| 11 | `TOTEM_SIGN_DATA` | `sign_data` | Partial signing for multisig with mandatory `inputAddresses[]` |
| 12 | `TOTEM_BROADCAST_HEX` | `broadcast_tx` | Broadcast pre-signed transaction blobs |

**Security model:**
- All methods enforce input ownership validation
- Digest-bound approval popups for signing operations
- `TOTEM_SIGN_DATA` requires `inputAddresses[]` to prevent blind signing
- `TOTEM_SEND_COMPLEX` supports `mode: 'build' | 'submit'` — build mode returns unsigned transaction without signing/broadcasting

### Flow 7: Per-User Identity Hash

```
On wallet unlock (3 init paths: create, import, restore):
  │
  ├─ 1. Derive root public key for address 0
  │     └─ rootPubkeyHex = "0x" + hex(treeKey.getPublicKey())
  │
  ├─ 2. Compute identity hash (client-side, privacy-preserving)
  │     └─ identityHash = hex(SHA3-256(TextEncoder.encode(rootPubkeyHex)))
  │
  ├─ 3. Set on RPC client
  │     └─ rpcClient.setUserIdentityHash(identityHash)
  │
  ├─ 4. All subsequent RPC calls include header
  │     └─ x-user-identity-hash: <identityHash>
  │
  ├─ 5. Server records per-user usage
  │     └─ project_requests.user_identity_hash column
  │
  ├─ 6. Quota endpoint
  │     └─ GET /v1/{projectId}/user-quota
  │     └─ Returns daily/monthly usage against shared project limits
  │
  └─ On wallet lock:
      ├─ rpcClient.clearUserIdentityHash()
      └─ sessionIdentityHash = null
```

**Privacy guarantees:**
- Identity hash is a one-way SHA3-256 hash — root public key cannot be recovered
- No raw PII stored server-side
- IP and User-Agent hashed server-side before storage
- `project_requests.user_identity_hash` and `wots_leases.root_pubkey` are architecturally separate — no cross-correlation allowed

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01 | Initial specification: WOTS parameters, TreeKey hierarchy, serialization, witness structure, extension architecture |
| 1.1 | 2026-01 | Unified parameter set (deprecated v1-dev and v2-spec aliases); fixed full 1088-byte public key in SignatureProof |
| 1.2 | 2026-02-05 | **Per-address TreeKey architecture**: Each address has independent TreeKey matching Wallet.java; WatermarkStore v2 with per-address tracking; LeaseStore updated for SigningIndices; legacy flat architecture removed |
| 1.3 | 2026-02-05 | **3-proof signing**: `setUses(l1*64+l2)` + `sign()` producing Root→L1→L2→DATA chain; 29 parity tests for Java compatibility; SDK wallet parity |
| 1.4 | 2026-02-05 | **Complete CoinProof extraction**: `extractCoinDataFromCoinProof()` with pre-serialized bytes for byte-exact serialization |
| 1.5 | 2026-02-06 | **Output CoinID precomputation**: Fixed transaction ID mismatch where Java precomputes output CoinIDs before digest; `precomputeTransactionCoinID()` in MinimaTransactionBuilder |
| 1.6 | 2026-02-06 | **Backend finalize fixes**: `txncheck` validation, burn parameter security, `txnpost mine:true` |
| 1.7 | 2026-02-08 | **Rich Token Metadata Pipeline**: End-to-end token metadata from backend to UI; TokenRow icons, NFT badges, verified stars; BrutalistTokenDetail page |
| 1.8 | 2026-02-08 | **Announcement system**: WebSocket delivery, admin dashboard, image upload with resize optimization |
| 2.0 | 2026-02-09 | **Comprehensive spec rewrite**: Consolidated all changes, added Transaction Building section, Coin Selection section, expanded file references, structured version history |
| 3.0 | 2026-02-18 | **End-to-end flows**: Added 7 complete operational flows (Wallet Creation, Unlock/Lock, Send Transaction, Balance Loading, Receive, DApp Provider API, Per-User Identity Hash); corrected capacity to 262,144 per address (64³); removed all deprecated method references |
| 3.1 | 2026-04-30 | **Reserved auth address**: `TOTEM_AUTH_ADDRESS_INDEX = 63` reserved permanently for TOTEM_VERIFY signing; guard added to reject index 63 in transaction signing path; `authKeyIndex` added to TOTEM_VERIFY response; server-side session token contract introduced (24 h TTL, 7 d max-lifetime refresh); dApp client session check gates TOTEM_VERIFY behind GET /api/auth/session (see TOTEM_CONNECT.md §4.3.1) |
