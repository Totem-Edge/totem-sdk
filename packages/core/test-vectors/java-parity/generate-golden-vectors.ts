/**
 * Golden Vector Generator for Java Parity Testing
 * 
 * This script generates all intermediate values that can be compared
 * against Java output to find the exact divergence point.
 * 
 * Run with: npx tsx generate-golden-vectors.ts
 */

import { TreeKey, TreeKeyNode } from '../../src/treekey';
import { 
  hex, fromHex, derivePKdigest, deriveFullPublicKey, 
  GMSSRandom, expandPrivateKey, F, hashChain 
} from '../../src/wots';
import { sha3_256 } from '@totemsdk/core';
import { 
  serializeMiniNumber, serializeMiniData, javaHashAllObjects, 
  deriveChainSeedJava, hashObject 
} from '../../src/javaStreamables';
import { getParamSet } from '../../src/params';
import { createMMRDataLeafNode, createMMRDataParentNode, MMRTree } from '../../src/mmr';

// Test case from Java's TreeKey.main()
const PRIV_SEED_HEX = '51D9F403271E267229B6C2A95C5EAED527846A1AF89F8B1CF5574B0E79A49CF1';
const EXPECTED_PUBKEY_HEX = 'f6d6379010b1f44c59942291e4a81166ffaad60d139be98920a2f546c6d8a165';

console.log('='.repeat(70));
console.log('GOLDEN VECTOR GENERATOR - Compare each value with Java output');
console.log('='.repeat(70));
console.log();

const privSeed = fromHex(PRIV_SEED_HEX);
const ps = getParamSet();

console.log('INPUT:');
console.log(`  Private seed: ${hex(privSeed)}`);
console.log(`  Expected pubkey (from Java): ${EXPECTED_PUBKEY_HEX.toLowerCase()}`);
console.log(`  ParamSet: L=${ps.L}, w=${ps.w}`);
console.log();

// =============================================================================
// Step 1: TreeKeyNode.mChildSeed = Crypto.hashObject(zPrivateSeed)
// =============================================================================
console.log('--- STEP 1: mChildSeed = Crypto.hashObject(privSeed) ---');
const seedAsMinData = serializeMiniData(privSeed);
console.log(`  privSeed serialized as MiniData: ${hex(seedAsMinData)}`);
const mChildSeed = sha3_256(seedAsMinData);
console.log(`  mChildSeed = SHA3-256(serialized): ${hex(mChildSeed)}`);
console.log();

// =============================================================================
// Step 2: Key seed derivation for each WOTS key
// Java: MiniData seed = Crypto.hashAllObjects(new MiniNumber(i), zPrivateSeed);
// =============================================================================
console.log('--- STEP 2: Key seed derivation (first 4 keys) ---');
console.log('  Formula: keySeed[i] = hashAllObjects(MiniNumber(i), privSeed)');
console.log();

const keySeeds: Uint8Array[] = [];
for (let i = 0; i < 4; i++) {
  const indexSerialized = serializeMiniNumber(i);
  const keySeed = javaHashAllObjects(indexSerialized, seedAsMinData);
  keySeeds.push(keySeed);
  console.log(`  MiniNumber(${i}) = ${hex(indexSerialized)}`);
  console.log(`  keySeed[${i}] = ${hex(keySeed)}`);
  console.log();
}

// =============================================================================
// Step 3: GMSSRandom expansion for first key
// =============================================================================
console.log('--- STEP 3: GMSSRandom expansion for keySeed[0] ---');
console.log('  Formula: privateKey[j] = GMSSRandom.nextSeed(state)');
console.log(`  Initial state = keySeed[0] = ${hex(keySeeds[0])}`);
console.log();

const state = new Uint8Array(keySeeds[0]);
console.log('  First 5 private keys:');
for (let j = 0; j < 5; j++) {
  const pk = GMSSRandom.nextSeed(state);
  console.log(`    pk[${j}] = ${hex(pk)}`);
  console.log(`    state_after = ${hex(state)}`);
}
console.log(`  ... (${ps.L} total private keys)`);
console.log();

// =============================================================================
// Step 4: Full public key generation (1088 bytes)
// =============================================================================
console.log('--- STEP 4: WOTS Full Public Key (1088 bytes) ---');
console.log('  Formula: hash each privateKey[j] 255 times, concatenate all, then hash once');
console.log();

// Reset and get full public key
const pkFull0 = deriveFullPublicKey(keySeeds[0], 0, ps);
console.log(`  First 64 bytes: ${hex(pkFull0).substring(0, 128)}...`);
console.log(`  Last 64 bytes: ...${hex(pkFull0).substring(hex(pkFull0).length - 128)}`);
console.log(`  Full length: ${pkFull0.length} bytes`);
console.log();

