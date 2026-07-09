# Minima Transaction Serialization Specification

This document describes how Totem builds and serializes Minima transactions locally for WOTS signing.

**Last Updated:** 2026-02-05
**Verified Against:** Minima Java Source (MiniData.java, MiniNumber.java, MiniString.java, MiniByte.java, MMRData.java, MMRProof.java, SignatureProof.java, Signature.java, TreeKey.java)

---

## CRITICAL: Complete CoinProof Extraction (2026-02-05)

Fixed transaction ID mismatch where input coins were using hardcoded default values instead of the actual blockchain values.

**Root Cause:** The `convertInputCoin()` function was setting:
```typescript
mmrEntryNumber: 0n,      // WRONG - should be actual value
blockCreated: 0n,        // WRONG - should be actual value  
storeState: false,       // WRONG - should be actual value
state: [],               // WRONG - should be actual values
```

**Fix:** New `extractCoinDataFromCoinProof()` function extracts ALL coin fields from CoinProof:
- `rawMmrEntryBytes` - Pre-serialized MMREntryNumber for byte-exact match
- `rawBlockCreatedBytes` - Pre-serialized blockCreated for byte-exact match
- `RawStateVariable[]` - Pre-serialized state variables

**Why This Matters:** Java computes the transaction ID (digest) from the serialized bytes of the COMPLETE coin as stored on the blockchain. If we use different values for any field, the transaction ID will be different, causing the WOTS signature to fail verification.

**New Interfaces:**
```typescript
interface RawStateVariable {
  port: number;
  type: number;  // 1=HEX, 2=NUMBER, 4=STRING, 8=BOOL
  rawData: Uint8Array;  // Pre-serialized data
}

interface CoinProofData {
  coinId: Uint8Array;
  address: Uint8Array;
  rawAmountBytes: Uint8Array;
  tokenId: Uint8Array;
  storeState: boolean;
  mmrEntryNumber: bigint;
  rawMmrEntryBytes: Uint8Array;  // For byte-exact serialization
  spent: boolean;
  blockCreated: bigint;
  rawBlockCreatedBytes: Uint8Array;  // For byte-exact serialization
  state: RawStateVariable[];
}
```

---

## SDK Consolidation Note (2026-01-18)

All wire format serialization is now consolidated in the SDK as the single source of truth:

**Canonical Source:** `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts`

The extension imports from the SDK:
```typescript
import type { MMRProof, MMRProofChunk } from '../../../../totem-sdk/packages/core/src/mmr';
import { serializeMMRProof } from '../../../../totem-sdk/packages/core/src/mmr';
```

Key files updated:
- `MinimaTransactionBuilder.ts` - uses SDK `serializeMMRProof`
- `WitnessSerializer.ts` - imports SDK types with adapter functions for RPC response conversion
- `ScriptTypes.ts` - imports SDK types (`MMRProof`, `MMRProofChunk`, `MMRData`)

See `packages/docs-site/docs/internal/mmr-implementation-analysis.md` for full architecture details.

---

## Overview

Totem implements **client-side transaction building** for true self-custody. The flow is:
1. Fetch spendable coins from MegaMMR via `/v1/wallet/coins`
2. Build transaction locally (this document)
3. Compute digest locally using SHA3-256 (NIST FIPS 202)
4. Sign with WOTS using per-address TreeKey (3 proofs: Root→L1→L2→DATA)
5. Serialize to HEX and submit via `/wots-hardened/finalize`

---

## Primitive Type Serialization

All wire formats verified against Minima Java source files.

### MiniByte

**Java (MiniByte.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    zOut.writeByte(mVal);
}
```

**Format:** 1 raw byte

**TypeScript:**
```typescript
function serializeMiniByte(value: number): Uint8Array {
  return new Uint8Array([value & 0xFF]);
}
```

---

### MiniData

**Java (MiniData.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    zOut.writeInt(mData.length);  // 4-byte big-endian length
    zOut.write(mData);            // raw bytes
}

public void writeHashToStream(DataOutputStream zOut) throws IOException {
    writeDataStream(zOut);  // Same format, just validates max 64 bytes
}
```

**Format:** `[4-byte big-endian length] + [data bytes]`

**TypeScript:**
```typescript
function serializeMiniData(data: Uint8Array): Uint8Array {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length, false); // big-endian
  return concat(length, data);
}
```

