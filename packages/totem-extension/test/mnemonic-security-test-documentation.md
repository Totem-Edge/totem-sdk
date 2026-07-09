# Mnemonic Security Test Suite

| Property | Value |
|----------|-------|
| **Component** | BIP39 Mnemonic Generation & Validation |
| **Type** | Security Unit Test |
| **Framework** | Jest |

## Purpose

This test suite validates the security properties of BIP39 mnemonic phrase generation and validation in the Totem wallet. It ensures that:

1. **Cryptographic Randomness** - Mnemonics are generated with sufficient entropy
2. **BIP39 Compliance** - Mnemonics follow the BIP39 standard
3. **Checksum Validation** - Invalid mnemonics are rejected
4. **Word List Correctness** - Only valid BIP39 words are used
5. **Entropy Security** - Minimum entropy requirements met (128 or 256 bits)
6. **No Weak Seeds** - Common or predictable mnemonics are rejected

This is a **security-critical** test suite ensuring wallet seed phrases are cryptographically secure.

## Test Design

The test suite validates mnemonic security through multiple layers:

### Security Properties Tested
```
Mnemonic Security
├── Entropy
│   ├── Minimum 128 bits (12 words)
│   ├── Recommended 256 bits (24 words)
│   └── True randomness (not predictable)
├── BIP39 Compliance
│   ├── Valid word list
│   ├── Correct checksum
│   └── Proper encoding
├── Validation
│   ├── Reject invalid checksums
│   ├── Reject unknown words
│   └── Reject weak patterns
└── Attack Resistance
    ├── No dictionary words only
    ├── No sequential patterns
    └── Sufficient uniqueness
```

## Pass Requirements

For tests to pass:

1. **Generated mnemonics** must have 12 or 24 words
2. **All words** must be from the official BIP39 word list
3. **Checksum** must be valid for all generated mnemonics
4. **Entropy source** must use cryptographically secure random number generator (CSPRNG)
5. **Invalid mnemonics** must be rejected with clear error messages
6. **1000 generated mnemonics** must all be unique (no collisions)
7. **Weak patterns** (all same word, sequential, etc.) must be rejected

## Test Coverage

### Generation Tests
```typescript
✓ generates 12-word mnemonic
✓ generates 24-word mnemonic
✓ all words from BIP39 word list
✓ generated mnemonic has valid checksum
✓ uses CSPRNG (crypto.randomBytes)
```

### Validation Tests
```typescript
✓ validates correct 12-word mnemonic
✓ validates correct 24-word mnemonic
✓ rejects mnemonic with wrong checksum
✓ rejects mnemonic with invalid word
✓ rejects mnemonic with wrong word count
```

### Entropy Tests
```typescript
✓ 12-word mnemonic = 128 bits entropy
✓ 24-word mnemonic = 256 bits entropy
✓ entropy is truly random (chi-squared test)
✓ no repeated patterns
```

### Security Tests
```typescript
✓ rejects all same word ("abandon abandon...")
✓ rejects sequential patterns
✓ rejects common dictionary phrases
✓ 1000 generated mnemonics are unique
```

### BIP39 Compliance Tests
```typescript
✓ converts mnemonic to seed correctly
✓ seed derivation matches reference implementation
✓ supports all BIP39 languages (if implemented)
✓ checksum calculation correct
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework

### Dependencies
- BIP39 library (official or compatible)
- Crypto library (Node.js crypto or WebCrypto)
- BIP39 English word list

### Test Data
```javascript
const VALID_MNEMONIC_12 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const VALID_MNEMONIC_24 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
const INVALID_CHECKSUM = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon"; // Wrong last word
const INVALID_WORD = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invalid";
```

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test test/mnemonic-security.test.ts
```

### Run with coverage:
```bash
cd packages/totem-extension
npm test -- --coverage test/mnemonic-security.test.ts
```

### Run specific security test:
```bash
cd packages/totem-extension
npm test -- --testNamePattern="entropy" test/mnemonic-security.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  test/mnemonic-security.test.ts
  Mnemonic Security
    Generation
      ✓ generates 12-word mnemonic (15ms)
      ✓ generates 24-word mnemonic (12ms)
      ✓ uses BIP39 word list (3ms)
      ✓ valid checksum (5ms)
    Validation
      ✓ validates correct mnemonic (2ms)
      ✓ rejects wrong checksum (1ms)
      ✓ rejects invalid word (1ms)
      ✓ rejects wrong word count (1ms)
    Entropy
      ✓ 12-word = 128 bits (2ms)
      ✓ 24-word = 256 bits (2ms)
      ✓ truly random (45ms)
    Security
      ✓ rejects weak patterns (3ms)
      ✓ 1000 unique mnemonics (234ms)

Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
```

