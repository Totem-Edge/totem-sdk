/**
 * Streamable.parity.test.ts - Byte-for-Byte Java Parity Tests
 * 
 * These tests validate that our TypeScript serialization produces
 * byte-exact output matching Minima's Java implementation.
 * 
 * JAVA REFERENCE FILES (from attached_assets):
 * - MiniNumber_1767465037473.java: MiniNumber.writeDataStream()
 * - MiniData_1767465051037.java: MiniData.writeDataStream(), writeHashToStream()
 * - MMRData_1768742834148.java: MMRData.writeDataStream()
 * - MMRProof_1768740810861.java: MMRProof.writeDataStream(), MMRProofChunk.writeDataStream()
 * - SignatureProof_1768848582024.java: SignatureProof.writeDataStream()
 * - Signature_1767887681489.java: Signature.writeDataStream()
 * - Witness_1766887812428.java: Witness.writeDataStream()
 * 
 * Created: 2026-01-26
 * Purpose: Gate all serialization changes with Java parity validation
 */

// Jest test suite (SDK uses Jest, not Vitest)
import {
  hexToBytes,
  bytesToHex,
  concat,
  writeMiniByte,
  writeMiniData,
  writeMiniNumber,
  writeHashToStream,
  writeMMREntryNumber,
  bigIntToByteArray,
  writeMMRData,
  writeMMRProofChunk,
  writeMMRProof,
  writeSignatureProof,
  writeSignature,
  writeWitness,
  writeHierarchicalWitness,
  type MMRData,
  type MMRProofChunk,
  type MMRProof,
  type SignatureProof,
  type Signature,
} from '../Streamable';

/**
 * Helper to compare bytes and show diff on failure
 */
function expectBytesEqual(actual: Uint8Array, expected: Uint8Array, context: string = '') {
  const actualHex = bytesToHex(actual);
  const expectedHex = bytesToHex(expected);
  if (actualHex !== expectedHex) {
    console.error(`${context} Mismatch:`);
    console.error(`  Expected: ${expectedHex} (${expected.length} bytes)`);
    console.error(`  Actual:   ${actualHex} (${actual.length} bytes)`);
  }
  expect(actualHex).toBe(expectedHex);
}

describe('MiniNumber Serialization (Java Parity)', () => {
  /**
   * Java MiniNumber.writeDataStream():
   *   1 byte: scale (signed)
   *   1 byte: length of unscaled BigInteger data
   *   N bytes: unscaled BigInteger in two's complement
   */

  it('MiniNumber(0) → [0x00, 0x01, 0x00]', () => {
    const result = writeMiniNumber(0n, 0);
    expectBytesEqual(result, new Uint8Array([0x00, 0x01, 0x00]), 'MiniNumber(0)');
  });

  it('MiniNumber(1) → [0x00, 0x01, 0x01]', () => {
    const result = writeMiniNumber(1n, 0);
    expectBytesEqual(result, new Uint8Array([0x00, 0x01, 0x01]), 'MiniNumber(1)');
  });

  it('MiniNumber(127) → [0x00, 0x01, 0x7F]', () => {
    const result = writeMiniNumber(127n, 0);
    expectBytesEqual(result, new Uint8Array([0x00, 0x01, 0x7F]), 'MiniNumber(127)');
  });

  it('MiniNumber(128) → [0x00, 0x02, 0x00, 0x80] (needs leading zero)', () => {
    const result = writeMiniNumber(128n, 0);
    expectBytesEqual(result, new Uint8Array([0x00, 0x02, 0x00, 0x80]), 'MiniNumber(128)');
  });

  it('MiniNumber(255) → [0x00, 0x02, 0x00, 0xFF]', () => {
    const result = writeMiniNumber(255n, 0);
    expectBytesEqual(result, new Uint8Array([0x00, 0x02, 0x00, 0xFF]), 'MiniNumber(255)');
  });

  it('MiniNumber(256) → [0x00, 0x02, 0x01, 0x00]', () => {
    const result = writeMiniNumber(256n, 0);
    expectBytesEqual(result, new Uint8Array([0x00, 0x02, 0x01, 0x00]), 'MiniNumber(256)');
  });

  it('MiniNumber(65535) → [0x00, 0x03, 0x00, 0xFF, 0xFF]', () => {
    const result = writeMiniNumber(65535n, 0);
    expectBytesEqual(result, new Uint8Array([0x00, 0x03, 0x00, 0xFF, 0xFF]), 'MiniNumber(65535)');
  });

  it('MiniNumber with scale=2 (e.g., 123 with 2 decimal places)', () => {
    const result = writeMiniNumber(123n, 2);
    expectBytesEqual(result, new Uint8Array([0x02, 0x01, 0x7B]), 'MiniNumber(123, scale=2)');
  });
});