**Note:** `writeHashToStream()` uses the SAME format as `writeDataStream()` - both use 4-byte length prefix. The only difference is writeHashToStream validates max 64 bytes.

---

### MiniNumber

**Java (MiniNumber.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    int scale = mNumber.scale();
    byte[] data = mNumber.unscaledValue().toByteArray();
    
    zOut.writeByte(scale);        // 1-byte scale
    zOut.writeByte(data.length);  // 1-byte length
    zOut.write(data);             // unscaled BigInteger bytes
}
```

**Format:** `[1-byte scale] + [1-byte length] + [unscaled value bytes]`

**TypeScript:**
```typescript
function serializeMiniNumber(value: bigint, scale: number = 0): Uint8Array {
  // Zero value: still needs length=1 with value byte 0x00
  // Per MiniNumber.java: BigDecimal.ZERO.unscaledValue().toByteArray() returns [0x00]
  if (value === 0n) {
    return new Uint8Array([scale & 0xff, 1, 0]); // scale, length=1, value=0x00
  }
  
  // Convert to big-endian bytes (two's complement for BigInteger)
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  
  let bytes = hexToBytes(hex);
  
  // If high bit is set, add leading 0x00 to keep positive (Java BigInteger behavior)
  if (bytes.length > 0 && (bytes[0] & 0x80) !== 0) {
    const withLeadingZero = new Uint8Array(bytes.length + 1);
    withLeadingZero[0] = 0x00;
    withLeadingZero.set(bytes, 1);
    bytes = withLeadingZero;
  }
  
  return new Uint8Array([scale & 0xff, bytes.length, ...bytes]);
}
```

**Examples:**
- `0` → `[0x00, 0x01, 0x00]` (scale=0, length=1, value=0x00)
- `1` → `[0x00, 0x01, 0x01]` (scale=0, length=1, value=0x01)
- `127` → `[0x00, 0x01, 0x7F]` (scale=0, length=1, value=0x7F)
- `128` → `[0x00, 0x02, 0x00, 0x80]` (scale=0, length=2, leading zero for positive)
- `255` → `[0x00, 0x02, 0x00, 0xFF]` (scale=0, length=2, leading zero for positive)
- `256` → `[0x00, 0x02, 0x01, 0x00]` (scale=0, length=2, value=256)

**Note:** Java's `BigInteger.toByteArray()` uses two's complement encoding. For positive numbers where the high bit (0x80) is set, a leading 0x00 byte is added to keep the number positive.

---

### MiniString

**Java (MiniString.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    MiniData strdata = new MiniData(getData()); // UTF-8 bytes
    strdata.writeDataStream(zOut);               // MiniData format
}

public byte[] getData() {
    return mString.getBytes(MINIMA_CHARSET); // UTF-8
}
```

**Format:** MiniData of UTF-8 bytes → `[4-byte length] + [UTF-8 bytes]`

**TypeScript:**
```typescript
function serializeMiniString(text: string): Uint8Array {
  const utf8 = new TextEncoder().encode(text);
  return serializeMiniData(utf8);
}
```

---

## Composite Type Serialization

### MMRData

**Java (MMRData.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    mData.writeDataStream(zOut);   // MiniData (hash)
    mValue.writeDataStream(zOut);  // MiniNumber
}
```

**Format:** `[MiniData hash] + [MiniNumber value]`
- Hash: 4-byte length + 32 bytes = 36 bytes
- Value: 1-byte scale + 1-byte length + N bytes

**TypeScript:**
```typescript
function serializeMMRData(hash: Uint8Array, value: bigint): Uint8Array {
  return concat(serializeMiniData(hash), serializeMiniNumber(value));
}
```

---

### MMRProofChunk

**Java (MMRProof.java inner class):**
```java
// ProofChunk
mLeft.writeDataStream(zOut);      // MiniByte (isLeft)
mMMRData.writeDataStream(zOut);   // MMRData
```

**Format:** `[1-byte isLeft] + [MMRData]`

**TypeScript:**
```typescript
function serializeMMRProofChunk(chunk: { isLeft: boolean; hash: Uint8Array; value: bigint }): Uint8Array {
  return concat(
    new Uint8Array([chunk.isLeft ? 1 : 0]),
    serializeMMRData(chunk.hash, chunk.value)
  );
}
```

---

### MMRProof

**Java (MMRProof.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    mBlockTime.writeDataStream(zOut);                    // MiniNumber
    MiniNumber.WriteToStream(zOut, mProofChain.size()); // MiniNumber (count)
    for(ProofChunk chunk : mProofChain) {
        chunk.writeDataStream(zOut);                     // ProofChunk
    }
}
```

