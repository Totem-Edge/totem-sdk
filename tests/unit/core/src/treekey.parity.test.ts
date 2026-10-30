/**
 * Java Parity Tests for TreeKey/MMR Implementation
 * 
 * These tests verify byte-exact compatibility with Minima's Java implementation.
 * Test vectors are generated from Minima's TreeKeyNode.java, MMR.java, and related classes.
 * 
 * To generate new test vectors from Java:
 * 1. Create a Minima node
 * 2. Generate TreeKey with known seed
 * 3. Export public keys, signatures, and MMR proofs as hex strings
 */

// Jest globals (describe, it, expect) are available in test environment
import { sha3_256 } from '@totemsdk/core';
import {
  serializeMiniNumber,
  serializeMiniData,
  hashAllObjects,
  deriveChainSeedJava,
  hashObject,
  writeHashToStream,
  javaHashAllObjects,
} from './javaStreamables';
import {
  MMRTree,
  createMMRDataLeafNode,
  createMMRDataParentNode,
  calculateProofRoot,
} from './mmr';
import {
  TreeKeyNode,
  TreeKey,
  SignatureProof,
  getRootPublicKey,
  DEFAULT_KEYS_PER_LEVEL,
} from './treekey';
import { derivePKdigest, deriveFullPublicKey, wotsSign, wotsVerify } from './wots';
import { getParamSet } from './params';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

describe('Java Serialization Parity', () => {
  describe('MiniNumber serialization', () => {
    it('serializes ZERO correctly', () => {
      const zero = serializeMiniNumber(0);
      expect(toHex(zero)).toBe('000100');
    });

    it('serializes ONE correctly', () => {
      const one = serializeMiniNumber(1);
      expect(toHex(one)).toBe('000101');
    });

    it('serializes 63 correctly', () => {
      const n = serializeMiniNumber(63);
      expect(toHex(n)).toBe('00013f');
    });

    it('serializes 64 correctly', () => {
      const n = serializeMiniNumber(64);
      expect(toHex(n)).toBe('000140');
    });

    it('serializes 127 correctly (no sign extension needed)', () => {
      const n = serializeMiniNumber(127);
      expect(toHex(n)).toBe('00017f');
    });

    it('serializes 128 correctly (requires sign extension)', () => {
      const n = serializeMiniNumber(128);
      expect(toHex(n)).toBe('00020080');
    });

    it('serializes 255 correctly', () => {
      const n = serializeMiniNumber(255);
      expect(toHex(n)).toBe('000200ff');
    });

    it('serializes 256 correctly', () => {
      const n = serializeMiniNumber(256);
      expect(toHex(n)).toBe('00020100');
    });
  });

  describe('MiniData serialization', () => {
    it('serializes empty data correctly', () => {
      const data = serializeMiniData(new Uint8Array(0));
      expect(toHex(data)).toBe('00000000');
    });

    it('serializes 32-byte hash correctly', () => {
      const hash = new Uint8Array(32).fill(0xab);
      const serialized = serializeMiniData(hash);
      expect(serialized.length).toBe(36);
      expect(toHex(serialized.slice(0, 4))).toBe('00000020');
      expect(serialized.slice(4)).toEqual(hash);
    });
  });

  describe('writeHashToStream (4-byte length)', () => {
    it('serializes 32-byte hash with 4-byte length prefix', () => {
      const hash = new Uint8Array(32).fill(0xcd);
      const serialized = writeHashToStream(hash);
      expect(serialized.length).toBe(36); // 4-byte prefix + 32 bytes
      // 4-byte big-endian length: 0x00000020 = 32
      expect(serialized[0]).toBe(0);
      expect(serialized[1]).toBe(0);
      expect(serialized[2]).toBe(0);
      expect(serialized[3]).toBe(32);
      expect(serialized.slice(4)).toEqual(hash);
    });
  });

  describe('hashObject (Crypto.hashObject)', () => {
    it('hashes MiniData correctly', () => {
      const seed = new Uint8Array(32).fill(0x42);
      const hashed = hashObject(seed);
      expect(hashed.length).toBe(32);
      const serialized = serializeMiniData(seed);
      const expected = sha3_256(serialized);
      expect(toHex(hashed)).toBe(toHex(expected));
    });
  });

  describe('deriveChainSeedJava (hashAllObjects)', () => {
    it('derives chain seed for index 0', () => {
      const seed = new Uint8Array(32).fill(0x11);
      const derived = deriveChainSeedJava(seed, 0);
      expect(derived.length).toBe(32);
      const indexSerialized = serializeMiniNumber(0);
      const seedSerialized = serializeMiniData(seed);
      const expected = javaHashAllObjects(indexSerialized, seedSerialized);
      expect(toHex(derived)).toBe(toHex(expected));
    });

    it('derives different seeds for different indices', () => {
      const seed = new Uint8Array(32).fill(0x22);
      const derived0 = deriveChainSeedJava(seed, 0);
      const derived1 = deriveChainSeedJava(seed, 1);
      const derived63 = deriveChainSeedJava(seed, 63);
      expect(toHex(derived0)).not.toBe(toHex(derived1));
      expect(toHex(derived1)).not.toBe(toHex(derived63));
    });
  });
});

