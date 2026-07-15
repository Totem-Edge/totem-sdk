# Totem SDK Integration Patterns

## Overview
The Totem Extension integrates with three primary systems:
1. **Totem SDK** - Client-side WOTS cryptography
2. **Axia API** - RPC proxy, WOTS lease management, quota tracking
3. **Minima Network** - Direct blockchain queries (read-only)

## Totem SDK (@totemsdk/core)

### Package Structure
```
packages/totem-sdk/
├── packages/core/
│   ├── src/
│   │   ├── wots/      # WOTS signing algorithms
│   │   ├── params/    # Parameter sets (v2-spec, etc.)
│   │   ├── mmr/       # Merkle Mountain Range trees
│   │   └── utils/     # SHA3-256, byte manipulation
│   └── package.json
├── README.md
└── package.json
```

### Core Functions

#### 1. WOTS Signing
```typescript
import { wotsSign, fromHex, toHex } from '@totemsdk/core/wots';
import { WOTS_V2_SPEC } from '@totemsdk/core/params';

// Sign a 32-byte message digest
const seed = new Uint8Array(32); // Your root seed
const index = 42;               // Key index (L1, L2, or L3)
const messageDigest = fromHex('0x1234...'); // 32 bytes

const signature = wotsSign(seed, index, messageDigest, WOTS_V2_SPEC);
// Returns: Uint8Array of length L * 32 (34 * 32 = 1,088 bytes for v2-spec)
```

#### 2. WOTS Public Key Generation
```typescript
import { wotsPubKey } from '@totemsdk/core/wots';

// Generate public key for a given index
const publicKey = wotsPubKey(seed, index, WOTS_V2_SPEC);
// Returns: Uint8Array of length L * 32 (1,088 bytes)

// Hash to get compact address (32 bytes)
const address = sha3_256(publicKey);
```

#### 3. Parameter Sets
```typescript
import { getParamSet, WOTS_V2_SPEC, WOTS_W16_SPEC } from '@totemsdk/core/params';

// v2-spec (default for Totem)
// - w = 256 (Winternitz parameter)
// - L = 34 (signature length)
// - Security: 128-bit post-quantum
const v2 = WOTS_V2_SPEC;

// w16-spec (legacy, smaller signatures)
// - w = 16
// - L = 67
// - Security: 128-bit post-quantum
const w16 = WOTS_W16_SPEC;

// Get by name
const paramSet = getParamSet('v2-spec');
```

### WOTS Cryptography Concepts

#### Winternitz One-Time Signatures (WOTS)
**Problem**: Classical signatures (RSA, ECDSA) are vulnerable to quantum computers via Shor's algorithm.

**Solution**: Hash-based signatures (WOTS) rely only on hash function collision resistance, which is quantum-resistant.

#### How WOTS Works
```
1. Private Key Generation:
   SK = [sk[0], sk[1], ..., sk[L-1]]
   where sk[i] = SHA3(seed || index || i)

2. Public Key Generation:
   PK = [pk[0], pk[1], ..., pk[L-1]]
   where pk[i] = hash^(w-1)(sk[i])
   (apply SHA3 w-1 times)

3. Signing:
   For message digest M:
   - Split M into L chunks of log2(w) bits each
   - For each chunk m[i]:
     SIG[i] = hash^(w - 1 - m[i])(sk[i])

4. Verification:
   For each chunk m[i]:
     hash^(m[i])(SIG[i]) should equal pk[i]
```

**Key Property**: Each private key can sign ONLY ONE message safely. Reusing a key leaks information that can forge signatures.

#### Hierarchical WOTS (L1/L2/L3)
To enable multiple signatures from one root seed:

```
Root Seed (256-bit)
 │
 ├─ L1 Tree (64 keys) - Signs L2 tree roots
 │   │
 │   ├─ L2-0 Tree (64 keys) - Signs L3 tree roots
 │   │   │
 │   │   ├─ L3-0 Tree (64 keys) - Signs transactions
 │   │   ├─ L3-1 Tree (64 keys)
 │   │   └─ ... (64 total L3 trees)
 │   │
 │   ├─ L2-1 Tree (64 keys)
 │   └─ ... (64 total L2 trees)
 │
 ├─ L1-1 Tree
 └─ ... (64 total L1 keys)

Total capacity: 64 (L1) × 64 (L2) × 64 (L3) = 262,144 signatures
```

