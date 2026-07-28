export * from './types.js';
export * from './dapp-types.js';
export {
  encodeMiniNumber,
  encodeMiniData,
  encodeMiniString,
  serializeMMRProofChunk,
  serializeScriptProofWithProof,
  STATETYPE_HEX,
  STATETYPE_NUMBER,
  STATETYPE_STRING,
  STATETYPE_BOOL,
  encodeStateValue,
  serializeStateVariables,
  buildScriptProofFromDescriptor,
  deduplicateScriptDescriptors,
  serializeExtraScripts,
  aggregateSignatures,
  validateExternalSignature,
  computeScriptAddress,
} from './witness-serializer.js';
export * from './contract-helpers.js';