**Format:** `[MiniNumber blockTime] + [MiniNumber count] + [ProofChunk...]`

**TypeScript:**
```typescript
function serializeMMRProof(proof: MMRProof): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(serializeMiniNumber(proof.blockTime));
  parts.push(serializeMiniNumber(BigInt(proof.proofChain.length)));
  for (const chunk of proof.proofChain) {
    parts.push(serializeMMRProofChunk(chunk));
  }
  return concat(...parts);
}
```

---

### SignatureProof

**Java (SignatureProof.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    mPublicKey.writeDataStream(zOut);   // MiniData (FULL 1088-byte WOTS public key)
    mSignature.writeDataStream(zOut);   // MiniData (WOTS signature, 1088 bytes)
    mProof.writeDataStream(zOut);       // MMRProof
}
```

**CRITICAL (January 2026 Fix):** `mPublicKey` is the **FULL 1088-byte WOTS public key** (L=34 chains × 32 bytes), NOT a 32-byte digest. Java's `Winternitz.getPublicKey()` returns the FULL key. The MMR tree is built from these 1088-byte keys, and verification compares the full reconstructed key against the stored full key.

**Previous Bug:** Using 32-byte digests caused MegaMMR to reject transactions with "not signed by publickey" errors.

**Format:** `[MiniData pubkeyFull] + [MiniData signature] + [MMRProof]`

**TypeScript:**
```typescript
function serializeSignatureProof(proof: SignatureProof): Uint8Array {
  return concat(
    serializeMiniData(proof.leafPubkey),  // 4 + 1088 = 1092 bytes (FULL key, not digest)
    serializeMiniData(proof.signature),   // 4 + 1088 = 1092 bytes
    serializeMMRProof(proof.mmrProof)
  );
}
```

**Source:** `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts`

---

### Signature

**Java (Signature.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    MiniNumber.WriteToStream(zOut, mSignatures.size());  // MiniNumber (count)
    for(SignatureProof sig : mSignatures) {
        sig.writeDataStream(zOut);                        // SignatureProof
    }
}
```

**Format:** `[MiniNumber count] + [SignatureProof...]`

**TypeScript:**
```typescript
function serializeSignature(signature: Signature): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(serializeMiniNumber(BigInt(signature.proofs.length)));
  for (const proof of signature.proofs) {
    parts.push(serializeSignatureProof(proof));
  }
  return concat(...parts);
}
```

---

### ScriptProof

