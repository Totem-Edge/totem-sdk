# Transaction Core Module

This module provides transaction orchestration for the Totem Wallet extension.

## useSendTransaction Hook

The `useSendTransaction` hook manages the complete transaction workflow from submission to confirmation.

### Features

- **RPC Submission**: Sends transaction via chrome.runtime.sendMessage
- **Pending Tracking**: Polls txpow endpoint until confirmed
- **State Management**: Exposes transaction status (idle, submitting, pending, confirmed, failed)
- **History Refresh**: Triggers wallet state refresh after confirmation
- **Error Handling**: Captures and exposes errors for UI display

### Usage

```typescript
import { useSendTransaction } from '@/core/transaction/useSendTransaction';

function SendPage() {
  const { status, error, txpowid, sendTransaction, reset } = useSendTransaction();
  
  const handleSend = async () => {
    await sendTransaction({
      address: '0xrecipient...',
      amount: '100.5',
      tokenid: '0x00', // MINIMA
    });
  };
  
  // Show UI based on status:
  // - status === 'submitting' → "Preparing transaction..."
  // - status === 'pending' → "Waiting for confirmation..."
  // - status === 'confirmed' → "Transaction successful!"
  // - status === 'failed' → error message
}
```

### Transaction Flow

1. **Submit** (`submitting`)
   - Calls chrome.runtime.sendMessage with RPC_COMMAND
   - Sends to mock RPC server in Designer mode
   - Returns txpowid

2. **Poll** (`pending`)
   - Polls txpow endpoint every 1s
   - Checks if transaction is confirmed (isinblock === true)
   - Timeout after 10s (configurable)

3. **Confirm** (`confirmed`)
   - Transaction confirmed on blockchain
   - Triggers wallet:refreshHistory message
   - Clears form and updates balance

4. **Error** (`failed`)
   - Shows error message in UI
   - Differentiates insufficient funds vs network errors
   - Allows retry

### Designer Mode Integration

In Designer mode, the RPC_COMMAND handler in `dev-popup.html` routes commands to the mock RPC server at `http://localhost:6000/mock-rpc`.

The mock RPC server:
- Simulates transaction submission with realistic delays
- Generates mock txpowid values
- Respects confirmation delay settings (adjustable in MockRpcControls)
- Updates balance and history after confirmation

### Configuration

- `POLL_INTERVAL`: 1000ms (1 second)
- `CONFIRMATION_TIMEOUT`: 10000ms (10 seconds)

These can be adjusted based on real blockchain confirmation times.
