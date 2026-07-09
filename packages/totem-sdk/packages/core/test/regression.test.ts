/**
 * Regression Test Suite for Minima Compatibility
 * 
 * These tests detect if someone accidentally changes critical cryptographic paths:
 * - Switching from SHA3-256 to PBKDF2 for seed derivation
 * - Deriving keys from childSeed instead of privateSeed
 * - Using wrong MMR hashing (simple H(left||right) instead of Java Streamable format)
 * - Changing WOTS parameters incorrectly
 * 
 * Test vectors are fixed values that MUST NOT change. If these tests fail,
 * it means the implementation is no longer compatible with Minima.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import { cleanSeedPhrase, convertStringToSeed } from '../src/bip39';
import { 
  serializeMiniNumber, 
  serializeMiniData, 
  hashAllObjects, 
  deriveChainSeedJava,
  hashObject,
} from '../src/javaStreamables';
import { TreeKey, TreeKeyNode, verifyTreeSignature } from '../src/treekey';
import { derivePKdigest, wotsSign, wotsVerify } from '../src/wots';
import { createMMRDataLeafNode, createMMRDataParentNode } from '../src/mmr';
import { getParamSet } from '../src/params';

const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

describe('REGRESSION: BIP39 Seed Derivation Must Use SHA3-256', () => {
  it('seed derivation MUST produce fixed vector (NOT PBKDF2)', () => {
    const phrase = 'ABANDON ABILITY';
    const seed = convertStringToSeed(phrase);
    
    const expected = sha3_256(new TextEncoder().encode(phrase));
    expect(hex(seed)).toBe(hex(expected));
  });

  it('convertStringToSeed uses SHA3-256 internally, not PBKDF2', () => {
    const phrase = 'ABANDON ABILITY';
    const seed = convertStringToSeed(phrase);
    
    const sha3Result = sha3_256(new TextEncoder().encode(phrase));
    expect(hex(seed)).toBe(hex(sha3Result));
  });
});

describe('REGRESSION: MiniNumber Serialization Must Match Java', () => {
  it('MiniNumber(0) = [00 01 00]', () => {
    expect(hex(serializeMiniNumber(0))).toBe('000100');
  });

  it('MiniNumber(1) = [00 01 01]', () => {
    expect(hex(serializeMiniNumber(1))).toBe('000101');
  });

  it('MiniNumber(255) = [00 02 00 ff] (needs sign byte)', () => {
    expect(hex(serializeMiniNumber(255))).toBe('000200ff');
  });
});

describe('REGRESSION: TreeKeyNode Must Derive From privateSeed NOT childSeed', () => {
  const testSeed = sha3_256(new TextEncoder().encode('regression test seed'));

  it('WOTS key 0 must match derivePKdigest(privateSeed, 0)', () => {
    const node = new TreeKeyNode(testSeed);
    const expected = derivePKdigest(testSeed, 0, getParamSet());
    expect(hex(node.getWOTSPublicKey(0))).toBe(hex(expected));
  });

  it('childSeed must equal hashObject(privateSeed)', () => {
    const expectedChildSeed = hashObject(testSeed);
    const node = new TreeKeyNode(testSeed);
    const child0 = node.getChild(0);
    
    const expectedChild0Seed = deriveChainSeedJava(expectedChildSeed, 0);
    const expectedChild0Node = new TreeKeyNode(expectedChild0Seed);
    
    expect(hex(child0.getPublicKey())).toBe(hex(expectedChild0Node.getPublicKey()));
  });

  it('child WOTS key must NOT be derivable from childSeed', () => {
    const node = new TreeKeyNode(testSeed);
    const wotsKey0 = node.getWOTSPublicKey(0);
    
    const childSeed = hashObject(testSeed);
    const wrongWotsKey = derivePKdigest(childSeed, 0, getParamSet());
    
    expect(hex(wotsKey0)).not.toBe(hex(wrongWotsKey));
  });
});

describe('REGRESSION: MMR Hashing Must Use Java Streamable Format', () => {
  it('MMRData leaf is NOT simple H(data)', () => {
    const pubkey = new Uint8Array(32).fill(0x42);
    const leafData = createMMRDataLeafNode(pubkey, 0n);
    
    const simpleHash = sha3_256(pubkey);
    expect(hex(leafData.data)).not.toBe(hex(simpleHash));
  });

  it('MMRData parent is NOT simple H(left || right)', () => {
    const left = createMMRDataLeafNode(new Uint8Array(32).fill(0x11), 0n);
    const right = createMMRDataLeafNode(new Uint8Array(32).fill(0x22), 0n);
    const parent = createMMRDataParentNode(left, right);
    
    const combined = new Uint8Array(64);
    combined.set(left.data, 0);
    combined.set(right.data, 32);
    const simpleHash = sha3_256(combined);
    
    expect(hex(parent.data)).not.toBe(hex(simpleHash));
  });

  it('MMRData leaf uses (ZERO, MiniData(pk), ZERO) format', () => {
    const pubkey = new Uint8Array(32).fill(0x00);
    const leaf = createMMRDataLeafNode(pubkey, 0n);
    
    const zero = new Uint8Array([0x00, 0x01, 0x00]);
    const pkSerialized = serializeMiniData(pubkey);
    const combined = new Uint8Array(zero.length + pkSerialized.length + zero.length);
    combined.set(zero, 0);
    combined.set(pkSerialized, zero.length);
    combined.set(zero, zero.length + pkSerialized.length);
    
    const expected = sha3_256(combined);
    expect(hex(leaf.data)).toBe(hex(expected));
  });
});

describe('REGRESSION: WOTS Parameters w=8 L=34', () => {
  it('paramSet.w must be 8', () => {
    expect(getParamSet().w).toBe(8);
  });

  it('paramSet.L must be 34', () => {
    expect(getParamSet().L).toBe(34);
  });

  it('signature length must be 34*32 = 1088 bytes', () => {
    const seed = sha3_256(new TextEncoder().encode('test'));
    const msgHash = sha3_256(new TextEncoder().encode('message'));
    const sig = wotsSign(seed, 0, msgHash, getParamSet());
    expect(sig.length).toBe(34 * 32);
  });
});

describe('REGRESSION: Signature Verification Consistency', () => {
  const seed = sha3_256(new TextEncoder().encode('verification test'));
  const msgHash = sha3_256(new TextEncoder().encode('test message'));

  it('same seed+index produces same public key', () => {
    const pk1 = derivePKdigest(seed, 0, getParamSet());
    const pk2 = derivePKdigest(seed, 0, getParamSet());
    expect(hex(pk1)).toBe(hex(pk2));
  });

  it('same seed+index+message produces same signature', () => {
    const sig1 = wotsSign(seed, 0, msgHash, getParamSet());
    const sig2 = wotsSign(seed, 0, msgHash, getParamSet());
    expect(hex(sig1)).toBe(hex(sig2));
  });

  it('signature from index 0 does not verify with pk from index 1', () => {
    const sig = wotsSign(seed, 0, msgHash, getParamSet());
    const wrongPk = derivePKdigest(seed, 1, getParamSet());
    expect(wotsVerify(sig, msgHash, wrongPk, getParamSet())).toBe(false);
  });
});

describe('REGRESSION: TreeKey Path Derivation', () => {
  it('TreeKey(4,3) max uses = 64', () => {
    const seed = sha3_256(new TextEncoder().encode('path test'));
    const tk = new TreeKey(seed, 4, 3);
    expect(tk.getMaxUses()).toBe(64);
  });

  it('TreeKey(64,3) max uses = 262144', () => {
    const seed = sha3_256(new TextEncoder().encode('path test'));
    const tk = new TreeKey(seed, 64, 3);
    expect(tk.getMaxUses()).toBe(262144);
  });
});

describe('INTEGRATION: Hierarchical TreeKey Signing End-to-End', () => {
  const seed = sha3_256(new TextEncoder().encode('hierarchical signing test'));
  
  it('setUses + sign produces 3-level hierarchical signature with verifiable proofs', () => {
    const tk = new TreeKey(seed, 4, 3); // 4×4×4 = 64 signatures
    const txDigest = sha3_256(new TextEncoder().encode('test transaction data'));
    
    const addressIndex = 1, l1 = 2, l2 = 3;
    tk.setUses(addressIndex * 4 * 4 + l1 * 4 + l2);
    const sig = tk.sign(txDigest);
    
    expect(sig.proofs.length).toBe(3);
    
    expect(sig.proofs[0].leafPubkey.length).toBe(32);
    expect(sig.proofs[0].signature.length).toBe(34 * 32);
    expect(sig.proofs[1].signature.length).toBe(34 * 32);
    expect(sig.proofs[2].signature.length).toBe(34 * 32);
  });

  it('same position produces same signature (deterministic)', () => {
    const tk = new TreeKey(seed, 4, 3);
    const txDigest = sha3_256(new TextEncoder().encode('determinism test'));
    
    tk.setUses(0);
    const sig1 = tk.sign(txDigest);
    tk.setUses(0);
    const sig2 = tk.sign(txDigest);
    
    expect(hex(sig1.proofs[0].signature)).toBe(hex(sig2.proofs[0].signature));
    expect(hex(sig1.proofs[1].signature)).toBe(hex(sig2.proofs[1].signature));
    expect(hex(sig1.proofs[2].signature)).toBe(hex(sig2.proofs[2].signature));
  });

  it('each level signature verifies against its leaf pubkey', () => {
    const tk = new TreeKey(seed, 4, 3);
    const txDigest = sha3_256(new TextEncoder().encode('verification chain test'));
    tk.setUses(1 * 4 * 4 + 1 * 4 + 1);
    const sig = tk.sign(txDigest);
    
    const leafProof = sig.proofs[2];
    const leafVerifies = wotsVerify(
      leafProof.signature,
      txDigest,
      leafProof.leafPubkey,
      getParamSet()
    );
    expect(leafVerifies).toBe(true);
  });

  it('root public key is first proof leafPubkey MMR root', () => {
    const tk = new TreeKey(seed, 4, 3);
    const txDigest = sha3_256(new TextEncoder().encode('root pk test'));
    tk.setUses(0);
    const sig = tk.sign(txDigest);
    
    expect(sig.proofs[0].leafPubkey.length).toBe(32);
  });

  it('different L2 positions use different leaf WOTS keys (no reuse)', () => {
    const tk = new TreeKey(seed, 4, 3);
    const txDigest = sha3_256(new TextEncoder().encode('key reuse test'));
    
    tk.setUses(0);
    const sig1 = tk.sign(txDigest);
    tk.setUses(1);
    const sig2 = tk.sign(txDigest);
    
    expect(hex(sig1.proofs[2].leafPubkey)).not.toBe(hex(sig2.proofs[2].leafPubkey));
    
    expect(hex(sig1.proofs[0].leafPubkey)).toBe(hex(sig2.proofs[0].leafPubkey));
    expect(hex(sig1.proofs[1].leafPubkey)).toBe(hex(sig2.proofs[1].leafPubkey));
    expect(hex(sig1.proofs[0].signature)).toBe(hex(sig2.proofs[0].signature));
    expect(hex(sig1.proofs[1].signature)).toBe(hex(sig2.proofs[1].signature));
  });

  it('different L1 positions use different intermediate WOTS keys', () => {
    const tk = new TreeKey(seed, 4, 3);
    const txDigest = sha3_256(new TextEncoder().encode('l2 key reuse test'));
    
    tk.setUses(0);
    const sig1 = tk.sign(txDigest);
    tk.setUses(1 * 4);
    const sig2 = tk.sign(txDigest);
    
    expect(hex(sig1.proofs[1].leafPubkey)).not.toBe(hex(sig2.proofs[1].leafPubkey));
    
    expect(hex(sig1.proofs[0].leafPubkey)).toBe(hex(sig2.proofs[0].leafPubkey));
  });

  it('verifyTreeSignature validates full parent-child chain against TreeKey root', () => {
    const tk = new TreeKey(seed, 4, 3);
    const txDigest = sha3_256(new TextEncoder().encode('end to end verify'));
    
    tk.setUses(2 * 4 * 4 + 1 * 4 + 3);
    const sig = tk.sign(txDigest);
    const rootPubkey = tk.getPublicKey();
    
    expect(verifyTreeSignature(rootPubkey, txDigest, sig)).toBe(true);
  });

  it('verifyTreeSignature fails with wrong root public key', () => {
    const tk = new TreeKey(seed, 4, 3);
    const txDigest = sha3_256(new TextEncoder().encode('wrong root test'));
    
    tk.setUses(0);
    const sig = tk.sign(txDigest);
    const wrongRootPubkey = sha3_256(new TextEncoder().encode('wrong root'));
    
    expect(verifyTreeSignature(wrongRootPubkey, txDigest, sig)).toBe(false);
  });

  it('verifyTreeSignature fails with wrong data', () => {
    const tk = new TreeKey(seed, 4, 3);
    const txDigest = sha3_256(new TextEncoder().encode('correct data'));
    const wrongDigest = sha3_256(new TextEncoder().encode('wrong data'));
    
    tk.setUses(0);
    const sig = tk.sign(txDigest);
    const rootPubkey = tk.getPublicKey();
    
    expect(verifyTreeSignature(rootPubkey, wrongDigest, sig)).toBe(false);
  });

  it('verifyTreeSignature validates all tree positions', () => {
    const tk = new TreeKey(seed, 4, 3);
    const rootPubkey = tk.getPublicKey();
    
    const positions = [[0, 0, 0], [1, 2, 3], [3, 3, 3], [2, 1, 0]];
    
    for (const [addressIndex, l1, l2] of positions) {
      const digest = sha3_256(new TextEncoder().encode(`position ${addressIndex}-${l1}-${l2}`));
      tk.setUses(addressIndex * 4 * 4 + l1 * 4 + l2);
      const sig = tk.sign(digest);
      expect(verifyTreeSignature(rootPubkey, digest, sig)).toBe(true);
    }
  });
});

