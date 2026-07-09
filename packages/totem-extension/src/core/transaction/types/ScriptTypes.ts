/**
 * Comprehensive Minima Script Types for Complex Transactions
 * 
 * This module provides type definitions for all Minima script types including:
 * - Basic SIGNEDBY contracts
 * - Multisig (2-of-2, M-of-N)
 * - Time locks and HTLC
 * - MAST (Merkelized Abstract Syntax Trees)
 * - Exchange contracts with VERIFYOUT
 * - Vault/covenant contracts
 * - Flash/slow cash
 * - Stateful game contracts
 * 
 * These types enable Totem wallet to participate as a single signer in any
 * Minima transaction type.
 * 
 * CONSOLIDATION (2026-01-18): MMR types now use SDK canonical interfaces.
 */

// Import canonical SDK types
import type { 
  MMRData as SDKMMRData,
  MMRProofChunk as SDKMMRProofChunk,
  MMRProof as SDKMMRProof 
} from '../../../../../totem-sdk/packages/core/src/mmr';

function kissHex(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return '0x' + raw.toUpperCase();
}

// Re-export SDK types as canonical
export type MMRData = SDKMMRData;
export type MMRProofChunk = SDKMMRProofChunk;
export type MMRProof = SDKMMRProof;

/**
 * Legacy flat MMRProofChunk format (from RPC responses).
 * Use convertFlatProofToSDK() to convert to SDK format.
 */
export interface FlatMMRProofChunk {
  isLeft: boolean;
  data: Uint8Array;
}

/**
 * Legacy MMRProof format with blockTime and flat proofChain.
 * Used by some RPC responses. Use convertLegacyProofToSDK() to convert.
 */
export interface LegacyMMRProof {
  blockTime: bigint;
  proofChain: FlatMMRProofChunk[];
}

/**
 * Convert flat proof chunk (from RPC) to SDK format.
 * Assumes value=0n (standard for TreeKey proofs).
 */
export function convertFlatChunkToSDK(chunk: FlatMMRProofChunk): SDKMMRProofChunk {
  return {
    isLeft: chunk.isLeft,
    mmrData: { data: chunk.data, value: 0n }
  };
}

/**
 * Convert legacy MMRProof format to SDK format.
 * The blockTime is discarded as SDK's serializeMMRProof accepts it as a parameter.
 */
export function convertLegacyProofToSDK(legacy: LegacyMMRProof): { proof: SDKMMRProof; blockTime: bigint } {
  return {
    proof: {
      chunks: legacy.proofChain.map(convertFlatChunkToSDK)
    },
    blockTime: legacy.blockTime
  };
}

/**
 * State variable types in Minima scripts.
 * 
 * STATE(n) - Current coin's state variable at port n
 * PREVSTATE(n) - Previous state from the coin being spent
 * SAMESTATE(a,b) - Assert states a through b are identical to prevstates
 */
export type StateVariableType = 'STATE' | 'PREVSTATE' | 'SAMESTATE';

/**
 * A state variable value with its port and encoded data.
 * 
 * State variables can hold:
 * - Booleans (MiniByte: 0 or 1)
 * - Numbers (MiniNumber)
 * - Hex data (MiniData)
 * - Strings (enclosed in square brackets: [my string])
 * 
 * Java type constants from StateVariable.java:
 *   STATETYPE_HEX = 1
 *   STATETYPE_NUMBER = 2
 *   STATETYPE_STRING = 4
 *   STATETYPE_BOOL = 8
 */
export interface StateValue {
  port: number;
  value: string | bigint | Uint8Array | boolean;
  type: 'bool' | 'number' | 'hex' | 'string';
}

/**
 * VERIFYOUT assertion for covenant contracts.
 * 
 * VERIFYOUT(@INPUT, address, amount, tokenid, keepstate) checks that
 * a specific output exists at a relative position to the input.
 * 
 * Used in:
 * - Exchange contracts (atomic swaps)
 * - Vault contracts (safe house enforcement)
 * - Flash cash (return with interest)
 */
