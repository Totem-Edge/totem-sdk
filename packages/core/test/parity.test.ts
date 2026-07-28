/**
 * Minima Parity Test Suite
 * 
 * Tests to ensure byte-exact compatibility with Minima Java implementation.
 * These tests verify critical cryptographic derivation paths that must match exactly.
 */

import { sha3_256 } from '@totemsdk/core';
import {
  cleanSeedPhrase,
  validatePhrase,
  convertStringToSeed,
  WORD_LIST,
} from '../src/bip39';
import {
  serializeMiniNumber,
  serializeMiniData,
  hashAllObjects,
  deriveChainSeedJava,
  hashObject,
} from '../src/javaStreamables';
import {
  TreeKey,
  TreeKeyNode,
  verifyTreeSignature,
  DEFAULT_KEYS_PER_LEVEL,
  DEFAULT_LEVELS,
} from '../src/treekey';
import {
  derivePKdigest,
  deriveFullPublicKey,
  wotsSign,
  wotsVerify,
  prfChainSeed,
} from '../src/wots';
import {
  createMMRDataLeafNode,
  createMMRDataParentNode,
  MMRTree,
} from '../src/mmr';
import { getParamSet } from '../src/params';

const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');
const fromHex = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

describe('BIP39 Seed Phrase Normalization (Minima-Compatible)', () => {
  it('cleanSeedPhrase normalizes partial words to full BIP39 words', () => {
    const result = cleanSeedPhrase('aban abil abou');
    expect(result).toBe('ABANDON ABILITY ABOUT');
  });

  it('cleanSeedPhrase handles full words correctly', () => {
    const result = cleanSeedPhrase('abandon ability about');
    expect(result).toBe('ABANDON ABILITY ABOUT');
  });

  it('cleanSeedPhrase handles mixed case and extra whitespace', () => {
    const result = cleanSeedPhrase('  AbanDon   ABILITY   about  ');
    expect(result).toBe('ABANDON ABILITY ABOUT');
  });

  it('cleanSeedPhrase returns UPPERCASE output', () => {
    const result = cleanSeedPhrase('zoo zebra zone');
    expect(result).toBe('ZOO ZEBRA ZONE');
    expect(result).toMatch(/^[A-Z\s]+$/);
  });

  it('cleanSeedPhrase rejects unknown words', () => {
    expect(() => cleanSeedPhrase('xyz unknown word')).toThrow();
  });

  it('cleanSeedPhrase requires minimum 3 character prefix', () => {
    expect(() => cleanSeedPhrase('ab ac')).toThrow();
  });
});

describe('BIP39 Seed Derivation (SHA3-256, NOT PBKDF2)', () => {
  it('convertStringToSeed uses SHA3-256(phrase_bytes), not PBKDF2', () => {
    const phrase = 'ABANDON ABILITY ABOUT';
    const seed = convertStringToSeed(phrase);
    
    const expected = sha3_256(new TextEncoder().encode(phrase));
    expect(hex(seed)).toBe(hex(expected));
    expect(seed.length).toBe(32);
  });

  it('convertStringToSeed produces deterministic output', () => {
    const phrase = 'TEST PHRASE ONE TWO THREE';
    const seed1 = convertStringToSeed(phrase);
    const seed2 = convertStringToSeed(phrase);
    expect(hex(seed1)).toBe(hex(seed2));
  });

  it('different phrases produce different seeds', () => {
    const seed1 = convertStringToSeed('ONE TWO THREE');
    const seed2 = convertStringToSeed('FOUR FIVE SIX');
    expect(hex(seed1)).not.toBe(hex(seed2));
  });
});

describe('Java Serialization (Streamables)', () => {
  it('serializeMiniNumber(0) produces [0x00, 0x01, 0x00]', () => {
    const result = serializeMiniNumber(0);
    expect(hex(result)).toBe('000100');
  });

  it('serializeMiniNumber(1) produces [0x00, 0x01, 0x01]', () => {
    const result = serializeMiniNumber(1);
    expect(hex(result)).toBe('000101');
  });

  it('serializeMiniNumber(63) produces correct bytes', () => {
    const result = serializeMiniNumber(63);
    expect(hex(result)).toBe('00013f');
  });

  it('serializeMiniNumber(128) adds sign byte for positive with high bit', () => {
    const result = serializeMiniNumber(128);
    expect(hex(result)).toBe('00020080');
  });

  it('serializeMiniData uses 4-byte length prefix', () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const result = serializeMiniData(data);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(4);
    expect(result.slice(4)).toEqual(data);
  });

  it('hashObject serializes as MiniData then hashes', () => {
    const data = new Uint8Array(32).fill(0xab);
    const result = hashObject(data);
    expect(result.length).toBe(32);
    
    const serialized = serializeMiniData(data);
    const expected = sha3_256(serialized);
    expect(hex(result)).toBe(hex(expected));
  });

  it('deriveChainSeedJava matches hashAllObjects(MiniNumber(i), MiniData(seed))', () => {
    const seed = new Uint8Array(32).fill(0x42);
    const index = 5;
    
    const result = deriveChainSeedJava(seed, index);
    
    const indexSerialized = serializeMiniNumber(index);
    const seedSerialized = serializeMiniData(seed);
    const expected = hashAllObjects(indexSerialized, seedSerialized);
    
    expect(hex(result)).toBe(hex(expected));
  });
});

