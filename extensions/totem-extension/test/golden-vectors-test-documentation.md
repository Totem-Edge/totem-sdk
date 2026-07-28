# Golden Vectors Test Suite

| Property | Value |
|----------|-------|
| **Component** | Cryptographic Test Vectors |
| **Type** | Regression Test |
| **Framework** | Jest |

## Purpose

This test suite validates cryptographic implementations against known "golden" test vectors - pre-computed inputs and outputs that serve as ground truth. It ensures that:

1. **Cryptographic Correctness** - WOTS signatures match reference implementation
2. **Cross-Implementation Compatibility** - Output matches other WOTS libraries
3. **Regression Prevention** - Changes don't break cryptographic primitives
4. **Standards Compliance** - Implementation follows WOTS specification
5. **Determinism** - Same input always produces same output

Golden vectors are critical for cryptographic code - they prove that the implementation is mathematically correct and compatible with other systems.

## Test Design

The test suite uses pre-computed test vectors from reference implementations:

### Test Vector Structure
```javascript
const goldenVectors = [
  {
    name: "Test Vector 1",
    seed: "0x1234...",
    message: "0xabcd...",
    expectedPublicKey: "0x5678...",
    expectedSignature: "0xef01..."
  },
  // ... more vectors
];
```

### Test Categories
```
Golden Vectors
├── Key Generation Vectors
│   ├── Seed → Private Key
│   └── Private Key → Public Key
├── Signing Vectors
│   ├── Message + Private Key → Signature
│   └── Deterministic signature
└── Verification Vectors
    ├── Valid signatures verify
    └── Invalid signatures rejected
```

## Pass Requirements

For tests to pass:

1. **Generated public keys** must exactly match golden vector public keys
2. **Generated signatures** must exactly match golden vector signatures
3. **Signature verification** must succeed for all golden vectors
4. **Hash outputs** must match expected values byte-for-byte
5. **No rounding errors** or floating-point inconsistencies
6. **All test vectors** must pass (100% pass rate required)

## Test Coverage

### Key Generation Vectors
```typescript
✓ Vector 1: Seed generates correct private key
✓ Vector 2: Private key derives correct public key
✓ Vector 3: Public key hash matches expected
```

### Signing Vectors
```typescript
✓ Vector 1: Sign("hello") produces expected signature
✓ Vector 2: Sign with different seed produces different signature
✓ Vector 3: Same message+key produces same signature (determinism)
```

### Verification Vectors
```typescript
✓ Vector 1: Valid signature verifies correctly
✓ Vector 2: Invalid signature rejected
✓ Vector 3: Tampered message fails verification
```

### Hash Function Vectors
```typescript
✓ SHA-256("test") = expected hash
✓ SHA-3("test") = expected hash
✓ Hash chain produces expected results
```

### Encoding Vectors
```typescript
✓ Base32 encoding matches expected
✓ Hex encoding matches expected
✓ Binary serialization matches expected
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework

### Dependencies
- WOTS implementation being tested
- Cryptographic hash functions (SHA-256, SHA-3)
- Encoding utilities (Base32, Hex)

### Test Vector Sources
Test vectors typically come from:
- Reference implementations (Python, Go, Rust)
- Cryptographic standards (NIST, IETF RFCs)
- Academic papers
- Other verified libraries

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test test/golden-vectors.test.ts
```

### Run with verbose output to see vector details:
```bash
cd packages/totem-extension
npm test -- --verbose test/golden-vectors.test.ts
```

### Run specific vector:
```bash
cd packages/totem-extension
npm test -- --testNamePattern="Vector 1" test/golden-vectors.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  test/golden-vectors.test.ts
  Golden Vectors
    Key Generation
      ✓ Vector 1: Seed → Private Key (5ms)
      ✓ Vector 2: Private Key → Public Key (3ms)
      ✓ Vector 3: Public Key Hash (2ms)
    Signing
      ✓ Vector 1: Sign("hello") (245ms)
      ✓ Vector 2: Different seed (198ms)
      ✓ Vector 3: Determinism (234ms)
    Verification
      ✓ Vector 1: Valid signature (123ms)
      ✓ Vector 2: Invalid rejected (45ms)
      ✓ Vector 3: Tampered fails (56ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

### What Passing Tests Indicate
- ✅ Cryptographic implementation is correct
- ✅ Compatible with reference implementations
- ✅ No regression in crypto primitives
- ✅ Ready for production use

## Common Issues

### Issue: "Vector 1: Sign produces expected signature" fails
**Cause**: Implementation differs from reference  
**Solution**: Compare implementations step-by-step:
```typescript
// Debug each step
const privateKey = generatePrivateKey(seed);
console.log('Private key:', privateKey);
console.log('Expected:', goldenVector.expectedPrivateKey);

const signature = sign(message, privateKey);
console.log('Signature:', signature);
console.log('Expected:', goldenVector.expectedSignature);
```

### Issue: Off-by-one errors in signature
**Cause**: Array indexing or bit manipulation error  
**Solution**: Check index calculations:
```typescript
// Common mistake
for (let i = 0; i <= array.length; i++) { // WRONG: <= instead of <
  
// Correct
for (let i = 0; i < array.length; i++) {
```

### Issue: Hash output doesn't match
**Cause**: Different hash implementation or endianness  
**Solution**: Verify hash function:
```typescript
import { sha256 } from 'your-hash-lib';

// Test basic hash
const testInput = Buffer.from('test', 'utf8');
const result = sha256(testInput);
const expected = Buffer.from('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', 'hex');

console.log('Match:', result.equals(expected));
```

### Issue: Signatures verify but don't match golden vector
**Cause**: Non-deterministic signature generation  
**Solution**: Ensure determinism:
```typescript
// Bad: Random nonce
const signature = sign(message, privateKey, randomNonce());

// Good: Deterministic nonce
const signature = sign(message, privateKey); // Uses deterministic nonce
```

### Issue: Encoding differences cause mismatch
**Cause**: Different encoding format  
**Solution**: Normalize encoding:
```typescript
// Ensure consistent encoding
function normalizeHex(hex: string): string {
  return hex.toLowerCase().replace(/^0x/, '');
}

expect(normalizeHex(actual)).toBe(normalizeHex(expected));
```

### Debugging Tips

1. **Compare intermediate values**:
```typescript
test('Vector 1', () => {
  const steps = {
    seed: vector.seed,
    privateKey: generatePrivateKey(vector.seed),
    publicKey: derivePublicKey(privateKey),
    signature: sign(vector.message, privateKey)
  };
  
  console.log('Steps:', steps);
  console.log('Expected:', vector);
});
```

2. **Binary comparison**:
```typescript
function compareBinary(a: Buffer, b: Buffer) {
  if (a.length !== b.length) {
    console.log('Length mismatch:', a.length, 'vs', b.length);
    return false;
  }
  
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      console.log(`Byte ${i}: ${a[i]} !== ${b[i]}`);
      return false;
    }
  }
  
  return true;
}
```

3. **Test against reference implementation**:
```python
# Python reference
from wots import sign

signature = sign(message, private_key)
print('Reference signature:', signature.hex())

# Compare to your JS implementation
```

4. **Incremental verification**:
```typescript
// Test each step
expect(step1_output).toEqual(vector.step1_expected);
expect(step2_output).toEqual(vector.step2_expected);
expect(step3_output).toEqual(vector.step3_expected);
// etc.
```

---

**Last Updated**: October 28, 2025