**Java (ScriptProof.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    mScript.writeDataStream(zOut);   // MiniString (script text)
    mProof.writeDataStream(zOut);    // MMRProof
}
```

**Format:** `[MiniString script] + [MMRProof]`

**TypeScript:**
```typescript
function serializeScriptProof(script: string, proof: MMRProof): Uint8Array {
  return concat(serializeMiniString(script), serializeMMRProof(proof));
}
```

---

## Hierarchical TreeKey Signing Architecture

**CRITICAL (2026-01-21):** This section documents the correct signature chain depth and proof ordering for address-based transactions.

### TreeKey Structure

Minima uses a 3-level hierarchical TreeKey structure (64×64×64 = 262,144 one-time signatures per wallet):

```
Level 0 (Root)
├── Level 1 (Address Nodes) × 64
│   └── Level 2 (Leaf Nodes) × 64 each
│       └── Level 3 (Data Signing) × 64 each
```

### Address Derivation

Coin addresses are derived from **Level-1 public keys**, NOT the TreeKey root:

```
address = SHA3(RETURN SIGNEDBY(level1_pubkey))
```

### Signature Chain Requirements

**For address-based transactions (SIGNEDBY scripts):**

Must use **3 proofs** from a per-address TreeKey (depth=3):
1. **proof[0] (Root→L1):** Root node signs L1 child's public key (CACHED)
2. **proof[1] (L1→L2):** L1 node signs L2 child's public key (CACHED)
3. **proof[2] (L2→DATA):** L2 leaf node signs the actual transaction digest (NEVER cached)

**Proof Ordering (CRITICAL):**
```
proofs[0] = Root→L1 signature (root signing L1 child's pubkey)
proofs[1] = L1→L2 signature (L1 signing L2 child's pubkey)
proofs[2] = L2→DATA signature (leaf signing transaction digest)
```

The ordering is verified by Java's `Signature.verify()` which iterates proofs in array order.

**Why 3 proofs?**

A 3-level TreeKey (depth=3) produces 3 proofs, one per tree level. Minima verifies by computing `proof[0].getRootPublicKey()` (MMR root from the first proof) and comparing it to the SIGNEDBY script's public key. In the per-address architecture, the TreeKey's root public key IS the address public key, so proof[0]'s MMR root matches directly.

**Parent-Child Signature Caching:**

Parent→child signatures (proof[0] Root→L1, proof[1] L1→L2) are cached via `ParentChildSigCache` because they're deterministic for a given tree path. Only the leaf proof (proof[2] L2→DATA) is computed fresh for each transaction.

### TreeKey Signing

**Use `setUses()` + `sign()` for all transactions:**
```typescript
const uses = l1 * 64 + l2;
perAddressTreeKey.setUses(uses);
const signature = perAddressTreeKey.sign(digestBytes);
// Returns TreeSignature with 3 proofs (Root→L1→L2→DATA)
```

### Signature Verification Flow

1. Minima extracts public key from SIGNEDBY script: `root_pubkey`
2. Minima computes MMR root from `signature.proofs[0]`: `computedRoot`
3. Minima verifies: `computedRoot === root_pubkey`
4. For each non-leaf proof[i]: verifies proof[i] signs proof[i+1].getRootPublicKey()
5. Leaf proof signs the actual transaction digest.

---

## Address Preprocessing

Before serializing addresses in transactions, Totem normalizes all address formats to hex using `normalizeAddressToHex()`.

**Source:** `packages/totem-extension/src/core/transaction/MinimaTransactionBuilder.ts`

### Mx to Hex Conversion

Minima addresses come in two formats:
- **Mx format:** Human-readable Base32 encoding (e.g., `MxG0B4TA7UD5AM2J...`)
- **Hex format:** Raw address hash with `0x` prefix

**TypeScript (normalizeAddressToHex):**
```typescript
function normalizeAddressToHex(addr: string): string {
  if (!addr) {
    console.warn('normalizeAddressToHex: empty address, defaulting to 0x00');
    return '0x00';
  }
  const trimmed = addr.trim();
  
  // Mx format: decode using mxToHex (from minima32.ts)
  if (trimmed.toLowerCase().startsWith('mx')) {
    try {
      const hexResult = mxToHex(trimmed);  // Returns 0x-prefixed hex string
      return hexResult;
    } catch (e: any) {
      throw new Error(`Invalid Mx address "${trimmed.substring(0, 20)}...": ${e.message}`);
    }
  }
  
  // Hex format: ensure 0x prefix and validate
  const hexAddr = trimmed.startsWith('0x') ? trimmed : '0x' + trimmed;
  
  // Validate hex format
  const cleanHex = hexAddr.slice(2);
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error(`Invalid hex address: contains non-hex characters`);
  }
  if (cleanHex.length % 2 !== 0) {
    throw new Error(`Invalid hex address: odd length (${cleanHex.length} chars)`);
  }
  
  return hexAddr;
}
```

**Key dependency:** Uses `mxToHex()` from `packages/totem-sdk/packages/core/src/minima32.ts` for Mx→Hex conversion.

### Usage in Transaction Building

The `normalizeAddressToHex()` function is called for:

1. **Recipient addresses** - Output coin destination
2. **Change addresses** - Return excess funds to sender
3. **Input coin addresses** - When building from raw address strings

**Example flow (from buildTransaction):**
```typescript
// 1. Normalize address format
const normalizedRecipient = normalizeAddressToHex(recipientAddress);  // "MxG0..." → "0x1a2b..."

// 2. Convert to bytes (separate step in builder)
const recipientBytes = hexToBytes(normalizedRecipient);

// 3. Pad to 32 bytes for Coin serialization (separate step in builder)
const paddedRecipient = new Uint8Array(32);
paddedRecipient.set(recipientBytes.slice(0, 32));
```

**Note:** `normalizeAddressToHex()` only handles format conversion and validation. The subsequent byte conversion and 32-byte padding are performed separately in the transaction builder when constructing Coin objects.

---

## Transaction Structure

### MinimaTransaction

```typescript
interface MinimaTransaction {
  linkHash: Uint8Array;      // 32 bytes, 0x00 for normal transactions
  inputs: Coin[];            // UTXOs being spent
  outputs: Coin[];           // New UTXOs being created
  state: StateVariable[];    // Optional state variables
}
```

### Coin Structure

```typescript
interface Coin {
  coinId: Uint8Array;        // 32 bytes - unique identifier
  address: Uint8Array;       // 32 bytes - recipient address
  amount: bigint;            // Amount in base units
  tokenId: Uint8Array;       // 32 bytes - 0x00 for native MINIMA
  token: Token | null;       // Optional token metadata
  storeState: boolean;       // Whether to store state
  state: StateVariable[];    // Coin state variables
  mmrEntryNumber: bigint;    // MMR position
  spent: boolean;            // Whether coin is spent
  created: bigint;           // Block number created
}
```

---

## Transaction Serialization

**Java (Transaction.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    MiniNumber.WriteToStream(zOut, mInputs.size());
    for(Coin coin : mInputs) {
        coin.writeDataStream(zOut);
    }
    
    MiniNumber.WriteToStream(zOut, mOutputs.size());
    for(Coin coin : mOutputs) {
        coin.writeDataStream(zOut);
    }
    
    MiniNumber.WriteToStream(zOut, mState.size());
    for(StateVariable sv : mState) {
        sv.writeDataStream(zOut);
    }
    
    mLinkHash.writeHashToStream(zOut);  // 4-byte length + 32 bytes
}
```

**Format:**
```
[MiniNumber inputCount]
[Coin...] × inputCount
[MiniNumber outputCount]
[Coin...] × outputCount
[MiniNumber stateCount]
[StateVariable...] × stateCount
[MiniData linkHash]  // 4-byte length + 32 bytes
```

---

## Coin Serialization

**Java (Coin.java) - Verified from official Minima source:**
```java
@Override
public void writeDataStream(DataOutputStream zOut) throws IOException {
    mCoinID.writeHashToStream(zOut);           // 1. MiniData (4-byte len + hash)
    mAddress.writeHashToStream(zOut);          // 2. MiniData (4-byte len + hash)
    mAmount.writeDataStream(zOut);             // 3. MiniNumber
    mTokenID.writeHashToStream(zOut);          // 4. MiniData (4-byte len + tokenId)
    
    MiniByte.WriteToStream(zOut, mStoreState); // 5. MiniByte
    
    mMMREntryNumber.writeDataStream(zOut);     // 6. MMREntryNumber
    mSpent.writeDataStream(zOut);              // 7. MiniByte
    mBlockCreated.writeDataStream(zOut);       // 8. MiniNumber
    
    MiniNumber.WriteToStream(zOut, mState.size()); // 9. MiniNumber (count)
    for(StateVariable sv : mState) {               // 10. StateVariable[]
        sv.writeDataStream(zOut);
    }
    
    if(mToken == null) {                        // 11. MiniByte (hasToken flag)
        MiniByte.WriteToStream(zOut, false);
    }else {
        MiniByte.WriteToStream(zOut, true);
        mToken.writeDataStream(zOut);           // 12. Token (if present)
    }
}
```

**Format:**
```
[MiniData coinId]       // CRITICAL: See coinId note below!
[MiniData address]      // 4 + 32 = 36 bytes
[MiniNumber amount]     // scale=44 for MINIMA amounts
[MiniData tokenId]      // 4-byte len + N bytes (NOTE: 0x00 for native MINIMA = 5 bytes total)
[MiniByte storeState]   // 1 byte
[MiniNumber mmrEntry]   // MMREntryNumber format
[MiniByte spent]        // 1 byte
[MiniNumber created]    // Block number
[MiniNumber stateCount] // Count of state variables
[StateVariable...]      // Each state variable
[MiniByte hasToken]     // 1 byte (0 or 1)
[Token?]                // Only if hasToken = 1 (Token metadata, NOT tokenId)
```

**CRITICAL - CoinID for Output Coins (January 2026 Fix):**
- `coinId` (field 1): For **OUTPUT coins**, Java uses `COINID_OUTPUT = new MiniData("0x00")` which is **1 byte** (not 32 zeros!).
  - For **input coins**: coinId = 32-byte hash, serialized = `[0x00, 0x00, 0x00, 0x20, ...32 bytes...]` = **36 bytes total**
  - For **output coins**: coinId = `0x00` (1 byte data), serialized = `[0x00, 0x00, 0x00, 0x01, 0x00]` = **5 bytes total**
  - **BUG FIX**: Previously used 32 zero bytes for output coinId, causing 31-byte mismatch per output coin and transaction ID hash failure!
  - See Coin.java line 24: `public static final MiniData COINID_OUTPUT = new MiniData("0x00");`

**Important distinction:**
- `tokenId` (field 4): The token identifier hash, serialized as MiniData.
  - For **native MINIMA**: tokenId = `0x00` (1 byte data), serialized = `[0x00, 0x00, 0x00, 0x01, 0x00]` = **5 bytes total**
  - For **custom tokens**: tokenId = 32-byte hash, serialized = `[0x00, 0x00, 0x00, 0x20, ...32 bytes...]` = **36 bytes total**
- `hasToken + Token` (fields 11-12): Optional token METADATA (name, description, decimals, etc.). Not present for native MINIMA.

**Native MINIMA TokenId Serialization Example:**
```
tokenId = 0x00 (1 byte)
serialized = serializeMiniData(0x00)
           = [0x00, 0x00, 0x00, 0x01]  // 4-byte length = 1
           + [0x00]                    // 1 byte data
           = 5 bytes total
```

---

## StateVariable Serialization

**Java (StateVariable.java) - VERIFIED:**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    // Port and Type
    mPort.writeDataStream(zOut);   // MiniByte - 1 byte (0-255)
    mType.writeDataStream(zOut);   // MiniByte - 1 byte (1, 2, 4, or 8)
    
    // Write the data in the correct format based on type
    if(mType.isEqual(STATETYPE_BOOL)) {           // type = 8
        if(mData.isEqual("TRUE")) {
            MiniByte.TRUE.writeDataStream(zOut);  // MiniByte - 1 byte
        } else {
            MiniByte.FALSE.writeDataStream(zOut); // MiniByte - 1 byte
        }
    } else if(mType.isEqual(STATETYPE_HEX)) {     // type = 1
        MiniData data = new MiniData(mData.toString());
        data.writeDataStream(zOut);               // MiniData - 4-byte len + bytes
        
    } else if(mType.isEqual(STATETYPE_NUMBER)) {  // type = 2
        MiniNumber number = new MiniNumber(mData.toString());
        number.writeDataStream(zOut);             // MiniNumber - scale + len + bytes
    
    } else if(mType.isEqual(STATETYPE_STRING)) {  // type = 4
        mData.writeDataStream(zOut);              // MiniString - 4-byte len + UTF-8
    }
}
```

**Format:**
```
[MiniByte port]         // 1 byte (0-255)
[MiniByte type]         // 1 byte: 1=HEX, 2=NUMBER, 4=STRING, 8=BOOL
[type-specific data]    // Format depends on type (see table)
```

**Type encoding:**
| Type | Value | Data Format | Total Size |
|------|-------|-------------|------------|
| HEX | 1 | MiniData (4-byte len + bytes) | 2 + 4 + N |
| NUMBER | 2 | MiniNumber (scale + len + bytes) | 2 + 1 + 1 + N |
| STRING | 4 | MiniString (4-byte len + UTF-8) | 2 + 4 + N |
| BOOL | 8 | MiniByte (0 or 1) | 2 + 1 = 3 |

**⚠️ Implementation Note:**
Our current TypeScript implementation uses a simplified format:
```typescript
function serializeStateVariable(sv: StateVariable): Uint8Array {
  const portBytes = encodeMiniNumber(BigInt(sv.port));  // WRONG: should be MiniByte
  const dataBytes = encodeMiniData(sv.data);            // WRONG: should be type-aware
  return concat(portBytes, dataBytes);
}
```

This works for our current use case because:
1. Input coins use CoinProofs from server (pre-serialized by Java)
2. Output coins typically have empty state arrays

**TODO:** Update `serializeStateVariable()` to match Java format for full compatibility with non-empty output state.

---

## Witness Serialization

**Java (Witness.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    MiniNumber.WriteToStream(zOut, mSignatures.size());
    for(Signature sig : mSignatures) {
        sig.writeDataStream(zOut);
    }
    
    MiniNumber.WriteToStream(zOut, mCoinProofs.size());
    for(CoinProof cp : mCoinProofs) {
        cp.writeDataStream(zOut);
    }
    
    MiniNumber.WriteToStream(zOut, mScriptProofs.size());
    for(ScriptProof sp : mScriptProofs) {
        sp.writeDataStream(zOut);
    }
}
```

