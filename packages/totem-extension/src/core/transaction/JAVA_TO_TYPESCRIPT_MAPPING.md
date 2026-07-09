# Minima Java to Totem TypeScript Mapping

This document maps each Minima Java source file in `attached_assets/` to its corresponding Totem TypeScript implementation.

**Last Updated:** 2026-01-21

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Full | Complete byte-exact implementation |
| ⚡ Partial | Core functionality implemented, some features pending |
| 🔧 Test Only | Used as reference for test vectors |
| ❌ N/A | Not applicable to client-side wallet |

---

## 1. WOTS Cryptography

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `Winternitz_*.java` | `packages/totem-sdk/packages/core/src/wots.ts` | ✅ Full | GMSSRandom PRNG, 34-chain signatures, BouncyCastle-compatible |
| `TreeKey_*.java` | `packages/totem-sdk/packages/core/src/treekey.ts` | ✅ Full | 3-level hierarchy (64×64×64), parent-child caching |
| `TreeKeyNode_*.java` | `packages/totem-sdk/packages/core/src/treekey.ts` | ✅ Full | Embedded in TreeKey, childCache for performance |
| `GMSSRandom_bouncycastle.java` | `packages/totem-sdk/packages/core/src/wots.ts` | ✅ Full | `gmssRandom()` function, byte-exact with BouncyCastle |
| `WinternitzOTSignature_bouncycastle.java` | `packages/totem-sdk/packages/core/src/wots.ts` | ✅ Full | Reference for signing algorithm |
| `WinternitzOTSVerify_bouncycastle.java` | `packages/totem-sdk/packages/core/src/wots.ts` | ✅ Full | Reference for verification algorithm |

---

## 2. MMR (Merkle Mountain Range) Trees

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `MMR_*.java` | `packages/totem-sdk/packages/core/src/mmr.ts` | ✅ Full | MMRTree class, proof generation |
| `MMRData_*.java` | `packages/totem-sdk/packages/core/src/mmr.ts` | ✅ Full | `createMMRDataLeafNode()`, `combineMMRData()` |
| `MMREntry_*.java` | `packages/totem-sdk/packages/core/src/mmr.ts` | ✅ Full | MMREntry type with data, row, isLeft fields |
| `MMREntryNumber_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeMMREntryNumber()` - compact format |
| `MMRProof_*.java` | `packages/totem-sdk/packages/core/src/mmr.ts` | ✅ Full | `MMRProof` type, serialization in minimaWireSerializer.ts |
| `MegaMMR_*.java` | N/A | ❌ N/A | Server-side only (chain-wide UTXO set) |

---

## 3. Serialization Primitives (Streamable Pattern)

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `MiniData_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeMiniData()` - 4-byte BE length + bytes |
| `MiniNumber_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeMiniNumber()` - scale-44 BigDecimal |
| `MiniString_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeMiniString()` - 4-byte len + UTF-8 |
| `MiniByte_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeMiniByte()` - single byte |
| `Streamable_*.java` | `packages/totem-sdk/packages/core/src/javaStreamables.ts`, `packages/totem-extension/src/core/transaction/utils/Streamable.ts` | ✅ Full | Interface pattern for wire format |
| `FastByteArrayStream_*.java` | N/A | ❌ N/A | Java I/O utility, not needed in TypeScript |
| `BaseConverter_*.java` | `packages/totem-sdk/packages/core/src/minima32.ts` | ✅ Full | Minima Base32 encoding |

---

## 4. Signature Types

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `Signature_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeSignature()` - rootPubkey + proofs[] |
| `SignatureProof_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeSignatureProof()` - leafPubkey (32B digest) + sig (1088B) + MMRProof |

---

