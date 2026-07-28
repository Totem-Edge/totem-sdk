# Serializer Golden Test Suite

| Property | Value |
|----------|-------|
| **Component** | Transaction Serializer (Binary Encoding) |
| **Type** | Golden Vector Regression Test |
| **Framework** | Jest |

## Purpose

This test suite validates the transaction serialization format against golden test vectors. It ensures that:

1. **Binary Format Correctness** - Transactions serialize to correct binary format
2. **Cross-Client Compatibility** - Serialized format matches other implementations
3. **Deterministic Encoding** - Same transaction always produces same bytes
4. **Deserialization Accuracy** - Binary can be parsed back to original transaction
5. **Field Order** - Fields serialized in specified order
6. **Type Encoding** - Each field type encoded correctly (uint, string, etc.)

This test validates that the Totem Extension can interoperate with blockchain nodes and other wallets.

## Test Design

The test suite uses pre-computed golden vectors from reference implementations:

### Golden Vector Structure
```typescript
const goldenVectors = [
  {
    name: "Simple Transfer",
    transaction: {
      from: "0x1234...",
      to: "0x5678...",
      amount: 1000,
      nonce: 1
    },
    expectedBytes: Buffer.from([
      0x01, // version
      0x00, 0x00, 0x00, 0x01, // nonce
      // ... rest of serialized transaction
    ]),
    expectedHex: "0x0100000001..."
  },
  // More vectors...
];
```

### Test Coverage Map
```
Serialization Tests
├── Basic Transactions
│   ├── Simple transfer
│   ├── Contract call
│   └── Contract deploy
├── Field Types
│   ├── Integers (uint8, uint32, uint64, uint256)
│   ├── Addresses (20 bytes)
│   ├── Hashes (32 bytes)
│   └── Variable-length (bytes, string)
├── Edge Cases
│   ├── Zero amounts
│   ├── Maximum values
│   └── Empty optional fields
└── Round-Trip
    └── serialize → deserialize → original
```

## Pass Requirements

For tests to pass:

1. **Serialized bytes** must exactly match golden vector bytes
2. **Hex encoding** must match expected hex strings
3. **Field order** must be deterministic and match spec
4. **Deserialization** must recover original transaction object
5. **No extra bytes** added to serialization
6. **No bytes omitted** from required fields

## Test Coverage

### Simple Transaction Tests
```typescript
✓ serialize simple transfer
✓ bytes match golden vector
✓ hex encoding correct
✓ deserialize restores transaction
```

### Field Type Tests
```typescript
✓ uint8 serializes to 1 byte
✓ uint32 serializes to 4 bytes (big-endian)
✓ uint256 serializes to 32 bytes
✓ address serializes to 20 bytes
✓ hash serializes to 32 bytes
✓ bytes field includes length prefix
✓ string field includes length prefix
```

### Complex Transaction Tests
```typescript
✓ contract call with data
✓ multi-signature transaction
✓ transaction with memo field
✓ transaction with all optional fields
```

### Edge Case Tests
```typescript
✓ zero amount transaction
✓ maximum uint256 value
✓ empty bytes field
✓ null optional field
✓ UTF-8 string with emojis
```

### Round-Trip Tests
```typescript
✓ serialize → deserialize = original
✓ works for all golden vectors
✓ preserves all field values
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework

### Dependencies
- Transaction serializer implementation
- Buffer utilities
- Golden vectors data file

### Test Vectors Source
Vectors should come from:
- Reference blockchain implementation
- Official protocol specification
- Other verified wallet implementations

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test test/serializer.golden.test.ts
```

### Run with hex output for debugging:
```bash
cd packages/totem-extension
DEBUG=serializer:* npm test test/serializer.golden.test.ts
```

### Run specific vector:
```bash
cd packages/totem-extension
npm test -- --testNamePattern="Simple Transfer" test/serializer.golden.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  test/serializer.golden.test.ts
  Serializer Golden Vectors
    Simple Transactions
      ✓ Vector 1: Simple Transfer (3ms)
      ✓ Vector 2: Contract Call (4ms)
      ✓ Vector 3: Contract Deploy (5ms)
    Field Types
      ✓ uint8 encoding (1ms)
      ✓ uint32 big-endian (1ms)
      ✓ uint256 encoding (2ms)
      ✓ address encoding (1ms)
    Edge Cases
      ✓ zero amount (2ms)
      ✓ max uint256 (2ms)
      ✓ empty bytes (1ms)
    Round-Trip
      ✓ all vectors round-trip (12ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
```