export interface VerifyOutExpectation {
  inputIndex: number | '@INPUT';
  outputAddress: string;
  amount: string | bigint;
  tokenId: string;
  keepState: boolean;
}

/**
 * Script types supported by Minima
 */
export type ScriptType = 
  | 'signedby'        // RETURN SIGNEDBY(pubkey)
  | 'multisig'        // RETURN SIGNEDBY(pk1) AND SIGNEDBY(pk2)
  | 'multisig_mofn'   // RETURN MULTISIG(M pk1 pk2 pk3...)
  | 'timelock'        // RETURN SIGNEDBY(pk) AND @BLOCK GT n
  | 'htlc'            // Hash timelock contract
  | 'mast'            // MAST with merkle proof
  | 'exchange'        // VERIFYOUT-based exchange
  | 'vault'           // Covenant with safe house
  | 'flashcash'       // Single-transaction loan
  | 'slowcash'        // Rate-limited withdrawal
  | 'stateful'        // Multi-round game contract
  | 'custom';         // Arbitrary user-defined script

/**
 * ScriptDescriptor - Complete metadata for an input's unlock script.
 * 
 * Extends InputScriptInfo with full support for all Minima script types.
 * This is the core data structure that enables complex transactions.
 * 
 * For CURRENT HD wallet (2024-12):
 *   All 64 addresses share one WOTS root public key, so 'signedby' type
 *   with wotsRootPublicKey is sufficient.
 * 
 * For COMPLEX scripts:
 *   Custom script body, state variables, MAST proofs, and VERIFYOUT
 *   expectations are required.
 */
export interface ScriptDescriptor {
  /** The address (0x hex) this script unlocks */
  address: string;
  
  /** Script type for quick categorization */
  scriptType: ScriptType;
  
  /** 
   * The actual script body. 
   * For SIGNEDBY: "RETURN SIGNEDBY(0xPubKey)"
   * For custom: Full script text
   */
  script: string;
  
  /**
   * WOTS root public key (0x hex) if this is a SIGNEDBY script.
   * Used for simple WOTS addresses.
   */
  wotsRootPublicKey?: string;
  
  /**
   * MMR proof for MAST scripts.
   * Proves which branch of the merkle tree is being executed.
   * Empty (blockTime=0, proofChain=[]) for simple scripts.
   */
  mastProof?: MMRProof;
  
  /**
   * Extra scripts for MAST branches (txnscript equivalent).
   * Maps script body to its proof hex.
   * e.g., { "RETURN TRUE": "0x00000101000..." }
   */
  extraScripts?: Map<string, string>;
  
  /**
   * State variables to include in the transaction.
   * Required for HTLC (preimage), exchange (terms), games (round state).
   */
  stateVariables?: StateValue[];
  
  /**
   * Whether to preserve state across the spend.
   * true = copy coin state to outputs
   */
  storeState?: boolean;
  
  /**
   * VERIFYOUT expectations this script requires.
   * Used for exchange contracts, vaults, flash cash.
   */
  verifyOutExpectations?: VerifyOutExpectation[];
  
  /**
   * For timelock scripts: minimum block number required
   */
  timelockBlock?: bigint;
  
  /**
   * For HTLC scripts: the hash that must be matched
   */
  htlcHash?: string;
  
  /**
   * For HTLC scripts: the preimage (secret) to reveal
   */
  htlcPreimage?: string;
  
  /**
   * For multisig: list of required public keys
   */
  multisigKeys?: string[];
  
  /**
   * For M-of-N multisig: minimum signatures required
   */
  multisigThreshold?: number;
  
  /**
   * External signatures imported for multisig transactions.
   * Totem adds its own signature; these are from other parties.
   */
  externalSignatures?: ExternalSignature[];
}

/**
 * External signature from another party in a multisig transaction.
 * 
 * Totem wallet signs its own contribution and imports signatures
 * from other parties. This structure holds imported signatures.
 */
export interface ExternalSignature {
  /** Public key that produced this signature */
  publicKey: string;
  
  /** The signature bytes (hex) */
  signature: string;
  
  /** MMR proof for hierarchical signature trees */
  proof?: MMRProof;
  
