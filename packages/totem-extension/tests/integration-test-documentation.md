# Totem Extension Integration Test Suite

| Property | Value |
|----------|-------|
| **Component** | Full Extension Integration |
| **Type** | Integration Test |
| **Framework** | Jest |

## Purpose

This integration test suite validates the complete Totem browser extension workflow from end to end. It ensures that:

1. **Extension Initialization** loads correctly in browser environment
2. **Wallet Creation** full flow works (mnemonic → keyring → accounts)
3. **Transaction Signing** integrates correctly with WOTS cryptography
4. **Storage Integration** persists wallet data correctly
5. **Message Passing** between content scripts and background works
6. **Provider API** exposes correct interface to dApps

This test validates that all components work together correctly in a realistic browser extension environment.

## Test Design

The test suite simulates a real browser extension lifecycle:

### Test Flow
```
Setup (beforeAll)
├── Initialize mock browser API
├── Load extension background script
└── Set up test environment

Integration Tests
├── Extension Lifecycle
│   ├── Extension loads without errors
│   └── All modules initialize
├── Wallet Flow
│   ├── Create new wallet
│   ├── Import from mnemonic
│   ├── Derive accounts
│   └── Store encrypted keyring
├── Transaction Flow
│   ├── Build transaction
│   ├── Sign with WOTS
│   ├── Verify signature
│   └── Broadcast (mocked)
└── Provider Integration
    ├── totem:announce event fired
    ├── Connect request
    └── Sign request
```

## Pass Requirements

For tests to pass:

1. **Extension loads** without uncaught exceptions
2. **Wallet creation** generates valid mnemonic and keys
3. **Keyring encryption** successfully stores/retrieves keys
4. **Transaction signing** produces valid WOTS signatures
5. **Provider API** responds to dApp requests
6. **Message passing** works between components
7. **Storage** persists and retrieves data correctly

## Test Coverage

### Extension Lifecycle Tests
```typescript
✓ extension background script loads
✓ content script loads
✓ popup script loads
✓ all modules initialize without errors
```

### Wallet Integration Tests
```typescript
✓ create new wallet generates mnemonic
✓ import wallet from mnemonic succeeds
✓ derive first account succeeds
✓ keyring stores encrypted keys
✓ unlock keyring with password
✓ lock keyring removes keys from memory
```

### Transaction Integration Tests
```typescript
✓ build transaction object
✓ sign transaction with WOTS
✓ signature verification passes
✓ signed transaction has correct format
✓ broadcast transaction (mocked network)
```

### Provider Integration Tests
```typescript
✓ totem:announce event fires
✓ totem.request() is callable
✓ connect() returns accounts
✓ signTransaction() returns signature
✓ event listeners work
```

### Storage Integration Tests
```typescript
✓ save wallet to storage
✓ load wallet from storage
✓ encrypted data not readable without password
✓ clear wallet removes all data
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework
- jsdom for browser environment simulation

### Dependencies
- `webextension-polyfill` for browser API mocks
- Extension source code
- WOTS cryptography library

### Test Setup
```javascript
// Mock browser APIs
global.browser = require('webextension-polyfill');

// Mock chrome APIs
global.chrome = {
  runtime: { /* mock */ },
  storage: { /* mock */ }
};
```

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test tests/integration.test.ts
```

### Run with browser environment:
```bash
cd packages/totem-extension
npm test -- --env=jsdom tests/integration.test.ts
```

### Run with timeout (for async operations):
```bash
cd packages/totem-extension
npm test -- --testTimeout=10000 tests/integration.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  tests/integration.test.ts
  Totem Extension Integration Tests
    Extension Lifecycle
      ✓ background script loads (45ms)
      ✓ content script loads (32ms)
      ✓ all modules initialize (56ms)
    Wallet Integration
      ✓ create new wallet (123ms)
      ✓ import from mnemonic (98ms)
      ✓ derive accounts (87ms)
      ✓ encrypt and store keyring (145ms)
    Transaction Integration
      ✓ build transaction (34ms)
      ✓ sign with WOTS (234ms)
      ✓ verify signature (98ms)
    Provider Integration
      ✓ totem:announce fires (23ms)
      ✓ connect request (67ms)
      ✓ sign request (156ms)

Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
Time:        3.245s
```

### What Passing Tests Indicate
- ✅ All components integrate correctly
- ✅ Complete user workflows functional
- ✅ Extension ready for manual testing
- ✅ No critical integration bugs

## Common Issues

### Issue: "background script loads" fails
**Cause**: Module import errors in browser environment  
**Solution**: Add proper polyfills:
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/test/setup.js']
};

// test/setup.js
global.browser = require('webextension-polyfill');
```

### Issue: "sign with WOTS" takes too long
**Cause**: WOTS signing is computationally expensive  
**Solution**: Increase test timeout:
```typescript
test('sign with WOTS', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Issue: Storage tests fail
**Cause**: Mock storage not implemented  
**Solution**: Mock browser.storage:
```typescript
const mockStorage = new Map();
global.browser = {
  storage: {
    local: {
      get: async (keys) => {
        const result = {};
        keys.forEach(k => result[k] = mockStorage.get(k));
        return result;
      },
      set: async (items) => {
        Object.entries(items).forEach(([k, v]) => mockStorage.set(k, v));
      }
    }
  }
};
```

### Issue: Provider injection doesn't work
**Cause**: Window object not properly mocked  
**Solution**: Set up jsdom correctly:
```typescript
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
```

### Debugging Tips

1. **Enable debug logging**:
```typescript
beforeAll(() => {
  process.env.DEBUG = '*';
});
```

2. **Test components individually first**:
```bash
npm test test/unit/wallet.test.ts
npm test test/unit/wots.test.ts
# Then integration
npm test tests/integration.test.ts
```

3. **Log integration points**:
```typescript
test('transaction flow', async () => {
  const tx = buildTransaction(...);
  console.log('Built tx:', tx);
  
  const signed = await signTransaction(tx);
  console.log('Signed:', signed);
  
  const valid = verifySignature(signed);
  console.log('Valid:', valid);
});
```

4. **Check async operations**:
```typescript
test('async operation', async () => {
  const promise = someAsyncOp();
  console.log('Promise state:', promise);
  const result = await promise;
  console.log('Result:', result);
});
```

---

**Last Updated**: October 28, 2025