### What Passing Tests Indicate
- ✅ Serialization format correct
- ✅ Compatible with blockchain nodes
- ✅ No interoperability issues
- ✅ Ready for production

## Common Issues

### Issue: "bytes match golden vector" fails by 1-2 bytes
**Cause**: Endianness mismatch (little-endian vs big-endian)  
**Solution**: Use big-endian (network byte order) for integers:
```typescript
function serializeUint32(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32BE(value, 0); // BE = Big-Endian
  return buffer;
}
```

### Issue: Serialization includes extra bytes
**Cause**: Not trimming padding or including unnecessary fields  
**Solution**: Only serialize required fields:
```typescript
function serialize(tx: Transaction): Buffer {
  const parts: Buffer[] = [];
  
  // Version (required)
  parts.push(Buffer.from([tx.version]));
  
  // Nonce (required)
  parts.push(serializeUint32(tx.nonce));
  
  // Optional fields - only if present
  if (tx.memo) {
    parts.push(serializeString(tx.memo));
  }
  
  return Buffer.concat(parts);
}
```

### Issue: Round-trip fails - deserialized value different
**Cause**: Lossy serialization (precision loss, truncation)  
**Solution**: Ensure bijective encoding:
```typescript
// For large numbers, use BigInt
function serializeUint256(value: bigint): Buffer {
  const hex = value.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

function deserializeUint256(buffer: Buffer): bigint {
  return BigInt('0x' + buffer.toString('hex'));
}
```

### Issue: "string field includes length prefix" fails
**Cause**: Missing length prefix for variable-length fields  
**Solution**: Add length prefix:
```typescript
function serializeString(str: string): Buffer {
  const data = Buffer.from(str, 'utf8');
  const length = serializeUint32(data.length);
  return Buffer.concat([length, data]);
}
```

### Debugging Tips

1. **Compare byte-by-byte**:
```typescript
function compareBytes(actual: Buffer, expected: Buffer) {
  console.log('Length:', actual.length, 'vs', expected.length);
  
  for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
    const a = actual[i] ?? 'missing';
    const e = expected[i] ?? 'missing';
    
    if (a !== e) {
      console.log(`Byte ${i}: ${a} !== ${e}`);
    }
  }
}
```

2. **Visualize serialization**:
```typescript
function serializeWithDebug(tx: Transaction): Buffer {
  const parts = [];
  
  console.log('Serializing version:', tx.version);
  parts.push(Buffer.from([tx.version]));
  
  console.log('Serializing nonce:', tx.nonce);
  const nonce = serializeUint32(tx.nonce);
  console.log('Nonce bytes:', nonce.toString('hex'));
  parts.push(nonce);
  
  // ... etc
  
  const result = Buffer.concat(parts);
  console.log('Final hex:', result.toString('hex'));
  return result;
}
```

3. **Test individual field serializers**:
```typescript
test('uint32 serialization', () => {
  const tests = [
    { value: 0, expected: '00000000' },
    { value: 1, expected: '00000001' },
    { value: 255, expected: '000000ff' },
    { value: 256, expected: '00000100' },
    { value: 0xFFFFFFFF, expected: 'ffffffff' }
  ];
  
  tests.forEach(({ value, expected }) => {
    const serialized = serializeUint32(value);
    expect(serialized.toString('hex')).toBe(expected);
  });
});
```

4. **Diff hex strings**:
```typescript
const actual = serialize(tx).toString('hex');
const expected = golden.expectedHex.replace(/^0x/, '');

if (actual !== expected) {
  console.log('Actual:  ', actual);
  console.log('Expected:', expected);
  
  // Find first difference
  for (let i = 0; i < Math.max(actual.length, expected.length); i += 2) {
    const a = actual.substr(i, 2);
    const e = expected.substr(i, 2);
    if (a !== e) {
      console.log(`First diff at byte ${i/2}: ${a} vs ${e}`);
      break;
    }
  }
}
```

---

**Last Updated**: October 28, 2025
