/**
 * @module @totemsdk/core
 * Core cryptographic primitives, adapters, and utilities for Minima blockchain
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

// Utilities first (canonical concatBytes source)
export * from './utils.js';

// WOTS Signatures - wots.concatBytes is intentionally shadowed by utils.concatBytes above
export {
  F,
  hex,
  fromHex,
  u16be,
  u32be,
  assert32,
  h,
  prfChainSeed,
  toWinternitzDigits,
  baseWWithChecksum,
  derivePKdigest,
  wotsKeypairFromSeed,
  wotsSign,
  wotsSignLegacy,
  wotsPkFromSig,
  wotsVerify,
  wotsVerifyDigest,
  wotsPublicKeyFromSeed,
  type WotsKeypair,
  type WotsSignature,
} from './wots.js';

// WOTS Params (from params.ts, imported by wots.ts)
export * from './params.js';

// Java-Compatible Serialization Helpers (for Minima-compatible seed derivation)
export {
  serializeMiniNumber,
  serializeMiniData,
  hashAllObjects,
  deriveChainSeedJava,
  deriveChildTreeSeedJava,
  hashObject,
  serializeMiniNumberZERO,
  serializeMiniNumberONE,
  writeHashToStream,
  javaHashAllObjects,
  // Per-address key derivation (Minima Wallet.java compatible) - kept for migration detection
  indexToMiniDataBytes,
  derivePerAddressSeed,
  // Unified hierarchical key derivation (2026-06)
  deriveRootPrivSeed,
  deriveUnifiedChildSeed,
  // MMREntryNumber and MMREntry serialization (2026-01-18)
  createMMREntryNumber,
  serializeMMREntryNumber,
  serializeMMRData,
  serializeMMREntry,
  precomputeTransactionCoinID,
  type MMREntryNumber as JavaMMREntryNumber,
  type MMRData as JavaMMRData,
  type MMREntry as JavaMMREntry,
} from './javaStreamables.js';

// TreeKey/TreeKeyNode - Hierarchical WOTS key tree matching Minima's TreeKey.java
export {
  TreeKey,
  type KeyGenProgress,
  type ProgressCallback,
  TreeKeyNode,
  verifyTreeSignature,
  serializeTreeSignature,
  deserializeTreeSignature,
  getRootPublicKey,
  DEFAULT_KEYS_PER_LEVEL,
  DEFAULT_LEVELS,
  type SignatureProof,
  type TreeSignature,
  // Unified hierarchical TreeKey factories (2026-06)
  createUnifiedChildTreeKey,
  createUnifiedChildTreeKeyAsync,
  createUnifiedRootTreeKey,
  deriveUnifiedAddressPublicKey,
  // @deprecated — migrate to createUnifiedChildTreeKey
  createPerAddressTreeKey,
  createPerAddressTreeKeyAsync,
} from './treekey.js';

// Script helpers (for address derivation)
export { scriptFromWotsPk, wotsAddressFromKeypair } from './script.js';

// Base32 Encoding (Minima-compatible)
export * from './minima32.js';

// Merkle Mountain Range (original)
export * from './mmr.js';

// Script Types, Witness Serializer, Contract Helpers
export * from './scripts/index.js';

// Address Derivation (original)
export { scriptToAddress, addressToRoot } from './derive.js';

// BIP39 Seed Phrase Handling (Minima-compatible, NOT standard BIP39)
export {
  WORD_LIST,
  cleanSeedPhrase,
  validatePhrase,
  convertStringToSeed,
  convertWordListToSeed,
  phraseToSeed,
  generateWordList,
  generateSeedPhrase,
} from './bip39.js';

// Transaction Serialization & Digest (Java-compatible, extension parity)
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
  serializeTransaction,
  computeTransactionDigest,
  precomputeTransactionCoinID as precomputeTransactionCoinIDTx,
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
  createChallenge,
  validateChallenge,
  type VerificationResult,
} from './verify.js';

// Constants
export const MINIMA_CONSTANTS = {
  WOTS_W: 8,
  WOTS_N: 32,
  MAX_SIGNATURES: 262144,
  SIGNATURE_LEVELS: 3,
  ADDRESS_PREFIX: 'Mx',
  NETWORK_ID: 1
} as const;

// Streamable primitives (low-level serialization building blocks)
export {
  writeMiniNumber,
  writeMiniData,
  writeMiniByte,
  writeMMREntryNumber,
  concat,
  hexToBytes,
  bytesToHex,
  bigIntToByteArray,
  writeMiniString,
  type Bytes,
} from './Streamable.js';