describe('MiniData Serialization (Java Parity)', () => {
  /**
   * Java MiniData.writeDataStream():
   *   4 bytes: big-endian int length
   *   N bytes: raw data
   */

  it('Empty MiniData → [0x00, 0x00, 0x00, 0x00]', () => {
    const result = writeMiniData(new Uint8Array(0));
    expectBytesEqual(result, new Uint8Array([0x00, 0x00, 0x00, 0x00]), 'Empty MiniData');
  });

  it('MiniData([0xAB]) → [0x00, 0x00, 0x00, 0x01, 0xAB]', () => {
    const result = writeMiniData(new Uint8Array([0xAB]));
    expectBytesEqual(result, new Uint8Array([0x00, 0x00, 0x00, 0x01, 0xAB]), 'MiniData(1 byte)');
  });

  it('MiniData(32-byte hash) → 4-byte len + 32 bytes', () => {
    const hash = new Uint8Array(32).fill(0xAA);
    const result = writeMiniData(hash);
    expect(result.length).toBe(36);
    expect(result[0]).toBe(0x00);
    expect(result[1]).toBe(0x00);
    expect(result[2]).toBe(0x00);
    expect(result[3]).toBe(0x20); // 32 in hex
    expect(result[4]).toBe(0xAA);
    expect(result[35]).toBe(0xAA);
  });
});

describe('writeHashToStream (Java Crypto.writeHashToStream Parity)', () => {
  /**
   * Java Crypto.writeHashToStream() is same as MiniData.writeDataStream()
   */

  it('32-byte hash → 4-byte len + 32 bytes', () => {
    const hash = hexToBytes('0x' + 'AB'.repeat(32));
    const result = writeHashToStream(hash);
    expect(result.length).toBe(36);
    expect(result[3]).toBe(0x20); // length = 32
  });
});

describe('MiniByte Serialization (Java Parity)', () => {
  /**
   * Java MiniByte.writeDataStream(): single byte
   */

  it('MiniByte(false) → [0x00]', () => {
    const result = writeMiniByte(false);
    expectBytesEqual(result, new Uint8Array([0x00]), 'MiniByte(false)');
  });

  it('MiniByte(true) → [0x01]', () => {
    const result = writeMiniByte(true);
    expectBytesEqual(result, new Uint8Array([0x01]), 'MiniByte(true)');
  });

  it('MiniByte(0) → [0x00]', () => {
    const result = writeMiniByte(0);
    expectBytesEqual(result, new Uint8Array([0x00]), 'MiniByte(0)');
  });

  it('MiniByte(255) → [0xFF]', () => {
    const result = writeMiniByte(255);
    expectBytesEqual(result, new Uint8Array([0xFF]), 'MiniByte(255)');
  });
});

describe('BigInt to ByteArray (Java BigInteger.toByteArray Parity)', () => {
  /**
   * Java BigInteger.toByteArray() uses two's complement:
   * - Zero → [0x00]
   * - Positive with high bit set → leading 0x00 byte
   */

  it('0n → [0x00]', () => {
    const result = bigIntToByteArray(0n);
    expectBytesEqual(result, new Uint8Array([0x00]), 'BigInt(0)');
  });

  it('1n → [0x01]', () => {
    const result = bigIntToByteArray(1n);
    expectBytesEqual(result, new Uint8Array([0x01]), 'BigInt(1)');
  });

  it('127n → [0x7F]', () => {
    const result = bigIntToByteArray(127n);
    expectBytesEqual(result, new Uint8Array([0x7F]), 'BigInt(127)');
  });

  it('128n → [0x00, 0x80] (two\'s complement needs leading zero)', () => {
    const result = bigIntToByteArray(128n);
    expectBytesEqual(result, new Uint8Array([0x00, 0x80]), 'BigInt(128)');
  });

  it('255n → [0x00, 0xFF]', () => {
    const result = bigIntToByteArray(255n);
    expectBytesEqual(result, new Uint8Array([0x00, 0xFF]), 'BigInt(255)');
  });

  it('256n → [0x01, 0x00]', () => {
    const result = bigIntToByteArray(256n);
    expectBytesEqual(result, new Uint8Array([0x01, 0x00]), 'BigInt(256)');
  });

  it('32767n → [0x7F, 0xFF]', () => {
    const result = bigIntToByteArray(32767n);
    expectBytesEqual(result, new Uint8Array([0x7F, 0xFF]), 'BigInt(32767)');
  });

  it('32768n → [0x00, 0x80, 0x00] (needs leading zero)', () => {
    const result = bigIntToByteArray(32768n);
    expectBytesEqual(result, new Uint8Array([0x00, 0x80, 0x00]), 'BigInt(32768)');
  });
});

