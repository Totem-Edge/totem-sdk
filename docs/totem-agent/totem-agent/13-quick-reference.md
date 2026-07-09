# Totem Agent - Quick Reference

## Common Commands

### Development Server
```bash
# Start Totem dev UI (port 6000)
cd packages/totem-extension && npm run dev:ui

# Build for Chrome
npm run build:chrome

# Build for Firefox
npm run build:firefox

# Package for distribution
npm run package:chrome   # Creates .zip
npm run package:firefox  # Creates .xpi
```

### Testing
```bash
# Load Chrome extension
1. chrome://extensions
2. Enable "Developer mode"
3. "Load unpacked" → dist/chrome

# Load Firefox add-on
1. about:debugging#/runtime/this-firefox
2. "Load Temporary Add-on"
3. Select dist/firefox/manifest.json

# Load Safari extension
1. Open Xcode project
2. Run "Totem Wallet Extension" target
```

---

## Design System Cheat Sheet

### Color Palette
```css
--totem-white: #FFFFFF;      /* Backgrounds, text */
--totem-orange: #FF6B35;     /* Primary CTA */
--totem-slate: #475569;      /* Secondary elements */
--totem-black: #0A0A0A;      /* Borders, emphasis */
--minima-green: #00C886;     /* Minima brand (legacy) */
```

### Typography
```css
/* Headings */
font-weight: 700;
text-transform: uppercase;
letter-spacing: 1.5px;

/* Body */
font-weight: 400;
line-height: 1.6;

/* Labels */
font-weight: 500;
text-transform: uppercase;
letter-spacing: 1px;
font-size: 11px;
```

### Component Classes
```html
<!-- Buttons -->
<button class="flat-btn flat-btn-primary">Primary</button>
<button class="flat-btn flat-btn-secondary">Secondary</button>
<button class="flat-btn flat-btn-outline">Outline</button>
<button class="flat-btn flat-btn-danger">Danger</button>

<!-- Cards -->
<div class="flat-card">Default card</div>
<div class="flat-card-tertiary">Less emphasis</div>

<!-- Inputs -->
<input type="text" class="flat-input" placeholder="Text">
<textarea class="flat-textarea"></textarea>

<!-- Badges -->
<span class="flat-badge flat-badge-success">Success</span>
<span class="flat-badge flat-badge-danger">Error</span>
<span class="flat-badge flat-badge-warning">Warning</span>

<!-- Alerts -->
<div class="flat-alert flat-alert-success">Success message</div>
<div class="flat-alert flat-alert-danger">Error message</div>
```

### Brutalist Button (React/Tailwind)
```tsx
<button className="
  bg-[#FF6B35] text-white
  border-3 border-black
  px-6 py-3
  font-bold uppercase tracking-wide
  hover:translate-y-[-2px] hover:shadow-[4px_4px_0_#0A0A0A]
  active:translate-y-0 active:shadow-none
">
  Send
</button>
```

---

## Browser Compatibility Checklist

### Manifest Conversion
| Feature | Chrome MV3 | Firefox MV2 | Safari |
|---------|-----------|-------------|--------|
| Version | `manifest_version: 3` | `manifest_version: 2` | N/A (Info.plist) |
| Popup | `action` | `browser_action` | `SFSafariContentScript` |
| Background | `service_worker` | `scripts` array | Swift handler |
| Permissions | `permissions` + `host_permissions` | `permissions` only | Entitlements |

### API Differences
```typescript
// Chrome (callback-based)
chrome.storage.local.get(['key'], (result) => {
  console.log(result.key);
});

// Firefox (Promise-based)
const result = await browser.storage.local.get(['key']);
console.log(result.key);

// Universal (use browser.* everywhere)
const storage = typeof browser !== 'undefined' ? browser : chrome;
await storage.storage.local.set({ key: 'value' });
```

### Viewport Sizes
```css
/* Chrome/Edge */
width: 400px;
height: 600px;

/* Firefox (DESIGN FOR THIS) */
width: 380px;  /* 20px narrower */
height: 580px;

/* Safari */
width: 420px;
height: 620px;
```

**Rule**: Always test at 380px width (Firefox constraint)

---

## WOTS Signing Quick Reference

### 3-Step Flow
```typescript
// 1. Prepare (Axia API)
const { l1, l2, l3, leaseToken, digestTx } = await TransactionService.prepare({
  to: '0x1234...5678',
  amount: '100.00',
  tokenId: '0x00'
}, rootPublicKey);

// 2. Sign (Client-side)
const { signedHex } = await TransactionService.sign({
  l1, l2, l3, digestTx
}, seed, 'v2-spec');

// 3. Finalize (Axia API)
const { txpowid } = await TransactionService.finalize({
  leaseToken,
  signedHex
});
```

