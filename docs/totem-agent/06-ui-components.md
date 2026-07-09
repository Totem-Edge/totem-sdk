# Totem UI Components Library

## Design Token System

### Color Tokens (from `tokens.css`)
```css
:root {
  --bg: #0f172a;        /* slate-900 - Main background */
  --panel: #111827;     /* gray-900 - Card/panel background */
  --text: #e5e7eb;      /* gray-200 - Primary text */
  --muted: #9ca3af;     /* gray-400 - Secondary text */
  --accent: #00C886;    /* neon green - Minima brand color */
  --danger: #ef4444;    /* red-500 - Error states */
  --ok: #22c55e;        /* green-500 - Success states */
  --ring: rgba(0,200,134,0.35); /* Focus ring */
}
```

**Note**: These are the legacy dark theme tokens. New components should use the flat brutalist design system (white, burnt orange #FF6B35, slate gray).

### Flat Design Tokens (from `flat-design.css`)
```css
:root {
  /* Brand colors */
  --minima-green: #00C886;
  --minima-dark: #001d12;
  
  /* Flat palette */
  --black: #000000;
  --white: #ffffff;
  --gray-100 to --gray-900: Grayscale progression
  
  /* Dark mode backgrounds */
  --bg-primary: #0a0a0a;      /* Pure black base */
  --bg-secondary: #141414;    /* Elevated panels */
  --bg-tertiary: #1a1a1a;     /* Tertiary surfaces */
  
  /* Text hierarchy */
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --text-muted: #707070;
  
  /* Borders (no shadows) */
  --border: #2a2a2a;
  --border-light: #3a3a3a;
  
  /* Status colors */
  --success: #00C886;
  --danger: #ff4444;
  --warning: #ffaa00;
  --info: #4a9eff;
}
```

## Core Components

### 1. QuotaIndicator

**Purpose**: Display daily/monthly quota usage with visual progress bar

**Location**: `packages/totem-extension/src/ui/components/QuotaIndicator.tsx`

**Props**: None (subscribes to quotaManager)

**Usage**:
```tsx
import { QuotaIndicator } from '@/components/QuotaIndicator';

function Settings() {
  return (
    <div>
      <h2>API Usage</h2>
      <QuotaIndicator />
    </div>
  );
}
```

**Rendered Output**:
```
┌─────────────────────────────┐
│ Daily Usage   847 / 1000 requests
│ ██████████░░░░░  84.7%      │
│ ⚠️ 85% of daily quota used  │
│ Monthly: 42,153 / 50,000    │
└─────────────────────────────┘
```

**States**:
- **Normal** (0-79% used): Green progress bar
- **Warning** (80-99% used): Orange bar + warning message
- **Exceeded** (100%+ used): Red bar + "Quota exceeded" message

**Styling**:
```css
.quota-indicator {
  /* Container */
}

.quota-bar {
  height: 8px;
  background: var(--accent);
  transition: width 0.3s;
}

.quota-bar.warning {
  background: var(--warning);
}

.quota-bar.danger {
  background: var(--danger);
}
```

**Data Flow**:
```
quotaManager.updateFromHeaders(response.headers)
  → quotaManager.notify(listeners)
    → QuotaIndicator.setQuota(newQuota)
      → Re-render with updated progress
```

---

### 2. QuotaExceededModal

**Purpose**: Full-screen modal when daily/monthly quota is exceeded

**Props**: None (auto-shows when `quota.isExceeded === true`)

**Usage**:
```tsx
import { QuotaExceededModal } from '@/components/QuotaIndicator';

function App() {
  return (
    <>
      {/* Normal UI */}
      <QuotaExceededModal /> {/* Auto-hides if not exceeded */}
    </>
  );
}
```

**Rendered Output**:
```
┌─────────────────────────────────────┐
│                                      │
│   Extend your access                │
│                                      │
│   Your daily quota has been exceeded.│
│                                      │
│   Your daily quota has been exceeded.│
│   Quota resets in 6 hours 23 minutes│
│                                      │
│   Daily Limit:    1,000 requests    │
│   Monthly Limit:  50,000 requests   │
│                                      │
│   [ Create Project ]                │
│                                      │
│   Create a free project in the       │
│   dashboard for extended access      │
│                                      │
└─────────────────────────────────────┘
```

**CTA Action**: Opens `https://dashboard.axia.to/projects/create` in new tab

**Remote Config**:
```typescript
// Fetched from https://rpc.axia.to/totem.json
{
  "upgrade_messaging": {
    "title": "Extend your access",
    "description": "Your daily quota has been exceeded.",
    "cta_text": "Create Project",
    "cta_url": "https://dashboard.axia.to/projects/create"
  }
}
```

---

### 3. Header

**Purpose**: Top navigation with logo, network selector, and settings

**Location**: `packages/totem-extension/src/ui/components/Header.tsx`

**Props**:
```typescript
interface HeaderProps {
  network?: string;               // Default: "Minima Mainnet"
  onNetworkClick?: () => void;    // Open network selector
  onSettingsClick?: () => void;   // Open settings page
}
```

**Usage**:
```tsx
<Header 
  network="Minima Testnet"
  onNetworkClick={() => setNetworkSelectorOpen(true)}
  onSettingsClick={() => navigate('/settings')}
/>
```

**Rendered Output**:
```
┌─────────────────────────────────────┐
│ [LOGO] Totem    [ Minima Mainnet ▼ ]│
└─────────────────────────────────────┘
```

**Styling**:
- Background: `var(--bg-surface)`
- Border-bottom: 1px solid
- Padding: 16px (responsive)
- Logo: 24x24px

---

### 4. Button (Flat Design)

**Purpose**: Primary, secondary, outline, and danger buttons

**Location**: `packages/totem-extension/src/ui/theme/flat-design.css`

**Variants**:
```html
<!-- Primary CTA -->
<button class="flat-btn flat-btn-primary">Send Transaction</button>

<!-- Secondary -->
<button class="flat-btn flat-btn-secondary">Cancel</button>

<!-- Outline -->
<button class="flat-btn flat-btn-outline">View Details</button>

<!-- Danger -->
<button class="flat-btn flat-btn-danger">Reject</button>
```

**Sizes**:
```html
<button class="flat-btn flat-btn-small">Small</button>
<button class="flat-btn">Medium (default)</button>
<button class="flat-btn flat-btn-large">Large</button>
<button class="flat-btn flat-btn-full">Full Width</button>
```

**States**:
- **Default**: Transparent background (except primary)
- **Hover**: Background fill (smooth transition)
- **Active**: Invert colors
- **Disabled**: 50% opacity, no pointer events

**Styling Rules**:
- ✅ Text-transform: UPPERCASE
- ✅ Letter-spacing: 0.05em
- ✅ Font-weight: 400
- ❌ NO border-radius (flat design)
- ❌ NO box-shadow (except on hover for brutalist variant)

---

### 5. Input (Flat Design)

**Purpose**: Text inputs, text areas for forms

**Variants**:
```html
<!-- Text input -->
<input type="text" class="flat-input" placeholder="Enter address">

<!-- Textarea -->
<textarea class="flat-textarea" placeholder="Enter seed phrase"></textarea>
```

**States**:
- **Default**: Dark background, light border
- **Focus**: Accent border (--minima-green), elevated background
- **Error**: Red border, error message below

**Form Group Pattern**:
```html
<div class="flat-form-group">
  <label class="flat-form-label">Recipient Address</label>
  <input type="text" class="flat-input" placeholder="0x...">
  <span class="flat-form-hint">Minima address (64 hex characters)</span>
</div>

<div class="flat-form-group">
  <label class="flat-form-label">Amount</label>
  <input type="number" class="flat-input" placeholder="0.00">
  <span class="flat-form-error">Insufficient balance</span>
</div>
```

---

### 6. Card (Flat Design)

**Purpose**: Container for grouped content

**Variants**:
```html
<!-- Default card -->
<div class="flat-card">
  <h3>Account Balance</h3>
  <p>1,234.56 MINIMA</p>
</div>

<!-- Tertiary (less emphasis) -->
<div class="flat-card-tertiary">
  <p>Transaction history empty</p>
</div>
```

**Styling**:
- Background: `var(--bg-secondary)` or `var(--bg-tertiary)`
- Border: 1px solid
- Padding: 16px (default) or 12px (tertiary)
- ❌ NO border-radius
- ❌ NO box-shadow

---

### 7. Badge (Flat Design)

**Purpose**: Status indicators, labels

**Variants**:
```html
<span class="flat-badge flat-badge-success">Confirmed</span>
<span class="flat-badge flat-badge-danger">Failed</span>
<span class="flat-badge flat-badge-warning">Pending</span>
<span class="flat-badge flat-badge-info">New</span>
<span class="flat-badge flat-badge-muted">Archived</span>
```

**Styling**:
- Font-size: 10px
- Font-weight: 500
- Text-transform: UPPERCASE
- Letter-spacing: 0.05em
- Padding: 4px 8px
- Border: 1px solid (matching color)
- Background: Semi-transparent version of border color

---

### 8. Navigation (Flat Design)

**Purpose**: Bottom tab navigation

**Usage**:
```html
<nav class="flat-nav">
  <button class="flat-nav-item active">Wallet</button>
  <button class="flat-nav-item">Activity</button>
  <button class="flat-nav-item">Settings</button>
</nav>
```

**Rendered Output**:
```
┌─────────────────────────────────────┐
│ [ WALLET ]  [ Activity ]  [ Settings ]
│   ━━━━━━
```

**Styling**:
- Active tab: Green text + 2px top border
- Hover: Light background fill
- Font-size: 11px, uppercase
- Flex layout (equal widths)

---

### 9. List Items (Flat Design)

**Purpose**: Transaction history, token list, dapp connections

**Usage**:
```html
<div class="flat-list">
  <div class="flat-list-item">
    <div class="flat-list-item-content">
      <div class="flat-list-item-title">Send MINIMA</div>
      <div class="flat-list-item-subtitle">To: 0x1234...5678</div>
    </div>
    <div class="flat-list-item-value">
      <div class="flat-list-item-amount">-100.00</div>
      <div class="flat-list-item-label">2 hours ago</div>
    </div>
  </div>
  
  <div class="flat-list-item">
    <div class="flat-list-item-content">
      <div class="flat-list-item-title">Receive MINIMA</div>
      <div class="flat-list-item-subtitle">From: 0xabcd...ef12</div>
    </div>
    <div class="flat-list-item-value">
      <div class="flat-list-item-amount">+50.00</div>
      <div class="flat-list-item-label">1 day ago</div>
    </div>
  </div>
</div>
```

**Rendered Output**:
```
┌─────────────────────────────────────┐
│ Send MINIMA               -100.00   │
│ To: 0x1234...5678        2 hours ago│
├─────────────────────────────────────┤
│ Receive MINIMA             +50.00   │
│ From: 0xabcd...ef12       1 day ago │
└─────────────────────────────────────┘
```

---

### 10. Alerts (Flat Design)

**Purpose**: Success, error, warning, info messages

**Usage**:
```html
<div class="flat-alert flat-alert-success">
  Transaction confirmed on-chain!
</div>

<div class="flat-alert flat-alert-danger">
  Insufficient balance for this transaction.
</div>

<div class="flat-alert flat-alert-warning">
  This dapp is requesting access to your wallet.
</div>

<div class="flat-alert flat-alert-info">
  New version available. Update now.
</div>
```

**Styling**:
- Semi-transparent colored background
- 1px solid border (matching color)
- Padding: 12px 16px
- ❌ NO icons (text only)
- ❌ NO border-radius

---

### 11. Empty States (Flat Design)

**Purpose**: No transactions, no tokens, no dapps connected

**Usage**:
```html
<div class="flat-empty">
  <div class="flat-empty-icon">
    📭
  </div>
  <div class="flat-empty-title">No Transactions Yet</div>
  <div class="flat-empty-subtitle">
    Your transaction history will appear here once you send or receive MINIMA.
  </div>
</div>
```

**Rendered Output**:
```
┌─────────────────────────────────────┐
│                                      │
│             ┌────┐                  │
│             │ 📭 │                  │
│             └────┘                  │
│                                      │
│      No Transactions Yet             │
│                                      │
│  Your transaction history will appear│
│  here once you send or receive MINIMA│
│                                      │
└─────────────────────────────────────┘
```

---

### 12. Tabs (Flat Design)

**Purpose**: Switch between views (Tokens / NFTs / Activity)

**Usage**:
```html
<div class="flat-tabs">
  <button class="flat-tab active">Tokens</button>
  <button class="flat-tab">NFTs</button>
  <button class="flat-tab">Activity</button>
</div>

<div class="flat-tab-content">
  <!-- Token list -->
</div>
```

**Rendered Output**:
```
[ TOKENS ]  [ NFTs ]  [ Activity ]
  ━━━━━━
```

---

### 13. Divider (Flat Design)

**Purpose**: Section separators

**Usage**:
```html
<div class="flat-divider"></div>
<div class="flat-divider flat-divider-light"></div> <!-- Lighter variant -->
```

**Styling**:
- Height: 1px
- Background: `var(--border)` or `var(--border-light)`
- Margin: 16px 0

---

## Component Usage Patterns

### Form Validation
```tsx
import { useState } from 'react';

function SendForm() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!address.match(/^0x[a-fA-F0-9]{64}$/)) {
      setError('Invalid Minima address format');
      return;
    }
    
    // Proceed with transaction
  };

  return (
    <div class="flat-form-group">
      <label class="flat-form-label">Recipient Address</label>
      <input 
        type="text" 
        class="flat-input"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="0x..."
      />
      {error && <span class="flat-form-error">{error}</span>}
    </div>
  );
}
```

### Loading States
```tsx
function TransactionButton({ isPending }: { isPending: boolean }) {
  return (
    <button 
      class="flat-btn flat-btn-primary flat-btn-full"
      disabled={isPending}
    >
      {isPending ? '⟳ Processing...' : 'Send Transaction'}
    </button>
  );
}
```

### Conditional Styling
```tsx
function QuotaBar({ percentUsed }: { percentUsed: number }) {
  const getBarClass = () => {
    if (percentUsed >= 100) return 'quota-bar danger';
    if (percentUsed >= 80) return 'quota-bar warning';
    return 'quota-bar';
  };

  return (
    <div class="quota-bar-container">
      <div 
        class={getBarClass()}
        style={{ width: `${Math.min(percentUsed, 100)}%` }}
      />
    </div>
  );
}
```

## Responsive Utilities

### Flexbox Helpers
```html
<!-- Horizontal layout -->
<div class="flat-flex flat-items-center flat-justify-between flat-gap-3">
  <span>Label</span>
  <span>Value</span>
</div>

<!-- Vertical layout -->
<div class="flat-flex flat-flex-col flat-gap-2">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

### Spacing Utilities
```html
<!-- Padding -->
<div class="flat-p-4">Content</div>    <!-- 16px all sides -->
<div class="flat-p-2">Content</div>    <!-- 8px all sides -->

<!-- Margin -->
<div class="flat-mt-3">Content</div>   <!-- 12px top -->
<div class="flat-mb-5">Content</div>   <!-- 20px bottom -->
```

### Text Utilities
```html
<!-- Alignment -->
<div class="flat-text-center">Centered</div>
<div class="flat-text-right">Right-aligned</div>

<!-- Size -->
<span class="flat-text-xs">Extra small (11px)</span>
<span class="flat-text-sm">Small (12px)</span>
<span class="flat-text-base">Base (14px)</span>
<span class="flat-text-lg">Large (16px)</span>

<!-- Weight -->
<span class="flat-font-light">Light (300)</span>
<span class="flat-font-normal">Normal (400)</span>
<span class="flat-font-medium">Medium (500)</span>

<!-- Transform -->
<span class="flat-uppercase">Uppercase</span>
<span class="flat-tracking-wide">Wide tracking</span>
```

### Color Utilities
```html
<!-- Text colors -->
<span class="flat-text-primary">Primary text</span>
<span class="flat-text-secondary">Secondary text</span>
<span class="flat-text-muted">Muted text</span>
<span class="flat-text-success">Success</span>
<span class="flat-text-danger">Danger</span>

<!-- Background colors -->
<div class="flat-bg-primary">Primary background</div>
<div class="flat-bg-secondary">Secondary background</div>
```

## Animation Classes

### Fade In
```html
<div class="flat-animate-fade-in">
  Content fades in over 0.3s
</div>
```

### Slide Up
```html
<div class="flat-animate-slide-up">
  Content slides up with fade over 0.3s
</div>
```

### Pulse (Loading)
```html
<div class="flat-animate-pulse">
  Infinite pulse animation for loading states
</div>
```

## Component Composition Examples

### Transaction Card
```html
<div class="flat-card">
  <div class="flat-flex flat-justify-between flat-items-center flat-mb-3">
    <div>
      <div class="flat-text-sm flat-text-muted flat-uppercase">Transaction</div>
      <div class="flat-text-lg flat-font-medium">Send MINIMA</div>
    </div>
    <span class="flat-badge flat-badge-warning">Pending</span>
  </div>
  
  <div class="flat-divider"></div>
  
  <div class="flat-flex flat-justify-between flat-mt-3">
    <span class="flat-text-secondary">Amount</span>
    <span class="flat-font-medium">100.00 MINIMA</span>
  </div>
  
  <div class="flat-flex flat-justify-between flat-mt-2">
    <span class="flat-text-secondary">Fee</span>
    <span class="flat-font-medium">0.01 MINIMA</span>
  </div>
  
  <div class="flat-divider"></div>
  
  <div class="flat-flex flat-justify-between flat-mt-3">
    <span class="flat-text-secondary flat-font-medium">Total</span>
    <span class="flat-font-medium">100.01 MINIMA</span>
  </div>
</div>
```

### Account Switcher
```html
<div class="flat-list">
  <div class="flat-list-item">
    <div class="flat-list-item-content">
      <div class="flat-flex flat-items-center flat-gap-2">
        <span class="flat-token-dot" style="background: var(--minima-green)"></span>
        <div>
          <div class="flat-list-item-title">Account 1</div>
          <div class="flat-list-item-subtitle">0x0000...0000</div>
        </div>
      </div>
    </div>
    <div class="flat-list-item-value">
      <div class="flat-list-item-amount">1,234.56</div>
      <div class="flat-list-item-label">MINIMA</div>
    </div>
  </div>
</div>
```

## Design Checklist

When creating new components:
- [ ] Uses design tokens (CSS variables)
- [ ] NO border-radius (flat design)
- [ ] NO box-shadow (except brutalist hover lifts)
- [ ] Uppercase labels/headings
- [ ] Letter-spacing: 0.05em for uppercase text
- [ ] Dark background (#0a0a0a base)
- [ ] Accessible contrast (WCAG AA minimum)
- [ ] Responsive viewport (380px minimum - Firefox)
- [ ] No horizontal scrolling
- [ ] Touch-friendly (44px minimum tap targets)