  /** Signature type (WOTS or standard) */
  signatureType: 'wots' | 'standard';
  
  /** Whether this signature has been validated */
  validated?: boolean;
}

/**
 * Script catalog entry for known scripts.
 * 
 * Maps addresses to their scripts for ScriptProof lookup.
 * Prevents needing to re-derive scripts when building transactions.
 */
export interface ScriptCatalogEntry {
  address: string;
  script: string;
  scriptType: ScriptType;
  createdAt: number;
  lastUsed: number;
}

/**
 * Result of building a ScriptProof for serialization.
 */
export interface ScriptProofResult {
  script: string;
  proof: MMRProof;
  serialized: Uint8Array;
}

/**
 * Transaction state for complex multi-round contracts.
 * 
 * Used for coin flip and other stateful games where each
 * transaction increments the round and preserves state.
 */
export interface TransactionRoundState {
  round: number;
  previousRound: number;
  preservedPorts: number[];
  newStates: StateValue[];
}

/**
 * Helper to create an empty MMR proof (for simple scripts).
 * Uses SDK format with chunks array.
 */
export function createEmptyMMRProof(): MMRProof {
  return { chunks: [] };
}

/**
 * Helper to create a simple SIGNEDBY script descriptor.
 */
export function createSignedByDescriptor(
  address: string,
  wotsRootPublicKey: string
): ScriptDescriptor {
  return {
    address,
    scriptType: 'signedby',
    script: `RETURN SIGNEDBY(${kissHex(wotsRootPublicKey)})`,
    wotsRootPublicKey,
    mastProof: createEmptyMMRProof(),
    storeState: false
  };
}

/**
 * Helper to create a multisig (2-of-2) script descriptor.
 */
export function createMultisigDescriptor(
  address: string,
  publicKey1: string,
  publicKey2: string,
  ownPublicKey: string
): ScriptDescriptor {
  return {
    address,
    scriptType: 'multisig',
    script: `RETURN SIGNEDBY(${kissHex(publicKey1)}) AND SIGNEDBY(${kissHex(publicKey2)})`,
    wotsRootPublicKey: ownPublicKey,
    multisigKeys: [publicKey1, publicKey2],
    multisigThreshold: 2,
    mastProof: createEmptyMMRProof(),
    storeState: false
  };
}

/**
 * Helper to create an M-of-N multisig script descriptor.
 */
export function createMofNMultisigDescriptor(
  address: string,
  threshold: number,
  publicKeys: string[],
  ownPublicKey: string
): ScriptDescriptor {
  const formattedKeys = publicKeys.map(pk => kissHex(pk)).join(' ');
  
  return {
    address,
    scriptType: 'multisig_mofn',
    script: `RETURN MULTISIG(${threshold} ${formattedKeys})`,
    wotsRootPublicKey: ownPublicKey,
    multisigKeys: publicKeys,
    multisigThreshold: threshold,
    mastProof: createEmptyMMRProof(),
    storeState: false
  };
}

/**
 * Helper to create a timelock script descriptor.
 */
export function createTimelockDescriptor(
  address: string,
  publicKey: string,
  unlockBlock: bigint
): ScriptDescriptor {
  return {
    address,
    scriptType: 'timelock',
    script: `RETURN SIGNEDBY(${kissHex(publicKey)}) AND @BLOCK GT ${unlockBlock}`,
    wotsRootPublicKey: publicKey,
    timelockBlock: unlockBlock,
    mastProof: createEmptyMMRProof(),
    storeState: false
  };
}

/**
 * Helper to create an HTLC script descriptor.
 */