## 5. Transaction Types

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `Transaction_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeTransaction()` |
| `Witness_*.java` | `packages/totem-extension/src/core/transaction/utils/WitnessSerializer.ts` | ✅ Full | Signatures + CoinProofs + ScriptProofs |
| `Coin_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeCoin()` - all 12 fields |
| `CoinProof_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeCoinProof()` - Coin + MMRProof |
| `StateVariable_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ⚡ Partial | Simplified format, full type-aware pending |
| `Token_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | Token metadata serialization |
| `ScriptProof_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | `serializeScriptProof()` |
| `ScriptToken_*.java` | N/A | ❌ N/A | Script VM internal |

---

## 6. Address & Script

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `Address_*.java` | `packages/totem-sdk/packages/core/src/derive.ts` | ✅ Full | `deriveAddress()` - SHA3(script) |
| `ADDRESS_*.java` | `packages/totem-sdk/packages/core/src/script.ts` | ✅ Full | ADDRESS opcode implementation |
| `CHECKSIG_*.java` | `packages/totem-sdk/packages/core/src/script.ts` | ✅ Full | CHECKSIG opcode for signature verification |
| `CHECKSIGTests_*.java` | `packages/totem-sdk/packages/core/test/` | 🔧 Test Only | Test vectors |

---

## 7. Wallet & Key Management

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `Wallet_*.java` | `packages/totem-extension/src/core/wallet.ts` | ✅ Full | TotemWallet class |
| `KeyRow_*.java` | `packages/totem-extension/src/core/wallet.ts` | ⚡ Partial | Key storage embedded in wallet |
| `SeedRow_*.java` | `packages/totem-extension/src/core/wallet.ts` | ⚡ Partial | Seed management embedded |
| `ScriptRow_*.java` | N/A | ❌ N/A | Server-side script storage |
| `BIP39_*.java` | `packages/totem-sdk/packages/core/src/bip39.ts` | ✅ Full | Mnemonic generation/validation |

---

## 8. Transaction Commands (RPC)

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `sign_*.java` | `packages/totem-sdk/packages/core/src/treekey.ts` | ✅ Full | `setUses()` + `sign()` (3-proof chain matching Java TreeKey.sign()) |
| `verify_*.java` | `packages/totem-extension/src/core/verify/verifySignature.ts` | ✅ Full | Signature verification |
| `txncheck_*.java` | `packages/totem-extension/src/core/transaction/txncheck.ts` | ✅ Full | Transaction validation |
| `txnexport_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | ✅ Full | Export = serialization |
| `txnimport_*.java` | N/A | ⚡ Partial | Deserialization (import from server) |
| `txnbasics_*.java` | N/A | ❌ N/A | CLI command, not applicable to wallet |
| `coincheck_*.java` | N/A | ❌ N/A | Server-side coin validation |
| `coinexport_*.java` | N/A | ❌ N/A | Server-side coin export |
| `coinimport_*.java` | N/A | ❌ N/A | Server-side coin import |

---

## 9. Block & TxPoW Types

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `TxBlock_*.java` | N/A | ❌ N/A | Server-side block structure |
| `TxBody_*.java` | N/A | ❌ N/A | Server-side transaction body |
| `TxHeader_*.java` | N/A | ❌ N/A | Server-side block header |
| `TxHeaderTests_*.java` | N/A | 🔧 Test Only | Reference for header format |
| `TxPoWSearcher_*.java` | N/A | ❌ N/A | Server-side PoW search |
| `TxPowTree_*.java` | N/A | ❌ N/A | Server-side chain tree |
| `TxnDB_*.java` | N/A | ❌ N/A | Server-side transaction DB |
| `TxnRow_*.java` | N/A | ❌ N/A | Server-side DB row |

---

## 10. Cryptographic Utilities

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `Crypto_*.java` | `packages/totem-sdk/packages/core/src/wots.ts`, `packages/totem-sdk/packages/core/src/javaStreamables.ts` | ✅ Full | SHA3-256 via @noble/hashes, used throughout serialization |

---

## 11. Test Files (Golden Vectors)

