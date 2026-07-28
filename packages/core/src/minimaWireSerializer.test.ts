/**
 * Unit tests for Minima Wire Format Serialization
 * 
 * Tests byte-exact compatibility with Java Signature.java and SignatureProof.java
 */
import { describe, it, expect } from 'vitest';

import {
  serializeHierarchicalWitness,
  serializeMiniNumber,
  serializeMiniData,
  fromHex,
  toHex,
} from './minimaWireSerializer';

import {
  writeMiniNumber,
  writeMiniData,
  writeHashToStream,
  writeMMRData,
  writeMMRProof,
  writeSignatureProof,
  writeSignature,
  hexToBytes,
  bytesToHex,
  type MMRData,
  type MMRProofChunk,
  type MMRProof,
  type SignatureProof,
  type Signature,
} from './Streamable';

// Alias for test compatibility (tests use serialize* naming)
const serializeMMRData = writeMMRData;
const serializeMMRProof = writeMMRProof;
const serializeSignatureProof = writeSignatureProof;
const serializeSignature = writeSignature;

describe('MiniNumber Serialization', () => {
  it('serializes zero correctly', () => {
    const result = serializeMiniNumber(0n);
    expect(Array.from(result)).toEqual([0, 1, 0x00]);
  });

  it('serializes small positive integers', () => {
    const result = serializeMiniNumber(1n);
    expect(result[0]).toBe(0); // scale
    expect(result[1]).toBe(1); // length
    expect(result[2]).toBe(1); // value
  });

  it('serializes count of 3 (typical for hierarchical proofs)', () => {
    const result = serializeMiniNumber(3n);
    expect(Array.from(result)).toEqual([0, 1, 3]);
  });

  it('serializes larger numbers with proper length', () => {
    const result = serializeMiniNumber(256n);
    expect(result[0]).toBe(0); // scale
    expect(result[1]).toBe(2); // length (needs 2 bytes: 0x01 0x00)
    expect(result[2]).toBe(1);
    expect(result[3]).toBe(0);
  });

  it('adds leading zero for negative sign bit', () => {
    const result = serializeMiniNumber(128n);
    expect(result[0]).toBe(0); // scale
    expect(result[1]).toBe(2); // length (0x80 has high bit set, needs 0x00 prefix)
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(0x80);
  });
});

describe('MiniData Serialization', () => {
  it('serializes empty data with 4-byte zero length', () => {
    const result = serializeMiniData(new Uint8Array(0));
    expect(Array.from(result)).toEqual([0, 0, 0, 0]);
  });

  it('serializes 32-byte hash with proper length prefix', () => {
    const hash = new Uint8Array(32).fill(0xAB);
    const result = serializeMiniData(hash);
    
    expect(result.length).toBe(4 + 32);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(32);
    expect(result[4]).toBe(0xAB);
    expect(result[35]).toBe(0xAB);
  });

  it('serializes WOTS signature (34*32 = 1088 bytes)', () => {
    const signature = new Uint8Array(1088).fill(0xCD);
    const result = serializeMiniData(signature);
    
    expect(result.length).toBe(4 + 1088);
    expect((result[0] << 24) | (result[1] << 16) | (result[2] << 8) | result[3]).toBe(1088);
  });
});

describe('Hash Stream Writing', () => {
  it('writes 32-byte hash with 4-byte length prefix', () => {
    const hash = new Uint8Array(32).fill(0xEF);
    const result = writeHashToStream(hash);
    
    // 4-byte prefix + 32 bytes = 36 bytes total
    expect(result.length).toBe(36);
    // First 4 bytes are big-endian length (32 = 0x00000020)
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(32);
    // Hash data follows
    expect(result[4]).toBe(0xEF);
    expect(result[35]).toBe(0xEF);
  });

  it('rejects inputs over 64 bytes (MINIMA_MAX_HASH_LENGTH)', () => {
    expect(() => writeHashToStream(new Uint8Array(65))).toThrow('Hash too long');
  });
});

