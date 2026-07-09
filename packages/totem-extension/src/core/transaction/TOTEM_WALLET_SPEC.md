# TOTEM WALLET INITIALIZATION SPECIFICATION

This document details the complete code journey from a BIP39 seed phrase to a fully functional Totem wallet with 64 Mx addresses and their per-address TreeKey signing structure.

**Last Updated:** 2026-02-10

---

## CRITICAL: Per-Address Architecture Migration (2026-02-05)

### Problem Statement

The Totem wallet was producing signatures that Minima Java nodes rejected with `allsignaturesvalid: false`. Root cause analysis revealed an **architectural mismatch**:

- **Minima Wallet.java**: Creates **one TreeKey per address** with per-address derived seeds
- **Totem (old)**: Created **one master TreeKey** with L1 children as addresses

This produced fundamentally different public keys even from the same mnemonic, causing signature verification to fail.

### New Per-Address Architecture

Minima's Wallet.java creates addresses like this:

```java
// From Wallet.createNewKey()
MiniData modifier = new MiniData(new BigInteger(Integer.toString(numkeys)));
MiniData privseed = Crypto.getInstance().hashObjects(baseSeed, modifier);
TreeKey treekey = TreeKey.createDefault(privseed);  // size=64, depth=3
```

Totem now matches this exactly:

```typescript
// From packages/totem-sdk/packages/core/src/treekey.ts
import { derivePerAddressSeed } from './javaStreamables';

// Create per-address TreeKey
const addressSeed = derivePerAddressSeed(baseSeed, addressIndex);
const treeKey = new TreeKey(addressSeed, 64, 3);

// Address public key = TreeKey root (NOT a child node)
const addressPubkey = treeKey.getPublicKey();

// CRITICAL FIX (2026-02-05): Use setUses() + sign() for 3 proofs matching Java
// Convert (l1, l2) indices to uses counter for Java parity
const uses = l1 * 64 + l2;
treeKey.setUses(uses);
const signature = treeKey.sign(digestBytes);  // Produces 3 proofs
```

### Key Changes

| Aspect | Old Architecture | New Architecture |
|--------|-----------------|------------------|
| TreeKey per wallet | 1 master TreeKey | 64 per-address TreeKeys |
| Address derivation | L1 child pubkey | TreeKey root pubkey |
| Signing indices | (l1, l2, l3) | (l1, l2) per TreeKey converted to uses counter |
| Proof count | 3 proofs (Root→L1→L2→DATA) | 3 proofs (Root→L1→L2→DATA) matching Java |
| Max signatures | 64 × 64 × 64 = 262,144 | 64 × (64 × 64) = 262,144 |

### Migration Impact

- **Breaking change**: Addresses derived from same mnemonic will differ
- **Pre-launch status**: Acceptable to require wallet re-initialization
- **Parity verified**: 26 tests pass with byte-exact Java compatibility

### New SDK Functions

```typescript
// Per-address seed derivation (matches Wallet.createNewKey())
export function derivePerAddressSeed(baseSeed: Bytes, addressIndex: number): Bytes

// Per-address TreeKey factory
export function createPerAddressTreeKey(baseSeed: Bytes, addressIndex: number): TreeKey

// Per-address signing: convert (l1, l2) to uses, then call sign() for 3 proofs
const uses = l1 * 64 + l2;
treeKey.setUses(uses);
const signature = treeKey.sign(data);  // Returns TreeSignature with 3 proofs

// Address public key from per-address TreeKey
export function deriveAddressPublicKey(baseSeed: Bytes, addressIndex: number): Bytes
```

---

## SDK Consolidation Note (2026-01-26)

All MMR and wire format serialization is now consolidated in the SDK as the single source of truth:

**Canonical Sources:**
- `packages/totem-sdk/packages/core/src/Streamable.ts` - **PRIMARY**: All byte-exact Java-compatible serialization primitives
- `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` - High-level hex bundle serializers (imports primitives from Streamable.ts)
- `packages/totem-sdk/packages/core/src/javaStreamables.ts` - Seed derivation and hashing utilities
- `packages/totem-sdk/packages/core/src/mmr.ts` - MMR tree operations

The extension imports SDK types and functions directly:
```typescript
import { writeMMRProof, writeSignature, type MMRProof, type Signature } from '../../../../totem-sdk/packages/core/src/Streamable';
```

