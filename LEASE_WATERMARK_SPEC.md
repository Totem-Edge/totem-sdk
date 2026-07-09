# WOTS Lease & Watermark System — Complete Technical Specification

> **Audience:** Developers building external multisig applications that use Totem/Axia accounts for offline signing.
>
> **Last updated:** 2026-02-11
>
> **Architecture version:** Per-Address TreeKey v2 (2026-02-05)

---

## Table of Contents

1. [Why Leases and Watermarks Exist](#1-why-leases-and-watermarks-exist)
2. [Per-Address TreeKey Architecture](#2-per-address-treekey-architecture)
3. [Index Allocation Mechanics](#3-index-allocation-mechanics)
4. [Server-Side Implementation (PostgreSQL)](#4-server-side-implementation-postgresql)
5. [Client-Side Tracking](#5-client-side-tracking)
6. [Complete Offline Signing Workflow](#6-complete-offline-signing-workflow)
7. [MultisigManager Coordination](#7-multisigmanager-coordination)
8. [API Reference](#8-api-reference)
9. [Error Handling & Edge Cases](#9-error-handling--edge-cases)
10. [Security Invariants](#10-security-invariants)
11. [Migration from Legacy Format](#11-migration-from-legacy-format)

---

## 1. Why Leases and Watermarks Exist

### The One-Time Signature Constraint

WOTS (Winternitz One-Time Signature) keys are **fundamentally different** from ECDSA/Ed25519 keys. Each WOTS key pair can only be used **once**. Reusing a WOTS key to sign two different messages reveals enough information to forge signatures — the security guarantee collapses completely.

This means every transaction requires a **fresh, never-before-used** signing index.

### The Coordination Problem

In a multi-device or multi-signer environment, two parties could independently try to use the same signing index. Without coordination:

- Device A signs message M₁ with index (2, 5)
- Device B signs message M₂ with index (2, 5)
- Both signatures leak information → key compromise

### Leases: Reserving Indices Before Signing

A **lease** is a time-bounded reservation of a specific signing index. When a client calls `PREPARE`, the server:

1. Finds the next unused index for the specified address
2. Reserves it exclusively (row-level lock in PostgreSQL)
3. Returns a signed JWT token (`leaseToken`) proving the reservation
4. Sets a TTL (time-to-live) — if the client doesn't finalize within the TTL, the lease expires

This prevents two concurrent transactions from receiving the same index.

### Watermarks: Monotonic High-Water Marks

A **watermark** tracks the highest index that has been allocated or used. It provides a second layer of safety:

- Watermarks **never decrease** (monotonic advancement)
- Even if a lease expires without being finalized, the watermark ensures that index is never re-allocated
- The client maintains a local watermark and validates it against the server

**Key rule:** `watermark(t₂) >= watermark(t₁)` for all `t₂ > t₁`. Violation of this invariant constitutes a critical security failure.

---

## 2. Per-Address TreeKey Architecture

### Overview

As of 2026-02-05, the system uses a **per-address TreeKey** architecture. Each of the 64 addresses has its own independent TreeKey with 4,096 signing slots.

```
Root Seed
  │
  ├── Address 0  → TreeKey₀ [64 × 64 = 4,096 signatures]
  ├── Address 1  → TreeKey₁ [64 × 64 = 4,096 signatures]
  ├── Address 2  → TreeKey₂ [64 × 64 = 4,096 signatures]
  │   ...
  └── Address 63 → TreeKey₆₃ [64 × 64 = 4,096 signatures]

Total capacity: 64 addresses × 4,096 signatures = 262,144 one-time signatures
```

### Index Hierarchy

The API uses a 3-level index system `(addressIndex, l1, l2)`:

| API Field      | Meaning                          | Range  |
|----------------|----------------------------------|--------|
| `addressIndex` | Address index                    | 0–63   |
| `l1`           | L1 index within per-address tree | 0–63   |
| `l2`           | L2 index within per-address tree | 0–63   |

The **flat index** for any signing slot is:
```
flatIndex = addressIndex × 4096  +  l1 × 64  +  l2

Range: 0 to 262,143
```

### Per-Address Flat Index

Within a single address, the flat index is:
```
addressFlatIndex = l1 × 64 + l2
Range: 0 to 4,095
```

When `l1 = 63` and `l2 = 63`, the address is **exhausted** — no more signatures can be produced from it. The wallet must use a different address.

### Unified Naming Convention

Naming is unified across server API, JWT claims, client extension, and SDK. The fields `addressIndex`, `l1`, and `l2` have the same meaning everywhere. The `convertApiIndicesToSigning()` conversion function has been removed.

### Signature Chain (Proofs)

For per-address signing (depth=3 TreeKey), the signature produces **3 proofs**:

```
proof[0]: Root → L1   (root signs L1 child's public key)
proof[1]: L1 → L2     (L1 signs L2 child's public key)
proof[2]: L2 → DATA   (L2 leaf signs the actual transaction digest)
```

Each `SignatureProofHex` contains:
- `leafPubkey`: 32-byte WOTS public key **digest** (SHA3-256 of the full L×32 key)
- `signature`: 1,088-byte WOTS signature (hex) — L×32 = 34×32 bytes
- `mmrProof`: Serialized MMR proof linking leaf to node root (hex)

---

## 3. Index Allocation Mechanics

### Allocation Order

Indices are allocated **sequentially within each address**:

```
Address 0: (l1=0,l2=0) → (0,1) → (0,2) → ... → (0,63) → (1,0) → (1,1) → ... → (63,63)
Address 1: (l1=0,l2=0) → (0,1) → ...
```

The `l2` counter increments first. When `l2` overflows past 63, it resets to 0 and `l1` increments. When `l1` reaches 64, the address is exhausted.

### Allocation Algorithm (Server)

```
function allocateNext(currentL1, currentL2):
  nextL2 = currentL2 + 1
  nextL1 = currentL1

  if nextL2 >= 64:
    nextL2 = 0
    nextL1 = nextL1 + 1

  if nextL1 >= 64:
    throw "Address exhausted"

  return (nextL1, nextL2)
```

### Concurrency Safety

The server uses PostgreSQL `SELECT ... FOR UPDATE` to prevent two concurrent `PREPARE` requests from receiving the same index:

```sql
BEGIN;

-- NOTE: DB columns l1/l2/l3 map to wire fields addressIndex/l1/l2
SELECT l2, l3 FROM wots_leases
WHERE root_pubkey = $1 AND param_set = $2 AND l1 = $3
ORDER BY l2 DESC, l3 DESC LIMIT 1
FOR UPDATE;

-- allocate next (l2, l3) based on result (wire l1/l2)
INSERT INTO wots_leases(...) VALUES (...);

COMMIT;
```

The `FOR UPDATE` clause acquires a row-level exclusive lock, forcing concurrent requests to serialize.

---

## 4. Server-Side Implementation (PostgreSQL)

### Schema: `wots_leases` Table

```sql
-- NOTE: DB columns l1/l2/l3 map to wire (API) fields addressIndex/l1/l2
CREATE TABLE wots_leases (
  id          VARCHAR PRIMARY KEY,        -- UUID v4
  root_pubkey VARCHAR NOT NULL,           -- Root public key (hex)
  param_set   VARCHAR NOT NULL DEFAULT 'v2-spec',
  l1          INTEGER NOT NULL,           -- Address index (0-63) — wire: addressIndex
  l2          INTEGER NOT NULL,           -- L1 within per-address TreeKey (0-63) — wire: l1
  l3          INTEGER NOT NULL,           -- L2 within per-address TreeKey (0-63) — wire: l2
  status      VARCHAR NOT NULL DEFAULT 'LEASED',  -- LEASED | USED | EXPIRED | CANCELLED
  api_key_id  VARCHAR,                    -- API key that created this lease
  tx_id       VARCHAR,                    -- Transaction ID
  digest_l2   VARCHAR,                    -- L2 digest (optional, client-provided)
  digest_l3   VARCHAR,                    -- L3 digest (optional, client-provided)
  digest_tx   VARCHAR,                    -- Transaction digest (client-provided)
  leased_at   BIGINT NOT NULL,            -- Unix timestamp (ms) of allocation
  ttl_ms      INTEGER NOT NULL,           -- Lease TTL in milliseconds
  used_at     BIGINT,                     -- When the lease was finalized/expired/cancelled
  posted_txpowid VARCHAR                  -- TxPoW ID after successful broadcast
);
```

### Lease Status Transitions

```
LEASED ──────┬──── finalize success ────→ USED
             │
             ├──── TTL expires ──────────→ EXPIRED
             │
             └──── error / cancel ───────→ CANCELLED
```

- **LEASED**: Index is reserved; client has not yet submitted signed transaction
- **USED**: Transaction was successfully broadcast; index is permanently consumed
- **EXPIRED**: TTL elapsed without finalization; index is consumed (never reused)
- **CANCELLED**: Finalization failed; index is consumed (never reused)

**Critical:** Even EXPIRED and CANCELLED leases **consume** the index permanently. The watermark never rewinds. This is by design — a lease that was returned to the client may have been used to sign data offline, even if the finalization was never submitted. Reusing the index would be a security violation.

### Lease Token (JWT)

The server mints a JWT `leaseToken` (signed with `JWT_SECRET`) that encodes:

```typescript
type PlanClaims = {
  lease_id: string;
  root_pubkey: string;
  param_set: string;       // "v2-spec"
  addressIndex: number;    // Address index (0-63)
  l1: number;              // L1 within per-address TreeKey (0-63)
  l2: number;              // L2 within per-address TreeKey (0-63)
  tx_id: string | null;
  digest_l2: string | null;
  digest_l3: string | null;
  digest_tx: string | null;
  exp: number;             // Expiry (Unix seconds)
};
```

The `leaseToken` serves as both:
1. **Proof of reservation** — the client presents it at `/finalize`
2. **Tamper-proof index binding** — the server verifies the JWT signature and extracts the exact indices that were allocated

### Cleanup of Expired Leases

A middleware on every request triggers cleanup:

```typescript
r.use(async (_req, _res, next) => {
  await db.cleanupExpiredLeases();
  next();
});
```

Cleanup query:
```sql
UPDATE wots_leases
SET status = 'EXPIRED', used_at = $1
WHERE status = 'LEASED' AND (leased_at + ttl_ms) < $1;
```

### TTL Configuration

| Parameter | Default  | Minimum | Maximum | Notes |
|-----------|----------|---------|---------|-------|
| `ttl_ms`  | 20,000 ms (20s) | 5,000 ms | 60,000 ms | Server-side clamp; client requests are capped |

The TTL is **clamped server-side** regardless of what the client requests:
```
effectiveTTL = Math.max(5000, Math.min(60000, params.ttl_ms ?? 20000))
```

**Important TTL details:**
- The **server default** is 20,000 ms (20 seconds) if no `ttlMs` is provided
- The **server maximum** is 60,000 ms (60 seconds) — even if the client requests 120,000 ms, the effective TTL will be 60,000 ms
- The Totem extension requests `ttlMs: 120000` but this is clamped to 60,000 ms
- The `leaseTTL` field in the PREPARE response is in **milliseconds**

**Client-side conversion note:** The extension's `TransactionLifecycle.prepare()` multiplies `leaseTTL` by 1,000 when computing `expiresAt`, treating it as seconds. If you're building an external client, use the value directly as milliseconds:
```typescript
// CORRECT — leaseTTL is already in milliseconds
const expiresAt = Date.now() + result.leaseTTL;

// WRONG — do not multiply by 1000
// const expiresAt = Date.now() + (result.leaseTTL * 1000);
```

---

## 5. Client-Side Tracking

### WatermarkStore (Per-Address)

The client (Totem extension) maintains a `WatermarkState` in `chrome.storage.local`:

```typescript
interface WatermarkState {
  version: 2;
  addresses: {
    [addressIndex: number]: {
      next_l1: number;          // Next available L1 within per-address TreeKey
      next_l2: number;          // Next available L2 within per-address TreeKey
      usedIndices: [number, number][];  // List of [l1, l2] pairs already used
    };
  };
  lastSyncTimestamp?: number;
}
```

**Storage key:** `totem_wots_watermark`

#### Monotonicity Enforcement

On every `save()`, the WatermarkStore validates that no address's watermark has decreased:

```typescript
async save(watermark: WatermarkState): Promise<void> {
  if (this.state) {
    for (const key of Object.keys(watermark.addresses)) {
      const idx = Number(key);
      const prev = this.state.addresses[idx];
      const next = watermark.addresses[idx];
      if (prev && next) {
        const prevFlat = prev.next_l1 * 64 + prev.next_l2;
        const nextFlat = next.next_l1 * 64 + next.next_l2;
        if (nextFlat < prevFlat) {
          throw new Error(
            `Monotonicity violation for address ${idx} — ` +
            `cannot decrease from (${prev.next_l1},${prev.next_l2}) ` +
            `to (${next.next_l1},${next.next_l2})`
          );
        }
      }
    }
  }
  // ... persist to storage
}
```

#### Address Exhaustion Check

```typescript
isAddressExhausted(addressIndex: number): boolean {
  const addrWm = this.state.addresses[addressIndex];
  return addrWm?.next_l1 >= 64;  // All 4,096 slots consumed
}

hasAvailableIndices(): boolean {
  for (let i = 0; i < 64; i++) {
    if (!this.isAddressExhausted(i)) return true;
  }
  return false;  // All 262,144 signatures consumed
}
```

#### Usage Metrics

```typescript
getAddressUsage(addressIndex: number): { used: number; total: number; percentage: number }
// Returns: { used: 150, total: 4096, percentage: 3.66 }

getTotalUsage(): { used: number; total: number; percentage: number }
// Returns: { used: 150, total: 262144, percentage: 0.06 }
```

### LeaseStore

The client tracks active leases in `chrome.storage.local`:

```typescript
interface StoredLease {
  leaseId: string;
  leaseToken: string;           // JWT from server
  indices: SigningIndices;       // { addressIndex, l1, l2 }
  expiresAt: number;            // Unix timestamp (ms)
  status: LeaseStatus;          // 'pending' | 'active' | 'expired' | 'finalized' | 'cancelled'
  createdAt: number;
  txId?: string;
  leaseTTL: number;             // Original TTL in ms
}
```

**Storage key:** `totem_wots_leases`

#### Concurrency Protection (AsyncMutex)

Both LeaseStore and WatermarkStore use an `AsyncMutex` to prevent concurrent `load()`/`save()` operations from corrupting state:

```typescript
class AsyncMutex {
  private _queue: Array<() => void> = [];
  private _locked = false;

  async acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this._queue.push(resolve);
    });
  }

  release(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift()!;
      next();
    } else {
      this._locked = false;
    }
  }
}
```

Every `save()`, `delete()`, `updateStatus()`, and `cleanupExpired()` operation acquires the mutex before reading/writing storage.

### LeaseMonitor (Background Timer)

The extension runs a `LeaseMonitor` that periodically checks for expiring leases:

- Monitoring interval: dynamically calculated as `min(minTTL / 4, 5000ms)`, clamped to at least `1000ms`
- Expiry warning threshold: 10 seconds before expiry
- Callbacks fire for each lease approaching expiry

```typescript
interface LeaseExpiryEvent {
  leaseId: string;
  leaseToken: string;
  expiresAt: number;
  remainingMs: number;
}
```

---

## 6. Complete Offline Signing Workflow

This section describes the full lifecycle for an external multisig application integrating with Axia/Totem.

### Step-by-Step Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Your App   │         │  Axia API    │         │ Minima Node  │
│  (External)  │         │  (Server)    │         │   (RPC)      │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  1. POST /prepare      │                        │
       │  {rootPublicKey,       │                        │
       │   txId, addressIndex}  │                        │
       │───────────────────────>│                        │
       │                        │  allocate lease        │
       │                        │  (PostgreSQL FOR       │
       │                        │   UPDATE lock)         │
       │                        │                        │
       │  {leaseToken,           │                        │
       │   addressIndex, l1,    │                        │
       │   l2, leaseTTL}       │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │  2. Build transaction  │                        │
       │     locally            │                        │
       │  (select coins,        │                        │
       │   compute digestTx)    │                        │
       │                        │                        │
       │  3. Sign offline       │                        │
       │  (WOTS signature       │                        │
       │   using allocated      │                        │
       │   indices)             │                        │
       │                        │                        │
       │  ┌─── MULTISIG ───┐   │                        │
       │  │ Export to other │   │                        │
       │  │ signers, collect│   │                        │
       │  │ all signatures  │   │                        │
       │  └────────────────┘   │                        │
       │                        │                        │
       │  4. POST /finalize     │                        │
       │  {leaseToken,          │                        │
       │   signedHex}          │                        │
       │───────────────────────>│                        │
       │                        │  txnimport data:<hex>  │
       │                        │───────────────────────>│
       │                        │                        │
       │                        │  txncheck id:<id>      │
       │                        │───────────────────────>│
       │                        │                        │
       │                        │  txnpost id:<id>       │
       │                        │  auto:false mine:true  │
       │                        │───────────────────────>│
       │                        │                        │
       │                        │  {txpowid}             │
       │                        │<───────────────────────│
       │                        │                        │
       │  {ok, leaseId,         │                        │
       │   txpowid}            │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │  5. Update local       │                        │
       │     watermark          │                        │
       │  (markUsed +           │                        │
       │   advanceWatermark)    │                        │
       │                        │                        │
```

### Step 1: PREPARE — Reserve Signing Index

```typescript
const response = await fetch('https://api.axia.to/v1/wots-hardened/prepare', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': YOUR_PROJECT_API_KEY,
  },
  body: JSON.stringify({
    txId: `tx-${Date.now()}-${randomId()}`,
    rootPublicKey: ROOT_PUBKEY_HEX,
    addressIndex: ADDRESS_INDEX,    // 0-63, REQUIRED
    paramSet: 'v2-spec',
    ttlMs: 60000,                   // 60 seconds (server max)
  }),
});

const lease = await response.json();
// lease = {
//   txId, rootPublicKey, paramSet,
//   addressIndex, l1, l2,          // Allocated indices
//   leaseId, leaseToken,           // JWT for finalization
//   leaseTTL,                      // TTL in ms
//   digestL2, digestL3, digestTx   // null (client computes locally)
// }
```

### Step 2: Build Transaction Locally

Fetch available coins from the wallet API, select inputs, construct the transaction body, and compute `digestTx` (SHA3-256 of the serialized transaction).

```typescript
const coins = await fetch(`${API_BASE}/v1/wallet/coins`, {
  headers: { 'x-api-key': YOUR_PROJECT_API_KEY }
});

// Select coins, build transaction, compute digest
const transaction = buildTransaction(coins, recipientAddress, amount);
const digestTx = sha3_256(serializeTransaction(transaction));
```

### Step 3: Sign Offline (WOTS)

Using the allocated indices from Step 1, produce the WOTS signature:

```typescript
// Per-address TreeKey signing produces 3 proofs:
//   proof[0]: Root → L1 (root signs L1 child's pubkey)
//   proof[1]: L1 → L2 (L1 signs L2 child's pubkey)
//   proof[2]: L2 → DATA (L2 leaf signs transaction digest)

const witnessBundle: HierarchicalWitnessBundle = {
  addressIndex: lease.addressIndex,  // Address index
  l1: lease.l1,                      // L1 within per-address TreeKey
  l2: lease.l2,                      // L2 within per-address TreeKey
  rootPublicKey: perAddressTreeKeyRoot,
  proofs: [
    {
      leafPubkey: rootToL1PubkeyDigest,    // SHA3-256 of full 1088-byte key
      signature: rootToL1SignatureHex,      // 1088-byte WOTS signature
      mmrProof: rootToL1MmrProofHex,       // MMR proof linking to tree root
    },
    {
      leafPubkey: l1ToDataPubkeyDigest,
      signature: l1ToDataSignatureHex,
      mmrProof: l1ToDataMmrProofHex,
    },
  ],
};
```

**For multisig:** At this point, export the unsigned transaction + digest to other signers. Collect all required signatures before proceeding to Step 4.

### Step 4: FINALIZE — Submit Signed Transaction

Serialize the complete transaction (TxnRow format: `[MiniString ID][Transaction][Witness]`) and submit:

```typescript
const signedHex = serializeTxnRow(transaction, witness);

const result = await fetch('https://api.axia.to/v1/wots-hardened/finalize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': YOUR_PROJECT_API_KEY,
  },
  body: JSON.stringify({
    leaseToken: lease.leaseToken,
    signedHex: signedHex,   // 0x-prefixed hex of complete TxnRow
  }),
});

const finalResult = await result.json();
// { ok: true, leaseId: "...", txpowid: "..." }
```

The server performs three RPC operations:
1. `txnimport data:<hex> id:<importId>` — import the signed transaction
2. `txncheck id:<importId>` — validate signatures, scripts, MMR proofs
3. `txnpost id:<importId> auto:false mine:true txndelete:true` — broadcast to network

**Important:** `auto:false` preserves your client-provided ScriptProofs. `auto:true` would overwrite WOTS scripts by trying to find them locally (which fails).

### Step 5: Update Local Watermark

After successful finalization, advance the local watermark:

```typescript
// Mark the indices as used
await watermarkStore.markUsed({
  addressIndex: lease.addressIndex,
  l1: lease.l1,
  l2: lease.l2,
});

// Advance the watermark pointer
await watermarkStore.advanceWatermark({
  addressIndex: lease.addressIndex,
  l1: lease.l1,
  l2: lease.l2,
});
```

---

## 7. MultisigManager Coordination

### Overview

The `MultisigManager` handles the coordination workflow for multisig transactions where multiple parties must sign before broadcast.

### Multisig Script Types

| Type   | Description       | Threshold | Public Keys |
|--------|-------------------|-----------|-------------|
| `2of2` | Two-of-two        | 2         | Exactly 2   |
| `mofn` | M-of-N threshold  | M         | N keys      |

### Creating a Multisig Transaction

```typescript
const config: MultisigConfig = {
  type: '2of2',
  threshold: 2,
  publicKeys: [TOTEM_PUBKEY, EXTERNAL_PUBKEY],
  ownPublicKey: TOTEM_PUBKEY,
  address: multisigAddress,
};

const pendingTx = await multisigManager.createPendingTransaction(
  config,
  transactionHex,       // Unsigned transaction body
  transactionDigest,    // SHA3-256 digest for signing
  24                    // Expiration in hours (default: 24)
);
```

### Signature Collection

```typescript
// Totem adds its own signature (WOTS)
await multisigManager.addOwnSignature(
  pendingTx.id,
  wotsSignatureHex,
  mmrProof
);

// Import external signer's signature
const result = await multisigManager.importExternalSignature(
  pendingTx.id,
  externalPublicKey,
  externalSignatureHex,
  'wots',               // or 'standard' for non-WOTS
  externalMmrProof
);

// Check if we have enough signatures
const status = await multisigManager.getSignatureStatus(pendingTx.id);
// { required: 2, collected: 1, missing: ["0xabc..."], status: "pending" }
```

### Export/Import for Offline Coordination

```typescript
// Export transaction data for sharing with external signers
const exportData = await multisigManager.exportTransaction(pendingTx.id);
// exportData: MultisigExportData = {
//   version: 1,
//   id: "...",
//   config: { type, threshold, publicKeys, ownPublicKey },
//   transactionHex: "0x...",
//   transactionDigest: "0x...",
//   signatures: [{ publicKey, signature, signatureType }],
//   createdAt: 1707...
// }

// Send exportData to external signer (QR code, file, network)

// External signer imports, adds their signature, exports back
const imported = await multisigManager.importTransaction(receivedExportData);
```

### Status Transitions

```
pending ──── enough sigs ────→ ready ──── broadcast ────→ broadcast
   │                             │
   └──── TTL expires ────────────┴──── error ────→ failed
                                                     │
                                                     └──── expired
```

### Integration with Lease System

The MultisigManager operates **between** the PREPARE and FINALIZE steps:

1. **PREPARE** → get lease and indices
2. **Build transaction** → create unsigned transaction body
3. **MultisigManager** → coordinate signatures (may take minutes to hours)
4. **FINALIZE** → submit fully-signed transaction

**Warning:** The lease TTL (default 2 minutes) is much shorter than multisig coordination time. For multisig workflows:
- Request the lease close to finalization time, not at the start of coordination
- Or design your flow so that the PREPARE happens only after all signatures are collected and you're ready to broadcast immediately

---

## 8. API Reference

### Base URL

```
Production: https://api.axia.to/v1/wots-hardened
Development: http://localhost:<PORT>/v1/wots-hardened
```

### Authentication

All endpoints require the `x-api-key` header:
```
x-api-key: <your-project-api-key>
```

---

### POST `/prepare`

Allocates a WOTS lease with watermark indices.

#### Request Body

```json
{
  "txId": "tx-1707654321-abc123",
  "rootPublicKey": "0xabcdef1234567890...",
  "addressIndex": 5,
  "paramSet": "v2-spec",
  "ttlMs": 60000,
  "digestL2": null,
  "digestL3": null,
  "digestTx": null
}
```

| Field          | Type     | Required | Description |
|----------------|----------|----------|-------------|
| `txId`         | string   | Yes      | Unique transaction identifier |
| `rootPublicKey`| string   | Yes      | Root public key (hex) |
| `addressIndex` | number   | Yes      | HD address index (0–63) — maps to TreeKey L1 |
| `paramSet`     | string   | No       | Must be `"v2-spec"` (default). `"v1-dev"` rejected for new leases |
| `ttlMs`        | number   | No       | Requested lease TTL in ms. **Clamped server-side** to 5,000–60,000 ms. Default: 20,000 ms |
| `digestL2`     | string   | No       | Client-provided L2 digest (optional) |
| `digestL3`     | string   | No       | Client-provided L3 digest (optional) |
| `digestTx`     | string   | No       | Client-provided transaction digest (optional) |

#### Response (200)

```json
{
  "txId": "tx-1707654321-abc123",
  "rootPublicKey": "0xabcdef1234567890...",
  "paramSet": "v2-spec",
  "addressIndex": 5,
  "l1": 3,
  "l2": 42,
  "digestL2": null,
  "digestL3": null,
  "digestTx": null,
  "leaseId": "a1b2c3d4-e5f6-...",
  "leaseToken": "eyJhbGciOiJIUzI1NiI...",
  "leaseTTL": 120000,
  "note": "Build transaction locally with coins from /v1/wallet/coins, then call /finalize with signedHex"
}
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400    | Missing `rootPublicKey`, `txId`, or invalid `addressIndex` |
| 400    | Invalid `paramSet` |
| 403    | `v1-dev` param set requested for new lease |
| 500    | Server error during allocation |

---

### POST `/finalize`

Imports and broadcasts a client-signed transaction.

#### Request Body

```json
{
  "leaseToken": "eyJhbGciOiJIUzI1NiI...",
  "signedHex": "0x00010c746f74656d2d...",
  "burn": "0.001"
}
```

| Field         | Type   | Required | Description |
|---------------|--------|----------|-------------|
| `leaseToken`  | string | Yes      | JWT from `/prepare` response |
| `signedHex`   | string | Yes      | Complete serialized TxnRow as hex (0x-prefixed). Must be >100 chars of valid hex |
| `burn`        | string | No       | Burn amount in MINIMA (numeric string, e.g. `"0.001"`) |
| `txId`        | string | No       | Must match the `tx_id` in the lease token if provided |
| `importId`    | string | No       | Client-provided import ID (auto-generated if omitted) |

**Only hex is accepted.** The server uses Minima's `txnimport data:<hex>` command, which only supports hex input. Base64 (`data64:`) is **not supported** by Minima's RPC. Do not send `signedBase64` — the server will reject the request.

**`signedHex` format:** The hex string must be a valid Minima TxnRow:
```
[MiniString ID][Transaction][Witness]
```

#### Response (200)

```json
{
  "ok": true,
  "leaseId": "a1b2c3d4-e5f6-...",
  "txpowid": "0x1234567890abcdef...",
  "elapsedMs": 1523
}
```

#### Error Responses

| Status | Condition | Notes |
|--------|-----------|-------|
| 400    | Missing `leaseToken` or `signedHex` | |
| 400    | Invalid hex format or too short | Must be proper hex, >100 chars |
| 400    | `txncheck` validation failed | WOTS signature mismatch, invalid ScriptProof, or MMRProof error |
| 404    | Lease not found | |
| 409    | Lease already consumed (`USED`) | Returns `existingTxpowid` |
| 409    | `txId` mismatch | Provided txId doesn't match lease token |
| 410    | Lease expired or cancelled | |
| 502    | Transaction import (`txnimport`) failed | Check `rpcResponse` for Java exception details |
| 502    | Transaction broadcast (`txnpost`) failed | No `txpowid` returned |
| 500    | Server error | |

#### Finalize Server-Side Steps

1. **Verify lease token** — JWT signature check, extract claims
2. **Validate lease status** — must be `LEASED` (not USED, EXPIRED, CANCELLED)
3. **Import transaction** — `txnimport data:<hex> id:<importId>`
4. **Validate transaction** — `txncheck id:<importId>` (checks signatures, scripts, MMR proofs)
5. **Broadcast** — `txnpost id:<importId> auto:false mine:true txndelete:true`
6. **Update lease** — mark as `USED` with `txpowid`

---

### GET `/watermark`

Read-only introspection of server watermark state.

#### Query Parameters

| Param     | Type   | Default      | Description |
|-----------|--------|--------------|-------------|
| `root`    | string | `root:unknown` | Root public key |
| `paramSet`| string | `v2-spec`    | Parameter set (`v1-dev` or `v2-spec`) |

#### Response (200)

```json
{
  "paramSet": "v2-spec",
  "next": { "addressIndex": 0, "l1": 3, "l2": 42 },
  "note": "Active parameter set"
}
```

---

## 9. Error Handling & Edge Cases

### Lease Expiry During Signing

**Scenario:** WOTS signing takes longer than the lease TTL.

**Mitigation:**
- Request `ttlMs: 120000` (2 minutes) — the maximum the server will honor (clamped to 60,000ms server-side, but clients typically request 120,000 and the extension uses this value)
- Monitor lease expiry using `LeaseMonitor`
- If the lease expires, the index is **consumed permanently** — you must request a new lease

**Recovery:**
```typescript
if (Date.now() > lease.expiresAt) {
  // Lease expired — do NOT attempt to finalize
  // Request a new lease with a new index
  const newLease = await prepare({ ... });
}
```

### Address Exhaustion

**Scenario:** All 4,096 signing slots for an address are consumed.

**Detection:**
```typescript
// Server-side: allocateLease throws
"Address L1=${l1} has exhausted all 4096 signing slots"

// Client-side: watermarkStore check
if (watermarkStore.isAddressExhausted(addressIndex)) {
  // Use a different address
}
```

**Recovery:** Use a different address (0–63). If all 64 addresses are exhausted (262,144 total signatures used), the wallet must be replaced entirely.

### Total Wallet Exhaustion

**Detection:**
```typescript
if (!watermarkStore.hasAvailableIndices()) {
  throw new WatermarkExhaustedError();
  // "All WOTS signatures have been used. Please create a new wallet."
}
```

### Multi-Device Conflict

**Scenario:** Two devices share the same wallet seed and independently request leases.

**Current behavior:** The server handles this through PostgreSQL row locking — each device gets a unique index. However, the **client-side** watermarks may diverge.

**Detection:** The `WatermarkSyncResult` includes a `multiDeviceConflict` flag (reserved for future use).

**Best practice:** Sync watermarks before transactions:
```typescript
const syncResult = await syncWatermark(rootPublicKey);
if (syncResult.multiDeviceConflict) {
  // Warn user about potential watermark divergence
}
```

### Legacy v1 Format Detection

The WatermarkStore detects legacy v1 format and **blocks all signing** until explicit migration:

```typescript
if (watermarkStore.isLegacyBlocked()) {
  // Cannot sign — legacy watermark format requires migration
  await watermarkStore.migrateLegacy();
}
```

Legacy format indicators:
- `version` missing or `=== 1`
- `next_l1` exists at the root level (not nested under `addresses`)

### Concurrent Prepare Requests

**Scenario:** Two `PREPARE` requests arrive simultaneously for the same address.

**Behavior:** PostgreSQL `FOR UPDATE` serializes them. The first gets index `(l1=3, l2=42)`, the second gets `(l1=3, l2=43)`. No collision.

### Network Failure After Signing

**Scenario:** Client signs the transaction but the `/finalize` request fails due to network error.

**Risk:** The WOTS key at the allocated index has been used to sign data. Even though the transaction wasn't broadcast, the key is **compromised** for that index.

**Mitigation:**
- The lease will expire server-side (status → EXPIRED)
- The index is permanently consumed
- The client should advance its local watermark past this index
- Retry with a **new** lease (new index)

### Storage Corruption

The WatermarkStore validates all loaded state:
- `version` must be `2`
- `addresses` must be an object
- Each address index must be 0–63
- `next_l1` and `next_l2` must be valid numbers in range
- `usedIndices` must be an array

If validation fails, the store treats the data as corrupted and blocks signing (same as legacy detection).

---

## 10. Security Invariants

These invariants must **never** be violated. Violating any of them can lead to WOTS key compromise.

| # | Invariant | Consequence of Violation |
|---|-----------|--------------------------|
| 1 | **Monotonic watermark advancement** — watermarks never decrease | Index reuse → signature forgery |
| 2 | **One-time index usage** — each (addressIndex, l1, l2) tuple is used at most once | Key compromise |
| 3 | **Lease exclusivity** — no two active leases share the same indices | Concurrent signing of different messages with same key |
| 4 | **Expired/cancelled indices are never reused** — even unused leases consume their index | Potential offline signing means the key may have been used |
| 5 | **Server-side row locking** — `FOR UPDATE` prevents concurrent allocation races | Two clients could receive the same index |
| 6 | **Client-side mutex** — `AsyncMutex` prevents concurrent read/write corruption | Storage races could corrupt watermark state |
| 7 | **JWT lease token integrity** — signed with server's `JWT_SECRET` | Forged lease tokens could bypass index allocation |
| 8 | **Legacy format blocks signing** — v1 watermarks block all operations until migration | Legacy format indices don't map correctly to per-address architecture |

---

## 11. Migration from Legacy Format

### Legacy v1 Format

```typescript
// Old format (pre-2026-02-05)
interface LegacyWatermarkState {
  version?: 1;
  next_l1: number;      // Global watermark
  next_l2: number;
  next_l3: number;
  usedIndices: [number, number, number][];  // [l1, l2, l3] triples
}
```

### Migration Process

The `migrateLegacy()` method converts v1 → v2:

1. Read legacy state from storage
2. Create fresh v2 state with 64 empty address entries
3. For each legacy `usedIndices` entry `[l1, l2, l3]`:
   - `l1` becomes the `addressIndex`
   - `(l2, l3)` becomes the per-address `usedIndices` entry
   - Advance the per-address watermark if this entry is ahead of the current pointer
4. Save v2 state, clearing the legacy detection flag

```typescript
// Trigger migration
if (await watermarkStore.isLegacyFormat()) {
  const migratedState = await watermarkStore.migrateLegacy();
  // Signing is now unblocked
}
```

### Legacy Lease Format

Legacy leases (pre-unification) used `WotsIndices { l1, l2, l3 }` directly. The LeaseStore auto-migrates on load (this is legacy migration code, retained for backward compatibility):

```typescript
// If legacy format detected (has 'l3' field in indices)
if ('l3' in lease.indices) {
  const legacyIndices = lease.indices as WotsIndices;
  return {
    ...lease,
    indices: {
      addressIndex: legacyIndices.l1,
      l1: legacyIndices.l2,
      l2: legacyIndices.l3,
    },
  };
}
```

---

## Appendix A: Type Definitions Reference

### Server Types

```typescript
// leaseStore-postgres.ts
// NOTE: DB columns l1/l2/l3 map to wire (API) fields addressIndex/l1/l2
type LeaseRow = {
  id: string;
  root_pubkey: string;
  param_set: string;
  l1: number; l2: number; l3: number;  // DB columns — wire: addressIndex/l1/l2
  status: "LEASED" | "USED" | "EXPIRED" | "CANCELLED";
  api_key_id: string | null;
  tx_id: string | null;
  digest_l2: string | null;
  digest_l3: string | null;
  digest_tx: string | null;
  leased_at: number;
  ttl_ms: number;
  used_at: number | null;
  posted_txpowid: string | null;
};

// token.ts
type PlanClaims = {
  lease_id: string;
  root_pubkey: string;
  param_set: string;
  addressIndex: number;  // Address index (0-63)
  l1: number;            // L1 within per-address TreeKey (0-63)
  l2: number;            // L2 within per-address TreeKey (0-63)
  tx_id: string | null;
  digest_l2: string | null;
  digest_l3: string | null;
  digest_tx: string | null;
};
```

### Client Types

```typescript
// WatermarkStore.ts
interface SigningIndices {
  addressIndex: number;   // 0-63
  l1: number;             // 0-63 within per-address TreeKey
  l2: number;             // 0-63 within per-address TreeKey
}

interface AddressWatermark {
  next_l1: number;
  next_l2: number;
  usedIndices: Array<[number, number]>;
}

interface WatermarkState {
  version: 2;
  addresses: { [addressIndex: number]: AddressWatermark };
  lastSyncTimestamp?: number;
}

// LeaseStore.ts
type LeaseStatus = 'pending' | 'active' | 'expired' | 'finalized' | 'cancelled';

interface StoredLease {
  leaseId: string;
  leaseToken: string;
  indices: SigningIndices;
  expiresAt: number;
  status: LeaseStatus;
  createdAt: number;
  txId?: string;
  leaseTTL: number;
}

// MultisigManager.ts
interface MultisigConfig {
  type: '2of2' | 'mofn';
  threshold: number;
  publicKeys: string[];
  ownPublicKey: string;
  address?: string;
}

interface MultisigExportData {
  version: number;
  id: string;
  config: MultisigConfig;
  transactionHex: string;
  transactionDigest: string;
  signatures: Array<{
    publicKey: string;
    signature: string;
    signatureType: 'wots' | 'standard';
  }>;
  createdAt: number;
}

// Transaction Service types
interface PrepareResponse {
  addressIndex: number;    // Address index (0-63)
  l1: number;              // L1 within per-address TreeKey (0-63)
  l2: number;              // L2 within per-address TreeKey (0-63)
  leaseToken: string;
  digestTx: string;
  digestL2: string | null;
  digestL3: string | null;
  txId: string;
  rootPublicKey: string;
  paramSet: string;
  leaseId: string;
  leaseTTL: number;
}

interface FinalizeResponse {
  ok: boolean;
  leaseId: string;
  txpowid: string;
}

interface SignatureProofHex {
  leafPubkey: string;   // 32-byte WOTS public key DIGEST (SHA3-256)
  signature: string;    // 1088-byte WOTS signature hex (34×32 bytes)
  mmrProof: string;     // Serialized MMR proof hex
}

interface HierarchicalWitnessBundle {
  addressIndex: number;    // Address index (0-63)
  l1: number;              // L1 within per-address TreeKey (0-63)
  l2: number;              // L2 within per-address TreeKey (0-63)
  rootPublicKey: string;   // Per-address TreeKey root
  proofs: SignatureProofHex[];  // 3 proofs for per-address architecture (Root→L1→L2→DATA)
}
```

---

## Appendix B: Source File Map

| Component | File Path |
|-----------|-----------|
| Server lease allocation (PostgreSQL) | `packages/axia-api/src/wots/leaseStore-postgres.ts` |
| Server API routes (prepare/finalize) | `packages/axia-api/src/wots/hardenedRoutes.ts` |
| Server lease token (JWT) | `packages/axia-api/src/wots/token.ts` |
| SDK TransactionService | `packages/totem-sdk/packages/core/src/tx/TransactionService.ts` |
| SDK TransactionLifecycle | `packages/totem-sdk/packages/core/src/tx/TransactionLifecycle.ts` |
| Extension LeaseStore | `packages/totem-extension/src/core/stores/LeaseStore.ts` |
| Extension WatermarkStore | `packages/totem-extension/src/core/stores/WatermarkStore.ts` |
| Extension Transaction Lifecycle | `packages/totem-extension/src/core/transaction/lifecycle.ts` |
| Extension Transaction Service | `packages/totem-extension/src/core/transaction/service.ts` |
| Extension Watermark Validation | `packages/totem-extension/src/core/validation/watermark.ts` |
| Extension Watermark Sync | `packages/totem-extension/src/core/sync/watermark.ts` |
| Extension Lease Monitor | `packages/totem-extension/src/core/monitoring/lease.ts` |
| Extension MultisigManager | `packages/totem-extension/src/core/transaction/services/MultisigManager.ts` |
| SDK Demo: Lease Lifecycle | `packages/totem-sdk/examples/node-wallet/src/demo-lease-lifecycle.ts` |
