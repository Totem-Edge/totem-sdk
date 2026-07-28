# Provider API Test Suite

| Property | Value |
|----------|-------|
| **Component** | dApp Provider API (totem:announce discovery) |
| **Type** | Integration/Unit Test |
| **Framework** | Jest |

## Purpose

This test suite validates the Totem provider API that is injected into web pages to allow dApps to interact with the wallet. It ensures that:

1. **API Announcement** - provider is correctly announced via `totem:announce` CustomEvent
2. **Connection Flow** - dApps can request wallet connection
3. **Account Access** - Connected dApps can read account addresses
4. **Transaction Signing** - dApps can request transaction signatures
5. **Message Signing** - dApps can sign arbitrary messages
6. **Event System** - Events are emitted for account/chain changes
7. **Permission System** - User approval required for sensitive operations
8. **Error Handling** - Proper errors for rejected requests

This API is the primary interface between decentralized applications and the Totem wallet.

## Test Design

The test suite validates the provider API from a dApp's perspective:

### Provider API Structure
```typescript
interface TotemProvider {
  // Connection
  request(args: { method: string, params?: any[] }): Promise<any>;
  
  // Convenience methods
  connect(): Promise<string[]>;
  disconnect(): Promise<void>;
  
  // Events
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  
  // Properties
  isTotem: boolean;
  isConnected: boolean;
  chainId: string;
  selectedAddress: string | null;
}
```

### Test Categories
```
Provider API Tests
├── Announcement
│   ├── totem:announce event fires on load
│   ├── detail.info.id present
│   ├── detail.provider.isTotem === true
│   └── API shape correct
├── Connection
│   ├── request({ method: 'eth_requestAccounts' })
│   ├── User approval flow
│   └── Returns account addresses
├── Account Access
│   ├── selectedAddress property
│   ├── request({ method: 'eth_accounts' })
│   └── Requires connection first
├── Transaction Signing
│   ├── request({ method: 'eth_sendTransaction' })
│   ├── User approval UI
│   └── Returns transaction hash
├── Message Signing
│   ├── request({ method: 'personal_sign' })
│   ├── request({ method: 'eth_signTypedData_v4' })
│   └── Returns signature
├── Events
│   ├── accountsChanged event
│   ├── chainChanged event
│   └── disconnect event
└── Error Handling
    ├── User rejected request
    ├── Method not found
    └── Invalid parameters
```

## Pass Requirements

For tests to pass:

1. **totem:announce** must fire after content script injection, with `detail.provider.isTotem === true`
2. **isTotem** must be true to identify Totem wallet
3. **connect()** must return array of account addresses
4. **eth_requestAccounts** must show approval popup
5. **eth_sendTransaction** must return transaction hash after approval
6. **personal_sign** must return valid signature
7. **Events** must fire when accounts or chain change
8. **Rejected requests** must throw errors with correct error codes

## Test Coverage

### Announcement Tests
```typescript
✓ totem:announce fires on load
✓ detail.provider.isTotem === true
✓ has request method
✓ has connect method
✓ has on/off methods
```

### Connection Tests
```typescript
✓ connect() requests user approval
✓ connect() returns account array
✓ isConnected updates to true
✓ selectedAddress populated
✓ disconnect() clears connection
```

### Account Access Tests
```typescript
✓ eth_accounts returns accounts after connection
✓ eth_accounts returns empty before connection
✓ selectedAddress matches first account
```

### Transaction Signing Tests
```typescript
✓ eth_sendTransaction shows approval UI
✓ approval returns transaction hash
✓ rejection throws user denied error
✓ invalid params throw validation error
```

### Message Signing Tests
```typescript
✓ personal_sign returns signature
✓ eth_signTypedData_v4 returns signature
✓ signatures can be verified
✓ user can reject signing
```

### Event Tests
```typescript
✓ accountsChanged fires when switching accounts
✓ chainChanged fires when switching networks
✓ disconnect fires when wallet disconnected
✓ multiple listeners work correctly
✓ removeListener works
```

### Error Handling Tests
```typescript
✓ unknown method throws method not found (code: -32601)
✓ user rejection throws user denied (code: 4001)
✓ invalid params throw invalid params (code: -32602)
✓ disconnected state throws not connected error
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework
- jsdom for DOM simulation

### Dependencies
- Provider implementation
- Content script injection logic
- Mock browser extension APIs

### Test Setup
```typescript
// Mock browser APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: { addListener: jest.fn() }
  }
};

// Simulate provider announcement
const provider = new TotemProvider();
const info = { id: 'test-totem', name: 'Test Totem', version: '1.0.0' };
global.window.dispatchEvent(new CustomEvent('totem:announce', { detail: { info, provider } }));
global.window.addEventListener('totem:requestAnnounce', () => {
  global.window.dispatchEvent(new CustomEvent('totem:announce', { detail: { info, provider } }));
});
```

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test tests/provider.test.ts
```

