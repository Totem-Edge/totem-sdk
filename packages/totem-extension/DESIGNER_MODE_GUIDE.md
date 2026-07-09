# Totem Wallet Designer Mode - Complete Testing Guide

## Overview

Designer Mode is a comprehensive development environment for testing Totem Wallet workflows **without requiring a live Minima blockchain connection**. It provides:

- **Mock RPC Server**: Simulates Minima node RPC commands with localStorage persistence
- **Debug Console**: Real-time log monitoring with filtering capabilities
- **Mock Controls**: UI controls to adjust balance, simulate receives, and control transaction confirmations
- **Complete Transaction Workflows**: Test Send and Receive flows end-to-end

## Quick Start

1. **Access Designer Mode**:
   ```bash
   cd packages/totem-extension
   npm run dev:ui
   ```

2. **Open Browser**: Navigate to `http://localhost:5173/totem-dev/dev-popup.html`

3. **Enable Mock RPC**: Click the "MOCK RPC" toggle in the bottom-left corner (turns green when active)

4. **Start Testing**: Use the wallet interface and Mock RPC Controls panel

## Architecture

### Components

1. **Mock RPC Middleware** (`src/dev/mock-rpc/handlers.ts`)
   - Vite dev server middleware at `/mock-rpc/*`
   - Handles core Minima RPC commands: balance, coins, address, send, txpow, history
   - Uses localStorage for persistent state across page reloads
   - BigInt arithmetic for 44-decimal MINIMA precision

2. **Mock Chrome API** (`dev-popup.html`)
   - Intercepts `chrome.runtime.sendMessage` calls
   - Routes `RPC_COMMAND` messages to mock RPC endpoints
   - Preserves compatibility with production extension code

3. **MockRpcControls Component** (`src/dev/mock-rpc/components/MockRpcControls.tsx`)
   - UI controls for balance adjustment, receive simulation, confirmation delays
   - State reset functionality
   - Visual feedback for all operations

4. **Event System**
   - `mock-rpc-balance-changed` custom events
   - Auto-refreshes balance and transaction history across all components
   - Ensures UI stays in sync with mock RPC state changes

## Mock RPC Commands

### Supported Commands

| Command | Description | Example Request |
|---------|-------------|-----------------|
| `balance` | Get current balance | `{command: "balance"}` |
| `coins` | List UTXOs | `{command: "coins", relevant: true}` |
| `getaddress` | Get primary address | `{command: "getaddress"}` |
| `newaddress` | Generate new address | `{command: "newaddress"}` |
| `send` | Submit transaction | `{command: "send", amount: "1.5", address: "Mx..."}` |
| `txpow` | Check transaction status | `{command: "txpow", txpowid: "0x..."}` |
| `history` | Get transaction history | `{command: "history"}` |

### State Management

Mock RPC state is stored in `localStorage` under the key `mockRpcState`:

```typescript
interface MockRpcState {
  balance: string;              // Total balance in base units (×10^44)
  address: string;              // Primary wallet address
  addresses: MinimaAddress[];   // All generated addresses
  coins: MinimaCoin[];          // UTXOs
  pendingTx: PendingTransaction[]; // Pending transactions
  history: MinimaTransaction[]; // Transaction history
  validationDelay: number;      // Confirmation delay (ms)
}
```

## Testing Workflows

### 1. Send Transaction Workflow

**Steps**:

1. **Adjust Balance**:
   - Enter amount in "Adjust Balance" input (e.g., `100`)
   - Click "Set Balance"
   - Balance card updates immediately

2. **Initiate Send**:
   - Click "↑ SEND" button
   - Select send mode: Global Send or Focused Send
   - Enter recipient address (e.g., `MxTEST123...`)
   - Enter amount (e.g., `5.5`)
   - Click "Send"

3. **Transaction Submission**:
   - Status banner appears: "Submitting transaction..."
   - Mock RPC creates pending transaction with `txpowid`
   - Status changes to: "Transaction pending confirmation..."

4. **Confirmation Polling**:
   - Wallet polls `/txpow` every 1 second (60s timeout)
   - After `validationDelay` ms (default: 5000ms), transaction confirms
   - Status banner: "Transaction confirmed! ✓"
   - Balance updates automatically
   - History refreshes with new sent transaction

5. **Verification**:
   - Check Activity tab for new transaction (shows as "Sent")
   - Verify balance decreased by sent amount
   - Debug console shows complete flow logs

**Error Testing**:

