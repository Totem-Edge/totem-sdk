# Transaction Flow Integration Test Suite

| Property | Value |
|----------|-------|
| **Component** | Complete Transaction Lifecycle |
| **Type** | Integration Test |
| **Framework** | Jest |

## Purpose

This integration test suite validates the complete end-to-end transaction flow in the Totem wallet extension. It ensures that:

1. **Transaction Building** constructs valid transaction objects
2. **Fee Estimation** calculates accurate gas/fees
3. **Signing Flow** integrates WOTS signature generation
4. **Serialization** produces blockchain-compatible format
5. **Broadcasting** (mocked) sends transactions to network
6. **Status Tracking** monitors transaction confirmation
7. **Error Handling** gracefully handles failures at each step

This test validates the entire user journey from "send transaction" to "transaction confirmed".

## Test Design

The test suite simulates a complete transaction lifecycle:

### Transaction Flow
```
User Action
├── 1. Build Transaction
│   ├── Get account balance
│   ├── Get nonce
│   ├── Set recipient
│   ├── Set amount
│   └── Add memo (optional)
├── 2. Estimate Fees
│   ├── Calculate gas needed
│   ├── Get current gas price
│   └── Calculate total fee
├── 3. Sign Transaction
│   ├── Unlock wallet
│   ├── Derive signing key
│   ├── Generate WOTS signature
│   └── Attach signature to tx
├── 4. Serialize Transaction
│   ├── Encode to binary format
│   └── Validate serialization
├── 5. Broadcast Transaction
│   ├── Send to RPC endpoint
│   ├── Get transaction hash
│   └── Add to pending pool
└── 6. Track Status
    ├── Poll for confirmation
    ├── Update UI state
    └── Handle success/failure
```

## Pass Requirements

For tests to pass:

1. **Transaction object** must have all required fields
2. **Balance check** must prevent overdraft
3. **Fee estimation** must return reasonable values
4. **Signature** must be valid WOTS signature
5. **Serialization** must produce valid blockchain transaction
6. **Broadcast** must return transaction hash
7. **Status** must update from pending → confirmed
8. **Error states** must be handled gracefully

## Test Coverage

### Transaction Building Tests
```typescript
✓ build transaction with valid inputs
✓ reject transaction with insufficient balance
✓ reject transaction with invalid recipient
✓ auto-increment nonce
✓ include memo if provided
```

### Fee Estimation Tests
```typescript
✓ estimate gas for simple transfer
✓ estimate gas for contract call
✓ gas estimation includes buffer (safety margin)
✓ total fee = gas × gas_price
```

### Signing Tests
```typescript
✓ unlock wallet before signing
✓ signing requires correct password
✓ generate WOTS signature
✓ signature verification passes
✓ signed transaction has signature attached
```

### Serialization Tests
```typescript
✓ serialize signed transaction
✓ serialized format matches expected structure
✓ deserialize round-trip successful
```

### Broadcasting Tests
```typescript
✓ broadcast returns transaction hash
✓ transaction hash is 32 bytes
✓ transaction added to pending pool
✓ network errors handled gracefully
```

### Status Tracking Tests
```typescript
✓ transaction starts as "pending"
✓ status updates to "confirmed" after blocks
✓ status updates to "failed" on revert
✓ confirmation count increments
```

### Error Handling Tests
```typescript
✓ handle network timeout
✓ handle insufficient funds
✓ handle nonce too low
✓ handle nonce too high
✓ handle gas price too low
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework

### Dependencies
- Wallet/keyring implementation
- WOTS signing implementation
- Transaction serializer
- Mock RPC client

### Test Setup
```typescript
// Mock blockchain RPC
const mockRPC = {
  getNonce: jest.fn().mockResolvedValue(1),
  getGasPrice: jest.fn().mockResolvedValue(100),
  estimateGas: jest.fn().mockResolvedValue(21000),
  sendTransaction: jest.fn().mockResolvedValue('0xabcd...'),
  getTransactionReceipt: jest.fn()
};
```

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test test/transaction-flow.integration.test.ts
```

### Run with timeout (transactions can be slow):
```bash
cd packages/totem-extension
npm test -- --testTimeout=30000 test/transaction-flow.integration.test.ts
```