**37 unit tests** in `Streamable.parity.test.ts` verify byte-exact compatibility with Minima's Java implementation, including:
- MiniNumber, MiniData, MMRData, MMRProofChunk, MMRProof
- SignatureProof, Signature, Witness, HierarchicalWitness

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Step 1: BIP39 Mnemonic Generation](#step-1-bip39-mnemonic-generation)
4. [Step 2: Minima-Compatible Seed Derivation](#step-2-minima-compatible-seed-derivation)
5. [Step 3: TreeKey Construction](#step-3-treekey-construction)
6. [Step 4: WOTS Public Key Generation](#step-4-wots-public-key-generation)
7. [Step 5: MMR Tree Construction](#step-5-mmr-tree-construction)
8. [Step 6: Address Derivation](#step-6-address-derivation)
9. [Step 7: Mx Address Encoding](#step-7-mx-address-encoding)
10. [Step 8: Persistence and Session Management](#step-8-persistence-and-session-management)
11. [Complete Data Flow Diagram](#complete-data-flow-diagram)
12. [Key Files Reference](#key-files-reference)
13. [Security Considerations](#security-considerations)
14. [Security Hardening (2026-02-10)](#security-hardening-2026-02-10)
15. [Implementation Notes](#implementation-notes)

---

## Overview

Totem wallet uses a **per-address TreeKey architecture** matching Minima's `Wallet.java` implementation. Each of the 64 wallet addresses has its own independent TreeKey, derived from a shared base seed and the address index. This provides:

- **64 wallet addresses** (each with its own per-address TreeKey)
- **262,144 one-time signatures** total (64 addresses × 64 L1 × 64 L2)
- **3-proof WOTS signatures** per signing operation (Root→L1→L2→DATA)
- **Quantum-resistant security** via WOTS (Winternitz One-Time Signatures)
- **Deterministic derivation** from a single 24-word BIP39 mnemonic

---

## Architecture Summary

```
PER-ADDRESS TREEKEY ARCHITECTURE

BIP39 Mnemonic (24 words, any case)
       |
       v cleanSeedPhrase() - normalize to UPPERCASE, expand prefixes
Canonical Phrase (24 words UPPERCASE)
       |
       v SHA3-256(UTF-8 bytes) - Minima BIP39.java method
Base Seed (32 bytes)
       |
       v derivePerAddressSeed(baseSeed, addressIndex)
         = hashObjects(baseSeed, BigInteger(addressIndex))
       |
  +----+----+----+----+----+--- ... (64 per-address TreeKeys)
  |    |    |    |    |    |
 TK   TK   TK   TK   TK
 [0]  [1]  [2]  [3]  [4]  ... [63]
  |
  |   Each TK[i] is an independent TreeKey(size=64, depth=3)
  |   TK[i].seed = derivePerAddressSeed(baseSeed, i)
  |   TK[i].rootPublicKey = Address[i] public key
  |
  |   Internal structure of each per-address TreeKey:
  |   +---------------------------------------------------+
  |   | Root Node (contains 64 WOTS keypairs -> MMR root) |
  |   |     |                                              |
  |   | 64 L1 children (each contains 64 WOTS keypairs)   |
  |   |     |                                              |
  |   | 64x64 L2 leaves (actual signing keys)              |
  |   +---------------------------------------------------+
  |
  v   Address[i] = scriptToAddress(RETURN SIGNEDBY(TK[i].rootPK))
  Address[0] -> MxG0XYZABC...

Signing: uses = l1 * 64 + l2; treeKey.setUses(uses); treeKey.sign()
Produces 3 proofs: Root->L1, L1->L2, L2->DATA
Watermark tracks (addressIndex, l1, l2) with strict monotonic advance
```

---

## Step 1: BIP39 Mnemonic Generation

**Source:** `packages/totem-extension/src/wallet/mnemonic.ts`

Totem **requires** 24-word mnemonics (256-bit entropy) for quantum-resistant security. 12-word and 18-word mnemonics are explicitly rejected.

```typescript
import { generateWordList, validatePhrase } from '../../../totem-sdk/packages/core/src/bip39';

export function generateMnemonic(): string {
  const words = generateWordList();
  return words.join(' ').toUpperCase();
}

export function validateMnemonic(mnemonic: string): boolean {
  const wordCount = mnemonic.trim().split(/\s+/).length;
  if (wordCount !== 24) {
    return false;  // REJECT: Only 24-word mnemonics accepted
  }
  return validatePhrase(mnemonic);
}
```

**Output:** 24 space-separated UPPERCASE words from the BIP39 English word list.

**Example:**
```
ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT ABSURD ABUSE ACCESS ACCIDENT
ACCOUNT ACCUSE ACHIEVE ACID ACOUSTIC ACQUIRE ACROSS ACT ACTION ACTOR ACTRESS ACTUAL
```

---

## Step 2: Minima-Compatible Seed Derivation

**Source:** `packages/totem-sdk/packages/core/src/bip39.ts`

**IMPORTANT:** This is NOT standard BIP39! Minima uses the BIP39 word list but derives seeds differently:

- **No PBKDF2** - No key stretching
- **No passphrase** - No optional salt
- **No checksum validation** - Words validated against word list only
- **Direct SHA3-256 hash** of the normalized phrase bytes

```typescript
import { cleanSeedPhrase, convertStringToSeed, phraseToSeed } from '../../../totem-sdk/packages/core/src/bip39';

export function mnemonicToSeed(mnemonic: string): Uint8Array {
  return phraseToSeed(mnemonic);
}
```

**phraseToSeed() Pipeline (from SDK bip39.ts):**
```typescript
export function phraseToSeed(rawPhrase: string): Uint8Array {
  const canonical = cleanSeedPhrase(rawPhrase);  // Step 2a: Normalize
  return convertStringToSeed(canonical);          // Step 2b: Hash
}
```

### Step 2a: Phrase Normalization (cleanSeedPhrase)

Matches Minima's `BIP39.cleanSeedPhrase()` exactly:

```typescript
export function cleanSeedPhrase(seedPhrase: string): string {
  const tokens = seedPhrase.trim().split(/\s+/);
  const matchedWords: string[] = [];
  
  for (const rawToken of tokens) {
    const token = rawToken.toLowerCase();
    
    if (token.length < 3) {
      throw new Error(`Word too short: "${rawToken}" (minimum 3 characters)`);
    }
    
    let found = false;
    
    // Short words (<4 chars): must match exactly
    if (token.length < 4) {
      for (const word of WORD_LIST) {
        if (token === word) {
          matchedWords.push(word);
          found = true;
          break;
        }
      }
    } else {
      // Longer words: prefix matching (first match wins)
      for (const word of WORD_LIST) {
        if (word.startsWith(token)) {
          matchedWords.push(word);
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      throw new Error(`Unknown BIP39 word: "${rawToken}"`);
    }
  }
  
  return matchedWords.join(' ').trim().toUpperCase();
}
```

**Normalization Rules:**
| Input | Output | Reason |
|-------|--------|--------|
| `"abandon"` | `"ABANDON"` | Uppercase |
| `"ABANDON"` | `"ABANDON"` | Already uppercase |
| `"aban"` | `"ABANDON"` | Prefix expansion |
| `"wago"` | `"WAGON"` | Prefix expansion |
| `"act"` | `"ACT"` | Exact match (< 4 chars) |

### Step 2b: SHA3-256 Hash (convertStringToSeed)

Matches Minima's `BIP39.convertStringToSeed()`:

```typescript
export function convertStringToSeed(phrase: string): Uint8Array {
  const encoder = new TextEncoder();
  const phraseBytes = encoder.encode(phrase);  // UTF-8 bytes
  return sha3_256(phraseBytes);                // 32-byte hash
}
```

**Algorithm:**
```
baseSeed = SHA3-256( UTF-8_encode( canonical_uppercase_phrase ) )
```

**Output:** 32-byte base seed for TreeKey construction.

**Example:**
```
Input:  "abandon ability able about..."  (24 words, mixed case)
Step 1: cleanSeedPhrase → "ABANDON ABILITY ABLE ABOUT..." (uppercase)
Step 2: UTF-8 encode → bytes
Step 3: SHA3-256 → 32-byte baseSeed
```

---

## Step 3: TreeKey Construction

**Source:** `packages/totem-sdk/packages/core/src/treekey.ts`

Each TreeKey is a 3-level hierarchical structure with 64 keys per level. In the per-address architecture, the wallet uses TWO kinds of TreeKey:

1. **Per-address TreeKeys** (for address derivation): Each of the 64 addresses gets its own independent TreeKey from `derivePerAddressSeed(baseSeed, addressIndex)`. The address public key = TreeKey root.
2. **Session TreeKey** (for signing): A single TreeKey from `baseSeed` is cached as `sessionTreeKey` for efficient signing operations. Its L1 children provide the signing structure.

```typescript
// Per-address TreeKey for address derivation (Step 6)
const addressSeed = derivePerAddressSeed(baseSeed, addressIndex);
const perAddressTK = new TreeKey(addressSeed, 64, 3);  // addressPubkey = perAddressTK.getPublicKey()

// Session TreeKey for signing operations (cached in memory)
const sessionTK = await TreeKey.createWithProgress(baseSeed, 64, 3, onProgress);
```

**TreeKeyNode Internal Architecture (each TreeKey has this structure):**
```
Level 0 (Root):    1 TreeKeyNode     (contains 64 WOTS key digests → MMR root = public key)
                   │
                   ├── childSeed = hashObject(privateSeed)
                   │              = SHA3( serializeMiniData(privateSeed) )
                   │
Level 1 (L1):      64 TreeKeyNodes  (child nodes for signing path)
                   │
                   ├── Each childSeed = deriveChainSeedJava(parent.childSeed, index)
                   │
Level 2 (L2):      64 × 64 = 4,096 TreeKeyNodes (actual signing keys)
                   │
Leaf WOTS keys:    64 × 64 × 64 = 262,144 one-time WOTS keys per TreeKey
```

**Child Seed Derivation:**

From `javaStreamables.ts`:
```typescript
// hashObject: Serializes as MiniData then hashes
export function hashObject(data: Uint8Array): Uint8Array {
  const serialized = serializeMiniData(data);  // 4-byte length + data
  return sha3_256(serialized);
}

// deriveChainSeedJava: Used for child node derivation
export function deriveChainSeedJava(seed: Uint8Array, index: number): Uint8Array {
  const indexSerialized = serializeMiniNumber(index);  // [scale, len, bytes]
  const seedSerialized = serializeMiniData(seed);      // [4-byte len, bytes]
  return hashAllObjects(indexSerialized, seedSerialized);  // SHA3( concat(...) )
}
```

From `treekey.ts`:
```typescript
constructor(privateSeed: Bytes) {
  this.seed = privateSeed;
  
  // hashObject: SHA3( serializeMiniData(privateSeed) ) = SHA3( [4-byte len] + privateSeed )
  // Matches TreeKeyNode.java: mChildSeed = Crypto.getInstance().hashObject(zPrivateSeed);
  this.childSeed = hashObject(privateSeed);
  
  // Child node cache - matches Java's mChildren[] array
  this.childCache = new Map();
  
  // ... generate WOTS keys and MMR tree ...
}

getChild(childIndex: number): TreeKeyNode {
  // Check cache first (matches Java's mChildren[zChild] != null check)
  const cached = this.childCache.get(childIndex);
  if (cached) {
    return cached;
  }
  
  // deriveChainSeedJava: hashAllObjects( serializeMiniNumber(index), serializeMiniData(seed) )
  const childSeed = deriveChainSeedJava(this.childSeed, childIndex);
  const child = new TreeKeyNode(childSeed, this.keysPerLevel);
  
  // Cache for future use (matches Java's mChildren[zChild] = new TreeKeyNode(...))
  this.childCache.set(childIndex, child);
  
  return child;
}
```

**Child Node Caching (Java Parity):**

Both Java and TypeScript cache child nodes to avoid regenerating WOTS keys on every access:

```java
// Java TreeKeyNode.java
public TreeKeyNode getChild(int zChild) {
    if(mChildren[zChild] == null) {
        MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(zChild),mChildSeed);
        mChildren[zChild] = new TreeKeyNode(seed, mSize);
    }
    return mChildren[zChild];
}
```

**Performance Impact:** Without caching, each `getChild()` call regenerates 64 WOTS public keys (~100ms per node). With 64 addresses, this would take 6+ seconds per address derivation cycle. Caching ensures O(1) access after first creation.

**Serialization Details:**
| Operation | Format |
|-----------|--------|
| `hashObject(seed)` | SHA3-256( serializeMiniData(seed) ) = SHA3-256( [4-byte len] + seed ) |
| `deriveChainSeedJava(seed, i)` | hashAllObjects( serializeMiniNumber(i), serializeMiniData(seed) ) |

---

## Step 4: WOTS Public Key Generation

**Source:** `packages/totem-sdk/packages/core/src/wots.ts`

Each TreeKeyNode contains 64 WOTS (Winternitz One-Time Signature) keypairs.

**WOTS Parameters (BouncyCastle Compatible):**
| Parameter | Value | Description |
|-----------|-------|-------------|
| w | 8 | Winternitz parameter (8 bits per digit, each byte = one digit 0-255) |
| n | 256 | Security bits (32-byte hash output) |
| L | 34 | Chain count (32 message chains + 2 checksum chains) |

**Two Key Representations Per WOTS Keypair:**

Each WOTS keypair can produce two representations, but only the **digest** is used in practice:

| Key Type | Size | Purpose | Source Function |
|----------|------|---------|-----------------|
| **Public Key Digest** | 32 bytes | **MMR tree leaves, SignatureProof.leafPubkey, address derivation** | `derivePKdigest()` |
| **Full Public Key** | 1,088 bytes (34 × 32) | Internal to WOTS signature verification only | `deriveFullPublicKey()` |

**CRITICAL (January 2026 Fix):** Java's `Winternitz.getPublicKey()` returns a **32-byte SHA3-256 digest** of the full 1088-byte concatenated chain tops. The MMR tree is built from these 32-byte digests. The full 1088-byte key is only used internally during WOTS signature verification.

**Previous Bug:** Using 1088-byte full public keys for MMR leaves and SignatureProof.leafPubkey caused MegaMMR to reject transactions with "not signed by publickey" errors because Java expected 32-byte digests.

**Public Key Derivation:**

```typescript
// From treekey.ts TreeKeyNode constructor
// Java's Winternitz.getPublicKey() returns SHA3-256(full_key) = 32 bytes
// See WinternitzOTSignature.getPublicKey() lines 103-121
this.publicKeyDigests = [];
for (let i = 0; i < 64; i++) {
  // Digest (32 bytes) - used for MMR tree, SignatureProof.leafPubkey, and address derivation
  const pkDigest = derivePKdigest(privateSeed, i, getParamSet());
  this.publicKeyDigests.push(pkDigest);
}

// MMR tree built from 32-byte PUBLIC KEY DIGESTS (Java-compatible)
// Java's TreeKeyNode: MMRData.CreateMMRDataLeafNode(wots.getPublicKey(), ZERO)
// where getPublicKey() returns SHA3-256(full_key) = 32-byte DIGEST
this.mmrTree = MMRTree.fromPublicKeys(this.publicKeyDigests);
```

**Digest Computation (`derivePKdigest`):**

`derivePKdigest` computes chain tops and hashes them in a single pass (it does NOT call `deriveFullPublicKey`):

```typescript
// From wots.ts - matches WinternitzOTSignature.getPublicKey() which returns H(buf)
export function derivePKdigest(seed: Uint8Array, i: number, ps: ParamSet): Uint8Array {
  const indexedSeed = deriveIndexedSeed(seed, i);
  const privateKeys = expandPrivateKey(indexedSeed, ps);
  const rounds = ps.maxDigit; // 255
  const buf = new Uint8Array(ps.L * 32); // 34 × 32 = 1,088 bytes
  for (let j = 0; j < ps.L; j++) {
    const top = hashChain(privateKeys[j], rounds);
    buf.set(top, j * 32);
  }
  return F(buf); // SHA3-256(all chain tops) → 32-byte digest
}
```

**Chain Derivation Algorithm (BouncyCastle GMSSRandom):**

Uses BouncyCastle's stateful GMSSRandom PRNG to derive L=34 chain seeds:
```typescript
// From packages/totem-sdk/packages/core/src/wots.ts
export function expandPrivateKey(seed: Uint8Array, ps: ParamSet): Uint8Array[] {
  const state = new Uint8Array(seed); // Copy seed to mutable state
  const privateKeys: Uint8Array[] = [];
  for (let i = 0; i < ps.L; i++) {
    privateKeys.push(GMSSRandom.nextSeed(state)); // Stateful PRNG
  }
  return privateKeys;
}
```

**GMSSRandom.nextSeed (BouncyCastle algorithm):**
```
rand = H(state)
state = state + rand + 1 (byte-wise addition with carry)
return rand
```

**Full Public Key (internal to WOTS verification only):**
```
fullPublicKey = concat(chainTop[0], chainTop[1], ..., chainTop[33])
             = 34 × 32 = 1,088 bytes
digest       = SHA3-256(fullPublicKey) = 32 bytes  ← this is what Java stores and uses
```

---

## Step 5: MMR Tree Construction

**Source:** `packages/totem-sdk/packages/core/src/mmr.ts`

Each TreeKeyNode builds an MMR (Merkle Mountain Range) tree from its 64 **WOTS public key digests** (32 bytes each).

This matches Java's `TreeKeyNode` where `Winternitz.getPublicKey()` returns the 32-byte SHA3-256 digest:

```java
// Java TreeKeyNode.java
for(int i=0; i<zSize; i++) {
    Winternitz wots = new Winternitz(seed);
    MiniData pubkey = wots.getPublicKey();  // Returns SHA3-256(full_key) = 32-byte DIGEST
    MMRData pubentry = MMRData.CreateMMRDataLeafNode(pubkey, MiniNumber.ZERO);
    mTree.addEntry(pubentry);
}
```

**MMR Leaf Creation (from `mmr.ts`):**
```typescript
import { serializeMiniNumber, serializeMiniData, javaHashAllObjects } from "./javaStreamables";

export function createMMRDataLeafNode(pubkey: Bytes, sumValue: bigint = 0n): MMRData {
  // Matches MMRData.CreateMMRDataLeafNode in Java:
  // MiniData hash = Crypto.getInstance().hashAllObjects(MiniNumber.ZERO, zData, zSumValue);
  
  const zero = new Uint8Array([0x00, 0x01, 0x00]);       // MiniNumber.ZERO - 3 bytes
  const pubkeySerialized = serializeMiniData(pubkey);      // [4-byte len] + 32 bytes = 36 bytes
  const sumSerialized = serializeMiniNumber(sumValue);     // [scale, len, bytes] - variable
  
  // javaHashAllObjects: concatenates all serialized items and SHA3-256 hashes
  const hash = javaHashAllObjects(zero, pubkeySerialized, sumSerialized);
  
  return { data: hash, value: sumValue };
}
```

**javaHashAllObjects (from `javaStreamables.ts`):**
```typescript
export function javaHashAllObjects(...items: Uint8Array[]): Uint8Array {
  const totalLength = items.reduce((sum, item) => sum + item.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const item of items) {
    combined.set(item, offset);
    offset += item.length;
  }
  return sha3_256(combined);
}
```

**Leaf Hash Format (using 32-byte public key digest):**
```
leafHash = javaHashAllObjects(
  MiniNumber.ZERO,          // [0x00, 0x01, 0x00] - 3 bytes
  MiniData(pkDigest),       // [0x00, 0x00, 0x00, 0x20] + 32 bytes = 36 bytes
  MiniNumber.ZERO           // [0x00, 0x01, 0x00] - 3 bytes
)
= SHA3-256(42 bytes) → 32 bytes
```

**MMR Parent Hash (from `mmr.ts`):**
```typescript
export function createMMRDataParentNode(left: MMRData, right: MMRData): MMRData {
  // Matches MMRData.CreateMMRDataParentNode in Java:
  // MiniData hash = Crypto.getInstance().hashAllObjects(
  //   MiniNumber.ONE, zLeft.getData(), zRight.getData(), sumvalue);
  
  const sumValue = left.value + right.value;
  
  const one = new Uint8Array([0x00, 0x01, 0x01]);         // MiniNumber.ONE - 3 bytes
  const leftDataSerialized = serializeMiniData(left.data);   // [4-byte len] + 32 bytes
  const rightDataSerialized = serializeMiniData(right.data); // [4-byte len] + 32 bytes
  const sumSerialized = sumValue === 0n 
    ? new Uint8Array([0x00, 0x01, 0x00])                  // MiniNumber.ZERO
    : serializeMiniNumber(Number(sumValue));
  
  const hash = javaHashAllObjects(one, leftDataSerialized, rightDataSerialized, sumSerialized);
  return { data: hash, value: sumValue };
}
```

**MMR Tree Structure:**
```
For 64 leaves, the MMR builds a balanced tree:
Row 6:  [Root]                    ← TreeKeyNode.getPublicKey()
Row 5:  [32] [32]
Row 4:  [16] [16] [16] [16]
...
Row 0:  [0] [1] [2] ... [63]     ← 64 leaf hashes
```

**Node Public Key = MMR Root (32 bytes)**

---

## Step 6: Address Derivation

**Source:** `packages/totem-extension/src/core/wallet.ts` → `deriveAddressFromSeed()`

For each of the 64 addresses, a per-address TreeKey is created from a derived seed, and the TreeKey's root public key becomes the address public key:

```typescript
private deriveAddressFromSeed(baseSeed: Uint8Array, addressIndex: number): { address: string; publicKey: string } {
  // Get the per-address TreeKey's root public key (32 bytes)
  // Creates a TreeKey(derivePerAddressSeed(baseSeed, addressIndex), 64, 3)
  // and returns its root MMR public key
  const addressPubkey = deriveAddressPublicKey(baseSeed, addressIndex);
  const publicKeyHex = `0x${this.bytesToHex(addressPubkey)}`;
  
  // Create KISSVM script from the per-address TreeKey's root public key
  const script = scriptFromWotsPk(addressPubkey);
  
  // Derive Mx address from script
  const address = scriptToAddress(script);
  
  return { address, publicKey: publicKeyHex };
}
```

**deriveAddressPublicKey() (from `treekey.ts`):**
```typescript
// Per-address architecture: each address has its own independent TreeKey
export function deriveAddressPublicKey(baseSeed: Bytes, addressIndex: number): Bytes {
  const treeKey = createPerAddressTreeKey(baseSeed, addressIndex);
  return treeKey.getPublicKey();  // MMR root of per-address TreeKey's 64 WOTS key digests
}

export function createPerAddressTreeKey(baseSeed: Bytes, addressIndex: number): TreeKey {
  const addressSeed = derivePerAddressSeed(baseSeed, addressIndex);
  return new TreeKey(addressSeed, 64, 3);
}
```

**Note:** The old method `deriveAddressFromTreeKey()` using `treeKey.getAddressPublicKey(l1)` (which got L1 child of a master TreeKey) is deprecated. The per-address architecture creates an independent TreeKey per address where the root IS the address public key.

**Script Generation:**
```typescript
// From script.ts
export function scriptFromWotsPk(pkDigest32: Uint8Array): string {
  return `RETURN SIGNEDBY(${bytesToHex(pkDigest32)})`;
}
```

**Example Script:**
```
RETURN SIGNEDBY(0x1A2B3C4D5E6F7890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890)
```

**Script → Address Hash:**
```typescript
// From mmr.ts / derive.ts
export function mmrRootFromSingleLeaf(script: string): Bytes {
  return mmrLeafExact(script);
}

function mmrLeafExact(script: string): Bytes {
  const zero = new Uint8Array([0x00, 0x01, 0x00]);  // MiniNumber.ZERO
  const mstr = encodeMiniStringUTF8(script);         // MiniString format
  const all = concat(zero, mstr, zero);
  return sha3_256(all);  // 32-byte address hash
}
```

**Address Hash Serialization:**
```
addressHash = SHA3-256(
  [0x00, 0x01, 0x00] +           // MiniNumber.ZERO (3 bytes)
  [4-byte length] + script_utf8 + // MiniString (4 + ~77 bytes)
  [0x00, 0x01, 0x00]             // MiniNumber.ZERO (3 bytes)
)
= SHA3-256(~87 bytes) → 32 bytes
```

---

## Step 7: Mx Address Encoding

**Source:** `packages/totem-sdk/packages/core/src/minima32.ts`

The 32-byte address hash is encoded to human-readable Mx format:

```typescript
export function encodeMx(root32: Uint8Array): string {
  // Build frame: [sentinel(1), length(2), data(32), checksum(4)]
  const frame = new Uint8Array(1 + 2 + 32 + 4);  // 39 bytes
  frame[0] = 0x01;     // Sentinel byte
  frame[1] = 0;        // Length high byte
  frame[2] = 32;       // Length low byte
  frame.set(root32, 3);
  
  // Checksum = first 4 bytes of SHA3-256(root32)
  const chk = sha3_256.arrayBuffer(root32);
  frame.set(new Uint8Array(chk).slice(0, 4), 35);
  
  return encodeMxRadix32Frame(frame);
}
```

**Frame Structure:**
```
Byte 0:      Sentinel (0x01)
Bytes 1-2:   Length (0x0020 = 32)
Bytes 3-34:  Address hash (32 bytes)
Bytes 35-38: Checksum (4 bytes)
Total:       39 bytes
```

**Base32 Encoding with Character Swaps:**
```typescript
function encodeMxRadix32Frame(frame: Uint8Array): string {
  let s = bytesToBigInt(frame).toString(32).toLowerCase();
  // Avoid ambiguous characters
  s = s.replace(/i/g, 'w').replace(/l/g, 'y').replace(/o/g, 'z');
  return 'Mx' + s.toUpperCase();
}
```

**Character Substitutions:**
| Original | Replaced | Reason |
|----------|----------|--------|
| i | w | Avoid confusion with 1 |
| l | y | Avoid confusion with 1 |
| o | z | Avoid confusion with 0 |

**Example Mx Address:**
```
MxG0B4TA7UD5AM2J9KPFCR8Q31YE6V7NHSWZ...
```

---

## Complete Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE WALLET INITIALIZATION FLOW                    │
│                   (Minima-Compatible - NO PBKDF2/HKDF)                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 1: BIP39 Mnemonic (24 words, any case)                         │  │
│  │ "abandon ability able about above absent absorb abstract..."         │  │
│  └──────────────────────────────────┬──────────────────────────────────┘  │
│                                     │                                      │
│                                     ▼ cleanSeedPhrase() - normalize        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 2a: Canonical Phrase (UPPERCASE, prefix-expanded)              │  │
│  │ "ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT..."        │  │
│  └──────────────────────────────────┬──────────────────────────────────┘  │
│                                     │                                      │
│                                     ▼ SHA3-256( UTF-8 bytes )              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 2b: Base Seed (32 bytes) - direct hash, no PBKDF2/HKDF         │  │
│  │ a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678   │  │
│  └──────────────────────────────────┬──────────────────────────────────┘  │
│                                     │                                      │
│         ┌───────────────────────────┼───────────────────────────┐          │
│         ▼                           ▼                           ▼          │
│  ┌─────────────┐             ┌─────────────┐             ┌─────────────┐  │
│  │ Address[0]  │             │ Address[1]  │     ...     │ Address[63] │  │
│  ├─────────────┤             ├─────────────┤             ├─────────────┤  │
│  │ Per-address │             │ Per-address │             │ Per-address │  │
│  │ TreeKey     │             │ TreeKey     │             │ TreeKey     │  │
│  │ seed=derive │             │ seed=derive │             │ seed=derive │  │
│  │ PerAddress  │             │ PerAddress  │             │ PerAddress  │  │
│  │ Seed(base,i)│             │ Seed(base,i)│             │ Seed(base,i)│  │
│  └──────┬──────┘             └─────────────┘             └─────────────┘  │
│         │                                                                  │
│         ▼ STEP 3: Per-address TreeKey (64 WOTS key digests)               │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │ addressSeed = derivePerAddressSeed(baseSeed, addressIndex)        │    │
│  │ treeKey = new TreeKey(addressSeed, 64, 3)                         │    │
│  │ addressPubkey = treeKey.getPublicKey() = MMR root (32 bytes)      │    │
│  └──────────────────────────────────┬────────────────────────────────┘    │
│                                     │                                      │
│         ▼ 64 WOTS keypairs per TreeKeyNode                                │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │ STEP 4: WOTS Public Key Digests (L=34 chains × 32 bytes each)     │    │
│  │ chainTop[j] = F^255(chainSeed[j])  where F = SHA3-256             │    │
│  │ digest = SHA3-256( concat(chainTop[0..33]) ) = 32 bytes           │    │
│  └──────────────────────────────────┬────────────────────────────────┘    │
│                                     │                                      │
│                                     ▼ MMR tree from 64 digests (32B each) │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │ STEP 5: MMR Tree (built from 32-byte public key digests)          │    │
│  │                                                                    │    │
│  │ leaf[i] = SHA3(                                                   │    │
│  │   MiniNumber.ZERO         // 3 bytes: [0x00, 0x01, 0x00]          │    │
│  │   || MiniData(pkDigest)   // 36 bytes: [4-byte len] + 32 bytes    │    │
│  │   || MiniNumber.ZERO      // 3 bytes: [0x00, 0x01, 0x00]          │    │
│  │ )                         // Total: 42 bytes hashed               │    │
│  │                                                                    │    │
│  │ parent = SHA3(                                                    │    │
│  │   MiniNumber.ONE          // 3 bytes: [0x00, 0x01, 0x01]          │    │
│  │   || MiniData(leftHash)   // 36 bytes: [4-byte len] + 32 bytes    │    │
│  │   || MiniData(rightHash)  // 36 bytes: [4-byte len] + 32 bytes    │    │
│  │   || MiniNumber(sum)      // variable: [scale, len, bytes]        │    │
│  │ )                         // Total: 75+ bytes hashed              │    │
│  │                                                                    │    │
│  │ addressPubkey = MMR root = per-address TreeKey public key (32B)   │    │
│  └──────────────────────────────────┬────────────────────────────────┘    │
│                                     │                                      │
│                                     ▼ Script generation                    │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │ STEP 6: KISSVM Script                                              │    │
│  │ script = "RETURN SIGNEDBY(0x" + hex(addressPubkey) + ")"          │    │
│  │ addressHash = SHA3( ZERO + MiniString(script) + ZERO )            │    │
│  └──────────────────────────────────┬────────────────────────────────┘    │
│                                     │                                      │
│                                     ▼ Mx encoding                          │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │ STEP 7: Mx Address                                                 │    │
│  │ frame = [0x01] + [0x00, 0x20] + addressHash + checksum            │    │
│  │ address = "Mx" + base32(frame).toUpperCase()                      │    │
│  │ Result: MxG0B4TA7UD5AM2J9KPFCR8Q31YE6V7NHSWZ...                   │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 8: Persistence and Session Management

**Source:** `packages/totem-extension/src/core/wallet.ts`

After address derivation, the wallet persists state to Chrome storage and initializes session variables:

**Storage Persistence (from `generateAllAddresses`):**
```typescript
// Persist addresses to chrome.storage for restoration on page reload
await chrome.storage.local.set({ walletAddresses: accounts });

// Store session variables (not persisted - memory only)
this.sessionSeed = baseSeed;
this.sessionTreeKey = treeKey;
this.sessionRootPublicKey = `0x${this.bytesToHex(rootPubkey)}`;
```

**Encrypted Seed Storage:**
```typescript
private async encryptAndStoreSeed(seed: Uint8Array, password: string): Promise<void> {
  // Derive AES-GCM key from password
  const key = await this.deriveKey(password);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt seed with AES-GCM
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    seed
  );
  
  // Store IV and ciphertext as hex
  await chrome.storage.local.set({
    encryptedSeed: {
      iv: this.bytesToHex(iv),
      ct: this.bytesToHex(new Uint8Array(encrypted))
    }
  });
}
```

**Storage Keys:**
| Key | Contents | Encrypted |
|-----|----------|-----------|
| `encryptedSeed` | { iv, ct } for base seed | Yes (AES-GCM) |
| `encryptedMnemonic` | { iv, ct } for mnemonic | Yes (AES-GCM) |
| `walletAddresses` | Array of Account objects | No |
| `excludedAddresses` | Array of excluded indices | No |
| `walletSetup` | Boolean flag | No |

**Session Variables (Memory Only):**
| Variable | Purpose |
|----------|---------|
| `sessionSeed` | Decrypted base seed for signing |
| `sessionTreeKey` | Cached TreeKey instance |
| `sessionRootPublicKey` | Root public key for watermark tracking |
| `sessionKey` | AES-GCM key for encryption |

**Restoration on Extension Reload:**
```typescript
private async restoreAddressesFromStorage(): Promise<void> {
  const stored = await chrome.storage.local.get('walletAddresses');
  if (stored.walletAddresses && Array.isArray(stored.walletAddresses)) {
    this.state.accounts = stored.walletAddresses;
    this.state.activeAccount = stored.walletAddresses[0]?.address || '';
  }
}
```

### Parent-Child Signature Cache Persistence

**Source:** `packages/totem-extension/src/core/stores/ParentChildSigCache.ts`

TreeKey parent-child signatures (L0→L1, L1→L2) are cached to avoid re-computing them on every signing operation. This cache is persisted to Chrome storage to survive extension restarts.

**What Gets Cached:**
- L0→L1 signatures: Root node signing Level-1 child's public key
- L1→L2 signatures: Level-1 node signing Level-2 child's public key
- L2→DATA signatures: **NEVER cached** (unique per transaction)

**Cache Key Format:**
| Path Key | Meaning |
|----------|---------|
| `"0"` | Root → Level-1[0] signature |
| `"5"` | Root → Level-1[5] signature |
| `"3,7"` | Level-1[3] → Level-2[7] signature |

**Storage Format:**
```typescript
interface CacheEntry {
  rootPubkey: string;  // Wallet root public key (hex)
  cache: Record<string, SignatureProofHex>;  // pathKey → serialized proof
  updatedAt: number;   // Timestamp
}

interface SignatureProofHex {
  leafPubkey: string;  // 32-byte WOTS public key digest (hex) - SHA3-256 of full 1088-byte key
  signature: string;   // 1,088-byte WOTS signature (hex)
  mmrProof: string;    // Serialized MMRProof (hex)
}
```

**Cache Operations:**
```typescript
// Save cache on wallet lock
const cache = treeKey.getCachedSignatures();
await parentChildSigCache.saveCacheForWallet(rootPubkey, cache);

// Restore cache on wallet unlock
const cache = await parentChildSigCache.getCacheForWallet(rootPubkey);
treeKey.restoreCachedSignatures(cache);
```

**Security Note:** Only derived public proofs are cached. Private keys are NEVER stored. The cache is deterministic - if lost, it regenerates identically from the seed.

**Java Parity:**
```java
// Java TreeKeyNode.java
SignatureProof mParentChildSig = null;

public void setParentChildSig(SignatureProof zSignature) {
    mParentChildSig = zSignature;
}

public SignatureProof getParentChildSig() {
    return mParentChildSig;
}
```

---

## Key Files Reference

All paths are relative to the monorepo root.

| File | Purpose |
|------|---------|
| `packages/totem-extension/src/wallet/mnemonic.ts` | BIP39 mnemonic generation and validation |
| `packages/totem-extension/src/core/wallet.ts` | WalletManager: orchestrates initialization and signing |
| `packages/totem-extension/src/background/index.ts` | Background message handler with sender validation |
| `packages/totem-extension/src/provider.ts` | Injected provider with origin-scoped postMessage |
| `packages/totem-extension/src/core/stores/ConnectedSitesStore.ts` | DApp permissions, transaction limits (BigInt) |
| `packages/totem-extension/src/core/stores/WatermarkStore.ts` | WOTS watermark tracking (addressIndex, l1, l2) |
| `packages/totem-extension/src/core/stores/LeaseStore.ts` | Mutex-protected watermark lease allocation |
| `packages/totem-extension/src/core/stores/ParentChildSigCache.ts` | Parent-child signature caching |
| `packages/totem-sdk/packages/core/src/bip39.ts` | Minima-compatible BIP39 seed derivation |
| `packages/totem-sdk/packages/core/src/treekey.ts` | Per-address TreeKey and TreeKeyNode implementation |
| `packages/totem-sdk/packages/core/src/wots.ts` | WOTS signature scheme (w=8, L=34, BouncyCastle compatible) |
| `packages/totem-sdk/packages/core/src/mmr.ts` | MMR tree construction and proofs |
| `packages/totem-sdk/packages/core/src/javaStreamables.ts` | Minima wire format serialization, per-address seed derivation |
| `packages/totem-sdk/packages/core/src/Streamable.ts` | Byte-exact Java-compatible serialization primitives |
| `packages/totem-sdk/packages/core/src/script.ts` | KISSVM script generation |
| `packages/totem-sdk/packages/core/src/derive.ts` | Script to address conversion |
| `packages/totem-sdk/packages/core/src/minima32.ts` | Mx Base32 encoding/decoding |

---

## Security Considerations

1. **24-word requirement:** Only 256-bit entropy mnemonics are accepted for quantum resistance.

2. **Minima-compatible derivation:** Uses SHA3-256 direct hash of uppercase phrase, matching Minima's `BIP39.java` exactly for wallet compatibility.

3. **WOTS one-time signatures:** Each leaf key can only be used ONCE. The wallet tracks watermarks via `WatermarkStore` to prevent key reuse. The watermark enforces strict monotonic advancement of `(addressIndex, l1, l2)` indices.

4. **MMR proof binding:** Signatures include MMR proofs linking leaf keys to address public keys, preventing key substitution attacks.

5. **Hierarchical caching:** Parent-child signatures are cached and reused, preserving one-time signature property while improving performance.

---

## Security Hardening (2026-02-10)

The following security hardening measures were applied during the second-pass security audit:

### Cryptographic ID Generation

All security-relevant IDs now use `crypto.getRandomValues()` instead of `Math.random()`:
- Session IDs (wallet unlock)
- Transaction IDs (DApp-initiated sends)
- Verification IDs (challenge-response)

### Debug Logging

`DEBUG_FULL_HEX` is set to `false` in production builds. When enabled during development, it logs full serialized transaction hex including witness/signature data. This is disabled by default to prevent leaking signed transaction data to the browser console.

### Background Message Sender Validation

The background message handler (`background/index.ts`) validates the sender of every incoming message:
- **Content-script senders** (messages from DApps, identified by `sender.tab` being defined) are restricted to 8 `TOTEM_*` methods only: `TOTEM_CONNECT`, `TOTEM_DISCONNECT`, `TOTEM_GET_STATE`, `TOTEM_SEND_TRANSACTION`, `TOTEM_VERIFY`, `TOTEM_GET_BALANCE`, `TOTEM_GET_ADDRESS`, `TOTEM_SIGN_MESSAGE`
- **Extension UI pages and internal calls** (no `sender.tab`) have unrestricted access to all message types including wallet management, RPC, and settings

This prevents a malicious DApp from accessing internal wallet operations (e.g., `EXPORT_SEED`, `LOCK_WALLET`, `RPC_COMMAND`) through the provider API.

### RPC Command Allowlist

The `RPC_COMMAND` handler restricts which Minima RPC commands can be executed to a read-only set:
- `txpow`, `balance`, `coins`, `tokens`, `txlist`, `status`

This prevents DApps from issuing destructive RPC commands. The allowlist only affects the `RPC_COMMAND` message handler; the transaction flow's internal `AxiaRpcClient` calls (e.g., `coinexport`, `txnimport`) are unaffected.

### DApp Transaction Limits (BigInt Precision)

Transaction amount limit checks in `ConnectedSitesStore.canExecuteTransaction()` use BigInt string-based comparison with 8-decimal fixed precision via `decimalToBigInt()` / `bigIntToDecimal()` helpers. This eliminates floating-point rounding errors that could allow a DApp to bypass per-transaction or daily aggregate limits.

### Provider PostMessage Origin Scoping

The injected provider (`provider.ts`) scopes all `window.postMessage()` calls to `window.location.origin` instead of `'*'`. This prevents other frames or windows from receiving wallet messages intended for the current page.

---

## Implementation Notes

### Minima-Compatible BIP39 Derivation

Totem uses **Minima-compatible BIP39 derivation exclusively**:

- **No PBKDF2:** Standard BIP39 key stretching is NOT used
- **No HKDF:** No additional key derivation is applied
- **No passphrase:** Passphrases are not supported
- **Direct SHA3-256:** The uppercase normalized phrase is hashed directly

This matches Minima's `BIP39.java` implementation exactly, ensuring wallets created in Totem are compatible with Minima's native tooling. The `cleanSeedPhrase()` function normalizes input to UPPERCASE and expands word prefixes (e.g., "wago" → "WAGON").

### Progress Reporting

Wallet initialization reports progress via callbacks:
- `wots_keys`: WOTS key generation (64 keys)
- `mmr_build`: MMR tree construction
- `address_derive`: Address derivation (64 addresses)
- `complete`: Initialization complete

### Persistence

Generated addresses are persisted to `chrome.storage.local` under `walletAddresses` for fast restoration on extension reload.