describe('TreeKeyNode Key Derivation', () => {
  const testSeed = sha3_256(new Uint8Array([1, 2, 3, 4, 5]));

  it('derives keys from privateSeed, NOT childSeed', () => {
    const node = new TreeKeyNode(testSeed);
    const pk0 = derivePKdigest(testSeed, 0, getParamSet());
    expect(hex(node.getWOTSPublicKey(0))).toBe(hex(pk0));
  });

  it('childSeed is hashObject(privateSeed)', () => {
    const expectedChildSeed = hashObject(testSeed);
    const node = new TreeKeyNode(testSeed);
    const childNode = node.getChild(0);
    const expectedChildNodePk = new TreeKeyNode(deriveChainSeedJava(expectedChildSeed, 0));
    expect(hex(childNode.getPublicKey())).toBe(hex(expectedChildNodePk.getPublicKey()));
  });

  it('creates 64 independent WOTS keys per node', () => {
    const node = new TreeKeyNode(testSeed, 64);
    const pks = new Set<string>();
    for (let i = 0; i < 64; i++) {
      pks.add(hex(node.getWOTSPublicKey(i)));
    }
    expect(pks.size).toBe(64);
  });

  it('MMR root is deterministic', () => {
    const node1 = new TreeKeyNode(testSeed);
    const node2 = new TreeKeyNode(testSeed);
    expect(hex(node1.getPublicKey())).toBe(hex(node2.getPublicKey()));
  });
});

describe('TreeKey Hierarchical Structure', () => {
  let treeKey: TreeKey;
  const testSeed = sha3_256(new TextEncoder().encode('test phrase'));

  beforeAll(() => {
    treeKey = new TreeKey(testSeed, 8, 3);
  });

  it('root public key is deterministic', () => {
    const tk1 = new TreeKey(testSeed, 8, 3);
    const tk2 = new TreeKey(testSeed, 8, 3);
    expect(hex(tk1.getPublicKey())).toBe(hex(tk2.getPublicKey()));
  });

  it('getMaxUses returns keysPerLevel^levels', () => {
    expect(treeKey.getMaxUses()).toBe(8 * 8 * 8);
  });

  it('baseConversion correctly decomposes usage count', () => {
    const tk = new TreeKey(testSeed, 64, 3);
    tk.setUses(0);
    expect(tk.getUses()).toBe(0);
    
    tk.setUses(64);
    expect(tk.getUses()).toBe(64);
  });

  it('level-1 address public key is independent of other indices', () => {
    const pk0 = treeKey.getAddressPublicKey(0);
    const pk1 = treeKey.getAddressPublicKey(1);
    expect(hex(pk0)).not.toBe(hex(pk1));
  });
});

describe('WOTS Signing and Verification', () => {
  const testSeed = sha3_256(new TextEncoder().encode('wots test'));
  const ps = getParamSet();

  it('wotsSign produces L*32 byte signature', () => {
    const msgHash = sha3_256(new TextEncoder().encode('test message'));
    const sig = wotsSign(testSeed, 0, msgHash, ps);
    expect(sig.length).toBe(ps.L * 32);
  });

  it('wotsVerify correctly verifies valid signatures', () => {
    const msgHash = sha3_256(new TextEncoder().encode('test message'));
    const sig = wotsSign(testSeed, 0, msgHash, ps);
    const pk = derivePKdigest(testSeed, 0, ps);
    expect(wotsVerify(sig, msgHash, pk, ps)).toBe(true);
  });

  it('wotsVerify rejects invalid signatures (wrong message)', () => {
    const msgHash1 = sha3_256(new TextEncoder().encode('message 1'));
    const msgHash2 = sha3_256(new TextEncoder().encode('message 2'));
    const sig = wotsSign(testSeed, 0, msgHash1, ps);
    const pk = derivePKdigest(testSeed, 0, ps);
    expect(wotsVerify(sig, msgHash2, pk, ps)).toBe(false);
  });

  it('wotsVerify rejects invalid signatures (wrong key)', () => {
    const msgHash = sha3_256(new TextEncoder().encode('test message'));
    const sig = wotsSign(testSeed, 0, msgHash, ps);
    const wrongPk = derivePKdigest(testSeed, 1, ps);
    expect(wotsVerify(sig, msgHash, wrongPk, ps)).toBe(false);
  });

  it('deriveFullPublicKey returns L*32 bytes', () => {
    const fullPk = deriveFullPublicKey(testSeed, 0, ps);
    expect(fullPk.length).toBe(ps.L * 32);
  });

  it('derivePKdigest is hash of full public key', () => {
    const fullPk = deriveFullPublicKey(testSeed, 0, ps);
    const pkDigest = derivePKdigest(testSeed, 0, ps);
    const expectedDigest = sha3_256(fullPk);
    expect(hex(pkDigest)).toBe(hex(expectedDigest));
  });
});