**Format:**
```
[MiniNumber signatureCount]
[Signature...] × signatureCount
[MiniNumber coinProofCount]
[CoinProof...] × coinProofCount
[MiniNumber scriptProofCount]
[ScriptProof...] × scriptProofCount
```

---

## Transaction ID (Digest) Computation

The `transactionid` is computed using **SHA3-256** (NIST FIPS 202):

```typescript
import { sha3_256 } from '@noble/hashes/sha3';

function computeTransactionId(tx: MinimaTransaction): Uint8Array {
  const serialized = serializeTransaction(tx);
  return sha3_256(serialized);
}
```

**Note:** Minima uses SHA3-256 (not Keccak-256) for quantum resistance. SHA3-256 uses padding byte `0x06` per NIST FIPS 202, while Keccak-256 (Ethereum) uses `0x01`.

---

## txnimport Format (TxnRow)

The `txnimport` command expects **TxnRow** format (NOT TxPoW!):

**Java (TxnRow.java):**
```java
public void writeDataStream(DataOutputStream zOut) throws IOException {
    new MiniString(mID).writeDataStream(zOut);    // MiniString ID
    mTransaction.writeDataStream(zOut);            // Transaction
    mWitness.writeDataStream(zOut);                // Witness
}
```

**Format:**
```
[MiniString ID]     // 4-byte length + UTF-8 bytes
[Transaction]
[Witness]
```