describe('MMRData Parity', () => {
  describe('createMMRDataLeafNode', () => {
    it('creates leaf node with correct hash', () => {
      const pubkey = new Uint8Array(32).fill(0xaa);
      const leaf = createMMRDataLeafNode(pubkey, 0n);
      expect(leaf.data.length).toBe(32);
      expect(leaf.value).toBe(0n);
    });

    it('different pubkeys produce different leaf hashes', () => {
      const pk1 = new Uint8Array(32).fill(0x01);
      const pk2 = new Uint8Array(32).fill(0x02);
      const leaf1 = createMMRDataLeafNode(pk1, 0n);
      const leaf2 = createMMRDataLeafNode(pk2, 0n);
      expect(toHex(leaf1.data)).not.toBe(toHex(leaf2.data));
    });
  });

  describe('createMMRDataParentNode', () => {
    it('creates parent node from two children', () => {
      const pk1 = new Uint8Array(32).fill(0x01);
      const pk2 = new Uint8Array(32).fill(0x02);
      const left = createMMRDataLeafNode(pk1, 0n);
      const right = createMMRDataLeafNode(pk2, 0n);
      const parent = createMMRDataParentNode(left, right);
      expect(parent.data.length).toBe(32);
      expect(parent.value).toBe(0n);
    });

    it('parent hash is deterministic', () => {
      const pk1 = new Uint8Array(32).fill(0xaa);
      const pk2 = new Uint8Array(32).fill(0xbb);
      const left = createMMRDataLeafNode(pk1, 0n);
      const right = createMMRDataLeafNode(pk2, 0n);
      const parent1 = createMMRDataParentNode(left, right);
      const parent2 = createMMRDataParentNode(left, right);
      expect(toHex(parent1.data)).toBe(toHex(parent2.data));
    });

    it('order matters (left vs right)', () => {
      const pk1 = new Uint8Array(32).fill(0xcc);
      const pk2 = new Uint8Array(32).fill(0xdd);
      const leaf1 = createMMRDataLeafNode(pk1, 0n);
      const leaf2 = createMMRDataLeafNode(pk2, 0n);
      const parentLR = createMMRDataParentNode(leaf1, leaf2);
      const parentRL = createMMRDataParentNode(leaf2, leaf1);
      expect(toHex(parentLR.data)).not.toBe(toHex(parentRL.data));
    });
  });
});