### Run with DOM environment:
```bash
cd packages/totem-extension
npm test -- --env=jsdom tests/provider.test.ts
```

### Run specific test group:
```bash
cd packages/totem-extension
npm test -- --testNamePattern="Connection" tests/provider.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  tests/provider.test.ts
  Totem Provider API
    Announcement
      ✓ totem:announce fires on load (2ms)
      ✓ detail.provider.isTotem is true (1ms)
      ✓ has required methods (1ms)
    Connection
      ✓ connect() requests approval (45ms)
      ✓ connect() returns accounts (67ms)
      ✓ disconnect() clears state (23ms)
    Account Access
      ✓ eth_accounts after connection (34ms)
      ✓ selectedAddress populated (12ms)
    Transaction Signing
      ✓ eth_sendTransaction shows UI (89ms)
      ✓ returns transaction hash (123ms)
    Message Signing
      ✓ personal_sign works (78ms)
      ✓ eth_signTypedData_v4 works (92ms)
    Events
      ✓ accountsChanged fires (34ms)
      ✓ chainChanged fires (28ms)
      ✓ removeListener works (15ms)
    Error Handling
      ✓ unknown method error (12ms)
      ✓ user rejection error (45ms)

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

### What Passing Tests Indicate
- ✅ Provider API correctly implemented
- ✅ dApps can interact with wallet
- ✅ User approval flows working
- ✅ Event system functional

## Common Issues

### Issue: "totem:announce fires on load" fails
**Cause**: Content script not injected properly, or announce event not dispatched  
**Solution**: Ensure provider.ts fires the announce event on load:
```typescript
// provider.ts
import { TotemProvider } from './provider';

function announce() {
  const provider = new TotemProvider();
  const info = { id: 'totem-wallet', name: 'Totem Wallet', version: '1.0.0' };
  window.dispatchEvent(new CustomEvent('totem:announce', { detail: { info, provider } }));
  Object.defineProperty(window, '_totemProvider', {
    value: provider,
    writable: false,
    configurable: false
  });
  
  // Also inject as window.ethereum for compatibility
  if (!window.ethereum) {
    window.ethereum = provider;
  }
}

injectProvider();
```

### Issue: "connect() returns accounts" fails - no accounts returned
**Cause**: Not implementing eth_requestAccounts method  
**Solution**: Implement RPC method handler:
```typescript
class TotemProvider {
  async request({ method, params }) {
    switch (method) {
      case 'eth_requestAccounts':
        const approved = await this.requestApproval('connect');
        if (!approved) throw new Error('User rejected');
        this.isConnected = true;
        this.selectedAddress = this.accounts[0];
        return this.accounts;
        
      case 'eth_accounts':
        return this.isConnected ? this.accounts : [];
        
      default:
        throw new Error(`Method not found: ${method}`);
    }
  }
}
```

### Issue: "accountsChanged fires" doesn't trigger
**Cause**: Event emitter not implemented  
**Solution**: Implement event system:
```typescript
class TotemProvider extends EventEmitter {
  switchAccount(newAddress: string) {
    this.selectedAddress = newAddress;
    this.emit('accountsChanged', [newAddress]);
  }
  
  switchChain(newChainId: string) {
    this.chainId = newChainId;
    this.emit('chainChanged', newChainId);
  }
}
```

### Issue: "user rejection error" doesn't have correct error code
**Cause**: Not following EIP-1193 error codes  
**Solution**: Use standard error codes:
```typescript
class ProviderError extends Error {
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

// Standard error codes
const ERRORS = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901
};

// Usage
throw new ProviderError(ERRORS.USER_REJECTED, 'User denied transaction');
```

### Debugging Tips

1. **Check provider injection**:
```typescript
test('debug injection', () => {
  window.addEventListener('totem:announce', (e) => {
    console.log('provider:', e.detail.provider);
    console.log('isTotem:', e.detail.provider?.isTotem);
    console.log('Methods:', Object.keys(e.detail.provider || {}));
  });
  window.dispatchEvent(new CustomEvent('totem:requestAnnounce'));
});
```

2. **Test RPC methods manually**:
```typescript
test('manual RPC call', async () => {
  const result = await provider.request({
    method: 'eth_requestAccounts'
  });
  console.log('Accounts:', result);
});
```

3. **Verify event listeners**:
```typescript
test('event system', () => {
  let fired = false;
  
  provider.on('accountsChanged', (accounts) => {
    fired = true;
    console.log('Event fired with:', accounts);
  });
  
  provider.switchAccount('0x1234...');
  console.log('Event fired:', fired);
});
```

4. **Compare with MetaMask**:
```typescript
// Test provider compatibility
const metamaskMethods = Object.keys(window.ethereum || {});
const totemMethods = Object.keys(discoveredProvider || {});

console.log('Missing methods:', 
  metamaskMethods.filter(m => !totemMethods.includes(m))
);
```

---

**Last Updated**: October 28, 2025
