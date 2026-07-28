/**
 * Legacy JS implementations — backward compatibility.
 *
 * These are the original TypeScript implementations preserved for
 * environments where WASM is not available. The main entry point
 * (`@totemsdk/core`) now delegates to WASM by default.
 *
 * Import legacy implementations directly:
 *   import { wotsSign } from '@totemsdk/core/legacy';
 */

// WOTS — unique exports
export {
  F, hex, fromHex, u16be, u32be, assert32, h, prfChainSeed,
  toWinternitzDigits, baseWWithChecksum,
  derivePKdigest as legacyDerivePKdigest,
  wotsKeypairFromSeed as legacyWotsKeypairFromSeed,
  wotsSign as legacyWotsSign,
  wotsSignLegacy,
  wotsPkFromSig as legacyWotsPkFromSig,
  wotsVerify as legacyWotsVerify,
  wotsVerifyDigest as legacyWotsVerifyDigest,
  wotsPublicKeyFromSeed as legacyWotsPublicKeyFromSeed,
  type WotsKeypair,
  type WotsSignature,
} from './wots.js';

// TreeKey — unique exports
export {
  TreeKey, TreeKeyNode,
  verifyTreeSignature as legacyVerifyTreeSignature,
  serializeTreeSignature, deserializeTreeSignature,
  getRootPublicKey,
  DEFAULT_KEYS_PER_LEVEL, DEFAULT_LEVELS,
  createUnifiedChildTreeKey as legacyCreateUnifiedChildTreeKey,
  createUnifiedChildTreeKeyAsync,
  createUnifiedRootTreeKey as legacyCreateUnifiedRootTreeKey,
  deriveUnifiedAddressPublicKey as legacyDeriveUnifiedAddressPublicKey,
  createPerAddressTreeKey, createPerAddressTreeKeyAsync,
  type KeyGenProgress, type ProgressCallback,
  type SignatureProof, type TreeSignature,
} from './treekey.js';

// MMR — unique exports
export {
  MMRTree, mmrLeafExact, mmrRootFromSingleLeaf,
  createMMRDataLeafNode, createMMRDataParentNode,
  calculateProofRoot, verifyMMRProof as legacyVerifyMMRProof,
  parseMMRProofFromHex, deserializeMMRProof,
  serializeMMRProof, serializeRealMMRProof,
  type MMRData, type MMREntry, type MMRProof, type MMRProofChunk, type Bytes,
} from './mmr.js';

// BIP39
export {
  WORD_LIST, cleanSeedPhrase as legacyCleanSeedPhrase,
  validatePhrase as legacyValidatePhrase,
  convertStringToSeed, convertWordListToSeed,
  phraseToSeed as legacyPhraseToSeed,
  generateWordList as legacyGenerateWordList,
  generateSeedPhrase,
} from './bip39.js';

// Transaction
export {
  type MinimaTransaction, type MinimaCoin, type ParsedMiniNumber,
  type MinimaToken, type StateVariable, type RawStateVariable,
  type CoinProofData, type SpendableCoinInput, type TransactionBuildResult,
  parseDecimalToMiniNumber, serializeCoin,
  serializeTransaction as legacySerializeTransaction,
  computeTransactionDigest as legacyComputeTransactionDigest,
  precomputeTransactionCoinID as legacyPrecomputeTransactionCoinID,
  createDefaultTransaction, buildMinimaCoin,
} from './transaction.js';

// Derive
export { scriptToAddress, addressToRoot } from './derive.js';

// Script
export { scriptFromWotsPk, wotsAddressFromKeypair as legacyWotsAddressFromKeypair } from './script.js';

// Minima32
export {
  encodeMxRadix32Frame, decodeMxRadix32Frame,
  makeMxAddress as legacyMakeMxAddress,
  parseMxAddress as legacyParseMxAddress,
  hexToMx, mxToHex, encodeMx, decodeMx,
  makeMinimaAddress, convertMinimaAddress,
} from './minima32.js';

// Streamable
export {
  writeMiniNumber as legacyWriteMiniNumber,
  writeMiniData as legacyWriteMiniData,
  writeMiniByte, writeMMREntryNumber,
  concat, hexToBytes as legacyHexToBytes,
  bytesToHex as legacyBytesToHex,
  bigIntToByteArray, writeMiniString as legacyWriteMiniString,
  writeHashToStream,
} from './Streamable.js';

// JavaStreamables
export {
  serializeMiniNumber, serializeMiniData,
  hashAllObjects, deriveChainSeedJava as legacyDeriveChainSeedJava,
  deriveChildTreeSeedJava, hashObject,
  serializeMiniNumberZERO, serializeMiniNumberONE,
  javaHashAllObjects, indexToMiniDataBytes,
  derivePerAddressSeed as legacyDerivePerAddressSeed,
  deriveRootPrivSeed as legacyDeriveRootPrivSeed,
  deriveUnifiedChildSeed,
  createMMREntryNumber, serializeMMREntryNumber,
  serializeMMRData, serializeMMREntry,
  precomputeTransactionCoinID as legacyPrecomputeTransactionCoinIDTx,
  type MMREntryNumber as JavaMMREntryNumber,
  type MMRData as JavaMMRData,
  type MMREntry as JavaMMREntry,
} from './javaStreamables.js';

// Utils
export { concatBytes as legacyConcatBytes } from './utils.js';

// Params
export * from './params.js';

// Verify
export {
  verifySignature, verifySignatureDetailed,
  verifyTreeSignatureDetailed,
  deriveAddressFromPublicKey, normalizeHex,
  createChallenge as legacyCreateChallenge,
  validateChallenge as legacyValidateChallenge,
  type VerificationResult,
} from './verify.js';
