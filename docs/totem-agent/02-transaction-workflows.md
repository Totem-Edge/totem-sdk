# Totem Transaction Workflows

> **Note:** This document describes the intended design and architecture for the Totem Agent. Some details may differ from the current implementation. For the authoritative specification, see [TOTEM_WALLET_SPEC.md](../../TOTEM_WALLET_SPEC.md) and [LEASE_WATERMARK_SPEC.md](../../LEASE_WATERMARK_SPEC.md).

## Overview
Totem implements a three-step WOTS signing workflow with Axia API integration:
1. **Prepare** - Request lease from Axia API
2. **Sign** - Generate WOTS signature client-side
3. **Finalize** - Submit to Axia API for broadcast

## Transaction Types

### 1. Send Transaction
**User Action**: Send MINIMA or tokens to an address

**States**:
- `idle` - No pending transaction
- `pending_approval` - Waiting for user confirmation
- `signing` - Generating WOTS signature
- `broadcasting` - Submitting to network
- `confirmed` - Transaction confirmed on-chain
- `failed` - Error occurred

**Flow Diagram**:
```
User (Send Page)
 │ Enters: to, amount, tokenId (optional)
 │ Clicks "Send"
 ↓
Popup UI
 │ Validates: amount > 0, to is valid address, sufficient balance
 │ chrome.runtime.sendMessage({ method: 'wallet:sendTransaction', params: {to, amount, tokenId} })
 ↓
Background Worker
 │ walletManager.sendTransaction({to, amount, tokenId})
 │ Opens approval popup
 ↓
Approval Popup
 │ Shows: From, To, Amount, Fee, Token
 │ User clicks "Approve" or "Reject"
 ↓
[If Approved]
Background Worker
 │ Step 1: TransactionService.prepare({to, amount, tokenId}, rootPublicKey)
 │   → POST /v1/wots-hardened/prepare
 │   ← {addressIndex, l1, l2, leaseToken, digestTx, txId, leaseTTL}
 ↓
Background Worker
 │ Step 2: TransactionService.sign({addressIndex, l1, l2, digestTx}, seed)
 │   → Client-side WOTS signing (w=8, L=34, 1,088-byte signature)
 │   ← {witnessBundle, signedHex}
 ↓
Background Worker
 │ Step 3: TransactionService.finalize({leaseToken, signedHex})
 │   → POST /v1/wots-hardened/finalize
 │   ← {ok: true, leaseId, txpowid}
 ↓
Background Worker
 │ Update txHistory with txpowid
 │ Emit event to popup
 ↓
Popup UI
 │ Show success: "Transaction sent! txpowid: 0x..."
 │ Navigate to Activity page
```

### 2. Dapp Transaction Request
**User Action**: Dapp requests transaction signature

**Flow Diagram**:
```
Dapp
 │ window.totem.request({method: 'TOTEM_SEND_TRANSACTION', params: [txData]})
 ↓
Content Script
 │ Forwards to background via chrome.runtime.sendMessage
 ↓
Background Worker
 │ Validates dapp is connected
 │ Extracts: to, amount, tokenId from txData
 │ Opens approval popup with dapp origin
 ↓
Approval Popup
 │ Shows:
 │  - Dapp origin + icon
 │  - Transaction details
 │  - Warning if high-risk (large amount, unknown token)
 │ User approves/rejects
 ↓
[If Approved]
Background Worker
 │ Same 3-step flow as Send Transaction
 │ Returns {txpowid, status: 'pending'} to content script
 ↓
Content Script
 │ postMessage back to dapp
 ↓
Dapp
 │ Receives {txpowid, status: 'pending'}
 │ Can poll for confirmation status
```

## WOTS Signing Details

### Hierarchical Key Structure
```
Root Seed (256-bit)
 │
 ├─ Address 0 (TreeKey with 64 L1 × 64 L2 = 4,096 signatures)
 ├─ Address 1 (TreeKey with 4,096 signatures)
 │   ...
 └─ Address 63 (TreeKey with 4,096 signatures)

Total: 64 addresses × 4,096 = 262,144 signatures per wallet
```

