# WOTS Signing Test Suite

| Property | Value |
|----------|-------|
| **Component** | WOTS (Winternitz One-Time Signature) |
| **Type** | Cryptographic Unit Test |
| **Framework** | Jest |

## Purpose

This test suite validates the WOTS (Winternitz One-Time Signature) implementation used in the Totem wallet for post-quantum security. It ensures that:

1. **Key Generation** produces valid WOTS key pairs
2. **Signature Generation** creates correct WOTS signatures
3. **Signature Verification** validates signatures correctly
4. **One-Time Property** enforces single-use keys (prevents key reuse)
5. **Parameter Sets** support multiple security levels (w=4, w=8, w=16)
6. **Chain Functions** correctly implement hash chains
7. **Security Properties** meet WOTS specification requirements

WOTS is a quantum-resistant signature scheme critical for future-proofing the wallet.

## Test Design

The test suite validates WOTS at multiple levels:

### Test Structure
```
WOTS Tests
├── Key Generation
│   ├── Generate from seed
│   ├── Derive public key from private
│   └── Key pair validation
├── Signature Generation
│   ├── Sign message
│   ├── Signature format validation
│   └── Determinism check
├── Signature Verification
│   ├── Verify valid signature
│   ├── Reject invalid signature
│   └── Reject tampered message
├── Parameter Sets
│   ├── w=4 (high security, larger sig)
│   ├── w=8 (balanced)
│   └── w=16 (smaller sig, less secure)
├── One-Time Property
│   ├── Track key usage
│   ├── Prevent key reuse
│   └── Warn on attempted reuse
└── Hash Chain Tests
    ├── Chain function correctness
    ├── Chain length validation
    └── Checksum calculation
```

## Pass Requirements

For tests to pass:

1. **Key generation** must produce valid WOTS key pairs
2. **Signatures** must verify correctly for valid message+key pairs
3. **Invalid signatures** must be rejected (fail verification)
4. **Tampered messages** must fail verification
5. **One-time property** must prevent key reuse
6. **All parameter sets** (w=4,8,16) must work correctly
7. **Hash chains** must match WOTS specification
8. **Signature size** must match expected size for parameter set

## Test Coverage

### Key Generation Tests
```typescript
✓ generate WOTS key pair from seed
✓ private key has correct length
✓ public key derived from private key
✓ key generation is deterministic (same seed → same key)
✓ different seeds → different keys
```

### Signature Generation Tests
```typescript
✓ sign message with private key
✓ signature has correct length
✓ signature format valid
✓ same message+key → same signature (deterministic)
✓ different message → different signature
```

### Signature Verification Tests
```typescript
✓ verify valid signature
✓ reject signature with wrong public key
✓ reject signature for tampered message
✓ reject invalid signature format
✓ reject random bytes as signature
```

### Parameter Set Tests
```typescript
✓ w=4: generate, sign, verify
✓ w=8: generate, sign, verify
✓ w=16: generate, sign, verify
✓ signature size increases as w decreases
✓ security increases as w decreases
```

### One-Time Property Tests
```typescript
✓ can sign one message per key
✓ second signature with same key throws error
✓ watermark tracking prevents reuse
✓ different derived keys are independent
```

### Hash Chain Tests
```typescript
✓ chain(x, 0) = x
✓ chain(x, n) = hash^n(x)
✓ chain is deterministic
✓ checksum calculation correct
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework

### Dependencies
- SHA-256 hash function (Node.js crypto or WebCrypto)
- WOTS implementation
- Buffer utilities

### WOTS Parameters
```typescript
const WOTS_PARAMS = {
  w: 16,         // Winternitz parameter
  n: 32,         // Hash output length (SHA-256)
  len1: 64,      // Number of hash chains for message
  len2: 3,       // Number of hash chains for checksum
  len: 67        // Total chains (len1 + len2)
};
```

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test test/wots-signing.test.ts
```

### Run with coverage:
```bash
cd packages/totem-extension
npm test -- --coverage test/wots-signing.test.ts
```

### Run specific parameter set:
```bash
cd packages/totem-extension
npm test -- --testNamePattern="w=16" test/wots-signing.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  test/wots-signing.test.ts
  WOTS Signing
    Key Generation
      ✓ generate key pair (145ms)
      ✓ deterministic generation (98ms)
      ✓ different seeds (87ms)
    Signature Generation
      ✓ sign message (345ms)
      ✓ deterministic signing (298ms)
    Verification
      ✓ verify valid signature (234ms)
      ✓ reject wrong public key (123ms)
      ✓ reject tampered message (145ms)
    Parameter Sets
      ✓ w=4 works (456ms)
      ✓ w=8 works (298ms)
      ✓ w=16 works (234ms)
    One-Time Property
      ✓ prevents key reuse (45ms)
      ✓ watermark tracking (67ms)
    Hash Chains
      ✓ chain correctness (89ms)
      ✓ checksum calculation (56ms)

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Time:        3.456s
```