// =============================================================================
// Step 5: Public Key Digest (32 bytes) - what Winternitz.getPublicKey() returns
// =============================================================================
console.log('--- STEP 5: WOTS Public Key Digest (32 bytes) ---');
console.log('  Formula: SHA3-256(fullPublicKey)');
console.log();

const pkDigest0 = sha3_256(pkFull0);
console.log(`  pkDigest[0] = ${hex(pkDigest0)}`);
console.log();

// Also compute via derivePKdigest to verify consistency
const pkDigest0Alt = derivePKdigest(keySeeds[0], 0, ps);
console.log(`  derivePKdigest(keySeed[0], 0) = ${hex(pkDigest0Alt)}`);
console.log(`  Match: ${hex(pkDigest0) === hex(pkDigest0Alt) ? 'YES' : 'NO'}`);
console.log();

// =============================================================================
// Step 6: MMR Leaf Node Creation
// =============================================================================
console.log('--- STEP 6: MMR Leaf Node for pkDigest[0] ---');
console.log('  Formula: hash = hashAllObjects(MiniNumber.ZERO, zData, zSumValue)');
console.log();

const leaf0 = createMMRDataLeafNode(pkDigest0, 0n);
console.log(`  Input pubkey digest: ${hex(pkDigest0)}`);
console.log(`  MMR leaf[0].data = ${hex(leaf0.data)}`);
console.log();

// =============================================================================
// Step 7: Build full MMR tree for first 4 keys
// =============================================================================
console.log('--- STEP 7: MMR Tree (first 4 keys) ---');
console.log();

const allPkDigests: Uint8Array[] = [];
for (let i = 0; i < 4; i++) {
  const keySeed = javaHashAllObjects(serializeMiniNumber(i), seedAsMinData);
  const pkFull = deriveFullPublicKey(keySeed, 0, ps);
  const pkDigest = sha3_256(pkFull);
  allPkDigests.push(pkDigest);
  console.log(`  pkDigest[${i}] = ${hex(pkDigest)}`);
}
console.log();

// Build MMR
const leaves = allPkDigests.map(pk => createMMRDataLeafNode(pk, 0n));
console.log('  Leaf nodes:');
for (let i = 0; i < leaves.length; i++) {
  console.log(`    leaf[${i}].data = ${hex(leaves[i].data)}`);
}
console.log();

// Parent nodes
const parent01 = createMMRDataParentNode(leaves[0], leaves[1]);
const parent23 = createMMRDataParentNode(leaves[2], leaves[3]);
console.log('  Parent nodes:');
console.log(`    parent(0,1).data = ${hex(parent01.data)}`);
console.log(`    parent(2,3).data = ${hex(parent23.data)}`);
console.log();

const root = createMMRDataParentNode(parent01, parent23);
console.log(`  ROOT (4 keys) = ${hex(root.data)}`);
console.log();

// =============================================================================
// Step 8: Full 64-key TreeKeyNode
// =============================================================================
console.log('--- STEP 8: Full TreeKeyNode (64 keys) ---');
console.log();

const node = new TreeKeyNode(privSeed, 64);
console.log(`  Our TreeKeyNode pubkey: ${hex(node.getPublicKey())}`);
console.log(`  Expected (from Java):   ${EXPECTED_PUBKEY_HEX.toLowerCase()}`);
console.log(`  Match: ${hex(node.getPublicKey()) === EXPECTED_PUBKEY_HEX.toLowerCase() ? 'YES!' : 'NO - DIVERGENCE DETECTED'}`);
console.log();

// =============================================================================
// Step 9: Full TreeKey (3 levels)
// =============================================================================
console.log('--- STEP 9: Full TreeKey (64 keys, 3 levels) ---');
console.log();

const treeKey = new TreeKey(privSeed, 64, 3);
console.log(`  Our TreeKey pubkey:   ${hex(treeKey.getPublicKey())}`);
console.log(`  Expected (from Java): ${EXPECTED_PUBKEY_HEX.toLowerCase()}`);
console.log(`  Match: ${hex(treeKey.getPublicKey()) === EXPECTED_PUBKEY_HEX.toLowerCase() ? 'YES!' : 'NO - DIVERGENCE DETECTED'}`);
console.log();

console.log('='.repeat(70));
console.log('END OF GOLDEN VECTOR GENERATION');
console.log('='.repeat(70));