### Run in watch mode:
```bash
cd packages/totem-extension
npm test -- --watch test/transaction-flow.integration.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  test/transaction-flow.integration.test.ts
  Transaction Flow Integration
    Building
      ✓ build valid transaction (45ms)
      ✓ reject insufficient balance (12ms)
      ✓ auto-increment nonce (23ms)
    Fee Estimation
      ✓ estimate simple transfer (34ms)
      ✓ estimate contract call (56ms)
      ✓ total fee calculation (8ms)
    Signing
      ✓ unlock and sign (245ms)
      ✓ signature verification (123ms)
    Serialization
      ✓ serialize signed tx (15ms)
      ✓ round-trip successful (18ms)
    Broadcasting
      ✓ broadcast returns hash (67ms)
      ✓ tx in pending pool (23ms)
    Status Tracking
      ✓ pending → confirmed (89ms)
      ✓ confirmation count (45ms)
    Error Handling
      ✓ handle network timeout (102ms)
      ✓ handle insufficient funds (34ms)

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
Time:        2.156s
```

### What Passing Tests Indicate
- ✅ Complete transaction flow working
- ✅ All integration points functional
- ✅ Error handling robust
- ✅ Ready for manual testing

## Common Issues

### Issue: "build valid transaction" fails with validation error
**Cause**: Missing required fields  
**Solution**: Ensure all fields populated:
```typescript
function buildTransaction(params: TxParams): Transaction {
  return {
    version: 1,
    from: params.from,
    to: params.to,
    amount: params.amount,
    nonce: params.nonce,
    gasLimit: params.gasLimit,
    gasPrice: params.gasPrice,
    data: params.data || Buffer.alloc(0),
    chainId: params.chainId || 1
  };
}
```

### Issue: "unlock and sign" takes too long / times out
**Cause**: WOTS signing is computationally expensive  
**Solution**: Increase timeout or optimize signing:
```typescript
test('unlock and sign', async () => {
  const tx = buildTransaction({...});
  const signed = await signTransaction(tx, password);
  expect(signed.signature).toBeDefined();
}, 10000); // 10 second timeout
```

### Issue: "broadcast returns hash" fails - mock not working
**Cause**: Mock RPC not set up correctly  
**Solution**: Properly mock RPC client:
```typescript
jest.mock('../src/rpc', () => ({
  sendTransaction: jest.fn().mockResolvedValue({
    hash: '0x' + '1'.repeat(64)
  })
}));
```

### Issue: "pending → confirmed" fails - status doesn't update
**Cause**: Status polling not implemented or not working  
**Solution**: Implement status polling:
```typescript
async function waitForConfirmation(txHash: string, timeout = 30000): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const receipt = await rpc.getTransactionReceipt(txHash);
    
    if (receipt && receipt.status === 'confirmed') {
      return;
    }
    
    await delay(1000); // Poll every second
  }
  
  throw new Error('Transaction confirmation timeout');
}
```

### Debugging Tips

1. **Log each step of the flow**:
```typescript
test('complete flow', async () => {
  console.log('1. Building transaction...');
  const tx = buildTransaction({...});
  console.log('Built:', tx);
  
  console.log('2. Estimating fees...');
  const fees = await estimateFees(tx);
  console.log('Fees:', fees);
  
  console.log('3. Signing...');
  const signed = await signTransaction(tx);
  console.log('Signed:', signed);
  
  console.log('4. Broadcasting...');
  const hash = await broadcast(signed);
  console.log('Hash:', hash);
  
  console.log('5. Tracking...');
  const status = await trackStatus(hash);
  console.log('Status:', status);
});
```

2. **Verify transaction object structure**:
```typescript
function validateTransaction(tx: Transaction): void {
  const required = ['version', 'from', 'to', 'amount', 'nonce', 'gasLimit', 'gasPrice'];
  
  required.forEach(field => {
    if (!(field in tx)) {
      throw new Error(`Missing required field: ${field}`);
    }
  });
  
  console.log('Transaction valid');
}
```

3. **Test each step independently first**:
```bash
npm test test/unit/transaction-builder.test.ts
npm test test/unit/fee-estimator.test.ts
npm test test/unit/wots-signing.test.ts
npm test test/unit/serializer.test.ts
# Then integration
npm test test/transaction-flow.integration.test.ts
```

4. **Mock network delays**:
```typescript
mockRPC.sendTransaction.mockImplementation(async (tx) => {
  await delay(1000); // Simulate network latency
  return { hash: generateTxHash(tx) };
});
```

---

**Last Updated**: October 28, 2025
