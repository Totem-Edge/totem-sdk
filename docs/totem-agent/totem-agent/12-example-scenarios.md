# Totem Agent - Example Scenarios

This document demonstrates Totem Agent's capabilities through real-world examples.

## Scenario 1: Design a Brutalist Component

### User Request
> [Totem Agent] Design a token balance card showing MINIMA balance with Send/Receive buttons

### Agent Response

I'll create a brutalist token balance card following Totem's flat design system (white, burnt orange #FF6B35, hard edges).

```tsx
export function TokenBalanceCard({ 
  balance, 
  onSend, 
  onReceive 
}: {
  balance: string;
  onSend: () => void;
  onReceive: () => void;
}) {
  return (
    <div className="
      bg-white 
      border-3 border-black 
      p-6
    ">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#00C886]" /> {/* Minima green dot */}
          <span className="font-bold uppercase tracking-wide text-xs">
            Minima
          </span>
        </div>
        <span className="text-slate-600 text-xs">MINIMA</span>
      </div>

      {/* Balance */}
      <div className="mb-6">
        <div className="text-4xl font-bold tabular-nums">
          {balance}
        </div>
        <div className="text-sm text-slate-600 mt-1">
          MINIMA
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onSend}
          className="
            flex-1
            bg-[#FF6B35] text-white
            border-3 border-black
            px-6 py-3
            font-bold uppercase tracking-wide text-sm
            hover:translate-y-[-2px] hover:shadow-[4px_4px_0_#0A0A0A]
            active:translate-y-0 active:shadow-none
            transition-all
          "
        >
          Send
        </button>
        
        <button
          onClick={onReceive}
          className="
            flex-1
            bg-white text-black
            border-3 border-black
            px-6 py-3
            font-bold uppercase tracking-wide text-sm
            hover:translate-y-[-2px] hover:shadow-[4px_4px_0_#0A0A0A]
            active:translate-y-0 active:shadow-none
            transition-all
          "
        >
          Receive
        </button>
      </div>
    </div>
  );
}
```

**Rendered Output**:
```
┌─────────────────────────────────────┐
│ ■ MINIMA                   MINIMA   │
│                                      │
│ 1,234.56                            │
│ MINIMA                              │
│                                      │
│ ┌──────────┐  ┌──────────┐         │
│ │  SEND    │  │ RECEIVE  │         │
│ └──────────┘  └──────────┘         │
└─────────────────────────────────────┘
```

**Design Decisions**:
1. **No border-radius**: Hard edges for brutalist aesthetic
2. **3px black border**: Strong visual separation
3. **Burnt orange CTA**: Primary action (Send) uses accent color
4. **Geometric shadow**: 4px 4px offset on hover (no blur)
5. **Uppercase labels**: Following typography system
6. **Tabular nums**: Balance aligns properly when updating

**Usage**:
```tsx
<TokenBalanceCard 
  balance="1,234.56"
  onSend={() => navigate('/send')}
  onReceive={() => setReceiveModalOpen(true)}
/>
```

---

## Scenario 2: Convert Chrome → Firefox

### User Request
> [Totem Agent] Convert this Chrome MV3 manifest to Firefox MV2

**Original (Chrome)**:
```json
{
  "manifest_version": 3,
  "name": "Totem Wallet",
  "version": "1.0.0",
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "permissions": ["storage", "unlimitedStorage"],
  "host_permissions": ["https://rpc.axia.to/*"]
}
```

### Agent Response

I'll convert this to Firefox MV2 WebExtensions format.

**Converted (Firefox)**:
```json
{
  "manifest_version": 2,
  "name": "Totem Wallet",
  "version": "1.0.0",
  
  "browser_action": {
    "default_popup": "popup.html",
    "browser_style": false
  },
  
  "background": {
    "scripts": ["background.js"],
    "persistent": false
  },
  
  "permissions": [
    "storage",
    "unlimitedStorage",
    "https://rpc.axia.to/*"
  ],
  
  "browser_specific_settings": {
    "gecko": {
      "id": "{totem-wallet@axia.to}",
      "strict_min_version": "109.0"
    }
  }
}
```

**Key Changes**:
1. **`manifest_version: 3 → 2`**: Firefox MV3 support incomplete
2. **`action` → `browser_action`**: MV2 naming
3. **`browser_style: false`**: Disable Firefox default styles (use custom CSS)
4. **Service worker → Scripts array**: `{"scripts": ["background.js"]}`
5. **`persistent: false`**: Event page (closes when idle)
6. **Host permissions merged**: MV2 includes in `permissions` array
7. **Add `browser_specific_settings.gecko.id`**: Required for signing
8. **Add `strict_min_version`**: Minimum Firefox 109

**Background Script Changes**:

Chrome (Service Worker):
```typescript
// No imports, already in global scope
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true;
});
```

Firefox (Persistent Background):
```typescript
// Can use browser.* API (native Promises)
browser.runtime.onMessage.addListener(async (msg, sender) => {
  return await handleMessage(msg);
});
```

**Viewport Adjustment**:

Chrome CSS (400px):
```css
.popup-container {
  width: 400px;
  max-height: 600px;
}
```

Firefox CSS (380px):
```css
.popup-container {
  width: 380px;        /* 20px narrower */
  max-height: 580px;   /* 20px shorter */
}
```

**Testing**:
1. `npm run build:firefox` (creates dist/firefox/)
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `dist/firefox/manifest.json`
5. Extension appears (temporary until browser restart)

---

## Scenario 3: Implement Transaction Workflow

### User Request
> [Totem Agent] Implement the "Send Transaction" flow with WOTS signing

### Agent Response

I'll implement the complete 3-step WOTS transaction flow (prepare → sign → finalize).

**1. Send Form Component**:
```tsx
import { useState } from 'react';
import { TransactionService } from '@/core/transaction/service';
import { walletManager } from '@/core/wallet';

export function SendForm() {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'signing' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [txpowid, setTxpowid] = useState('');

  const handleSend = async () => {
    try {
      setStatus('pending');
      setError('');

      // Validate inputs
      if (!to.match(/^0x[a-fA-F0-9]{64}$/)) {
        throw new Error('Invalid address format');
      }
      if (parseFloat(amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Get wallet seed and root public key
      const wallet = await walletManager.getWallet();
      if (!wallet) {
        throw new Error('Wallet not unlocked');
      }

      setStatus('pending');

      // Step 1: Prepare (Axia API - request lease)
      const prepareResponse = await TransactionService.prepare({
        to,
        amount,
        tokenId: '0x00' // MINIMA
      }, wallet.rootPublicKey);

      setStatus('signing');

      // Step 2: Sign (Client-side WOTS)
      const { signedHex } = await TransactionService.sign({
        l1: prepareResponse.l1,
        l2: prepareResponse.l2,
        l3: prepareResponse.l3,
        digestTx: prepareResponse.digestTx
      }, wallet.seed, 'v2-spec');

      // Step 3: Finalize (Axia API - broadcast)
      const finalizeResponse = await TransactionService.finalize({
        leaseToken: prepareResponse.leaseToken,
        signedHex
      });

      setStatus('success');
      setTxpowid(finalizeResponse.txpowid);

    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Transaction failed');
    }
  };

  return (
    <div className="bg-white border-3 border-black p-6">
      <h2 className="text-xl font-bold uppercase tracking-wide mb-4">
        Send Transaction
      </h2>

      {/* Recipient Address */}
      <div className="mb-4">
        <label className="block text-xs font-bold uppercase tracking-wide mb-2">
          To Address
        </label>
        <input
          type="text"
          className="w-full bg-white border-2 border-black px-3 py-2"
          placeholder="0x..."
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={status !== 'idle'}
        />
      </div>

      {/* Amount */}
      <div className="mb-6">
        <label className="block text-xs font-bold uppercase tracking-wide mb-2">
          Amount
        </label>
        <input
          type="number"
          className="w-full bg-white border-2 border-black px-3 py-2"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={status !== 'idle'}
        />
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="mb-4 bg-red-50 border-2 border-red-500 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="mb-4 bg-green-50 border-2 border-green-500 p-3">
          <p className="text-sm text-green-700 font-bold mb-1">
            Transaction Sent!
          </p>
          <p className="text-xs text-green-600 break-all">
            {txpowid}
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSend}
        disabled={status !== 'idle'}
        className="
          w-full
          bg-[#FF6B35] text-white
          border-3 border-black
          px-6 py-3
          font-bold uppercase tracking-wide
          hover:translate-y-[-2px] hover:shadow-[4px_4px_0_#0A0A0A]
          active:translate-y-0 active:shadow-none
          disabled:opacity-50 disabled:cursor-not-allowed
          disabled:hover:translate-y-0 disabled:hover:shadow-none
          transition-all
        "
      >
        {status === 'pending' && '⟳ Preparing...'}
        {status === 'signing' && '⟳ Signing (WOTS)...'}
        {status === 'idle' && 'Send Transaction'}
        {status === 'success' && '✓ Sent'}
        {status === 'error' && '✗ Failed - Retry'}
      </button>
    </div>
  );
}
```

**Flow Diagram**:
```
User fills form → Click "Send"
  ↓
[Pending] Validate inputs
  ↓
[Pending] TransactionService.prepare()
  → POST /wots/hardened/prepare
  ← {addressIndex, l1, l2, leaseToken, digestTx}
  ↓
[Signing] TransactionService.sign()
  → Client-side WOTS (50-300ms)
  ← {signedHex}
  ↓
[Pending] TransactionService.finalize()
  → POST /wots/hardened/finalize
  ← {txpowid}
  ↓
[Success] Show txpowid
```

---

## Scenario 4: UX Review

### User Request
> [Totem Agent] Review this quota indicator - is 80% the right warning threshold?

**Code**:
```tsx
const isWarning = quota.daily.percentUsed >= 80;
```

### Agent Response

I'll review the 80% warning threshold against wallet UX best practices.

**Current Behavior**:
- **80-99% used**: Orange warning, allow continue
- **100%+ used**: Red error, block operations

**Analysis**:

✅ **Pros of 80% Threshold**:
1. **Early warning**: Gives users time to upgrade before hitting limit
2. **Industry standard**: Most APIs (Stripe, AWS, Twilio) warn at 75-80%
3. **Non-blocking**: Users can still complete transactions

❌ **Cons**:
1. **May annoy power users**: 20% remaining = ~200 requests (substantial)
2. **No tiered warnings**: Jump from 0 → 80% with no intermediate alert

**Recommendations**:

**Option 1: Keep 80%, add 50% info banner**
```tsx
const getQuotaState = (percentUsed: number) => {
  if (percentUsed >= 100) return 'exceeded'; // Red, blocking
  if (percentUsed >= 80) return 'warning';  // Orange, non-blocking
  if (percentUsed >= 50) return 'info';     // Blue, subtle
  return 'normal';                          // No indicator
};

// UI
{quotaState === 'info' && (
  <div className="bg-blue-50 border-2 border-blue-300 p-2 text-xs">
    ℹ️ Halfway through daily quota ({quota.daily.percentUsed.toFixed(0)}%)
  </div>
)}
```

**Option 2: Use 90% threshold (more aggressive)**
```tsx
const isWarning = quota.daily.percentUsed >= 90; // Only 10% remaining
```
- **Pro**: Less notification fatigue
- **Con**: Less buffer for heavy users

**Option 3: Personalized thresholds**
```tsx
// Adjust based on historical usage
const avgDailyUsage = calculateAverageDailyUsage(last30Days);
const threshold = avgDailyUsage > 900 ? 95 : 80; // Power users get higher threshold
```

**Verdict**: **Keep 80%**, but add:
1. **50% info banner** (subtle, informational)
2. **Dismissible warnings** (show once per session)
3. **"Don't show again" option** for power users

**Updated Component**:
```tsx
export function QuotaIndicator() {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const quotaState = getQuotaState(quota?.daily.percentUsed || 0);

  return (
    <div className="quota-indicator">
      {/* Progress bar (always visible) */}
      <div className="quota-bar-container">
        <div 
          className={`quota-bar ${quotaState}`}
          style={{ width: `${quota.daily.percentUsed}%` }}
        />
      </div>

      {/* Info banner (50-79%) */}
      {quotaState === 'info' && !dismissed && (
        <div className="flat-alert flat-alert-info flex justify-between items-center">
          <span>ℹ️ {quota.daily.percentUsed.toFixed(0)}% of daily quota used</span>
          <button 
            onClick={() => setDismissed(true)}
            className="text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Warning banner (80-99%) */}
      {quotaState === 'warning' && (
        <div className="flat-alert flat-alert-warning">
          ⚠️ {quota.daily.percentUsed.toFixed(0)}% quota used. 
          {quota.daily.remaining} requests remaining.
        </div>
      )}

      {/* Error banner (100%+) */}
      {quotaState === 'exceeded' && (
        <div className="flat-alert flat-alert-danger">
          ❌ Quota exceeded. Resets in {quotaManager.getTimeUntilReset()}
        </div>
      )}
    </div>
  );
}
```

**Testing Scenarios**:
1. **Light user (100/1000)**: No warnings ✓
2. **Moderate user (500/1000)**: Info banner (dismissible) ✓
3. **Heavy user (850/1000)**: Warning banner (always shown) ✓
4. **Exceeded (1050/1000)**: Error banner + blocked operations ✓

---

## Scenario 5: Debug WOTS Issue

### User Request
> [Totem Agent] My lease token keeps expiring before signing completes. How to fix this?

### Agent Response

Lease tokens expire after **5 minutes** (300 seconds). If signing takes longer, the finalize step fails with `LEASE_EXPIRED` error.

**Root Causes**:
1. **Slow device**: WOTS signing on old hardware
2. **UI blocking**: Long synchronous operations
3. **User delay**: Approval popup left open >5min
4. **Network latency**: Slow prepare/finalize requests

**Debugging Steps**:

```typescript
// 1. Measure signing time
console.time('wots-sign');
const { signedHex } = await TransactionService.sign({
  addressIndex, l1, l2, digestTx
}, seed, 'v2-spec');
console.timeEnd('wots-sign');
// Expected: 50-300ms on modern devices
// Problem: >1000ms indicates performance issue
```

**Solutions**:

**Solution 1: Web Worker for Signing (Recommended)**
```typescript
// sign-worker.ts
self.addEventListener('message', async (event) => {
  const { seed, addressIndex, l1, l2, digestTx, paramSet } = event.data;
  
  // Import WOTS SDK in worker
  const { wotsSign } = await import('@totemsdk/core/wots');
  
  // Sign in background thread (non-blocking)
  const signature = wotsSign(seed, l1, digestTx, paramSet);
  
  self.postMessage({ signature });
});

// main thread
const worker = new Worker('sign-worker.js');
worker.postMessage({ seed, addressIndex, l1, l2, digestTx, paramSet });

worker.addEventListener('message', (event) => {
  const { signature } = event.data;
  // Continue with finalize...
});
```

**Solution 2: Show Countdown Timer**
```tsx
function SigningModal({ leaseExpiresAt }: { leaseExpiresAt: number }) {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, leaseExpiresAt - Date.now()) / 1000;
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        // Lease expired, cancel transaction
        handleCancel('Lease expired. Please retry.');
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [leaseExpiresAt]);

  return (
    <div className="flat-card">
      <h3 className="font-bold uppercase mb-2">Signing Transaction</h3>
      <p className="text-sm text-slate-600 mb-4">
        Generating quantum-resistant signature...
      </p>
      
      <div className="text-xs text-slate-500">
        Time remaining: {Math.floor(timeLeft / 60)}:{String(Math.floor(timeLeft % 60)).padStart(2, '0')}
      </div>
      
      {timeLeft < 60 && (
        <div className="flat-alert flat-alert-warning mt-2">
          ⚠️ Lease expiring soon!
        </div>
      )}
    </div>
  );
}
```

**Solution 3: Auto-Retry with Fresh Lease**
```typescript
async function sendTransactionWithRetry(params: SendParams, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Prepare (new lease)
      const lease = await TransactionService.prepare(params, rootPubKey);
      
      // Sign
      const { signedHex } = await TransactionService.sign({
        l1: lease.l1, l2: lease.l2, l3: lease.l3,
        digestTx: lease.digestTx
      }, seed, 'v2-spec');
      
      // Finalize
      return await TransactionService.finalize({
        leaseToken: lease.leaseToken,
        signedHex
      });
      
    } catch (error) {
      if (error.message.includes('LEASE_EXPIRED') && attempt < maxRetries) {
        console.warn(`Lease expired, retrying (${attempt + 1}/${maxRetries})`);
        continue; // Get fresh lease and retry
      }
      throw error;
    }
  }
}
```

**Prevention Checklist**:
- [ ] Sign in Web Worker (non-blocking)
- [ ] Show countdown timer (5min → 0)
- [ ] Warn at 1min remaining
- [ ] Auto-retry once on expiry
- [ ] Cache prepared transaction (allow user to restart)
- [ ] Optimize WOTS params (consider w=16 for faster signing if security allows)

**Performance Benchmarks**:
| Device | WOTS w=8, L=34 (minima) |
|--------|----------------------------|
| M1 Mac | 50-80ms |
| Intel i7 | 100-150ms |
| iPhone 12 | 150-200ms |
| Budget Android | 300-500ms |

If signing takes >1000ms, investigate device-specific issues or consider w=16 parameter set (faster, still quantum-resistant).

---

## Key Takeaways

1. **Design**: Always follow flat brutalist principles (no border-radius, hard borders)
2. **Browsers**: Test Firefox 380px viewport (narrowest constraint)
3. **WOTS**: 3-step flow, 5min lease TTL, one-time key use
4. **UX**: Clear error messages, accessible (WCAG AA), responsive
5. **Performance**: Web Workers for crypto, lazy loading, caching

For more examples, see [13-quick-reference.md](./13-quick-reference.md).