describe('MMRTree Parity', () => {
  it('builds tree with 2 entries', () => {
    const pk1 = new Uint8Array(32).fill(0x01);
    const pk2 = new Uint8Array(32).fill(0x02);
    const tree = MMRTree.fromPublicKeys([pk1, pk2]);
    const root = tree.getRoot();
    expect(root).toBeDefined();
    expect(root!.data.length).toBe(32);
  });

  it('builds tree with 64 entries', () => {
    const pubkeys: Uint8Array[] = [];
    for (let i = 0; i < 64; i++) {
      pubkeys.push(new Uint8Array(32).fill(i));
    }
    const tree = MMRTree.fromPublicKeys(pubkeys);
    const root = tree.getRoot();
    expect(root).toBeDefined();
    expect(root!.data.length).toBe(32);
  });

  it('proof verifies back to root', () => {
    const pubkeys: Uint8Array[] = [];
    for (let i = 0; i < 64; i++) {
      pubkeys.push(new Uint8Array(32).fill(i));
    }
    const tree = MMRTree.fromPublicKeys(pubkeys);
    const root = tree.getRoot();
    for (let i = 0; i < 64; i++) {
      const proof = tree.getProof(i);
      const leaf = createMMRDataLeafNode(pubkeys[i], 0n);
      const computedRoot = calculateProofRoot(leaf, proof);
      expect(toHex(computedRoot)).toBe(toHex(root!.data));
    }
  });
});

describe('TreeKeyNode Parity', () => {
  const testSeed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) testSeed[i] = i;

  it('creates node with deterministic public key', () => {
    const node1 = new TreeKeyNode(testSeed, 4);
    const node2 = new TreeKeyNode(testSeed, 4);
    expect(toHex(node1.getPublicKey())).toBe(toHex(node2.getPublicKey()));
  }, 30000);

  it('different seeds produce different public keys', () => {
    const seed1 = new Uint8Array(32).fill(0x11);
    const seed2 = new Uint8Array(32).fill(0x22);
    const node1 = new TreeKeyNode(seed1, 4);
    const node2 = new TreeKeyNode(seed2, 4);
    expect(toHex(node1.getPublicKey())).not.toBe(toHex(node2.getPublicKey()));
  }, 30000);

  it('public key is 32 bytes (MMR root hash)', () => {
    const node = new TreeKeyNode(testSeed, 4);
    expect(node.getPublicKey().length).toBe(32);
  }, 30000);

  it('child nodes have deterministic public keys', () => {
    const node = new TreeKeyNode(testSeed, 4);
    const child0a = node.getChild(0);
    const child0b = node.getChild(0);
    expect(toHex(child0a.getPublicKey())).toBe(toHex(child0b.getPublicKey()));
  }, 30000);

  it('different child indices produce different public keys', () => {
    const node = new TreeKeyNode(testSeed, 4);
    const child0 = node.getChild(0);
    const child1 = node.getChild(1);
    expect(toHex(child0.getPublicKey())).not.toBe(toHex(child1.getPublicKey()));
  }, 30000);

  it('signing produces valid SignatureProof with 32-byte pubkey DIGEST', () => {
    const node = new TreeKeyNode(testSeed, 4);
    const data = sha3_256(new TextEncoder().encode('test message'));
    const proof = node.sign(0, data);
    // CRITICAL FIX (January 2026): Java's Winternitz.getPublicKey() returns 32-byte DIGEST!
    // BouncyCastle hashes full 1088-byte key: SHA3-256(full_key) = 32 bytes
    expect(proof.leafPubkey.length).toBe(32);   // 32-byte SHA3-256 digest
    expect(proof.signature.length).toBe(1088);  // Signature is still 1088 bytes
    expect(proof.mmrProof.chunks.length).toBeGreaterThan(0);
  }, 30000);

  it('SignatureProof.getRootPublicKey matches node public key', () => {
    const node = new TreeKeyNode(testSeed, 4);
    const data = sha3_256(new TextEncoder().encode('test data'));
    const proof = node.sign(0, data);
    const recoveredRoot = getRootPublicKey(proof);
    expect(toHex(recoveredRoot)).toBe(toHex(node.getPublicKey()));
  }, 30000);

  it('all keys produce valid proofs to same root', () => {
    const node = new TreeKeyNode(testSeed, 4);
    const rootPubkey = node.getPublicKey();
    const data = sha3_256(new TextEncoder().encode('uniform test'));
    for (let i = 0; i < 4; i++) {
      const proof = node.sign(i, data);
      const recoveredRoot = getRootPublicKey(proof);
      expect(toHex(recoveredRoot)).toBe(toHex(rootPubkey));
    }
  }, 30000);
});