- **Insufficient Funds**: Set balance to `1`, try to send `10` → Error: "Insufficient MINIMA balance"
- **Network Failure**: Mock RPC returns error → Error: "Transaction failed: [error details]"
- **Timeout**: Set validation delay >60s → Transaction times out after 60s polling

### 2. Receive Transaction Workflow

**Steps**:

1. **Open Receive Modal**:
   - Click "↓ RECEIVE" button
   - Modal displays QR code and current address

2. **Copy Address**:
   - Click "Copy Address" button
   - Visual feedback: "✓ Copied!"
   - Address copied to clipboard

3. **Generate New Address** (Optional):
   - Click "Generate New Address"
   - Modal updates with new address
   - New QR code generated

4. **Simulate Receive**:
   - Enter amount in MockRpcControls "Simulate Receive" input (e.g., `25`)
   - Click "Simulate Receive"
   - Success message appears

5. **Auto-Refresh**:
   - Balance card updates immediately (+25 MINIMA)
   - Activity tab shows new received transaction (no page reload needed)
   - Debug console logs refresh events

**Event Flow**:
```
MockRpcControls.handleSimulateReceive()
  → Creates UTXO + transaction in mock state
  → Dispatches 'mock-rpc-balance-changed' event
  → BrutalistHome listener → loadBalance() + loadTokens()
  → BrutalistActivity listener → loadTransactions()
  → UI updates complete
```

## Mock RPC Controls Panel

Located in the bottom-left corner of Designer Mode:

### Controls

1. **Balance Adjustment**
   - Input: Enter MINIMA amount
   - Button: "Set Balance"
   - Effect: Instantly updates balance to exact amount

2. **Simulate Receive**
   - Input: Enter MINIMA amount to receive
   - Button: "Simulate Receive"
   - Effect: Creates incoming transaction, adds to balance + history

3. **Confirmation Delay**
   - Input: Milliseconds (default: 5000)
   - Effect: Controls how long transactions stay pending before confirming
   - Use Cases:
     - `0ms`: Instant confirmation (test success case)
     - `5000ms`: Normal delay (production-like)
     - `70000ms`: Force timeout (test timeout handling)

4. **State Reset**
   - Button: "Reset State"
   - Effect: Clears all mock RPC state (balance, addresses, UTXOs, history)
   - Use Case: Start fresh testing session

## Debug Console

Located on the right side of Designer Mode:

### Features

- **Real-time Logs**: Captures all console.log, console.error, console.warn
- **Log Filtering**: Filter by ALL, LOG, WARN, ERROR, INFO
- **Auto-scroll**: Toggle to keep newest logs visible
- **Clear**: Clear console logs
- **Log Count**: Shows total logs in current session

### Useful Log Patterns

Search for these patterns in Debug Console:

- `[BrutalistSend]` - Send transaction flow logs
- `[useSendTransaction]` - Transaction submission and polling
- `[ReceiveModal]` - Receive workflow logs
- `[MockRpcControls]` - Mock RPC operation logs
- `[Mock Chrome]` - Chrome API interception logs
- `RPC_COMMAND` - All RPC command routing

## Common Testing Scenarios

### Scenario 1: Complete Send/Receive Cycle

1. Reset state
2. Set balance to `100`
3. Send `20` MINIMA to test address
4. Wait for confirmation (5s)
5. Simulate receive `30` MINIMA
6. Verify final balance: `110` (100 - 20 + 30)
7. Check Activity tab shows both transactions

### Scenario 2: Insufficient Funds

1. Set balance to `5`
2. Try to send `10` MINIMA
3. Verify error: "Insufficient MINIMA balance"
4. Verify balance unchanged
5. Verify no transaction created

### Scenario 3: Transaction Timeout

1. Set confirmation delay to `70000` (70 seconds)
2. Send transaction
3. Wait 60 seconds
4. Verify timeout error message
5. Transaction marked as failed

### Scenario 4: Multiple Receives

1. Set balance to `0`
2. Simulate receive `10` MINIMA
3. Simulate receive `20` MINIMA
4. Simulate receive `30` MINIMA
5. Verify balance: `60`
6. Verify 3 receive transactions in Activity tab

## Technical Implementation Details

### BigInt Arithmetic

Minima uses 44-decimal precision. Mock RPC uses BigInt for all calculations:

```typescript
// Convert display amount to base units
const baseUnits = BigInt(Math.floor(parseFloat(amount) * 1e44));

// Convert base units to display amount
const displayAmount = (Number(baseUnits) / 1e44).toFixed(8);
```