### Hierarchical Tree
```
Root Seed
 ├─ L1 (64 keys)
 │   ├─ L2 (64 keys per L1)
 │   │   └─ L3 (64 keys per L2)
 │   └─ ... (64 L2 trees)
 └─ ... (64 L1 keys)

Total: 64³ = 262,144 signatures
```

### Parameter Sets
```typescript
// v2-spec (default)
w = 256
L = 34
signature size = 34 * 32 = 1,088 bytes
signing time = 50-300ms

// w16-spec (legacy, faster)
w = 16
L = 67
signature size = 67 * 32 = 2,144 bytes
signing time = 30-150ms
```

### Security Checklist
- [ ] Seed NEVER leaves client
- [ ] Each L1/L2/L3 index used ONLY ONCE
- [ ] Lease token expires after 5 minutes
- [ ] Signatures validated before broadcast
- [ ] Session seed cleared on wallet lock

---

## Quota Management

### Tiers
| Tier | Daily Limit | Monthly Limit | Cost |
|------|-------------|---------------|------|
| Free | 1,000 | 10,000 | $0/mo |
| Developer | 10,000 | 100,000 | $19/mo |
| Growth | 100,000 | 1,000,000 | $99/mo |
| Scale | 1,000,000 | 10,000,000 | $499/mo |

### Method Costs
| Method | Credits | Category |
|--------|---------|----------|
| `balance` | 1 | query:balance |
| `txpow` | 1 | query:txpow |
| `coins` | 2 | query:coins |
| `wots/hardened/prepare` | 10 | lease:request |
| `wots/hardened/finalize` | 5 | txn:submit |

### Thresholds
```typescript
// 0-79%: Normal (green)
// 80-99%: Warning (orange)
// 100%+: Exceeded (red, blocking)

const quotaState = quota.daily.percentUsed >= 100 ? 'exceeded' :
                   quota.daily.percentUsed >= 80 ? 'warning' : 'normal';
```

### Usage Example
```tsx
import { quotaManager } from '@/core/quota/manager';

// Get current quota
const quota = quotaManager.getQuota();

// Check before expensive operation
if (quota.daily.remaining < 15) {
  showWarning('Low quota remaining');
}

// Subscribe to updates
const unsubscribe = quotaManager.subscribe((quota) => {
  console.log('Quota updated:', quota.daily.percentUsed);
});
```

---

## Common Patterns

### Loading State
```tsx
const [isLoading, setIsLoading] = useState(false);

<button
  disabled={isLoading}
  className="flat-btn flat-btn-primary"
>
  {isLoading ? '⟳ Processing...' : 'Submit'}
</button>
```

### Error Handling
```tsx
try {
  await riskyOperation();
} catch (error: any) {
  // User-friendly message
  if (error.message.includes('INSUFFICIENT_BALANCE')) {
    showError('Insufficient balance for this transaction');
  } else if (error.message.includes('LEASE_EXPIRED')) {
    showError('Transaction timeout. Please try again.');
  } else {
    showError(error.message || 'Operation failed');
  }
}
```

### Form Validation
```tsx
const validate = () => {
  const errors: string[] = [];
  
  // Address format
  if (!address.match(/^0x[a-fA-F0-9]{64}$/)) {
    errors.push('Invalid address format');
  }
  
  // Amount range
  if (parseFloat(amount) <= 0) {
    errors.push('Amount must be greater than 0');
  }
  
  // Balance check
  if (parseFloat(amount) > parseFloat(balance)) {
    errors.push('Insufficient balance');
  }
  
  return errors;
};
```

### Background Messaging
```typescript
// Popup → Background
const response = await chrome.runtime.sendMessage({
  method: 'wallet:getBalance',
  params: { address: '0x...' }
});

// Background handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true; // Keep channel open
});
```

---

## Accessibility Checklist

### Contrast
- [ ] Normal text: 4.5:1 minimum (WCAG AA)
- [ ] Large text (18px+): 3:1 minimum
- [ ] UI components: 3:1 minimum

### Keyboard Navigation
- [ ] All interactive elements focusable
- [ ] Focus indicators visible (3px outline)
- [ ] Tab order logical
- [ ] Escape closes modals

### Focus Indicators
```css
:focus-visible {
  outline: 3px solid #FF6B35;
  outline-offset: 2px;
}

/* NEVER remove outline without alternative */
```

### Touch Targets
- [ ] Minimum size: 44x44px
- [ ] Spacing between targets: 8px minimum

---

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
2. **Multiple Pending**: 3+ transactions in queue (handle sequentially)
3. **Offline→Online**: Queue transaction, broadcast when connected
4. **Lease Expiry**: Sign takes >5min (should fail gracefully)
5. **Concurrent Dapp Requests**: 2 dapps request tx simultaneously (queue separately)