### Signature Generation (Client-Side)
```typescript
// From TransactionService.sign()

1. Get indices from Axia API (addressIndex, l1, l2)
2. Derive per-address TreeKey from seed
3. Convert (l1, l2) to flat uses counter: uses = l1 * 64 + l2
4. treeKey.setUses(uses)
5. treeKey.sign(digestTx) → produces 3 SignatureProof entries:
   - Proof 0: Root → L1 (root signs L1 child's public key)
   - Proof 1: L1 → L2 (L1 signs L2 child's public key)
   - Proof 2: L2 → DATA (L2 leaf signs transaction digest)
6. Each proof: 1,088-byte WOTS signature (34 chains × 32 bytes)
7. Serialize to signedHex (Minima wire format)
```

### Lease System
**Purpose**: Prevent WOTS key reuse (one-time signatures)

**Lifecycle**:
1. **Request**: `POST /v1/wots-hardened/prepare`
   - Input: `{txId, rootPublicKey, addressIndex}`
   - Output: `{addressIndex, l1, l2, leaseToken (JWT), digestTx, leaseTTL}`

2. **Sign**: Client-side only (no network call)
   - Uses leased indices (addressIndex, l1, l2)
   - Never signs same indices twice

3. **Consume**: `POST /v1/wots-hardened/finalize`
   - Input: `{leaseToken, signedHex}`
   - Marks lease as consumed on server
   - Broadcasts transaction to Minima network

**Lease Expiry**:
- TTL: 20-60 seconds (server default 20s, max 60s)
- After expiry: Lease is marked EXPIRED, indices are PERMANENTLY consumed (never reused)
- If signing takes too long: Finalize will fail, must restart with new lease

## Error States & Handling

### 1. Insufficient Balance
**Trigger**: `amount + fee > balance`

**UX**:
```
[X] Insufficient Balance
You have: 100 MINIMA
Required: 150 MINIMA (145 + 5 fee)
Missing: 50 MINIMA

[Cancel]
```

### 2. Invalid Address
**Trigger**: `to` address format invalid

**UX**:
```
[!] Invalid Address
Address must be:
- 64 hex characters
- Starting with 0x
- Checksum valid (optional)

[Try Again]
```

### 3. Lease Expired
**Trigger**: Finalize called after 5min

**Response**: `{error: 'Lease expired', code: 'LEASE_EXPIRED'}`

**UX**:
```
[!] Transaction Timeout
The transaction took too long to sign.
Please try again.

[Retry] [Cancel]
```

**Action**: Discard signature, return to send page

### 4. Network Error
**Trigger**: Axia API unreachable

**UX**:
```
[!] Network Error
Could not connect to Axia API.
Check your internet connection.

[Retry] [Cancel]
```

**Retry Logic**:
- 3 attempts with exponential backoff (1s, 2s, 4s)
- After 3 failures: Show error, allow manual retry

### 5. RPC Endpoint Unavailable
**Trigger**: Minima node down or unreachable

**UX**:
```
[!] Blockchain Network Unavailable
The Minima network is currently unreachable.
Your transaction will be broadcast when connection is restored.

[OK]
```

**Behavior**: Queue transaction for retry

## UI States & Screens

### Send Page States

#### Idle
```
┌─────────────────────────────┐
│ Send                         │
├─────────────────────────────┤
│ To Address                   │
│ [___________________________]│
│                              │
│ Amount                       │
│ [___________] [▼ MINIMA]    │
│                              │
│ Available: 1,234.56 MINIMA   │
│                              │
│ [ Send ]                     │
└─────────────────────────────┘
```

#### Validating
```
┌─────────────────────────────┐
│ Send                         │
├─────────────────────────────┤
│ To Address                   │
│ [0x1234...cdef]              │
│                              │
│ Amount                       │
│ [100.00] [MINIMA]            │
│                              │
│ ⟳ Checking balance...        │
│                              │
│ [ ⟳ Processing... ]          │
└─────────────────────────────┘
```

#### Approval Popup
```
┌─────────────────────────────┐
│ Confirm Transaction          │
├─────────────────────────────┤
│ From                         │
│ 0x0000...0000 (Account 1)    │
│                              │
│ To                           │
│ 0x1234...cdef                │
│                              │
│ Amount                       │
│ 100.00 MINIMA                │
│                              │
│ Network Fee                  │
│ 0.01 MINIMA                  │
│                              │
│ Total                        │
│ 100.01 MINIMA                │
├─────────────────────────────┤
│ [ Reject ]      [ Approve ]  │
└─────────────────────────────┘
```