describe('MMRData Serialization', () => {
  it('serializes MMRData with hash (4-byte prefix) and value', () => {
    const mmrData: MMRData = {
      data: new Uint8Array(32).fill(0x11),
      value: 1n
    };
    
    const result = serializeMMRData(mmrData);
    // 4-byte length prefix + 32-byte hash + 3-byte MiniNumber = 39 bytes
    expect(result.length).toBe(4 + 32 + 3);
    // Length prefix (32 = 0x00000020)
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(32);
    // Hash data
    expect(result[4]).toBe(0x11);
    expect(result[35]).toBe(0x11);
    // MiniNumber value (1)
    expect(result[36]).toBe(0);  // scale
    expect(result[37]).toBe(1);  // length
    expect(result[38]).toBe(1);  // value
  });
});

describe('MMRProof Serialization', () => {
  it('serializes empty proof', () => {
    const proof: MMRProof = { blockTime: 0n, chunks: [] };
    const result = serializeMMRProof(proof);
    
    expect(result.length).toBe(6);
    expect(Array.from(result.slice(0, 3))).toEqual([0, 1, 0]);
    expect(Array.from(result.slice(3, 6))).toEqual([0, 1, 0]);
  });

  it('serializes proof with single chunk', () => {
    const chunk: MMRProofChunk = {
      isLeft: true,
      mmrData: {
        data: new Uint8Array(32).fill(0x22),
        value: 0n
      }
    };
    const proof: MMRProof = { blockTime: 0n, chunks: [chunk] };
    const result = serializeMMRProof(proof);
    
    const blockTimeLen = 3;
    const countLen = 3;
    // Chunk = 1 (isLeft) + 4 (hash length prefix) + 32 (hash) + 3 (MiniNumber.ZERO) = 40 bytes
    const chunkLen = 1 + 4 + 32 + 3;
    expect(result.length).toBe(blockTimeLen + countLen + chunkLen);
    
    // isLeft byte
    expect(result[blockTimeLen + countLen]).toBe(1);
    // First byte of hash length prefix (0x00)
    expect(result[blockTimeLen + countLen + 1]).toBe(0);
    // Fifth byte is first byte of hash data
    expect(result[blockTimeLen + countLen + 5]).toBe(0x22);
  });

  it('serializes isLeft correctly (0 or 1)', () => {
    const leftChunk: MMRProofChunk = {
      isLeft: true,
      mmrData: { data: new Uint8Array(32), value: 0n }
    };
    const rightChunk: MMRProofChunk = {
      isLeft: false,
      mmrData: { data: new Uint8Array(32), value: 0n }
    };
    
    const leftProof = serializeMMRProof({ blockTime: 0n, chunks: [leftChunk] });
    const rightProof = serializeMMRProof({ blockTime: 0n, chunks: [rightChunk] });
    
    // isLeft byte is at offset 6 (after blockTime[3] + count[3])
    expect(leftProof[6]).toBe(1);
    expect(rightProof[6]).toBe(0);
  });
});

describe('SignatureProof Serialization', () => {
  it('serializes complete SignatureProof', () => {
    const sigProof: SignatureProof = {
      leafPubkey: new Uint8Array(32).fill(0xAA),  // 32-byte WOTS digest
      signature: new Uint8Array(1088).fill(0xBB),
      mmrProof: { blockTime: 0n, chunks: [] }
    };
    
    const result = serializeSignatureProof(sigProof);
    
    const pubKeyLen = 4 + 32;  // 32-byte digest
    const sigLen = 4 + 1088;
    const proofLen = 6;
    expect(result.length).toBe(pubKeyLen + sigLen + proofLen);
    
    expect(result[0]).toBe(0);
    expect(result[3]).toBe(32);
    expect(result[4]).toBe(0xAA);
    
    expect(result[pubKeyLen + 3]).toBe(0x20);
  });
});