### Security Indicators
- ✅ Mnemonics are cryptographically secure
- ✅ BIP39 standard properly implemented
- ✅ Weak seeds cannot be generated
- ✅ Validation prevents user errors

## Common Issues

### Issue: "uses CSPRNG" fails - randomness not cryptographic
**Cause**: Using Math.random() instead of crypto  
**Solution**: Use cryptographically secure random:
```typescript
// BAD - NOT SECURE
function generateEntropy() {
  return Math.random().toString(); // NEVER USE THIS
}

// GOOD - CRYPTOGRAPHICALLY SECURE
import { randomBytes } from 'crypto';

function generateEntropy(bits: number): Buffer {
  return randomBytes(bits / 8);
}
```

### Issue: "rejects wrong checksum" doesn't throw
**Cause**: Checksum validation not implemented  
**Solution**: Implement BIP39 checksum validation:
```typescript
function validateMnemonic(mnemonic: string): boolean {
  const words = mnemonic.split(' ');
  
  // Check word count
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    return false;
  }
  
  // Check words are in word list
  if (!words.every(w => WORD_LIST.includes(w))) {
    return false;
  }
  
  // Verify checksum
  const indices = words.map(w => WORD_LIST.indexOf(w));
  const bits = indices.map(i => i.toString(2).padStart(11, '0')).join('');
  
  const checksumBits = words.length / 3;
  const dataBits = bits.slice(0, -checksumBits);
  const checksum = bits.slice(-checksumBits);
  
  const dataBytes = Buffer.from(dataBits.match(/.{1,8}/g).map(b => parseInt(b, 2)));
  const hash = sha256(dataBytes);
  const expectedChecksum = hash.toString('binary').slice(0, checksumBits);
  
  return checksum === expectedChecksum;
}
```

### Issue: "1000 unique mnemonics" fails (collisions found)
**Cause**: Weak random number generator  
**Solution**: Verify CSPRNG usage:
```typescript
test('1000 unique mnemonics', () => {
  const mnemonics = new Set();
  
  for (let i = 0; i < 1000; i++) {
    const mnemonic = generateMnemonic();
    
    // Check no collision
    expect(mnemonics.has(mnemonic)).toBe(false);
    mnemonics.add(mnemonic);
  }
  
  expect(mnemonics.size).toBe(1000);
});
```

### Issue: "truly random" test fails
**Cause**: Entropy test too strict or random source biased  
**Solution**: Use chi-squared test for randomness:
```typescript
function testEntropy(samples: number): boolean {
  const buckets = new Array(256).fill(0);
  
  for (let i = 0; i < samples; i++) {
    const entropy = generateEntropy(128);
    entropy.forEach(byte => buckets[byte]++);
  }
  
  // Chi-squared test
  const expected = samples / 256;
  const chiSquared = buckets.reduce((sum, count) => {
    return sum + Math.pow(count - expected, 2) / expected;
  }, 0);
  
  // Critical value for 255 degrees of freedom at 0.05 significance
  const critical = 293.25;
  
  return chiSquared < critical; // Pass if random enough
}
```

### Debugging Tips

1. **Verify BIP39 word list**:
```typescript
import { wordlist } from 'bip39/src/wordlists/english.json';
console.log('Word list length:', wordlist.length); // Should be 2048
console.log('First word:', wordlist[0]); // Should be "abandon"
console.log('Last word:', wordlist[2047]); // Should be "zoo"
```

2. **Test checksum calculation**:
```typescript
const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
console.log('Valid:', validateMnemonic(testMnemonic)); // Should be true

const wrongChecksum = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
console.log('Invalid:', validateMnemonic(wrongChecksum)); // Should be false
```

3. **Inspect entropy**:
```typescript
const entropy = generateEntropy(128);
console.log('Entropy bytes:', entropy.length); // Should be 16
console.log('Entropy hex:', entropy.toString('hex'));
console.log('All zeros:', entropy.every(b => b === 0)); // Should be false
console.log('All same:', entropy.every(b => b === entropy[0])); // Should be false
```

4. **Compare with reference implementation**:
```typescript
import * as bip39 from 'bip39';

const ourMnemonic = generateMnemonic();
console.log('Our mnemonic:', ourMnemonic);
console.log('Our validation:', validateMnemonic(ourMnemonic));
console.log('BIP39 validation:', bip39.validateMnemonic(ourMnemonic));

// Should match
```

---

**Last Updated**: October 28, 2025