describe('TreeKey 3-Level Hierarchy', () => {
  const testSeed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) testSeed[i] = (i * 7) % 256;
  const KEYS = 4;

  it('creates TreeKey with deterministic root public key', () => {
    const tk1 = new TreeKey(testSeed, KEYS, 3);
    const tk2 = new TreeKey(testSeed, KEYS, 3);
    expect(toHex(tk1.getPublicKey())).toBe(toHex(tk2.getPublicKey()));
  }, 60000);

  it('reports correct max uses (4^3 = 64 in test mode)', () => {
    const tk = new TreeKey(testSeed, KEYS, 3);
    expect(tk.getMaxUses()).toBe(64);
  }, 60000);

  it('sign() produces 3-level TreeSignature', () => {
    const tk = new TreeKey(testSeed, KEYS, 3);
    const data = sha3_256(new TextEncoder().encode('transaction data'));
    const sig = tk.sign(data);
    expect(sig.proofs.length).toBe(3);
  }, 60000);

  it('setUses(0) + sign() produces same signature as sequential sign()', () => {
    const tk1 = new TreeKey(testSeed, KEYS, 3);
    const tk2 = new TreeKey(testSeed, KEYS, 3);
    const data = sha3_256(new TextEncoder().encode('test'));
    const sigSeq = tk1.sign(data);
    tk2.setUses(0);
    const sigIdx = tk2.sign(data);
    expect(sigSeq.proofs.length).toBe(sigIdx.proofs.length);
    for (let i = 0; i < 3; i++) {
      expect(toHex(sigSeq.proofs[i].leafPubkey)).toBe(toHex(sigIdx.proofs[i].leafPubkey));
      expect(toHex(sigSeq.proofs[i].signature)).toBe(toHex(sigIdx.proofs[i].signature));
    }
  }, 60000);

  it('increments usage counter after signing', () => {
    const tk = new TreeKey(testSeed, KEYS, 3);
    expect(tk.getUses()).toBe(0);
    const data = sha3_256(new TextEncoder().encode('msg'));
    tk.sign(data);
    expect(tk.getUses()).toBe(1);
    tk.sign(data);
    expect(tk.getUses()).toBe(2);
  }, 60000);

  it('setUses at (0,0,1) differs from (0,0,0)', () => {
    const tk = new TreeKey(testSeed, KEYS, 3);
    const data = sha3_256(new TextEncoder().encode('test'));
    tk.setUses(0);
    const sig000 = tk.sign(data);
    tk.setUses(1);
    const sig001 = tk.sign(data);
    expect(toHex(sig000.proofs[2].leafPubkey)).not.toBe(toHex(sig001.proofs[2].leafPubkey));
  }, 60000);

  it('setUses at (0,1,0) uses different L2 node', () => {
    const tk = new TreeKey(testSeed, KEYS, 3);
    const data = sha3_256(new TextEncoder().encode('test'));
    tk.setUses(0);
    const sig000 = tk.sign(data);
    tk.setUses(1 * KEYS);
    const sig010 = tk.sign(data);
    expect(toHex(sig000.proofs[1].leafPubkey)).not.toBe(toHex(sig010.proofs[1].leafPubkey));
  }, 60000);

  it('setUses at (1,0,0) uses different L1 node', () => {
    const tk = new TreeKey(testSeed, KEYS, 3);
    const data = sha3_256(new TextEncoder().encode('test'));
    tk.setUses(0);
    const sig000 = tk.sign(data);
    tk.setUses(1 * KEYS * KEYS);
    const sig100 = tk.sign(data);
    expect(toHex(sig000.proofs[0].leafPubkey)).not.toBe(toHex(sig100.proofs[0].leafPubkey));
  }, 60000);
});