**Usage Example**:
```typescript
// Transaction #12,345 uses:
// L1 = 2 (third L1 key)
// L2 = 35 (36th L2 key under L1=2)
// L3 = 57 (58th L3 key under L2=35)

const l1Sig = wotsSign(seed, 2, digest, paramSet);
const l2Sig = wotsSign(seed, 35, digest, paramSet);
const l3Sig = wotsSign(seed, 57, digest, paramSet);

// All three signatures are bundled and submitted together
```

### MMR (Merkle Mountain Range) Trees

**Purpose**: Efficiently prove set membership without revealing other elements.

**Use Case in Totem**: Proving a WOTS public key belongs to a user's key tree without exposing sibling keys.

```typescript
import { MMRTree, MMRProof } from '@totemsdk/core/mmr';

// Build MMR from list of public keys
const pubKeys = [pk0, pk1, pk2, ..., pk63]; // L3 tree (64 keys)
const tree = new MMRTree(pubKeys);

// Get root hash (commitment to entire tree)
const root = tree.getRoot();

// Generate proof for key at index 42
const proof = tree.getProof(42);

// Verify proof
const isValid = MMRProof.verify(root, pk42, proof);
```

## Axia API Integration

### Base Configuration
```typescript
// From: packages/totem-extension/src/core/api/base.ts

// Get RPC endpoint
const apiBase = await getApiBase();
// Returns: "https://rpc.axia.to" (production)
//      or: Custom URL from storage (AXIA_BASE)

// Get Project ID (replaces API keys)
const projectId = await getProjectId();
// Returns: "totem-shared" (default public project)
//      or: User's custom project ID from storage
```

### Endpoint Categories

#### 1. WOTS Lease Management
**Base URL**: `https://rpc.axia.to/wots/hardened`

##### POST /prepare
**Purpose**: Request fresh WOTS indices for signing

**Request**:
```json
{
  "txId": "tx-1234567890-abc123",
  "rootPublicKey": "0xabcd...ef12",
  "to": "0x1234...5678",
  "amount": "100.00",
  "tokenId": "0x00",
  "burn": null,
  "paramSet": "v2-spec"
}
```

**Response**:
```json
{
  "l1": 2,
  "l2": 35,
  "l3": 57,
  "leaseToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "digestTx": "0x9876...fedc",
  "digestL2": "0x1111...2222",
  "digestL3": "0x3333...4444",
  "txId": "tx-1234567890-abc123",
  "rootPublicKey": "0xabcd...ef12",
  "paramSet": "v2-spec",
  "leaseId": "lease-uuid-1234",
  "leaseTTL": 300
}
```

**Headers**:
- `Content-Type: application/json`
- `x-api-key: <projectId>`

**Quota Cost**: 10 credits (lease:request)

##### POST /finalize
**Purpose**: Submit signed transaction and mark lease consumed

**Request**:
```json
{
  "leaseToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "signedHex": "0x..."
}
```

**Response**:
```json
{
  "ok": true,
  "leaseId": "lease-uuid-1234",
  "txpowid": "0xdeadbeef..."
}
```

**Quota Cost**: 5 credits (txn:submit)

#### 2. RPC Proxy Endpoints
**Base URL**: `https://rpc.axia.to/v1/<projectId>`

**Format**: JSON-RPC 2.0

##### Example: Get Balance
```typescript
const response = await fetch(`https://rpc.axia.to/v1/totem-shared`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'balance',
    params: { address: '0x1234...' },
    id: Date.now()
  })
});

const result = await response.json();
// { jsonrpc: "2.0", result: { balance: "1234.56", confirmed: "1234.56" }, id: 1234567890 }
```

**Quota Cost**: 1 credit (query:balance)

##### Example: Get Transaction Status
```json
{
  "jsonrpc": "2.0",
  "method": "txpow",
  "params": { "txpowid": "0xabcd..." },
  "id": 2
}
```

**Quota Cost**: 1 credit (query:txpow)

#### 3. Remote Config
**Endpoint**: `https://rpc.axia.to/totem.json`

