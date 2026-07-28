# Minima Base32 Encoding Test Suite

| Property | Value |
|----------|-------|
| **Component** | Minima Base32 Encoder/Decoder |
| **Type** | Unit Test |
| **Framework** | Jest |

## Purpose

This test suite validates a custom Base32 encoding scheme optimized for minimal character set and human readability. It ensures that:

1. **Encoding Correctness** - Binary data correctly encodes to Base32 strings
2. **Decoding Correctness** - Base32 strings correctly decode to original binary
3. **Round-Trip Integrity** - encode(decode(x)) === x for all inputs
4. **Character Set** - Only uses allowed characters (A-Z, 2-7)
5. **Padding Handling** - Correctly applies and strips padding
6. **Edge Cases** - Empty input, single byte, max length handled correctly

Base32 is used for encoding binary data (keys, signatures) into human-readable strings suitable for mnemonic phrases or QR codes.

## Test Design

The test suite validates encoding/decoding with various inputs:

### Test Categories
```
Minima Base32 Tests
├── Encoding Tests
│   ├── Empty buffer → ""
│   ├── Single byte → base32
│   └── Multi-byte → base32
├── Decoding Tests
│   ├── "" → empty buffer
│   ├── base32 → binary
│   └── Invalid chars rejected
├── Round-Trip Tests
│   ├── encode → decode → original
│   └── Random data integrity
└── Edge Cases
    ├── Maximum length
    ├── Padding edge cases
    └── Character set boundaries
```

### Test Data
```typescript
const testVectors = [
  { input: Buffer.from([]), expected: "" },
  { input: Buffer.from([0x00]), expected: "AA======" },
  { input: Buffer.from([0xFF]), expected: "74======" },
  { input: Buffer.from("hello"), expected: "NBSWY3DP" },
  { input: Buffer.from("test"), expected: "ORSXG5A=" }
];
```

## Pass Requirements

For tests to pass:

1. **Encoding** must produce valid Base32 strings (only A-Z, 2-7, =)
2. **Decoding** must reproduce original binary data exactly
3. **Round-trip** must preserve data: `decode(encode(x)) === x`
4. **Invalid input** must throw errors (not silently fail)
5. **Edge cases** (empty, single byte) must work correctly
6. **Padding** must be correct according to Base32 spec

## Test Coverage

### Encoding Tests
```typescript
✓ encode(empty buffer) returns ""
✓ encode(single byte) returns valid base32
✓ encode("hello") returns "NBSWY3DP"
✓ encode("test") returns "ORSXG5A="
✓ encoded strings use only valid characters
✓ padding is correct
```

### Decoding Tests
```typescript
✓ decode("") returns empty buffer
✓ decode("NBSWY3DP") returns "hello"
✓ decode("ORSXG5A=") returns "test"
✓ decode handles padding correctly
✓ decode rejects invalid characters
✓ decode rejects invalid padding
```

### Round-Trip Tests
```typescript
✓ decode(encode(buffer)) === buffer
✓ works for all byte values 0-255
✓ works for random data
✓ works for various lengths (1-1000 bytes)
```

### Character Set Tests
```typescript
✓ output contains only [A-Z2-7=]
✓ no lowercase characters
✓ no numbers 0, 1, 8, 9
✓ padding only at end
```

### Edge Cases
```typescript
✓ zero-length input
✓ single byte input
✓ maximum practical length (32KB)
✓ all-zero buffer
✓ all-255 buffer
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework

### Dependencies
- Base32 encoder/decoder implementation
- Buffer support (Node.js built-in)

### No External Config
Tests are self-contained with inline test vectors.

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test test/minima-base32.test.ts
```

### Run with coverage:
```bash
cd packages/totem-extension
npm test -- --coverage test/minima-base32.test.ts
```

### Run specific test:
```bash
cd packages/totem-extension
npm test -- --testNamePattern="round-trip" test/minima-base32.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  test/minima-base32.test.ts
  Minima Base32
    Encoding
      ✓ encode empty buffer (2ms)
      ✓ encode single byte (1ms)
      ✓ encode "hello" (1ms)
      ✓ encode "test" (1ms)
    Decoding
      ✓ decode empty string (1ms)
      ✓ decode "NBSWY3DP" (1ms)
      ✓ decode with padding (1ms)
      ✓ reject invalid characters (2ms)
    Round-Trip
      ✓ preserves binary data (5ms)
      ✓ works for random data (8ms)
    Edge Cases
      ✓ zero-length input (1ms)
      ✓ max length (12ms)

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
```

### What Passing Tests Indicate
- ✅ Base32 implementation correct
- ✅ Data integrity maintained
- ✅ Compatible with standard Base32
- ✅ Ready for production use

## Common Issues

### Issue: "encode 'hello'" produces wrong output
**Cause**: Incorrect bit manipulation  
**Solution**: Check encoding algorithm:
```typescript
function encode(buffer: Buffer): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  
  // Add padding
  while (output.length % 8 !== 0) {
    output += '=';
  }
  
  return output;
}
```

### Issue: Round-trip fails for certain inputs
**Cause**: Padding not handled correctly  
**Solution**: Strip padding before decoding:
```typescript
function decode(str: string): Buffer {
  str = str.replace(/=/g, ''); // Remove padding
  // Then decode
}
```

### Issue: "reject invalid characters" doesn't throw
**Cause**: No input validation  
**Solution**: Add validation:
```typescript
function decode(str: string): Buffer {
  const valid = /^[A-Z2-7=]*$/;
  if (!valid.test(str)) {
    throw new Error('Invalid Base32 string');
  }
  // Continue decoding
}
```

### Issue: Off-by-one in length calculations
**Cause**: Bit shift errors  
**Solution**: Carefully track bit counts:
```typescript
// When encoding
while (bits >= 5) {  // Not bits > 5
  // Extract 5 bits
  output += ALPHABET[(value >>> (bits - 5)) & 0x1F]; // 0x1F = 31 = 5 bits
  bits -= 5;
}
```

### Debugging Tips

1. **Visualize bit operations**:
```typescript
function encodeByte(byte: number): void {
  console.log('Input byte:', byte.toString(2).padStart(8, '0'));
  console.log('Split into 5-bit chunks...');
  // Show the splitting
}
```

2. **Compare with known implementation**:
```typescript
import * as base32 from 'base32-encode';

const input = Buffer.from('test');
const expected = base32.encode(input);
const actual = minimaBase32.encode(input);

console.log('Expected:', expected);
console.log('Actual:', actual);
console.log('Match:', expected === actual);
```

3. **Test byte-by-byte**:
```typescript
for (let i = 0; i < 256; i++) {
  const input = Buffer.from([i]);
  const encoded = encode(input);
  const decoded = decode(encoded);
  
  if (decoded[0] !== i) {
    console.log(`Failed for byte ${i}`);
    console.log('Encoded:', encoded);
    console.log('Decoded:', decoded[0]);
  }
}
```

4. **Check padding logic**:
```typescript
const testCases = [
  { length: 1, expectedPadding: 6 },
  { length: 2, expectedPadding: 4 },
  { length: 3, expectedPadding: 3 },
  { length: 4, expectedPadding: 1 },
  { length: 5, expectedPadding: 0 }
];

testCases.forEach(({ length, expectedPadding }) => {
  const input = Buffer.alloc(length);
  const encoded = encode(input);
  const paddingCount = (encoded.match(/=/g) || []).length;
  console.log(`Length ${length}: ${paddingCount} padding (expected ${expectedPadding})`);
});
```

---

**Last Updated**: October 28, 2025