describe('MMREntryNumber Serialization (Java Parity)', () => {
  /**
   * Java MMREntryNumber.writeDataStream():
   *   MiniNumber for scale (always 0 for integers)
   *   MiniData for unscaled BigInteger value
   * 
   * For value=0, scale=0:
   *   [00 01 00]           - MiniNumber: scale=0, len=1, data=0x00
   *   [00 00 00 01 00]     - MiniData: len=1, data=0x00
   */

  it('MMREntryNumber(0) → MiniNumber(0) + MiniData([0x00])', () => {
    const result = writeMMREntryNumber(0n, 0);
    const expected = concat(
      new Uint8Array([0x00, 0x01, 0x00]),      // MiniNumber for scale=0
      new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00]) // MiniData for value=0
    );
    expectBytesEqual(result, expected, 'MMREntryNumber(0)');
  });

  it('MMREntryNumber(1) → MiniNumber(0) + MiniData([0x01])', () => {
    const result = writeMMREntryNumber(1n, 0);
    const expected = concat(
      new Uint8Array([0x00, 0x01, 0x00]),      // MiniNumber for scale=0
      new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x01]) // MiniData for value=1
    );
    expectBytesEqual(result, expected, 'MMREntryNumber(1)');
  });
});

// ============================================================
// MMR STRUCTURE SERIALIZATION TESTS
// ============================================================

describe('MMRData Serialization (Java Parity)', () => {
  it('MMRData with 32-byte hash and value=0', () => {
    const hash = new Uint8Array(32).fill(0xAA);
    const mmrData: MMRData = { data: hash, value: 0n };
    const result = writeMMRData(mmrData);
    
    // Expected: writeHashToStream(32 bytes) + MiniNumber(0)
    // = [00 00 00 20] + <32 bytes> + [00 01 00]
    expect(result.length).toBe(4 + 32 + 3); // 39 bytes
    expect(result[0]).toBe(0x00); // length high byte
    expect(result[3]).toBe(0x20); // length = 32
    expect(result[4]).toBe(0xAA); // first hash byte
    expect(result[35]).toBe(0xAA); // last hash byte
    expect(result[36]).toBe(0x00); // MiniNumber scale
    expect(result[37]).toBe(0x01); // MiniNumber length
    expect(result[38]).toBe(0x00); // MiniNumber value = 0
  });

  it('MMRData with value=1', () => {
    const hash = new Uint8Array(32).fill(0x00);
    const mmrData: MMRData = { data: hash, value: 1n };
    const result = writeMMRData(mmrData);
    
    expect(result.length).toBe(39);
    expect(result[38]).toBe(0x01); // MiniNumber value = 1
  });
});

describe('MMRProofChunk Serialization (Java Parity)', () => {
  it('MMRProofChunk(isLeft=true)', () => {
    const hash = new Uint8Array(32).fill(0xBB);
    const chunk: MMRProofChunk = {
      isLeft: true,
      mmrData: { data: hash, value: 0n }
    };
    const result = writeMMRProofChunk(chunk);
    
    // Expected: MiniByte(1) + MMRData
    // = [01] + 39 bytes = 40 bytes
    expect(result.length).toBe(40);
    expect(result[0]).toBe(0x01); // isLeft = true
    expect(result[1]).toBe(0x00); // MMRData hash length high byte
  });

  it('MMRProofChunk(isLeft=false)', () => {
    const hash = new Uint8Array(32).fill(0xCC);
    const chunk: MMRProofChunk = {
      isLeft: false,
      mmrData: { data: hash, value: 0n }
    };
    const result = writeMMRProofChunk(chunk);
    
    expect(result[0]).toBe(0x00); // isLeft = false
  });
});