**Purpose**: Fetch extension configuration (RPC endpoints, feature flags)

**Response**:
```json
{
  "rpcEndpoint": "https://rpc.axia.to",
  "projectId": "totem-shared",
  "version": "1.0.0",
  "features": {
    "dappConnect": true,
    "hardwareWallet": false
  },
  "limits": {
    "maxGasPrice": "1000",
    "maxTxSize": 1024
  }
}
```

**Caching**: Fetched on extension load, cached in `chrome.storage.local.REMOTE_CONFIG`

## Quota Management System

### Quota Headers
Axia API returns quota information in every response:

```
x-quota-daily-limit: 1000
x-quota-daily-remaining: 847
x-quota-daily-reset: 1234567890
x-quota-monthly-limit: 50000
x-quota-monthly-remaining: 42153
x-quota-monthly-reset: 1234567890
```

### Quota Manager
```typescript
import { quotaManager } from '@/core/quota/manager';

// Parse headers from API response
await quotaManager.updateFromHeaders(response.headers);

// Get current quota state
const quota = quotaManager.getQuota();
// {
//   daily: { limit: 1000, remaining: 847, used: 153, percentUsed: 15.3 },
//   monthly: { limit: 50000, remaining: 42153, used: 7847, percentUsed: 15.7 },
//   isExceeded: false,
//   exceededType: null
// }

// Check if warning threshold reached (80%)
const shouldWarn = quotaManager.shouldWarn();

// Subscribe to quota updates (for UI)
const unsubscribe = quotaManager.subscribe((quota) => {
  console.log('Quota updated:', quota);
});
```

### Quota Tiers
| Tier | Daily Limit | Monthly Limit | Cost |
|------|-------------|---------------|------|
| **Free** | 1,000 | 10,000 | $0/month |
| **Developer** | 10,000 | 100,000 | $19/month |
| **Growth** | 100,000 | 1,000,000 | $99/month |
| **Scale** | 1,000,000 | 10,000,000 | $499/month |

### Method Weights
Different RPC methods consume different credit amounts:

| Method | Cost | Category |
|--------|------|----------|
| `balance` | 1 | query:balance |
| `txpow` | 1 | query:txpow |
| `status` | 1 | query:status |
| `coins` | 2 | query:coins |
| `tokens` | 2 | query:tokens |
| `wots/hardened/prepare` | 10 | lease:request |
| `wots/hardened/finalize` | 5 | txn:submit |
| `tx/build` | 3 | tx:build |

### Rate Limiting
Token bucket algorithm with per-method burst limits:

```
- Window: 1 minute (60 seconds)
- Bucket size: 100 requests
- Refill rate: 100 requests/minute
- Burst limit: 200 requests (if under daily quota)
```

**Response**: HTTP 429 Too Many Requests
```json
{
  "error": {
    "code": -32005,
    "message": "Rate limit exceeded. Try again in 47 seconds.",
    "data": {
      "retryAfter": 47,
      "resetTime": 1234567890
    }
  }
}
```

## Error Handling Patterns

### Quota Exceeded
```typescript
try {
  const response = await fetch(url, options);
  
  // Update quota from headers
  await quotaManager.updateFromHeaders(response.headers);
  
  if (response.status === 429) {
    // Daily or monthly quota exceeded
    const quota = quotaManager.getQuota();
    
    if (quota.isExceeded) {
      // Show quota exceeded modal
      showQuotaExceededModal({
        type: quota.exceededType, // 'daily' or 'monthly'
        resetTime: quotaManager.getTimeUntilReset()
      });
      
      throw new Error('Quota exceeded');
    }
  }
  
  return await response.json();
} catch (error) {
  console.error('API call failed:', error);
  throw error;
}
```

### Network Errors
```typescript
async function makeApiCallWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return await response.json();
      }
      
      // Don't retry client errors (4xx except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Client error: ${response.status}`);
      }
      
      // Retry on 5xx or 429
      lastError = new Error(`Server error: ${response.status}`);
    } catch (error) {
      lastError = error as Error;
    }
    
    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}
