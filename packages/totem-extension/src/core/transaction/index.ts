/**
 * Transaction Module Index
 * 
 * Exports all transaction-related types, utilities, and services
 * for building complex Minima transactions.
 */

export * from './types/ScriptTypes';

export {
  serializeMMRProofChunk,
  serializeRealMMRProof,
  parseMMRProofFromHex,
  serializeScriptProofWithProof,
  encodeStateValue,
  serializeStateVariables,
  buildScriptProofFromDescriptor,
  deduplicateScriptDescriptors,
  serializeExtraScripts,
  aggregateSignatures,
  validateExternalSignature,
  computeScriptAddress
} from './utils/WitnessSerializer';

export * from './services/ScriptCatalog';
export * from './services/ProofFetcher';

export {
  MinimaTransaction,
  MinimaCoin,
  MinimaToken,
  StateVariable,
  SpendableCoinInput,
  TransactionBuildResult,
  WotsSignatureData,
  InputScriptInfo,
  TxPoWBuildResult,
  TxnImportBuildResult,
  BuildTransactionParams,
  serializeTransaction,
  computeTransactionDigest,
  serializeTxPoW,
  buildTransaction,
  buildSignedTxPoW,
  serializeForTxnImport,
  buildForTxnImport,
  extractAmountBytesFromCoinProof,
  ZERO_HASH
} from './MinimaTransactionBuilder';

export {
  EnhancedBuildParams,
  EnhancedCoinInput,
  EnhancedCoinOutput,
  EnhancedBuildResult,
  buildEnhancedTransaction,
  serializeEnhancedWitness,
  serializeEnhancedForTxnImport,
  buildEnhancedForTxnImport,
  validateVerifyOutExpectations,
  hexToBytes,
  bytesToHex,
  concat,
  parseDecimalToBaseUnits,
  formatBaseUnitsToDecimal
} from './EnhancedTransactionBuilder';

export {
  MultisigManager,
  MultisigConfig,
  PendingMultisigTransaction,
  MultisigExportData,
  getMultisigManager
} from './services/MultisigManager';

export {
  TimelockHelper,
  HTLCHelper,
  MASTHelper,
  ExchangeHelper,
  VaultHelper,
  FlashCashHelper,
  SlowCashHelper,
  StatefulGameHelper
} from './helpers/ContractHelpers';

export {
  TransactionType,
  TransactionInputArtifact,
  TransactionOutputArtifact,
  TransactionArtifact,
  TransactionAssemblyRequest,
  TransactionAssemblyResult,
  generateArtifactId
} from './TransactionArtifact';

export {
  TransactionAssembler,
  transactionAssembler
} from './TransactionAssembler';