describe('Signature Serialization', () => {
  it('serializes signature with 3 proofs (hierarchical TreeKey)', () => {
    const createProof = (fill: number): SignatureProof => ({
      leafPubkey: new Uint8Array(32).fill(fill),  // 32-byte WOTS digest
      signature: new Uint8Array(1088).fill(fill),
      mmrProof: { blockTime: 0n, chunks: [] }
    });
    
    const signature: Signature = {
      proofs: [createProof(0x11), createProof(0x22), createProof(0x33)]
    };
    
    const result = serializeSignature(signature);
    
    expect(Array.from(result.slice(0, 3))).toEqual([0, 1, 3]);
    
    const proofSize = 4 + 32 + 4 + 1088 + 6;  // 32-byte digest, not 1088
    expect(result.length).toBe(3 + 3 * proofSize);
  });

  it('serializes signature count correctly', () => {
    const createProof = (): SignatureProof => ({
      leafPubkey: new Uint8Array(32),  // 32-byte WOTS digest
      signature: new Uint8Array(1088),
      mmrProof: { blockTime: 0n, chunks: [] }
    });
    
    const sig1: Signature = { proofs: [createProof()] };
    const sig3: Signature = { proofs: [createProof(), createProof(), createProof()] };
    
    expect(serializeSignature(sig1)[2]).toBe(1);
    expect(serializeSignature(sig3)[2]).toBe(3);
  });
});

describe('Hex Utilities', () => {
  it('converts hex to bytes', () => {
    const bytes = fromHex('0x0102030405');
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);
  });

  it('converts bytes to hex with 0x prefix', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    expect(toHex(bytes)).toBe('0x0102030405');
  });

  it('handles hex without 0x prefix', () => {
    const bytes = fromHex('abcdef');
    expect(Array.from(bytes)).toEqual([0xab, 0xcd, 0xef]);
  });
});

describe('Hierarchical Witness Serialization', () => {
  it('serializes complete hierarchical witness bundle', () => {
    const emptyProof = '0x' + '00010000010000';
    
    const bundle = {
      addressIndex: 0,
      l1: 0,
      l2: 0,
      rootPublicKey: '0x' + 'aa'.repeat(32),
      proofs: [
        {
          leafPubkey: '0x' + '11'.repeat(32),
          signature: '0x' + '22'.repeat(1088),
          mmrProof: emptyProof
        },
        {
          leafPubkey: '0x' + '33'.repeat(32),
          signature: '0x' + '44'.repeat(1088),
          mmrProof: emptyProof
        },
        {
          leafPubkey: '0x' + '55'.repeat(32),
          signature: '0x' + '66'.repeat(1088),
          mmrProof: emptyProof
        }
      ]
    };
    
    const result = serializeHierarchicalWitness(bundle);
    
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(1);
    expect(result[2]).toBe(3);
    
    expect(result.length).toBeGreaterThan(3300);
  });
});

import {
  serializeMMREntryNumber,
  serializeMMREntry,
  createMMREntryNumber,
  serializeMMRData as serializeMMRDataJava,
  type MMREntry as MMREntryType,
  type MMREntryNumber as MMREntryNumberType,
  type MMRData as MMRDataJavaType,
} from './javaStreamables';

describe('MMREntryNumber Serialization', () => {
  it('serializes ZERO correctly', () => {
    const entry: MMREntryNumberType = { scale: 0, unscaled: 0n };
    const result = serializeMMREntryNumber(entry);
    expect(Array.from(result)).toEqual([
      0, 1, 0,       // MiniNumber(scale=0): scale(0) + len(1) + data(0)
      0, 0, 0, 1, 0  // MiniData(unscaled): 4-byte len(1) + data(0)
    ]);
  });

  it('serializes small positive integers', () => {
    const entry = createMMREntryNumber(63n);
    const result = serializeMMREntryNumber(entry);
    expect(result[0]).toBe(0);  // scale byte
    expect(result[1]).toBe(1);  // length byte
    expect(result[2]).toBe(0);  // scale value = 0
    expect(result.slice(3, 7)).toEqual(new Uint8Array([0, 0, 0, 1]));  // MiniData length = 1
    expect(result[7]).toBe(63); // unscaled value
  });

  it('serializes 128 with sign extension', () => {
    const entry = createMMREntryNumber(128n);
    const result = serializeMMREntryNumber(entry);
    expect(result.slice(3, 7)).toEqual(new Uint8Array([0, 0, 0, 2]));  // MiniData length = 2
    expect(result[7]).toBe(0);   // leading zero for sign
    expect(result[8]).toBe(128); // value
  });
});