```

### Lease Expiry
```typescript
try {
  const finalizeResponse = await TransactionService.finalize({
    leaseToken,
    signedHex
  });
  
  return finalizeResponse;
} catch (error) {
  if (error.message.includes('Lease expired')) {
    // Lease TTL (5 min) exceeded during signing
    // Must restart transaction from prepare step
    
    showError({
      title: 'Transaction Timeout',
      message: 'The transaction took too long to sign. Please try again.',
      action: 'retry'
    });
    
    // Clear local state
    clearPendingTransaction();
  }
  
  throw error;
}
```

## Integration Examples

### Complete Transaction Flow
```typescript
// 1. Prepare transaction
const prepareResponse = await TransactionService.prepare({
  to: '0x1234...5678',
  amount: '100.00',
  tokenId: '0x00'
}, rootPublicKey);

// 2. Sign with WOTS
const { witnessBundle, signedHex } = await TransactionService.sign({
  l1: prepareResponse.l1,
  l2: prepareResponse.l2,
  l3: prepareResponse.l3,
  digestTx: prepareResponse.digestTx
}, seed, 'v2-spec');

// 3. Finalize and broadcast
const finalizeResponse = await TransactionService.finalize({
  leaseToken: prepareResponse.leaseToken,
  signedHex
});

console.log('Transaction broadcast:', finalizeResponse.txpowid);
```

### Polling Transaction Status
```typescript
async function pollTxStatus(txpowid: string, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await makeProjectApiCall('txpow', {
      body: JSON.stringify({ txpowid })
    });
    
    const result = await status.json();
    
    if (result.result?.confirmations >= 3) {
      return 'confirmed';
    }
    
    // Wait 10 seconds between polls
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  return 'pending'; // Still pending after 10 minutes
}
```

### Checking Quota Before Transaction
```typescript
async function sendTransactionWithQuotaCheck(params) {
  const quota = quotaManager.getQuota();
  
  // Transaction requires: 10 (prepare) + 5 (finalize) = 15 credits
  const requiredCredits = 15;
  
  if (quota.daily.remaining < requiredCredits) {
    showQuotaWarning({
      message: `Transaction requires ${requiredCredits} credits, but only ${quota.daily.remaining} remain today.`,
      resetTime: quotaManager.getTimeUntilReset()
    });
    
    const userConfirmed = await confirmDialog('Continue anyway?');
    if (!userConfirmed) {
      throw new Error('User cancelled due to quota');
    }
  }
  
  // Proceed with transaction
  return await TransactionService.prepare(params, rootPublicKey);
}
```

## Testing with Mock APIs

### Mock Chrome Storage
```typescript
// From: packages/totem-extension/src/dev/mock-chrome.ts
const mockChrome = {
  storage: {
    local: {
      get: async (keys) => {
        return {
          AXIA_BASE: 'http://localhost:8000',
          AXIA_PROJECT_ID: 'test-project'
        };
      },
      set: async (items) => {
        console.log('Mock storage set:', items);
      }
    }
  }
};
```

### Mock Quota Headers
```typescript
const mockResponse = new Response(JSON.stringify({ result: {} }), {
  headers: new Headers({
    'x-quota-daily-limit': '1000',
    'x-quota-daily-remaining': '847',
    'x-quota-daily-reset': String(Date.now() + 86400000),
    'x-quota-monthly-limit': '50000',
    'x-quota-monthly-remaining': '42153'
  })
});

await quotaManager.updateFromHeaders(mockResponse.headers);
```

## Performance Optimization

### Caching Strategies
- **Remote Config**: Cache for 24 hours, fallback to defaults if fetch fails
- **Balance Queries**: Cache for 10 seconds (avoid excessive RPC calls)
- **Token Metadata**: Cache indefinitely with manual refresh button
- **Quota State**: Update on every API call, persist to storage

### Lazy Loading
```typescript
// Don't import full SDK until signing is needed
const { wotsSign } = await import('@totemsdk/core/wots');
```

### Background Sync
```typescript
// Update balance every 30 seconds in background
setInterval(async () => {
  const balance = await fetchBalance(currentAddress);
  await chrome.storage.local.set({ cachedBalance: balance });
}, 30000);
```