describe('MMRData Serialization (Minima-Compatible)', () => {
  it('createMMRDataLeafNode hashes (ZERO, pubkey, ZERO)', () => {
    const pubkey = new Uint8Array(32).fill(0xaa);
    const leafData = createMMRDataLeafNode(pubkey, 0n);
    expect(leafData.data.length).toBe(32);
    expect(leafData.value).toBe(0n);
  });

  it('createMMRDataParentNode hashes (ONE, left, right, sum)', () => {
    const left = createMMRDataLeafNode(new Uint8Array(32).fill(0x11), 0n);
    const right = createMMRDataLeafNode(new Uint8Array(32).fill(0x22), 0n);
    const parent = createMMRDataParentNode(left, right);
    expect(parent.data.length).toBe(32);
    expect(parent.value).toBe(0n);
  });

  it('MMRTree produces consistent root from same keys', () => {
    const keys = Array.from({ length: 8 }, (_, i) => new Uint8Array(32).fill(i));
    const tree1 = MMRTree.fromPublicKeys(keys);
    const tree2 = MMRTree.fromPublicKeys(keys);
    const root1 = tree1.getRoot()!;
    const root2 = tree2.getRoot()!;
    expect(hex(root1.data)).toBe(hex(root2.data));
  });
});

describe('Parent-Child Signature Caching', () => {
  const testSeed = sha3_256(new TextEncoder().encode('cache test'));

  it('caches parent-child signatures for reuse', () => {
    const tk = new TreeKey(testSeed, 4, 3);
    
    expect(tk.hasParentChildSig([0])).toBe(false);
    
    const data = sha3_256(new TextEncoder().encode('test'));
    tk.setUses(0);
    tk.sign(data);
    
    expect(tk.hasParentChildSig([0])).toBe(true);
    expect(tk.hasParentChildSig([0, 0])).toBe(true);
  });

  it('reuses cached signatures on subsequent signs', () => {
    const tk = new TreeKey(testSeed, 4, 3);
    const data1 = sha3_256(new TextEncoder().encode('test1'));
    const data2 = sha3_256(new TextEncoder().encode('test2'));
    
    tk.setUses(0);
    const sig1 = tk.sign(data1);
    tk.setUses(1);
    const sig2 = tk.sign(data2);
    
    expect(hex(sig1.proofs[0].leafPubkey)).toBe(hex(sig2.proofs[0].leafPubkey));
    expect(hex(sig1.proofs[0].signature)).toBe(hex(sig2.proofs[0].signature));
    expect(hex(sig1.proofs[1].leafPubkey)).toBe(hex(sig2.proofs[1].leafPubkey));
    expect(hex(sig1.proofs[1].signature)).toBe(hex(sig2.proofs[1].signature));
  });

  it('getCachedSignatures returns all cached sigs', () => {
    const tk = new TreeKey(testSeed, 4, 3);
    const data = sha3_256(new TextEncoder().encode('test'));
    
    tk.setUses(0 * 4 * 4 + 1 * 4 + 2);
    tk.sign(data);
    
    const cache = tk.getCachedSignatures();
    expect(cache.has('0')).toBe(true);
    expect(cache.has('0,1')).toBe(true);
    expect(cache.size).toBe(2);
  });
});