describe('MMREntry Serialization', () => {
  it('serializes complete MMREntry', () => {
    const hash = new Uint8Array(32).fill(0xab);
    const entry: MMREntryType = {
      row: 0,
      entryNumber: { scale: 0, unscaled: 5n },
      mmrData: { data: hash, value: 0n }
    };
    
    const result = serializeMMREntry(entry);
    expect(result[0]).toBe(0);  // row scale
    expect(result[1]).toBe(1);  // row length
    expect(result[2]).toBe(0);  // row value = 0
    
    expect(result.length).toBeGreaterThan(40);
  });

  it('serializes row 3 entry 10 correctly', () => {
    const hash = new Uint8Array(32).fill(0xff);
    const entry: MMREntryType = {
      row: 3,
      entryNumber: { scale: 0, unscaled: 10n },
      mmrData: { data: hash, value: 0n }
    };
    
    const result = serializeMMREntry(entry);
    expect(result[0]).toBe(0);  // row scale
    expect(result[1]).toBe(1);  // row length
    expect(result[2]).toBe(3);  // row value = 3
  });
});

describe('MMRData Java Serialization', () => {
  it('serializes MMRData with hash and zero value', () => {
    const hash = new Uint8Array(32).fill(0xcc);
    const mmrData: MMRDataJavaType = { data: hash, value: 0n };
    
    const result = serializeMMRDataJava(mmrData);
    expect(result[0]).toBe(0);  // 4-byte length prefix
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(32); // hash length
    expect(result.slice(4, 36)).toEqual(hash);
    expect(result.slice(36)).toEqual(new Uint8Array([0, 1, 0])); // MiniNumber.ZERO
  });
});

describe('MMRProof round-trip', () => {
  it('serializeMMRProof output can be parsed correctly', () => {
    const hash1 = new Uint8Array(32).fill(0xaa);
    const hash2 = new Uint8Array(32).fill(0xbb);
    const proof: MMRProof = {
      blockTime: 0n,
      chunks: [
        { isLeft: true, mmrData: { data: hash1, value: 0n } },
        { isLeft: false, mmrData: { data: hash2, value: 0n } }
      ]
    };
    
    const serialized = serializeMMRProof(proof);
    
    expect(serialized[0]).toBe(0);  // blockTime scale
    expect(serialized[1]).toBe(1);  // blockTime len
    expect(serialized[2]).toBe(0);  // blockTime value = 0
    expect(serialized[3]).toBe(0);  // chainLength scale
    expect(serialized[4]).toBe(1);  // chainLength len
    expect(serialized[5]).toBe(2);  // chainLength value = 2 (two chunks)
    
    const chunkSize = 1 + 4 + 32 + 3;  // isLeft + 4-byte prefix + 32-byte hash + MiniNumber.ZERO
    expect(serialized.length).toBe(6 + chunkSize * 2);
  });
});

describe('SDK consolidation verification', () => {
  it('serializeMMRProof produces consistent output across calls', () => {
    const hash1 = new Uint8Array(32);
    for (let i = 0; i < 32; i++) hash1[i] = i;
    const hash2 = new Uint8Array(32);
    for (let i = 0; i < 32; i++) hash2[i] = 255 - i;
    const hash3 = new Uint8Array(32).fill(0x42);
    
    const proof: MMRProof = {
      blockTime: 0n,
      chunks: [
        { isLeft: true, mmrData: { data: hash1, value: 0n } },
        { isLeft: false, mmrData: { data: hash2, value: 100n } },
        { isLeft: true, mmrData: { data: hash3, value: 1000000n } }
      ]
    };
    
    // Verify serializeMMRProof produces consistent byte-exact output
    const result1 = serializeMMRProof(proof);
    const result2 = serializeMMRProof(proof);
    
    expect(toHex(result1)).toBe(toHex(result2));
    expect(result1.length).toBe(result2.length);
    
    // Verify basic structure (exact size depends on value encoding)
    // Minimum: blockTime(3) + chainLen(3) + 3 * (isLeft(1) + lengthPrefix(4) + hash(32) + value)
    expect(result1.length).toBeGreaterThan(6 + 3 * (1 + 4 + 32)); // At least header + chunks without values
  });
  
  it('canonical serializer exports expected types', () => {
    // Verify the exported types can be used correctly
    const proof: MMRProof = { blockTime: 0n, chunks: [] };
    const result = serializeMMRProof(proof);
    
    // Empty proof should have: blockTime(3B) + chainLen(3B) = 6 bytes
    expect(result.length).toBe(6);
    expect(result[5]).toBe(0); // chainLen = 0
  });
});
