/**
 * @module @totemsdk/core
 * Core cryptographic primitives, adapters, and utilities for Minima blockchain.
 *
 * Cryptographic primitives are backed by Rust/WASM (@totemsdk/core-wasm).
 * Legacy JS implementations are available at @totemsdk/core/legacy.
 */

// Version information for bundle duplication detection
export * from './version.js';

// Platform-agnostic Adapters (SDK Upgrade)
export * from './adapters/index.js';

// Lease Management (SDK Upgrade) - exclude conflicting WotsIndices
export {
  LeaseStore,
  WatermarkStore,
  LeaseMonitor,
  prepareLease,
  finalizeLease,
  flatIndexFromLanes,
  type StoredLease,
  type LeaseStatus,
  type LeaseStoreConfig,
  type LeaseWotsIndices,
  type WatermarkState,
  type SyncResult,
  type WatermarkStoreConfig,
  type LeaseExpiryEvent,
  type LeaseExpiryCallback,
  type LeaseMonitorConfig,
  type PrepareArgs,
  type PrepareResp,
} from './lease/index.js';

// Transaction Management (SDK Upgrade) - exclude conflicting WotsIndices
export {
  TransactionService,
  TransactionLifecycle,
  TransactionLifecycleError,
  WatermarkExhaustedError,
  TransactionReceiptStore,
  type TransactionServiceConfig,
  type WotsSigningDependencies,
  type TransactionLifecycleConfig,
  type WatermarkSyncFunction,
  type PrepareResult,
  type TransactionReceiptStoreConfig,
  type PrepareRequest,
  type PrepareResponse,
  type SignRequest,
  type SignResult,
  type HierarchicalWitnessBundle,
  type WitnessBundle,
  type FinalizeRequest,
  type FinalizeResponse,
  type TransactionMetadata,
  type TransactionReceipt,
  type TransactionError,
} from './tx/index.js';

// Canonical WotsIndices type (use from tx/types)
export type { WotsIndices } from './tx/index.js';

// ---------------------------------------------------------------------------
// Cryptographic primitives — backed by Rust/WASM (@totemsdk/core-wasm)
// ---------------------------------------------------------------------------

// Utilities
export { bytesToHex, hexToBytes, concatBytes } from './wasm-sync.js';

// SHA3-256
export { sha3_256 } from './wasm-sync.js';

// WOTS Signatures
export {
  expandPrivateKey,
  hashChain,
  derivePKdigest,
  deriveFullPublicKey,
  wotsSign,
  wotsVerify,
  wotsVerifyDigest,
  wotsPkFromSig,
  wotsPublicKeyFromSeed,
  wotsKeypairFromSeed,
} from './wasm-sync.js';

// WOTS Params (from params.ts — constants, no crypto)
export * from './params.js';

// Java-Compatible Serialization
export {
  deriveChainSeedJava,
  derivePerAddressSeed,
  deriveRootPrivSeed,
  writeMiniNumber,
  writeMiniData,
  writeMiniString,
  precomputeTransactionCoinID,
} from './wasm-sync.js';

// TreeKey/TreeKeyNode — WASM-backed
export {
  createUnifiedChildTreeKey,
  createUnifiedRootTreeKey,
  deriveUnifiedAddressPublicKey,
  verifyTreeSignature,
  mmrRootFromPublicKeys,
  verifyMMRProof,
} from './wasm-sync.js';

// BIP39 Seed Phrase Handling
export {
  phraseToSeed,
  generateWordList,
  validatePhrase,
  cleanSeedPhrase,
} from './wasm-sync.js';

// Address Derivation
export {
  makeMxAddress,
  parseMxAddress,
  wotsAddressFromKeypair,
} from './wasm-sync.js';

// Transaction Serialization & Digest
export {
  serializeTransaction,
  computeTransactionDigest,
} from './wasm-sync.js';

// Verification
export {
  timingSafeEqual,
  createChallenge,
  validateChallenge,
} from './wasm-sync.js';

// ---------------------------------------------------------------------------
// TypeScript-only modules (no crypto — keep as-is)
// ---------------------------------------------------------------------------

// Script helpers (for address derivation)
export { scriptFromWotsPk } from './script.js';

// Base32 Encoding (Minima-compatible) — re-export from WASM
export { makeMxAddress as encodeMx, parseMxAddress as decodeMx } from './wasm-sync.js';

// Merkle Mountain Range (original JS — types and helpers)
export * from './mmr.js';

// Script Types, Witness Serializer, Contract Helpers
export * from './scripts/index.js';

// Address Derivation (original)
export { scriptToAddress, addressToRoot } from './derive.js';

// BIP39 — re-export word list and legacy helpers from JS
export {
  WORD_LIST,
  convertStringToSeed,
  convertWordListToSeed,
  generateSeedPhrase,
} from './bip39.js';

// Transaction types (from JS)
export {
  type MinimaTransaction,
  type MinimaCoin,
  type ParsedMiniNumber,
  type MinimaToken,
  type StateVariable,
  type RawStateVariable,
  type CoinProofData,
  type SpendableCoinInput,
  type TransactionBuildResult,
  parseDecimalToMiniNumber,
  serializeCoin,
  createDefaultTransaction,
  buildMinimaCoin,
} from './transaction.js';

// High-level Verification API (convenience functions for integrators)
export {
  verifySignature,
  verifySignatureDetailed,
  verifyTreeSignatureDetailed,
  deriveAddressFromPublicKey,
  normalizeHex,
  type VerificationResult,
} from './verify.js';

// Streamable primitives (low-level serialization building blocks)
export {
  writeMiniByte,
  writeMMREntryNumber,
  concat,
  bigIntToByteArray,
  type Bytes,
} from './Streamable.js';

// Java-Compatible Serialization Helpers (non-crypto)
export {
  serializeMiniNumber,
  serializeMiniData,
  hashAllObjects,
  deriveChildTreeSeedJava,
  hashObject,
  serializeMiniNumberZERO,
  serializeMiniNumberONE,
  writeHashToStream,
  javaHashAllObjects,
  indexToMiniDataBytes,
  deriveUnifiedChildSeed,
  createMMREntryNumber,
  serializeMMREntryNumber,
  serializeMMRData,
  serializeMMREntry,
  type MMREntryNumber as JavaMMREntryNumber,
  type MMRData as JavaMMRData,
  type MMREntry as JavaMMREntry,
} from './javaStreamables.js';

// TreeKey/TreeKeyNode — JS types and helpers
export {
  TreeKey,
  TreeKeyNode,
  serializeTreeSignature,
  deserializeTreeSignature,
  getRootPublicKey,
  DEFAULT_KEYS_PER_LEVEL,
  DEFAULT_LEVELS,
  createUnifiedChildTreeKeyAsync,
  createPerAddressTreeKey,
  createPerAddressTreeKeyAsync,
  type KeyGenProgress,
  type ProgressCallback,
  type SignatureProof,
  type TreeSignature,
} from './treekey.js';

// WOTS legacy types
export type { WotsKeypair, WotsSignature } from './wots.js';

// Constants
export const MINIMA_CONSTANTS = {
  WOTS_W: 8,
  WOTS_N: 32,
  MAX_SIGNATURES: 262144,
  SIGNATURE_LEVELS: 3,
  ADDRESS_PREFIX: 'Mx',
  NETWORK_ID: 1
} as const;
