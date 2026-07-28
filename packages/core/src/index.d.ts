/**
 * @module @totemsdk/core
 * Core cryptographic primitives, adapters, and utilities for Minima blockchain
 */
export * from './adapters';
export { LeaseStore, WatermarkStore, LeaseMonitor, prepareLease, finalizeLease, flatIndexFromLanes, type StoredLease, type LeaseStatus, type LeaseStoreConfig, type LeaseWotsIndices, type WatermarkState, type SyncResult, type WatermarkStoreConfig, type LeaseExpiryEvent, type LeaseExpiryCallback, type LeaseMonitorConfig, type PrepareArgs, type PrepareResp, } from './lease';
export { TransactionService, TransactionLifecycle, TransactionLifecycleError, WatermarkExhaustedError, TransactionReceiptStore, type TransactionServiceConfig, type WotsSigningDependencies, type TransactionLifecycleConfig, type WatermarkSyncFunction, type PrepareResult, type TransactionReceiptStoreConfig, type PrepareRequest, type PrepareResponse, type SignRequest, type SignResult, type WitnessBundle, type FinalizeRequest, type FinalizeResponse, type TransactionMetadata, type TransactionReceipt, type TransactionError, } from './tx';
export type { WotsIndices } from './tx';
export * from './utils';
export { F, hex, fromHex, u16be, u32be, assert32, h, prfChainSeed, toWinternitzDigits, baseWWithChecksum, derivePKdigest, wotsKeypairFromSeed, wotsSign, wotsSignLegacy, wotsPkFromSig, wotsVerify, wotsPublicKeyFromSeed, type WotsKeypair, type WotsSignature, } from './wots';
export * from './params';
export { serializeMiniNumber, serializeMiniData, hashAllObjects, deriveChainSeedJava, deriveChildTreeSeedJava, hashObject, serializeMiniNumberZERO, serializeMiniNumberONE, writeHashToStream, javaHashAllObjects, indexToMiniDataBytes, derivePerAddressSeed, createMMREntryNumber, serializeMMREntryNumber, serializeMMRData, serializeMMREntry, type MMREntryNumber as JavaMMREntryNumber, type MMRData as JavaMMRData, type MMREntry as JavaMMREntry, } from './javaStreamables';
export { TreeKey, type KeyGenProgress, type ProgressCallback, TreeKeyNode, verifyTreeSignature, serializeTreeSignature, deserializeTreeSignature, getRootPublicKey, DEFAULT_KEYS_PER_LEVEL, DEFAULT_LEVELS, type SignatureProof, type TreeSignature, createPerAddressTreeKey, createPerAddressTreeKeyAsync, deriveAddressPublicKey, getPerAddressPublicKey, } from './treekey';
export { scriptFromWotsPk, wotsAddressFromKeypair } from './script';
export * from './minima32';
export * from './mmr';
export { scriptToAddress, addressToRoot } from './derive';
export { WORD_LIST, cleanSeedPhrase, validatePhrase, convertStringToSeed, convertWordListToSeed, phraseToSeed, generateWordList, generateSeedPhrase, } from './bip39';
export declare const MINIMA_CONSTANTS: {
    readonly WOTS_W: 8;
    readonly WOTS_N: 32;
    readonly MAX_SIGNATURES: 262144;
    readonly SIGNATURE_LEVELS: 3;
    readonly ADDRESS_PREFIX: "Mx";
    readonly NETWORK_ID: 1;
};