#### Signing
```
┌─────────────────────────────┐
│ Signing Transaction...       │
├─────────────────────────────┤
│                              │
│        [WOTS Icon]           │
│                              │
│ ⟳ Generating quantum-        │
│   resistant signature        │
│                              │
│ Step 2 of 3                  │
│ ████████░░░░░░░░░░           │
│                              │
└─────────────────────────────┘
```

#### Success
```
┌─────────────────────────────┐
│ ✓ Transaction Sent           │
├─────────────────────────────┤
│                              │
│ Transaction ID:              │
│ 0xabcd...ef12                │
│                              │
│ Status: Pending              │
│ Confirmations: 0/3           │
│                              │
│ [ View in Explorer ]         │
│ [ Close ]                    │
└─────────────────────────────┘
```

#### Failed
```
┌─────────────────────────────┐
│ ✗ Transaction Failed         │
├─────────────────────────────┤
│                              │
│ Error: Insufficient gas      │
│                              │
│ Your transaction could not   │
│ be processed. Please try     │
│ again or contact support.    │
│                              │
│ [ Retry ]      [ Cancel ]    │
└─────────────────────────────┘
```

## Activity Page Updates

### Real-Time Status
```
┌─────────────────────────────┐
│ Activity                     │
├─────────────────────────────┤
│ Today                        │
│                              │
│ ⟳ Pending                    │
│ Send 100 MINIMA              │
│ To: 0x1234...cdef            │
│ 2 min ago • 0/3 confirmations│
│                              │
│ ✓ Confirmed                  │
│ Receive 50 MINIMA            │
│ From: 0xabcd...ef12          │
│ 1 hour ago • 3/3             │
│                              │
│ ✓ Confirmed                  │
│ Send 25 TEST                 │
│ To: 0xdead...beef            │
│ 3 hours ago • 5/3            │
└─────────────────────────────┘
```

### Poll Mechanism
```typescript
// Update pending transactions every 10 seconds
setInterval(async () => {
  const pending = txHistory.filter(tx => tx.status === 'pending');
  for (const tx of pending) {
    const status = await checkTxStatus(tx.txpowid);
    if (status.confirmations >= 3) {
      updateTxStatus(tx.id, 'confirmed');
    }
  }
}, 10000);
```

## Performance Considerations

### Signature Generation Time
- **WOTS w=8, L=34**: ~50-100ms on modern devices
- **3 signatures (L1, L2, L3)**: ~150-300ms total
- **UI**: Show progress indicator for >200ms operations

### Quota Consumption
Each transaction consumes:
- `lease:request` (prepare): 10 credits
- `txn:submit` (finalize): 5 credits
- **Total**: 15 credits per transaction

## Security Checklist

Before finalizing transaction:
- ✓ User explicitly approved (popup confirmation)
- ✓ Lease token is fresh (<5min old)
- ✓ Signature indices match leased indices
- ✓ Destination address validated
- ✓ Amount is within balance
- ✓ Dapp origin verified (if dapp-initiated)
- ✓ No WOTS key reuse (indices consumed)

## Testing Scenarios

### Happy Path
1. User has sufficient balance
2. Address is valid
3. Network is online
4. Lease obtained successfully
5. Signature generated <5min
6. Transaction broadcast succeeds

### Edge Cases
1. **Exact Balance**: amount + fee = balance (should succeed)
2. **Multiple Pending**: 3+ transactions in queue (should handle sequentially)
3. **Offline→Online**: Queue transaction, broadcast when connected
4. **Lease Expiry**: Sign takes >5min (should fail gracefully)
5. **Concurrent Dapp Requests**: 2 dapps request tx simultaneously (queue, approve separately)

### Error Recovery
1. **Network failure during prepare**: Retry 3x, then fail
2. **Browser crash during signing**: Session seed cleared, must unlock
3. **Finalize timeout**: Show error, allow retry (new lease)
4. **Dapp disconnect during approval**: Auto-reject transaction
