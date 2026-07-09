/**
 * WOTS Parity Test
 * 
 * This test file enables debug logging and runs WOTS operations with a known seed
 * to capture all intermediate values for comparison with Java reference implementation.
 * 
 * Usage:
 *   npx jest packages/totem-sdk/packages/core/src/__tests__/wots-parity.test.ts --verbose
 * 
 * The debug output can be compared against Java's TreeKeyNode and Winternitz output
 * to identify exactly where the implementations diverge.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import { 
  setWotsLogger, 
  disableWotsLogger,
  wotsSign,
  deriveFullPublicKey,
  wotsVerify,
  expandPrivateKey,
  toWinternitzDigits,
  deriveIndexedSeed,
  GMSSRandom,
  hex,
  fromHex,
  F,
  hashChain
} from '../wots';
import { 
  setTreeKeyLogger, 
  disableTreeKeyLogger,
  TreeKey,
  TreeKeyNode
} from '../treekey';
import { getParamSet } from '../params';
import { ConsoleLogger } from '../adapters';

describe('WOTS Parity Tests', () => {
  const consoleLogger = new ConsoleLogger('[WOTS-PARITY]');
  
  beforeEach(() => {
    setWotsLogger(consoleLogger);
    setTreeKeyLogger(consoleLogger);
  });
  
  afterEach(() => {
    disableWotsLogger();
    disableTreeKeyLogger();
  });
  
  it('should verify hashChain rounds=0 returns input unchanged', () => {
    console.log('\n========== hashChain Boundary Test ==========');
    
    const ps = getParamSet();
    const seed = new Uint8Array(32);
    seed[0] = 0xAA;
    
    const privateKeys = expandPrivateKey(seed, ps);
    const pk0 = privateKeys[0];
    
    const result0 = hashChain(pk0, 0);
    const result1 = hashChain(pk0, 1);
    const result2 = hashChain(pk0, 2);
    const result255 = hashChain(pk0, 255);
    
    console.log(`pk0: ${hex(pk0).substring(0, 32)}...`);
    console.log(`hashChain(pk0, 0): ${hex(result0).substring(0, 32)}...`);
    console.log(`hashChain(pk0, 1): ${hex(result1).substring(0, 32)}...`);
    console.log(`hashChain(pk0, 2): ${hex(result2).substring(0, 32)}...`);
    console.log(`hashChain(pk0, 255): ${hex(result255).substring(0, 32)}...`);
    
    expect(Buffer.from(result0).equals(Buffer.from(pk0))).toBe(true);
    expect(Buffer.from(result1).equals(Buffer.from(result0))).toBe(false);
    expect(Buffer.from(F(pk0)).equals(Buffer.from(result1))).toBe(true);
    expect(Buffer.from(F(F(pk0))).equals(Buffer.from(result2))).toBe(true);
    
    console.log('hashChain rounds=0 returns unchanged: PASS');
    console.log('hashChain rounds=1 = F(x): PASS');
    console.log('hashChain rounds=2 = F(F(x)): PASS');
  });
  
  it('should dump GMSSRandom intermediate values', () => {
    console.log('\n========== GMSSRandom Test ==========');
    
    const seed = new Uint8Array(32);
    seed[0] = 0x01; // Simple test seed
    
    console.log(`Initial seed: ${hex(seed)}`);
    
    const state = new Uint8Array(seed);
    
    for (let i = 0; i < 5; i++) {
      const rand = GMSSRandom.nextSeed(state);
      console.log(`GMSSRandom.nextSeed[${i}]:`);
      console.log(`  rand: ${hex(rand)}`);
      console.log(`  state after: ${hex(state)}`);
    }
  });
  
  it('should dump deriveIndexedSeed intermediate values', () => {
    console.log('\n========== deriveIndexedSeed Test ==========');
    
    const seed = new Uint8Array(32);
    seed[0] = 0x01;
    
    console.log(`Master seed: ${hex(seed)}`);
    
    for (let i = 0; i < 3; i++) {
      const indexed = deriveIndexedSeed(seed, i);
      console.log(`deriveIndexedSeed(seed, ${i}): ${hex(indexed)}`);
    }
  });
  
  it('should dump expandPrivateKey for a known seed', () => {
    console.log('\n========== expandPrivateKey Test ==========');
    
    const ps = getParamSet();
    const seed = new Uint8Array(32);
    seed[0] = 0xAB;
    seed[1] = 0xCD;
    
    console.log(`Seed: ${hex(seed)}`);
    console.log(`L=${ps.L}, w=${ps.w}`);
    
    const privateKeys = expandPrivateKey(seed, ps);
    
    console.log(`Generated ${privateKeys.length} private keys`);
    for (let i = 0; i < 5; i++) {
      console.log(`pk[${i}]: ${hex(privateKeys[i])}`);
    }
    console.log(`...`);
    console.log(`pk[${ps.L - 1}]: ${hex(privateKeys[ps.L - 1])}`);
  });
  
  it('should dump toWinternitzDigits for a known hash', () => {
    console.log('\n========== toWinternitzDigits Test ==========');
    
    const ps = getParamSet();
    const hash = sha3_256(new Uint8Array([0x01, 0x02, 0x03]));
    
    console.log(`Input hash: ${hex(hash)}`);
    
    const { digits, checksumDigits, total } = toWinternitzDigits(hash, ps);
    
    console.log(`Message digits (${digits.length}): [${digits.join(', ')}]`);
    console.log(`Checksum digits (${checksumDigits.length}): [${checksumDigits.join(', ')}]`);
    console.log(`Total: ${total} (expected L=${ps.L})`);
    
    const sum = digits.reduce((a, b) => a + b, 0);
    console.log(`Digit sum: ${sum}`);
    console.log(`Checksum = (32 << 8) - ${sum} = ${(32 << 8) - sum}`);
    console.log(`Checksum digit[0] = ${checksumDigits[0]} (low 8 bits)`);
    console.log(`Checksum digit[1] = ${checksumDigits[1]} (next 8 bits)`);
  });
  
  it('should dump full WOTS sign/verify cycle', () => {
    console.log('\n========== WOTS Sign/Verify Test ==========');
    
    const ps = getParamSet();
    const seed = new Uint8Array(32);
    seed[0] = 0xDE;
    seed[1] = 0xAD;
    seed[2] = 0xBE;
    seed[3] = 0xEF;
    const keyIndex = 0;
    // CRITICAL: Both wotsSign and wotsVerify hash internally to match Java/BouncyCastle
    // Use 32-byte raw message (like a tx digest) - both functions will hash it internally
    const rawMessage = new Uint8Array(32).fill(0xab);
    rawMessage[0] = 0x01;
    rawMessage[1] = 0x02;
    rawMessage[2] = 0x03;
    rawMessage[3] = 0x04;
    
    console.log(`Seed: ${hex(seed)}`);
    console.log(`Key index: ${keyIndex}`);
    console.log(`Message (raw 32B): ${hex(rawMessage)}`);
    
    console.log('\n--- Deriving public key ---');
    const pkFull = deriveFullPublicKey(seed, keyIndex, ps);
    console.log(`Full public key (${pkFull.length}B): ${hex(pkFull).substring(0, 128)}...`);
    
    console.log('\n--- Signing ---');
    // Pass raw message - wotsSign hashes internally
    const signature = wotsSign(seed, keyIndex, rawMessage, ps);
    console.log(`Signature (${signature.length}B): ${hex(signature).substring(0, 128)}...`);
    
    console.log('\n--- Verifying locally ---');
    // Pass same raw message - wotsVerify hashes internally
    const valid = wotsVerify(signature, rawMessage, pkFull, ps);
    console.log(`Local verification result: ${valid}`);
    
    expect(pkFull.length).toBe(1088);
    expect(signature.length).toBe(1088);
    expect(valid).toBe(true);
  });
  
  it('should dump TreeKeyNode initialization', () => {
    console.log('\n========== TreeKeyNode Init Test ==========');
    
    const seed = new Uint8Array(32);
    seed[0] = 0x11;
    seed[1] = 0x22;
    seed[2] = 0x33;
    
    console.log(`Seed: ${hex(seed)}`);
    
    const node = new TreeKeyNode(seed, 64);
    
    console.log(`Root public key: ${hex(node.getPublicKey())}`);
    console.log(`WOTS key[0] full: ${hex(node.getWOTSPublicKey(0)).substring(0, 64)}...`);
    console.log(`WOTS key[0] digest: ${hex(node.getWOTSPublicKeyDigest(0))}`);
  });
  
  it('should dump TreeKeyNode sign operation', () => {
    console.log('\n========== TreeKeyNode Sign Test ==========');
    
    const seed = new Uint8Array(32);
    seed[0] = 0x44;
    seed[1] = 0x55;
    seed[2] = 0x66;
    
    const node = new TreeKeyNode(seed, 64);
    const data = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]);
    
    console.log(`Seed: ${hex(seed)}`);
    console.log(`Data to sign: ${hex(data)}`);
    console.log(`Data hash: ${hex(sha3_256(data))}`);
    
    const sigProof = node.sign(0, data);
    
    console.log(`Leaf pubkey (${sigProof.leafPubkey.length}B): ${hex(sigProof.leafPubkey)}`);
    console.log(`Signature (${sigProof.signature.length}B): ${hex(sigProof.signature).substring(0, 64)}...`);
    console.log(`MMR proof chunks: ${sigProof.mmrProof.chunks.length}`);
    
    // CRITICAL FIX (January 2026): leafPubkey is 32-byte DIGEST, not 1088-byte full key
    expect(sigProof.leafPubkey.length).toBe(32);   // SHA3-256 digest
    expect(sigProof.signature.length).toBe(1088);  // Signature is still 1088 bytes
  });
  
  it('should verify local signature matches public key', () => {
    console.log('\n========== Local Verification Consistency Test ==========');
    
    const ps = getParamSet();
    const seed = new Uint8Array(32);
    seed[0] = 0x77;
    seed[1] = 0x88;
    
    const node = new TreeKeyNode(seed, 64);
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    
    const sigProof = node.sign(0, data);
    
    const valid = wotsVerify(sigProof.signature, data, sigProof.leafPubkey, ps);
    console.log(`Stored public key matches signature verification: ${valid}`);
    
    expect(valid).toBe(true);
  });
  
  it('should dump full TreeKey hierarchy signing', () => {
    console.log('\n========== TreeKey Hierarchy Sign Test ==========');
    
    const seed = new Uint8Array(32);
    seed[0] = 0x99;
    seed[1] = 0xAA;
    seed[2] = 0xBB;
    
    console.log(`Root seed: ${hex(seed)}`);
    
    const treeKey = new TreeKey(seed, 64, 3);
    
    console.log(`TreeKey public key: ${hex(treeKey.getPublicKey())}`);
    
    const data = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    console.log(`Data to sign: ${hex(data)}`);
    
    treeKey.setUses(0);
    const multiSig = treeKey.sign(data);
    
    console.log(`Multi-signature has ${multiSig.proofs.length} levels`);
    for (let i = 0; i < multiSig.proofs.length; i++) {
      const p = multiSig.proofs[i];
      console.log(`Level ${i}:`);
      console.log(`  leafPubkey (${p.leafPubkey.length}B): ${hex(p.leafPubkey).substring(0, 32)}...`);
      console.log(`  signature (${p.signature.length}B): ${hex(p.signature).substring(0, 32)}...`);
      console.log(`  mmrProof chunks: ${p.mmrProof.chunks.length}`);
    }
  });
});