### Error Recovery
1. **Network failure during prepare**: Retry 3x, then fail
2. **Browser crash during signing**: Session seed cleared, must unlock
3. **Finalize timeout**: Show error, allow retry (new lease)
4. **Dapp disconnect during approval**: Auto-reject transaction

---

## Performance Optimization

### Lazy Loading
```typescript
// Don't import SDK until needed
const signTransaction = async () => {
  const { wotsSign } = await import('@totem/sdk/core/wots');
  // ...
};
```

### Caching Strategy
```typescript
// Remote config: 24 hours
const config = await fetchWithCache('remote-config', 86400000);

// Balance: 10 seconds
const balance = await fetchWithCache(`balance-${address}`, 10000);

// Token metadata: Indefinite (manual refresh)
const metadata = await fetchWithCache(`token-${id}`, Infinity);
```

### Background Sync
```typescript
// Update balance every 30s in background
setInterval(async () => {
  const balance = await fetchBalance(currentAddress);
  await chrome.storage.local.set({ cachedBalance: balance });
}, 30000);
```

---

## Troubleshooting

### Extension Not Loading
```
1. Check manifest.json syntax (JSON validator)
2. Check file paths (case-sensitive)
3. Check permissions (storage, unlimitedStorage)
4. Check Chrome console (chrome://extensions errors)
```

### Transaction Failing
```
1. Check balance (>= amount + fee)
2. Check address format (64 hex chars)
3. Check network (RPC endpoint reachable)
4. Check quota (daily limit not exceeded)
5. Check lease (not expired)
```

### Quota Always Exceeded
```
1. Check AXIA_PROJECT_ID (should be valid project)
2. Check remote config (totem.json)
3. Check headers (x-quota-* present in responses)
4. Clear storage and reload
```

### WOTS Signing Slow
```
1. Check device performance (signing benchmarks)
2. Move to Web Worker (non-blocking)
3. Consider w=16 param set (faster, still secure)
4. Profile with console.time() / console.timeEnd()
```

---

## Resources

### Documentation
- **Totem Docs**: `docs/totem-agent/`
- **Minima Docs**: https://docs.minima.global
- **Axia Dashboard**: https://dashboard.axia.to
- **WebExtension API**: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions

### Code References
- **MetaMask**: https://github.com/MetaMask/metamask-extension
- **Phantom**: https://phantom.app (reference UX)
- **Rainbow**: https://rainbow.me (wallet patterns)

### Design
- **Brutalist Websites**: https://brutalistwebsites.com
- **Axia Design**: Flat minimalist aesthetic
- **System Fonts**: -apple-system, BlinkMacSystemFont, Segoe UI

---

## Prompts for Totem Agent

### Design
```
[Totem Agent] Design a brutalist modal for [feature]
[Totem Agent] Create a loading state for [operation]
[Totem Agent] Review the UX of [component]
```

### Development
```
[Totem Agent] Implement [workflow/feature]
[Totem Agent] Convert this Chrome code to Firefox
[Totem Agent] Debug: [error message/issue]
```

### WOTS
```
[Totem Agent] Explain WOTS signing for non-technical user
[Totem Agent] Why is my lease expiring?
[Totem Agent] How to prevent key reuse?
```

### Optimization
```
[Totem Agent] Optimize [component] performance
[Totem Agent] Reduce bundle size for [module]
[Totem Agent] Cache strategy for [data type]
```

---

## Quick Wins

### Add Brutalist Button
```tsx
<button className="
  bg-[#FF6B35] text-white
  border-3 border-black px-6 py-3
  font-bold uppercase tracking-wide
  hover:translate-y-[-2px] hover:shadow-[4px_4px_0_#0A0A0A]
">
  Send
</button>
```

### Show Quota Indicator
```tsx
import { QuotaIndicator } from '@/components/QuotaIndicator';

<QuotaIndicator /> // Auto-subscribes to quotaManager
```

### Check Quota Before Operation
```typescript
const quota = quotaManager.getQuota();
if (quota.daily.remaining < 15) {
  showWarning('Low quota. Continue?');
}
```

### Format MINIMA Balance
```typescript
const formatBalance = (balance: string) => {
  return parseFloat(balance).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
};

// "1234.56" → "1,234.56"
```

### Truncate Address
```typescript
const truncateAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// "0x1234567890abcdef..." → "0x1234...cdef"
```

---

**For detailed information, see:**
- Architecture: [01-architecture.md](./01-architecture.md)
- Workflows: [02-transaction-workflows.md](./02-transaction-workflows.md)
- SDK Integration: [03-sdk-integration.md](./03-sdk-integration.md)
- Browser Support: [04-browser-requirements.md](./04-browser-requirements.md)
- Design System: [05-design-system.md](./05-design-system.md)
- Components: [06-ui-components.md](./06-ui-components.md)