| Java File | TypeScript File | Status | Notes |
|-----------|-----------------|--------|-------|
| `AddressTests_*.java` | `packages/totem-sdk/packages/core/src/address.test.ts` | 🔧 Test Only | Address derivation vectors |
| `CoinTests_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.test.ts` | 🔧 Test Only | Coin serialization vectors |
| `TokenTests_*.java` | `packages/totem-sdk/packages/core/src/minimaWireSerializer.test.ts` | 🔧 Test Only | Token serialization vectors |
| `TransactionTests_*.java` | `packages/totem-extension/src/core/transaction/__tests__/` | 🔧 Test Only | Transaction golden vectors |
| `TxHeaderTests_*.java` | N/A | 🔧 Test Only | Reference only |

---

## Summary Statistics

| Status | Count |
|--------|-------|
| ✅ Full Implementation | 38 |
| ⚡ Partial Implementation | 4 |
| 🔧 Test/Reference Only | 6 |
| ❌ Not Applicable (Server-side) | 15 |
| **Total Unique Java Files** | **63** |

---

## File Location Quick Reference

### Primary TypeScript Files

| File | Purpose |
|------|---------|
| `packages/totem-sdk/packages/core/src/wots.ts` | WOTS signatures, GMSSRandom, Winternitz |
| `packages/totem-sdk/packages/core/src/treekey.ts` | TreeKey hierarchy, signing methods |
| `packages/totem-sdk/packages/core/src/mmr.ts` | MMR tree construction and proofs |
| `packages/totem-sdk/packages/core/src/minimaWireSerializer.ts` | All Streamable serialization |
| `packages/totem-sdk/packages/core/src/javaStreamables.ts` | Java-compatible type definitions |
| `packages/totem-sdk/packages/core/src/derive.ts` | Address derivation |
| `packages/totem-sdk/packages/core/src/bip39.ts` | BIP39 mnemonic handling |
| `packages/totem-sdk/packages/core/src/minima32.ts` | Minima Base32 encoding |
| `packages/totem-sdk/packages/core/src/script.ts` | Script opcodes |
| `packages/totem-extension/src/core/wallet.ts` | Wallet management |
| `packages/totem-extension/src/core/transaction/txncheck.ts` | Transaction validation |
| `packages/totem-extension/src/core/verify/verifySignature.ts` | Signature verification |

---

## Notes

1. **Duplicate Java Files:** Many Java files have multiple versions with different timestamps (e.g., `MMR_1767464991150.java`, `MMR_1768742834147.java`). These are snapshots of the same source at different times. The latest timestamp typically has the most current implementation.

2. **Server-side Files:** Files marked ❌ N/A are server-side only (blockchain node, database, block production) and not applicable to a client-side wallet extension.

3. **BouncyCastle Files:** The `*_bouncycastle.java` files contain the reference implementation from BouncyCastle's post-quantum cryptography library, used to ensure byte-exact compatibility.

4. **Test Vectors:** Java test files (`*Tests_*.java`) provide golden vectors for validating TypeScript implementations.

---

## Appendix: Complete Java Class List

The following table lists every unique Java class name from `attached_assets/` with its explicit mapping:

| # | Java Class | TypeScript Equivalent | Status |
|---|------------|----------------------|--------|
| 1 | `Address` | `derive.ts` | ✅ Full |
| 2 | `ADDRESS` | `script.ts` | ✅ Full |
| 3 | `AddressTests` | `address.test.ts` | 🔧 Test |
| 4 | `BaseConverter` | `minima32.ts` | ✅ Full |
| 5 | `BIP39` | `bip39.ts` | ✅ Full |
| 6 | `CHECKSIG` | `script.ts` | ✅ Full |
| 7 | `CHECKSIGTests` | test files | 🔧 Test |
| 8 | `Coin` | `minimaWireSerializer.ts` | ✅ Full |
| 9 | `coincheck` | N/A | ❌ N/A |
| 10 | `coinexport` | N/A | ❌ N/A |
| 11 | `coinimport` | N/A | ❌ N/A |
| 12 | `CoinProof` | `minimaWireSerializer.ts` | ✅ Full |
| 13 | `CoinTests` | `minimaWireSerializer.test.ts` | 🔧 Test |
| 14 | `Crypto` | `wots.ts`, `javaStreamables.ts` | ✅ Full |
| 15 | `FastByteArrayStream` | N/A | ❌ N/A |
| 16 | `GMSSRandom` | `wots.ts` | ✅ Full |
| 17 | `KeyRow` | `wallet.ts` | ⚡ Partial |
| 18 | `MegaMMR` | N/A | ❌ N/A |
| 19 | `MiniByte` | `minimaWireSerializer.ts` | ✅ Full |
| 20 | `MiniData` | `minimaWireSerializer.ts` | ✅ Full |
| 21 | `MiniNumber` | `minimaWireSerializer.ts` | ✅ Full |
| 22 | `MiniString` | `minimaWireSerializer.ts` | ✅ Full |
| 23 | `MMR` | `mmr.ts` | ✅ Full |
| 24 | `MMRData` | `mmr.ts` | ✅ Full |
| 25 | `MMREntry` | `mmr.ts` | ✅ Full |
| 26 | `MMREntryNumber` | `minimaWireSerializer.ts` | ✅ Full |
| 27 | `MMRProof` | `mmr.ts`, `minimaWireSerializer.ts` | ✅ Full |
| 28 | `ScriptProof` | `minimaWireSerializer.ts` | ✅ Full |
| 29 | `ScriptRow` | N/A | ❌ N/A |
| 30 | `ScriptToken` | N/A | ❌ N/A |
| 31 | `SeedRow` | `wallet.ts` | ⚡ Partial |
| 32 | `sign` | `treekey.ts` | ✅ Full |
| 33 | `Signature` | `minimaWireSerializer.ts` | ✅ Full |
| 34 | `SignatureProof` | `minimaWireSerializer.ts` | ✅ Full |
| 35 | `StateVariable` | `minimaWireSerializer.ts` | ⚡ Partial |
| 36 | `Streamable` | `javaStreamables.ts`, `Streamable.ts` | ✅ Full |
| 37 | `Token` | `minimaWireSerializer.ts` | ✅ Full |
| 38 | `TokenTests` | test files | 🔧 Test |
| 39 | `Transaction` | `minimaWireSerializer.ts` | ✅ Full |
| 40 | `TransactionTests` | `JavaParityVectors.test.ts` | 🔧 Test |
| 41 | `TreeKey` | `treekey.ts` | ✅ Full |
| 42 | `TreeKeyNode` | `treekey.ts` | ✅ Full |
| 43 | `TxBlock` | N/A | ❌ N/A |
| 44 | `TxBody` | N/A | ❌ N/A |
| 45 | `TxHeader` | N/A | ❌ N/A |
| 46 | `TxHeaderTests` | N/A | 🔧 Test |
| 47 | `txnbasics` | N/A | ❌ N/A |
| 48 | `txncheck` | `txncheck.ts` | ✅ Full |
| 49 | `TxnDB` | N/A | ❌ N/A |
| 50 | `txnexport` | `minimaWireSerializer.ts` | ✅ Full |
| 51 | `txnimport` | N/A | ⚡ Partial |
| 52 | `TxnRow` | N/A | ❌ N/A |
| 53 | `TxPoWSearcher` | N/A | ❌ N/A |
| 54 | `TxPowTree` | N/A | ❌ N/A |
| 55 | `verify` | `verifySignature.ts` | ✅ Full |
| 56 | `Wallet` | `wallet.ts` | ✅ Full |
| 57 | `Winternitz` | `wots.ts` | ✅ Full |
| 58 | `WinternitzOTSignature` | `wots.ts` | ✅ Full |
| 59 | `WinternitzOTSVerify` | `wots.ts` | ✅ Full |
| 60 | `Witness` | `WitnessSerializer.ts` | ✅ Full |
| 61 | `GMSSRandom_bouncycastle` | `wots.ts` | ✅ Full |
| 62 | `WinternitzOTSignature_bouncycastle` | `wots.ts` | ✅ Full |
| 63 | `WinternitzOTSVerify_bouncycastle` | `wots.ts` | ✅ Full |

**Verification:** 63 unique Java files from attached_assets/ (excluding timestamp suffixes). The BouncyCastle variants are the reference implementations from BouncyCastle's post-quantum cryptography library.