export function createHTLCDescriptor(
  address: string,
  ownerPublicKey: string,
  recipientPublicKey: string,
  hashLock: string,
  timeoutBlock: bigint,
  isOwner: boolean,
  preimage?: string
): ScriptDescriptor {
  const script = `IF @BLOCK GT ${timeoutBlock} AND SIGNEDBY(${kissHex(ownerPublicKey)}) THEN RETURN TRUE ENDIF RETURN (SIGNEDBY(${kissHex(recipientPublicKey)}) AND SHA3(STATE(1)) EQ ${kissHex(hashLock)})`;
  
  const descriptor: ScriptDescriptor = {
    address,
    scriptType: 'htlc',
    script,
    wotsRootPublicKey: isOwner ? ownerPublicKey : recipientPublicKey,
    htlcHash: hashLock,
    timelockBlock: timeoutBlock,
    mastProof: createEmptyMMRProof(),
    storeState: false
  };
  
  if (preimage) {
    descriptor.htlcPreimage = preimage;
    descriptor.stateVariables = [{
      port: 1,
      value: preimage,
      type: 'string'
    }];
  }
  
  return descriptor;
}

/**
 * Helper to create a MAST script descriptor.
 */
export function createMASTDescriptor(
  address: string,
  rootHash: string,
  branchScript: string,
  branchProof: string,
  wotsPublicKey?: string
): ScriptDescriptor {
  return {
    address,
    scriptType: 'mast',
    script: `MAST ${kissHex(rootHash)}`,
    wotsRootPublicKey: wotsPublicKey,
    extraScripts: new Map([[branchScript, branchProof]]),
    mastProof: createEmptyMMRProof(),
    storeState: false
  };
}

/**
 * Helper to create an exchange contract descriptor.
 */
export function createExchangeDescriptor(
  address: string,
  ownerPublicKey: string,
  desiredAddress: string,
  desiredAmount: string,
  desiredTokenId: string
): ScriptDescriptor {
  const script = `IF SIGNEDBY(PREVSTATE(0)) THEN RETURN TRUE ENDIF ASSERT VERIFYOUT(@INPUT PREVSTATE(1) PREVSTATE(2) PREVSTATE(3) TRUE) RETURN TRUE`;
  
  return {
    address,
    scriptType: 'exchange',
    script,
    wotsRootPublicKey: ownerPublicKey,
    stateVariables: [
      { port: 0, value: kissHex(ownerPublicKey), type: 'hex' },
      { port: 1, value: desiredAddress, type: 'hex' },
      { port: 2, value: desiredAmount, type: 'number' },
      { port: 3, value: desiredTokenId, type: 'hex' }
    ],
    verifyOutExpectations: [{
      inputIndex: '@INPUT',
      outputAddress: desiredAddress,
      amount: desiredAmount,
      tokenId: desiredTokenId,
      keepState: true
    }],
    mastProof: createEmptyMMRProof(),
    storeState: true
  };
}

/**
 * Helper to create a flash cash descriptor.
 */
export function createFlashCashDescriptor(
  address: string,
  ownerPublicKey: string,
  interestMultiplier: string = '1.01'
): ScriptDescriptor {
  const script = `IF SIGNEDBY(PREVSTATE(1)) THEN RETURN TRUE ENDIF ASSERT SAMESTATE(1 1) RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT*${interestMultiplier} @TOKENID TRUE)`;
  
  return {
    address,
    scriptType: 'flashcash',
    script,
    wotsRootPublicKey: ownerPublicKey,
    stateVariables: [
      { port: 1, value: ownerPublicKey, type: 'hex' }
    ],
    mastProof: createEmptyMMRProof(),
    storeState: true
  };
}

/**
 * Helper to create a slow cash descriptor.
 */
export function createSlowCashDescriptor(
  address: string,
  ownerPublicKey: string,
  withdrawalPercent: string = '0.9',
  cooldownBlocks: bigint = 10000n
): ScriptDescriptor {
  const script = `IF @COINAGE LT ${cooldownBlocks} THEN RETURN FALSE ENDIF ASSERT SIGNEDBY(${kissHex(ownerPublicKey)}) AND VERIFYOUT(@INPUT @ADDRESS @AMOUNT*${withdrawalPercent} @TOKENID TRUE)`;
  
  return {
    address,
    scriptType: 'slowcash',
    script,
    wotsRootPublicKey: ownerPublicKey,
    timelockBlock: cooldownBlocks,
    mastProof: createEmptyMMRProof(),
    storeState: false
  };
}