### Transaction State Machine

Send transactions follow this state machine:

```
idle → submitting → pending → confirmed/failed
```

States:
- **idle**: No active transaction
- **submitting**: Calling /send endpoint
- **pending**: Polling /txpow for confirmation
- **confirmed**: Transaction in block (isinblock=true)
- **failed**: Error or timeout occurred

### Event-Driven Architecture

All balance/history updates use custom events to avoid tight coupling:

```typescript
// Dispatch event (MockRpcControls)
window.dispatchEvent(new CustomEvent('mock-rpc-balance-changed', {
  detail: { amount, type: 'receive' }
}));

// Listen for event (BrutalistHome, BrutalistActivity)
window.addEventListener('mock-rpc-balance-changed', handleBalanceChange);
```

## Troubleshooting

### Balance Not Updating After Send

**Symptoms**: Transaction confirms but balance stays the same

**Fix**: Check that `useSendTransaction` calls balance refresh after confirmation:
```typescript
if (data.response.isinblock) {
  // Refresh balance after confirmation
  chrome.runtime.sendMessage({ method: 'wallet:getState' });
}
```

### Receive Not Appearing in Activity

**Symptoms**: Simulate receive updates balance but no transaction in Activity tab

**Fix**: Verify BrutalistActivity has event listener:
```typescript
useEffect(() => {
  const handler = () => loadTransactions();
  window.addEventListener('mock-rpc-balance-changed', handler);
  return () => window.removeEventListener('mock-rpc-balance-changed', handler);
}, []);
```

### Mock RPC Returns Errors

**Symptoms**: All RPC commands fail with errors

**Fix**:
1. Check Mock RPC toggle is ON (green)
2. Clear localStorage and reset state
3. Check browser console for middleware errors
4. Verify Vite dev server is running

### Transaction Stuck Pending

**Symptoms**: Transaction polls forever, never confirms

**Fix**:
1. Check confirmation delay setting (should be <60000ms)
2. Verify mock RPC `/txpow` endpoint returns `isinblock: true` after delay
3. Check Debug Console for polling logs

## File Reference

### Core Files

- `packages/totem-extension/dev-popup.html` - Designer Mode entry point
- `packages/totem-extension/src/dev/mock-rpc/handlers.ts` - Mock RPC middleware
- `packages/totem-extension/src/dev/mock-rpc/components/MockRpcControls.tsx` - Controls UI
- `packages/totem-extension/src/core/transaction/useSendTransaction.ts` - Send workflow hook
- `packages/totem-extension/src/ui/components/molecules/ReceiveModal.tsx` - Receive modal
- `packages/totem-extension/src/ui/popup/pages/BrutalistSend.tsx` - Send page
- `packages/totem-extension/src/ui/popup/pages/BrutalistHome.tsx` - Home page (balance)
- `packages/totem-extension/src/ui/popup/pages/BrutalistActivity.tsx` - Activity page (history)

### Configuration

- `packages/totem-extension/vite.config.ts` - Vite middleware configuration
- `packages/totem-extension/src/core/transaction/README.md` - Transaction architecture docs

## Best Practices

1. **Always Reset State**: Start each testing session with "Reset State" for predictable behavior
2. **Check Debug Console**: Monitor logs to understand internal flow
3. **Test Error Cases**: Don't just test happy paths - verify error handling
4. **Verify Event Flow**: After simulate receive, check both balance AND activity update
5. **Use Realistic Delays**: Test with 5000ms confirmation delay for production-like experience
6. **Clear localStorage**: If state becomes corrupted, clear browser localStorage

## Production vs Designer Mode

| Feature | Designer Mode | Production |
|---------|---------------|------------|
| RPC Backend | Mock (localStorage) | Live Minima node |
| Confirmations | Simulated (5s default) | Real blockchain (~30s) |
| State Persistence | localStorage only | Blockchain + wallet DB |
| Network Calls | None (all local) | Real RPC over network |
| WOTS Signatures | Mocked | Real cryptographic signatures |

## Next Steps

After testing in Designer Mode, deploy to production:

1. Build extension: `npm run build`
2. Load unpacked extension in Chrome
3. Connect to real Minima node via AXIA RPC Gateway
4. Test with real blockchain transactions
5. Verify WOTS signature generation
6. Test on testnet before mainnet

---

**Last Updated**: November 2025
**Version**: 1.0.0
**Status**: Production-Ready