### What Passing Tests Indicate
- ✅ WOTS implementation correct
- ✅ Post-quantum security functional
- ✅ Signature verification reliable
- ✅ One-time property enforced

## Common Issues

### Issue: "verify valid signature" fails
**Cause**: Signature verification algorithm incorrect  
**Solution**: Implement WOTS verification correctly:
```typescript
function verify(message: Buffer, signature: number[][], publicKey: Buffer[]): boolean {
  // Hash message
  const msgHash = sha256(message);
  
  // Calculate checksum
  const checksum = calculateChecksum(msgHash, w);
  const combined = Buffer.concat([msgHash, checksum]);
  
  // Convert to base-w
  const baseW = toBaseW(combined, w, len);
  
  // Compute public key from signature
  const computedPubKey = [];
  for (let i = 0; i < len; i++) {
    const chainLength = (1 << w) - 1 - baseW[i];
    computedPubKey[i] = chain(signature[i], chainLength, w);
  }
  
  // Compare with provided public key
  return computedPubKey.every((val, i) => val.equals(publicKey[i]));
}
```

### Issue: "prevents key reuse" doesn't throw
**Cause**: No tracking of used keys  
**Solution**: Implement key usage tracking:
```typescript
class WOTSKeyManager {
  private usedKeys = new Set<string>();
  
  sign(message: Buffer, privateKey: Buffer, keyId: string): Signature {
    if (this.usedKeys.has(keyId)) {
      throw new Error('WOTS key already used! Generate new key.');
    }
    
    const signature = generateSignature(message, privateKey);
    this.usedKeys.add(keyId);
    
    return signature;
  }
}
```

### Issue: Signature size doesn't match expected
**Cause**: Incorrect calculation of signature length  
**Solution**: Calculate signature size correctly:
```typescript
function calculateSignatureSize(w: number, n: number): number {
  const len1 = Math.ceil((8 * n) / Math.log2(w));
  const len2 = Math.floor(Math.log2(len1 * (w - 1)) / Math.log2(w)) + 1;
  const len = len1 + len2;
  
  return len * n; // Each chain contributes n bytes
}

// For w=16, n=32:
// len1 = 64, len2 = 3, len = 67
// signature size = 67 * 32 = 2144 bytes
```

### Issue: "deterministic signing" fails (different signatures each time)
**Cause**: Using random values in signature generation  
**Solution**: Ensure determinism:
```typescript
function sign(message: Buffer, privateKey: Buffer[]): Buffer[] {
  // NO random nonce!
  const msgHash = sha256(message);
  const checksum = calculateChecksum(msgHash, w);
  const combined = Buffer.concat([msgHash, checksum]);
  const baseW = toBaseW(combined, w, len);
  
  const signature = [];
  for (let i = 0; i < len; i++) {
    // Deterministic: hash chain from private key
    signature[i] = chain(privateKey[i], baseW[i], w);
  }
  
  return signature;
}
```

### Debugging Tips

1. **Visualize hash chain**:
```typescript
function debugChain(x: Buffer, iterations: number): void {
  let current = x;
  console.log(`Chain start: ${current.toString('hex').slice(0, 16)}...`);
  
  for (let i = 0; i < iterations; i++) {
    current = sha256(current);
    console.log(`  ${i+1}: ${current.toString('hex').slice(0, 16)}...`);
  }
}

debugChain(Buffer.from('test'), 4);
```

2. **Check base-w conversion**:
```typescript
const msgHash = sha256(Buffer.from('test'));
const baseW = toBaseW(msgHash, 16, 64);
console.log('Base-16 values:', baseW);
console.log('All in range:', baseW.every(v => v >= 0 && v < 16));
```

3. **Verify signature components**:
```typescript
const signature = sign(message, privateKey);
console.log('Signature length:', signature.length); // Should be len
signature.forEach((sig, i) => {
  console.log(`Chain ${i} length:`, sig.length); // Should be n bytes
});
```

4. **Test with known vectors**:
```typescript
// Use test vectors from WOTS specification or other implementations
const knownVector = {
  seed: Buffer.from('...'),
  message: Buffer.from('...'),
  expectedSignature: Buffer.from('...')
};

const keys = generateKeys(knownVector.seed);
const signature = sign(knownVector.message, keys.private);
expect(signature).toEqual(knownVector.expectedSignature);
```

---

**Last Updated**: October 28, 2025