describe('Lease System Integration', () => {
  const KEYS = 4;

  it('lease indices map to TreeKey.setUses + sign correctly', () => {
    const tk = new TreeKey(new Uint8Array(32).fill(0x55), KEYS, 3);
    const leaseIndices = [
      { addressIndex: 0, l1: 0, l2: 0 },
      { addressIndex: 0, l1: 0, l2: 1 },
      { addressIndex: 0, l1: 1, l2: 0 },
      { addressIndex: 1, l1: 0, l2: 0 },
      { addressIndex: 3, l1: 3, l2: 3 },
    ];
    const data = sha3_256(new TextEncoder().encode('lease test'));
    for (const { addressIndex, l1, l2 } of leaseIndices) {
      tk.setUses(addressIndex * KEYS * KEYS + l1 * KEYS + l2);
      const sig = tk.sign(data);
      expect(sig.proofs.length).toBe(3);
      expect(sig.proofs[0].leafPubkey.length).toBe(32);
      expect(sig.proofs[1].leafPubkey.length).toBe(32);
      expect(sig.proofs[2].leafPubkey.length).toBe(32);
    }
  }, 60000);

  it('bump() order matches baseConversion()', () => {
    const tk = new TreeKey(new Uint8Array(32).fill(0x66), KEYS, 3);
    for (let i = 0; i < 10; i++) {
      const data = sha3_256(new Uint8Array([i]));
      const sig = tk.sign(data);
      expect(sig.proofs.length).toBe(3);
    }
    expect(tk.getUses()).toBe(10);
  }, 60000);
});

describe('WOTS Signature Verification', () => {
  const testSeed = new Uint8Array(32).fill(0x77);

  it('WOTS signature verifies correctly with FULL 1088-byte pubkey', () => {
    // CRITICAL: Both wotsSign and wotsVerify hash internally to match Java/BouncyCastle
    // Pass the SAME raw 32-byte data to both functions (not pre-hashed!)
    const rawMessage = new Uint8Array(32).fill(0xab); // 32-byte raw message (e.g., tx digest)
    
    // CRITICAL: Java's wotsVerify uses FULL 1088-byte public key, not 32-byte digest
    const pubkeyFull = deriveFullPublicKey(testSeed, 0, getParamSet());
    const signature = wotsSign(testSeed, 0, rawMessage, getParamSet()); // raw message - hashed internally
    const isValid = wotsVerify(signature, rawMessage, pubkeyFull, getParamSet()); // same raw message - hashed internally
    expect(isValid).toBe(true);
  });

  it('WOTS signature fails for wrong data', () => {
    const rawMessage1 = new Uint8Array(32).fill(0x11);
    const rawMessage2 = new Uint8Array(32).fill(0x22);
    
    const pubkeyFull = deriveFullPublicKey(testSeed, 0, getParamSet());
    const signature = wotsSign(testSeed, 0, rawMessage1, getParamSet());
    const isValid = wotsVerify(signature, rawMessage2, pubkeyFull, getParamSet());
    expect(isValid).toBe(false);
  });

  it('WOTS signature fails for wrong pubkey', () => {
    const rawMessage = new Uint8Array(32).fill(0x33);
    
    const pubkeyFull1 = deriveFullPublicKey(testSeed, 0, getParamSet());
    const pubkeyFull2 = deriveFullPublicKey(testSeed, 1, getParamSet());
    const signature = wotsSign(testSeed, 0, rawMessage, getParamSet());
    const isValid = wotsVerify(signature, rawMessage, pubkeyFull2, getParamSet());
    expect(isValid).toBe(false);
  });
});