**Example hex breakdown:**
```
0x0000001037354242303242304644424442394338000101...
    ^^^^^^^                                    
    ID length = 16 (0x10)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
           ASCII "75BB02B0FDBDB9C8" (16 bytes)
                                              ^^^^
                                              Transaction starts here
```

---

## Minima Amount Precision

Minima uses **44 decimal places** internally:

```typescript
const MINIMA_DECIMALS = 44;

function parseDecimalToBaseUnits(decimal: string): bigint {
  const [whole, frac = ''] = decimal.split('.');
  const paddedFrac = frac.padEnd(MINIMA_DECIMALS, '0');
  return BigInt(whole + paddedFrac);
}

function formatBaseUnitsToDecimal(baseUnits: bigint): string {
  const str = baseUnits.toString().padStart(MINIMA_DECIMALS + 1, '0');
  const whole = str.slice(0, -MINIMA_DECIMALS);
  const frac = str.slice(-MINIMA_DECIMALS).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}
```

---

## Token IDs

```typescript
const MINIMA_TOKEN_ID = new Uint8Array(32);  // All zeros (native MINIMA)
const TOKEN_CREATE_ID = new Uint8Array(32).fill(0xFF);  // Token creation marker
```

---

## Implementation Files

| Component | TypeScript File |
|-----------|-----------------|
| Primitive serialization | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` |
| TreeKey signing | `packages/totem-sdk/packages/core/src/treekey.ts` |
| Transaction building | `packages/totem-extension/src/core/transaction/index.ts` |
| Witness serialization | `packages/totem-extension/src/core/transaction/utils/WitnessSerializer.ts` |
| Enhanced builder | `packages/totem-extension/src/core/transaction/EnhancedTransactionBuilder.ts` |

---

## References

- Minima Java Source: https://github.com/minima-global/Minima
- MiniData.java: `src/org/minima/objects/base/MiniData.java`
- MiniNumber.java: `src/org/minima/objects/base/MiniNumber.java`
- MiniString.java: `src/org/minima/objects/base/MiniString.java`
- MiniByte.java: `src/org/minima/objects/base/MiniByte.java`
- MMRData.java: `src/org/minima/database/mmr/MMRData.java`
- MMRProof.java: `src/org/minima/database/mmr/MMRProof.java`
- Signature.java: `src/org/minima/objects/keys/Signature.java`
- SignatureProof.java: `src/org/minima/objects/keys/SignatureProof.java`
- TreeKey.java: `src/org/minima/objects/keys/TreeKey.java`
- Transaction.java: `src/org/minima/objects/Transaction.java`
- Witness.java: `src/org/minima/objects/Witness.java`
- TxnRow.java: `src/org/minima/database/txpowtree/TxnRow.java`
