# Totem Agent - Specialized UX Design Agent for Browser Wallets

## What is Totem Agent?

Totem Agent is an expert AI assistant specialized in designing and building the **Totem Wallet** - a quantum-resistant browser extension for the Minima blockchain. The agent combines deep expertise in:

- **Browser Extension Development** (Chrome, Firefox, Safari)
- **Flat Brutalist Design** (Axia's design language)
- **WOTS Cryptography** (Quantum-resistant signatures)
- **Wallet UX Patterns** (MetaMask-style provider API)

## Knowledge Base Structure

This directory contains comprehensive documentation for the Totem Agent:

### Core Documentation

1. **[01-architecture.md](./01-architecture.md)** - Extension architecture, message flows, keyring structure
2. **[02-transaction-workflows.md](./02-transaction-workflows.md)** - 3-step WOTS signing flow, state diagrams, error handling
3. **[03-sdk-integration.md](./03-sdk-integration.md)** - WOTS SDK, Axia API endpoints, quota management
4. **[04-browser-requirements.md](./04-browser-requirements.md)** - Multi-browser support (Chrome/Firefox/Safari manifests, APIs, packaging)
5. **[05-design-system.md](./05-design-system.md)** - Flat brutalist aesthetic, color palette, typography, component styling
6. **[06-ui-components.md](./06-ui-components.md)** - Component library with usage examples

### Agent Instructions

7. **[11-totem-agent-instructions.md](./11-totem-agent-instructions.md)** - Custom instructions for Totem Agent behavior
8. **[12-example-scenarios.md](./12-example-scenarios.md)** - Example tasks and demonstrations
9. **[13-quick-reference.md](./13-quick-reference.md)** - Common commands, design rules, browser checklists

## How to Use Totem Agent

### Invoking the Agent

When you need help with Totem Wallet development, start your message with:

```
[Totem Agent] <your request>
```

**Examples**:
- `[Totem Agent] Design a transaction approval screen`
- `[Totem Agent] Convert this Chrome component to work in Firefox`
- `[Totem Agent] Review the quota indicator UX`
- `[Totem Agent] Create a brutalist loading spinner`

### Agent Capabilities

Totem Agent can:

1. **Design UI Components** following flat brutalist principles
2. **Convert Between Browsers** (Chrome ↔ Firefox ↔ Safari)
3. **Implement Workflows** (transaction signing, dapp connection)
4. **Review UX** against wallet best practices
5. **Debug WOTS Issues** (signing, lease management)
6. **Generate Code** adhering to design system

### Quick Start

```bash
# 1. Start development server
cd packages/totem-extension
npm run dev:ui

# 2. Open http://localhost:6000 in browser
# 3. See live preview with hot reload

# 4. Ask Totem Agent for help:
[Totem Agent] Add a "Copy Address" button to the Header component
```

## Development Environment

### Local Setup

The Totem dev server (port 6000) provides:
- **Extension frame simulator** (400x600px Chrome viewport)
- **Browser preset switcher** (Chrome 400px, Firefox 380px, Safari 420px)
- **Mock Chrome APIs** (storage, runtime, tabs)
- **Hot reload** for rapid iteration

### File Locations

```
packages/totem-extension/
├── src/
│   ├── core/               # Wallet logic, WOTS signing
│   │   ├── wallet.ts       # Keyring, seed management
│   │   ├── transaction/    # 3-step signing flow
│   │   ├── quota/          # Quota manager
│   │   └── api/            # Axia API client
│   ├── ui/
│   │   ├── components/     # React components
│   │   ├── theme/          # flat-design.css, tokens.css
│   │   └── popup/          # Main popup app
│   ├── background/         # Service worker (Chrome MV3)
│   └── content-script/     # Dapp provider injection
├── dev/                    # Development tools
│   ├── dev-server.html     # Hosted UI (port 6000)
│   └── mock-chrome.ts      # Chrome API mocks
└── vite.dev.config.ts      # Vite dev server config
```

## Design Principles

### Color Palette
- **Primary**: White (#FFFFFF) - backgrounds, text
- **Accent**: Burnt Neon Orange (#FF6B35) - CTAs, highlights
- **Secondary**: Slate Gray (#475569) - muted text, borders
- **Base**: Near-black (#0A0A0A) - dark mode backgrounds

### Typography
- **Headings**: Bold (700), UPPERCASE, letter-spacing: 1.5px
- **Body**: Regular (400), sentence case, line-height: 1.6
- **Labels**: Medium (500), UPPERCASE, letter-spacing: 1px
- **Font stack**: System fonts (San Francisco, Segoe UI, Roboto)

### Component Rules
- ❌ NO rounded corners (border-radius: 0)
- ❌ NO soft shadows (box-shadow only for brutalist lifts)
- ❌ NO gradients (solid colors only)
- ✅ Hard borders (2-3px)
- ✅ High contrast
- ✅ Uppercase headings

## Browser Support Matrix

| Browser | Viewport | Manifest | Notes |
|---------|----------|----------|-------|
| **Chrome/Edge** | 400x600px | MV3 | Service workers, default target |
| **Firefox** | 380x580px | MV2 | Persistent background, smaller panel |
| **Safari** | 420x620px | App Extension | Native Swift wrapper required |

**Always test at 380px width (Firefox constraint)**

## Common Tasks

### 1. Create New Component
```typescript
// 1. Read design system (05-design-system.md)
// 2. Check existing components (06-ui-components.md)
// 3. Follow flat brutalist patterns
// 4. Test at Firefox viewport (380px)

// Example: Brutalist button
<button className="
  bg-[#FF6B35] 
  text-white 
  border-3 border-black 
  px-6 py-3 
  font-bold uppercase tracking-wide
  hover:translate-y-[-2px] hover:shadow-[4px_4px_0_#0A0A0A]
  active:translate-y-0 active:shadow-none
">
  Send Transaction
</button>
```

### 2. Convert Chrome → Firefox
```json
// Chrome (MV3)
{
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "background.js" }
}

// Firefox (MV2)
{
  "browser_action": { "default_popup": "popup.html" },
  "background": { "scripts": ["background.js"] }
}
```

### 3. Implement WOTS Flow
```typescript
// Read: 02-transaction-workflows.md, 03-sdk-integration.md

// Step 1: Prepare (Axia API)
const { addressIndex, l1, l2, leaseToken, digestTx } = 
  await TransactionService.prepare({ to, amount }, rootPubKey);

// Step 2: Sign (Client-side WOTS)
const { signedHex } = 
  await TransactionService.sign({ addressIndex, l1, l2, digestTx }, seed);

// Step 3: Finalize (Axia API)
const { txpowid } = 
  await TransactionService.finalize({ leaseToken, signedHex });
```

### 4. Add Quota Indicator
```tsx
// Reads from quotaManager automatically
import { QuotaIndicator } from '@/components/QuotaIndicator';

<div>
  <h2>Settings</h2>
  <QuotaIndicator /> {/* Shows daily/monthly usage */}
</div>
```

## Testing Workflow

1. **Local Dev** (port 6000) - Rapid UI iteration
2. **Chrome Extension** - Load unpacked from `dist/chrome`
3. **Firefox Add-on** - Load temporary from `dist/firefox`
4. **Safari** - Build Xcode project, run extension

## Getting Help

When asking Totem Agent for help:

1. **Be specific**: "Design a send form" vs "Make the UI better"
2. **Include context**: Browser target (Chrome/Firefox/Safari)
3. **Reference docs**: "Following 05-design-system.md..."
4. **Show code**: Paste existing code for review/refactor

## Example Prompts

```
[Totem Agent] Design a dapp connection approval modal with:
- Dapp icon, name, origin
- Requested permissions list
- Approve/Reject buttons (brutalist style)
- Warning if dapp is untrusted

[Totem Agent] Convert this Chrome service worker to Firefox persistent background script

[Totem Agent] Review the QuotaIndicator component UX - is the warning threshold (80%) appropriate?

[Totem Agent] Create a loading state for transaction signing (WOTS signature generation)

[Totem Agent] Debug: Lease token expires before signing completes. How to handle this gracefully?
```

## Architecture Diagrams

### Message Flow
```
Dapp Page
  ↓ window.totem.request()
Content Script
  ↓ chrome.runtime.sendMessage()
Background Worker
  ↓ Validate, process
  ↓ chrome.windows.create() (approval popup)
Approval Popup
  ↓ User approves
Background Worker
  ↓ Prepare → Sign → Finalize
  ↓ chrome.tabs.sendMessage()
Content Script
  ↓ window.postMessage()
Dapp Page (receives result)
```

### Transaction States
```
idle → pending_approval → signing → broadcasting → confirmed
       ↓                   ↓           ↓
       rejected           failed      failed
```

## Resources

- **Minima Docs**: https://docs.minima.global
- **Axia Dashboard**: https://dashboard.axia.to
- **WOTS Research**: "Post-Quantum Cryptography" (Bernstein et al.)
- **MetaMask UX**: https://metamask.io (reference patterns)
- **Brutalist Design**: https://brutalistwebsites.com

## Contributing

When modifying Totem:

1. **Read relevant docs** (architecture, workflows, design system)
2. **Follow design principles** (flat brutalist, no rounded corners)
3. **Test all browsers** (Chrome 400px, Firefox 380px, Safari 420px)
4. **Update replit.md** if adding features or changing architecture
5. **Run architect review** before completing tasks

---

**Next Steps**: Read [11-totem-agent-instructions.md](./11-totem-agent-instructions.md) for detailed agent behavior guidelines.