describe('MMRProof Serialization (Java Parity)', () => {
  it('Empty MMRProof with blockTime=0', () => {
    const proof: MMRProof = { blockTime: 0n, chunks: [] };
    const result = writeMMRProof(proof);
    
    // Expected: MiniNumber(0) + MiniNumber(0)
    // = [00 01 00] + [00 01 00] = 6 bytes
    expectBytesEqual(result, concat(
      new Uint8Array([0x00, 0x01, 0x00]), // blockTime = 0
      new Uint8Array([0x00, 0x01, 0x00])  // length = 0
    ), 'Empty MMRProof');
  });

  it('MMRProof with 1 chunk', () => {
    const hash = new Uint8Array(32).fill(0xDD);
    const proof: MMRProof = {
      blockTime: 0n,
      chunks: [{
        isLeft: true,
        mmrData: { data: hash, value: 0n }
      }]
    };
    const result = writeMMRProof(proof);
    
    // Expected: MiniNumber(0) + MiniNumber(1) + chunk(40 bytes)
    // = 3 + 3 + 40 = 46 bytes
    expect(result.length).toBe(46);
    expect(result[5]).toBe(0x01); // length = 1
  });
});

describe('SignatureProof Serialization (Java Parity)', () => {
  it('SignatureProof with 32-byte pubkey, empty proof', () => {
    const pubKey = new Uint8Array(32).fill(0x11);
    const signature = new Uint8Array(1088).fill(0x22);
    const sigProof: SignatureProof = {
      leafPubkey: pubKey,
      signature: signature,
      mmrProof: { blockTime: 0n, chunks: [] }
    };
    const result = writeSignatureProof(sigProof);
    
    // Expected: MiniData(32) + MiniData(1088) + MMRProof(6)
    // = (4+32) + (4+1088) + 6 = 36 + 1092 + 6 = 1134 bytes
    expect(result.length).toBe(1134);
    expect(result[3]).toBe(0x20); // pubkey length = 32
    // Signature length starts at byte 36 (after 4+32 pubkey bytes)
    // 1088 = 0x00000440 in big-endian
    expect(result[36]).toBe(0x00); // signature length byte 0
    expect(result[37]).toBe(0x00); // signature length byte 1
    expect(result[38]).toBe(0x04); // signature length byte 2 (1088 = 0x0440)
    expect(result[39]).toBe(0x40); // signature length byte 3
  });
});

describe('Signature Serialization (Java Parity)', () => {
  it('Empty Signature (no proofs)', () => {
    const sig: Signature = { proofs: [] };
    const result = writeSignature(sig);
    
    // Expected: MiniNumber(0) = [00 01 00]
    expectBytesEqual(result, new Uint8Array([0x00, 0x01, 0x00]), 'Empty Signature');
  });

  it('Signature with 1 proof', () => {
    const pubKey = new Uint8Array(32).fill(0x33);
    const signature = new Uint8Array(1088).fill(0x44);
    const sig: Signature = {
      proofs: [{
        leafPubkey: pubKey,
        signature: signature,
        mmrProof: { blockTime: 0n, chunks: [] }
      }]
    };
    const result = writeSignature(sig);
    
    // Expected: MiniNumber(1) + SignatureProof(1134)
    // = 3 + 1134 = 1137 bytes
    expect(result.length).toBe(1137);
    expect(result[2]).toBe(0x01); // length = 1
  });
});

describe('Witness/HierarchicalWitness Serialization (Java Parity)', () => {
  it('Empty Witness (no proofs)', () => {
    const witness = {
      signatures: [],
      coinProofs: [],
      scriptProofs: []
    };
    const result = writeWitness(witness);
    
    // Expected: 3x MiniNumber(0) = [00 01 00] [00 01 00] [00 01 00]
    expectBytesEqual(result, concat(
      new Uint8Array([0x00, 0x01, 0x00]),
      new Uint8Array([0x00, 0x01, 0x00]),
      new Uint8Array([0x00, 0x01, 0x00])
    ), 'Empty Witness');
  });

  it('Empty HierarchicalWitness', () => {
    const bundle = { signatures: [] };
    const result = writeHierarchicalWitness(bundle);
    
    // Expected: MiniNumber(0) = [00 01 00]
    expectBytesEqual(result, new Uint8Array([0x00, 0x01, 0x00]), 'Empty HierarchicalWitness');
  });
});