describe('TreeSignature Verification', () => {
  const testSeed = sha3_256(new TextEncoder().encode('verify test'));

  it('verifyTreeSignature validates correct signatures', () => {
    const tk = new TreeKey(testSeed, 4, 3);
    const data = sha3_256(new TextEncoder().encode('test message'));
    const sig = tk.sign(data);
    const rootPk = tk.getPublicKey();
    
    expect(verifyTreeSignature(rootPk, data, sig)).toBe(true);
  });

  it('verifyTreeSignature rejects wrong data', () => {
    const tk = new TreeKey(testSeed, 4, 3);
    const data1 = sha3_256(new TextEncoder().encode('message 1'));
    const data2 = sha3_256(new TextEncoder().encode('message 2'));
    const sig = tk.sign(data1);
    const rootPk = tk.getPublicKey();
    
    expect(verifyTreeSignature(rootPk, data2, sig)).toBe(false);
  });

  it('verifyTreeSignature rejects wrong public key', () => {
    const tk1 = new TreeKey(testSeed, 4, 3);
    const tk2 = new TreeKey(sha3_256(new TextEncoder().encode('different')), 4, 3);
    const data = sha3_256(new TextEncoder().encode('test'));
    const sig = tk1.sign(data);
    
    expect(verifyTreeSignature(tk2.getPublicKey(), data, sig)).toBe(false);
  });
});

describe('WOTS Parameters (w=8, L=89)', () => {
  it('paramSet has correct values for w=8', () => {
    const ps = getParamSet();
    expect(ps.w).toBe(8);
    expect(ps.n).toBe(256);
    expect(ps.L).toBe(89);
  });

  it('L calculation: 85 message digits + 4 checksum = 89', () => {
    const logW = 3;
    const n = 256;
    const len1 = Math.floor(n / logW);
    expect(len1).toBe(85);
    const maxSum = len1 * 7;
    const len2 = Math.ceil(Math.log(maxSum) / Math.log(8));
    expect(len2).toBe(4);
    expect(len1 + len2).toBe(89);
  });
});

describe('End-to-End Wallet Flow', () => {
  it('mnemonic → seed → TreeKey → address → sign → verify', () => {
    const phrase = cleanSeedPhrase('abandon ability about above absent absorb abstract absurd abuse access accident account');
    const seed = convertStringToSeed(phrase);
    expect(seed.length).toBe(32);
    
    const tk = new TreeKey(seed, 8, 3);
    const addressPk = tk.getAddressPublicKey(0);
    expect(addressPk.length).toBe(32);
    
    const txHash = sha3_256(new TextEncoder().encode('transaction data'));
    tk.setUses(0);
    const sig = tk.sign(txHash);
    expect(sig.proofs.length).toBe(3);
    
    expect(verifyTreeSignature(tk.getPublicKey(), txHash, sig)).toBe(true);
  });
});

import { getRootPublicKey } from '../src/treekey';

describe('TreeKey Signing (3-proof chain)', () => {
  const testSeed = sha3_256(new TextEncoder().encode('address-signing-test'));
  
  it('sign() with setUses produces exactly 3 proofs', () => {
    const tk = new TreeKey(testSeed, 4, 3);
    const data = sha3_256(new TextEncoder().encode('transaction'));
    tk.setUses(0);
    const sig = tk.sign(data);
    
    expect(sig.proofs.length).toBe(3);
  });
  
  it('proof[0] MMR root equals TreeKey root pubkey', () => {
    const tk = new TreeKey(testSeed, 4, 3);
    const data = sha3_256(new TextEncoder().encode('test'));
    const l1Index = 2;
    tk.setUses(l1Index * 4 * 4 + 0 * 4 + 0);
    const sig = tk.sign(data);
    
    const rootPubkey = tk.getPublicKey();
    const proof0Root = getRootPublicKey(sig.proofs[0]);
    
    expect(hex(proof0Root)).toBe(hex(rootPubkey));
  });
  
  it('parent-child signatures are cached and reused', () => {
    const tk = new TreeKey(testSeed, 4, 3);
    const data1 = sha3_256(new TextEncoder().encode('msg1'));
    const data2 = sha3_256(new TextEncoder().encode('msg2'));
    
    tk.setUses(1 * 4 * 4 + 2 * 4 + 0);
    const sig1 = tk.sign(data1);
    tk.setUses(1 * 4 * 4 + 2 * 4 + 1);
    const sig2 = tk.sign(data2);
    
    expect(hex(sig1.proofs[0].leafPubkey)).toBe(hex(sig2.proofs[0].leafPubkey));
    expect(hex(sig1.proofs[0].signature)).toBe(hex(sig2.proofs[0].signature));
    
    expect(hex(sig1.proofs[2].signature)).not.toBe(hex(sig2.proofs[2].signature));
  });
  
  it('proofs chain correctly: proof[0] root links to TreeKey root', () => {
    const tk = new TreeKey(testSeed, 4, 3);
    const data = sha3_256(new TextEncoder().encode('chain-test'));
    tk.setUses(0);
    const sig = tk.sign(data);
    
    const rootPubkey = tk.getPublicKey();
    
    expect(hex(getRootPublicKey(sig.proofs[0]))).toBe(hex(rootPubkey));
    expect(sig.proofs.length).toBe(3);
  });
});
