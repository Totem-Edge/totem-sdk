/**
 * Enhanced Transaction Builder
 * 
 * Extends the base MinimaTransactionBuilder with full support for:
 * - ScriptDescriptor-based witness building
 * - Real MMRProof serialization
 * - MAST extra scripts
 * - State variables
 * - External signature aggregation
 * - Script deduplication
 * 
 * This builder enables Totem to participate in any Minima transaction type.
 * 
 * AMOUNT CONTRACT (UNIFIED WITH BASE BUILDER):
 * - All amounts must be in BASE UNITS (44 decimal precision as string)
 * - Example: "0.0001" MINIMA = "10000000000000000000000000000000000000000" base units
 * - Convert decimal amounts to base units BEFORE calling buildEnhancedTransaction
 * - This matches MinimaTransactionBuilder.buildTransaction() contract
 */

import { sha3_256 } from 'js-sha3';
import type {
  ScriptDescriptor,
  MMRProof,
  StateValue,
  ExternalSignature,
  VerifyOutExpectation
} from './types/ScriptTypes';
import {
  serializeRealMMRProof,
  serializeScriptProofWithProof,
  serializeStateVariables,
  deduplicateScriptDescriptors,
  serializeExtraScripts
} from './utils/WitnessSerializer';
import {
  MinimaTransaction,
  MinimaCoin,
  StateVariable,
  WotsSignatureData,
  TransactionBuildResult,
  parseDecimalToBaseUnits,
  formatBaseUnitsToDecimal,
  serializeTransaction,
  computeTransactionDigest
} from './MinimaTransactionBuilder';

// Import canonical serialization functions from Streamable.ts (single source of truth)
import {
  hexToBytes as canonicalHexToBytes,
  bytesToHex as canonicalBytesToHex,
  concat as canonicalConcat,
  writeMiniData,
  writeMiniNumber,
  writeMiniString,
  writeSignature,
  type SignatureProof as StreamableSignatureProof,
  type MMRProof as StreamableMMRProof
} from '../../../../totem-sdk/packages/core/src/Streamable';

const MINIMA_DECIMALS = 44;
const ZERO_HASH = new Uint8Array(32);
// CRITICAL: Java's MiniData.ZERO_TXPOWID = new MiniData("0x00") is 1 BYTE, not 32!
// This is the default linkHash value used by Transaction class.
const ZERO_TXPOWID = new Uint8Array([0x00]);
const MINIMA_TOKEN_ID = new Uint8Array([0x00]);

/**
 * @deprecated Use canonicalHexToBytes from Streamable.ts instead.
 * Kept for backward compatibility with existing code paths.
 */
function hexToBytes(hex: string): Uint8Array {
  return canonicalHexToBytes(hex);
}

/**
 * @deprecated Use canonicalBytesToHex from Streamable.ts instead.
 * Kept for backward compatibility with existing code paths.
 */
function bytesToHex(bytes: Uint8Array): string {
  return canonicalBytesToHex(bytes);
}

/**
 * @deprecated Use canonicalConcat from Streamable.ts instead.
 * Kept for backward compatibility with existing code paths.
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  return canonicalConcat(...arrays);
}

/**
 * @deprecated Use writeMiniNumber from Streamable.ts instead.
 * Kept for backward compatibility with existing code paths.
 */
function encodeMiniNumber(value: bigint, scale: number = 0): Uint8Array {
  return writeMiniNumber(value, scale);
}

/**
 * @deprecated Use writeMiniData from Streamable.ts instead.
 * Kept for backward compatibility with existing code paths.
 */
function encodeMiniData(data: Uint8Array): Uint8Array {
  return writeMiniData(data);
}

/**
 * @deprecated Use writeMiniString from Streamable.ts instead.
 * Kept for backward compatibility with existing code paths.
 */
function encodeMiniString(str: string): Uint8Array {
  return writeMiniString(str);
}

/**
 * Enhanced transaction build parameters supporting complex scripts.
 */
export interface EnhancedBuildParams {
  inputs: EnhancedCoinInput[];
  outputs: EnhancedCoinOutput[];
  transactionState?: StateValue[];
  linkHash?: Uint8Array;
}

/**
 * Enhanced coin input with ScriptDescriptor.
 */
export interface EnhancedCoinInput {
  coinId: string;
  address: string;
  amount: string;
  tokenId?: string;
  scriptDescriptor: ScriptDescriptor;
  coinProofHex?: string;
}

/**
 * Enhanced coin output with optional state.
 */
export interface EnhancedCoinOutput {
  address: string;
  amount: string;
  tokenId?: string;
  storeState?: boolean;
  state?: StateValue[];
}

/**
 * Enhanced build result with ScriptDescriptor info.
 */
export interface EnhancedBuildResult extends TransactionBuildResult {
  scriptDescriptors: ScriptDescriptor[];
  extraScripts: Map<string, string>;
  coinProofsHex: string[];
}

/**
 * Convert StateValue to StateVariable for transaction serialization.
 * 
 * UNIFIED (2026-01-20): Now simply passes through the high-level value.
 * Encoding is done at serialization time by serializeStateVariable().
 * This eliminates pre-encoding inconsistencies and matches Java's behavior.
 */
function stateValueToVariable(sv: StateValue): StateVariable {
  return { 
    port: sv.port, 
    value: sv.value, 
    type: sv.type 
  };
}

/**
 * Build a transaction with full ScriptDescriptor support.
 */
export function buildEnhancedTransaction(params: EnhancedBuildParams): EnhancedBuildResult {
  const { inputs, outputs, transactionState, linkHash } = params;
  
  if (!inputs || inputs.length === 0) {
    throw new Error('No input coins provided');
  }
  
  const inputCoins: MinimaCoin[] = inputs.map(input => {
    const addressBytes = hexToBytes(input.address);
    const paddedAddress = new Uint8Array(32);
    paddedAddress.set(addressBytes.slice(0, 32));
    
    const coinIdBytes = hexToBytes(input.coinId);
    const paddedCoinId = new Uint8Array(32);
    paddedCoinId.set(coinIdBytes.slice(0, 32));
    
    const tokenIdBytes = input.tokenId ? hexToBytes(input.tokenId) : MINIMA_TOKEN_ID;
    
    const coinState: StateVariable[] = [];
    if (input.scriptDescriptor.stateVariables) {
      for (const sv of input.scriptDescriptor.stateVariables) {
        coinState.push(stateValueToVariable(sv));
      }
    }
    
    // Amount stays as decimal string for natural scale serialization
    // parseDecimalToMiniNumber extracts scale and unscaledValue at serialization time
    return {
      coinId: paddedCoinId,
      address: paddedAddress,
      amount: input.amount || '0',  // Decimal string for correct scale serialization
      tokenId: tokenIdBytes,
      token: null,
      storeState: input.scriptDescriptor.storeState || false,
      state: coinState,
      mmrEntryNumber: 0n,
      spent: false,
      created: 0n
    };
  });
  
  const outputCoins: MinimaCoin[] = outputs.map(output => {
    const addressBytes = hexToBytes(output.address);
    const paddedAddress = new Uint8Array(32);
    paddedAddress.set(addressBytes.slice(0, 32));
    
    const tokenIdBytes = output.tokenId ? hexToBytes(output.tokenId) : MINIMA_TOKEN_ID;
    
    const coinState: StateVariable[] = [];
    if (output.state) {
      for (const sv of output.state) {
        coinState.push(stateValueToVariable(sv));
      }
    }
    
    // Amount stays as decimal string for natural scale serialization
    return {
      coinId: ZERO_HASH,
      address: paddedAddress,
      amount: output.amount || '0',  // Decimal string for correct scale serialization
      tokenId: tokenIdBytes,
      token: null,
      storeState: output.storeState || false,
      state: coinState,
      mmrEntryNumber: 0n,
      spent: false,
      created: 0n
    };
  });
  
  const txState: StateVariable[] = [];
  if (transactionState) {
    for (const sv of transactionState) {
      txState.push(stateValueToVariable(sv));
    }
  }
  
  const transaction: MinimaTransaction = {
    linkHash: linkHash || ZERO_TXPOWID,  // 1 byte (0x00), matches Java's MiniData.ZERO_TXPOWID
    inputs: inputCoins,
    outputs: outputCoins,
    state: txState
  };
  
  const scriptDescriptors = inputs.map(i => i.scriptDescriptor);
  
  const extraScripts = new Map<string, string>();
  for (const desc of scriptDescriptors) {
    if (desc.extraScripts) {
      for (const [script, proof] of desc.extraScripts) {
        extraScripts.set(script, proof);
      }
    }
  }
  
  const coinProofsHex = inputs
    .filter(i => i.coinProofHex)
    .map(i => i.coinProofHex!);
  
  const digestTx = computeTransactionDigest(transaction);
  const serialized = serializeTransaction(transaction);
  
  return {
    transaction,
    digestTx,
    digestTxHex: bytesToHex(digestTx),
    serialized,
    serializedHex: bytesToHex(serialized),
    scriptDescriptors,
    extraScripts,
    coinProofsHex
  };
}

/**
 * Serialize an enhanced witness with ScriptDescriptor support.
 * 
 * This replaces the basic serializeWitness with full support for:
 * - Real MMRProofs in ScriptProofs
 * - Script deduplication
 * - Extra scripts for MAST (serialized as additional ScriptProofs)
 * - External signature aggregation
 * 
 * Minima Witness format:
 *   1. Signature count (MiniNumber) + Signature objects
 *   2. CoinProof count (MiniNumber) + CoinProof objects (pre-serialized from coinexport)
 *   3. ScriptProof count (MiniNumber) + ScriptProof objects
 * 
 * For MAST contracts, extra branch scripts are included as additional ScriptProofs
 * with their merkle proofs linking them to the MAST root.
 */
export function serializeEnhancedWitness(
  wotsData: WotsSignatureData | undefined,
  coinProofsHex: string[],
  scriptDescriptors: ScriptDescriptor[],
  extraScripts?: Map<string, string>,
  externalSignatures?: ExternalSignature[]
): Uint8Array {
  console.log(`[EnhancedWitness] wotsData=${!!wotsData}, coinProofs=${coinProofsHex.length}, scripts=${scriptDescriptors.length}, extraScripts=${extraScripts?.size || 0}`);
  const parts: Uint8Array[] = [];
  
  // === SECTION 1: SIGNATURES ===
  if (wotsData) {
    const sigCount = 1 + (externalSignatures?.filter(s => s.validated)?.length || 0);
    parts.push(writeMiniNumber(BigInt(sigCount), 0));
    
    // Check for hierarchical format (proofs array with full SignatureProof data)
    // This is the correct format from signWithPerAddressTreeKey() that includes:
    // - leafPubkey: 32-byte WOTS public key DIGEST (SHA3-256 of full L×32 key)
    // - signature: 1088-byte WOTS signature
    // - mmrProof: serialized MMR proof bytes
    if (wotsData.proofs && wotsData.proofs.length > 0) {
      // Hierarchical format - serialize using canonical Streamable.ts functions
      console.log(`[EnhancedWitness] Using HIERARCHICAL format with ${wotsData.proofs.length} SignatureProofs`);
      
      // Java's Signature.writeDataStream writes:
      // 1. MiniNumber (count of proofs)
      // 2. For each proof: SignatureProof.writeDataStream (leafPubkey, signature, mmrProof)
      const signatureProofBytes: Uint8Array[] = [];
      
      for (let i = 0; i < wotsData.proofs.length; i++) {
        const proof = wotsData.proofs[i];
        const leafPubkeyBytes = canonicalHexToBytes(proof.leafPubkey);   // 32 bytes (digest)
        const signatureBytes = canonicalHexToBytes(proof.signature);      // 1088 bytes
        const mmrProofBytes = canonicalHexToBytes(proof.mmrProof);        // Already serialized
        
        console.log(`[EnhancedWitness]   proof[${i}]: leafPk=${leafPubkeyBytes.length}B, sig=${signatureBytes.length}B, mmr=${mmrProofBytes.length}B`);
        
        // Serialize as SignatureProof using canonical Streamable.ts functions:
        // MiniData(pubkey) + MiniData(sig) + raw mmrProof bytes
        // Note: mmrProof is already serialized by serializeMMRProof from Streamable.ts
        const proofParts: Uint8Array[] = [];
        proofParts.push(writeMiniData(leafPubkeyBytes));
        proofParts.push(writeMiniData(signatureBytes));
        proofParts.push(mmrProofBytes);  // Already serialized by Streamable.writeMMRProof
        
        signatureProofBytes.push(canonicalConcat(...proofParts));
      }
      
      // Wrap as Signature: MiniNumber(proofCount) + all SignatureProof bytes
      const sigParts: Uint8Array[] = [];
      sigParts.push(writeMiniNumber(BigInt(wotsData.proofs.length), 0));
      for (const proofBytes of signatureProofBytes) {
        sigParts.push(proofBytes);
      }
      parts.push(canonicalConcat(...sigParts));
      
    } else {
      // Per-address TreeKey architecture (2026-02): hierarchical format is REQUIRED
      // Legacy l1Proof/l2Proof/l3Proof format has been removed
      throw new Error('Per-address TreeKey architecture requires hierarchical format with proofs array');
    }
    
    if (externalSignatures) {
      for (const extSig of externalSignatures) {
        if (!extSig.validated) continue;
        
        const extPubKey = canonicalHexToBytes(extSig.publicKey);
        const extSigBytes = canonicalHexToBytes(extSig.signature);
        const extProof = extSig.proof || { chunks: [] };
        
        const extSigProof = serializeSignatureProof(extPubKey, extSigBytes, extProof);
        parts.push(serializeSignature([extSigProof]));
      }
    }
  } else {
    parts.push(writeMiniNumber(0n, 0));
  }
  
  // === SECTION 2: COIN PROOFS ===
  // CoinProofs from coinexport RPC are already fully serialized (Coin + MMRProof)
  // They do NOT need additional MiniData framing - coinexport provides complete bytes
  if (coinProofsHex.length > 0) {
    parts.push(writeMiniNumber(BigInt(coinProofsHex.length), 0));
    for (const proofHex of coinProofsHex) {
      // coinexport returns complete CoinProof serialization, just decode hex
      parts.push(canonicalHexToBytes(proofHex));
    }
    console.log(`[EnhancedWitness] CoinProofs: ${coinProofsHex.length} proofs`);
  } else {
    parts.push(writeMiniNumber(0n, 0));
    console.log(`[EnhancedWitness] CoinProofs: 0 (empty)`);
  }
  
  // === SECTION 3: SCRIPT PROOFS ===
  // Deduplicate script descriptors by address
  const uniqueDescriptors = deduplicateScriptDescriptors(scriptDescriptors);
  
  // Collect all ScriptProofs including extra scripts for MAST
  const allScriptProofs: Uint8Array[] = [];
  
  // Primary script proofs from descriptors
  for (const [addr, descriptor] of uniqueDescriptors) {
    const proof = descriptor.mastProof || { chunks: [] };
    const scriptProofBytes = serializeScriptProofWithProof(descriptor.script, proof);
    allScriptProofs.push(scriptProofBytes);
    console.log(`[EnhancedWitness] ScriptProof for ${addr.substring(0, 10)}...: ${descriptor.script.substring(0, 40)}...`);
  }
  
  // Extra scripts for MAST branches (txnscript equivalent)
  // These are additional ScriptProofs with their merkle proofs
  if (extraScripts && extraScripts.size > 0) {
    for (const [script, proofHex] of extraScripts) {
      // Parse the proof hex into MMRProof structure
      let proof: MMRProof = { chunks: [] };
      if (proofHex && proofHex.length > 0) {
        try {
          proof = parseMMRProofFromHex(proofHex);
        } catch (err) {
          console.warn(`[EnhancedWitness] Failed to parse MAST proof for script, using empty: ${err}`);
        }
      }
      
      const scriptProofBytes = serializeScriptProofWithProof(script, proof);
      allScriptProofs.push(scriptProofBytes);
      console.log(`[EnhancedWitness] Extra ScriptProof (MAST): ${script.substring(0, 40)}...`);
    }
  }
  
  // Write total ScriptProof count and all proofs
  parts.push(writeMiniNumber(BigInt(allScriptProofs.length), 0));
  console.log(`[EnhancedWitness] ScriptProof count: ${allScriptProofs.length} (${uniqueDescriptors.size} primary + ${extraScripts?.size || 0} extra)`);
  
  for (const scriptProof of allScriptProofs) {
    parts.push(scriptProof);
  }
  
  const result = canonicalConcat(...parts);
  console.log(`[EnhancedWitness] TOTAL: ${result.length} bytes`);
  return result;
}

/**
 * Parse MMRProof from hex string (from mmrcreate or other RPC commands).
 */
function parseMMRProofFromHex(proofHex: string): MMRProof {
  const bytes = hexToBytes(proofHex);
  let offset = 0;
  
  // Read blockTime (MiniNumber)
  const { value: blockTime, bytesRead: btRead } = readMiniNumberFromBytes(bytes, offset);
  offset += btRead;
  
  // Read chain length (MiniNumber)
  const { value: chainLength, bytesRead: clRead } = readMiniNumberFromBytes(bytes, offset);
  offset += clRead;
  
  // Read proof chunks in SDK format
  const chunks: Array<{ isLeft: boolean; mmrData: { data: Uint8Array; value: bigint } }> = [];
  for (let i = 0; i < Number(chainLength); i++) {
    // isLeft (MiniByte)
    const isLeft = bytes[offset] === 1;
    offset += 1;
    
    // MMRData: data length (4 bytes) + data + value (MiniNumber)
    const dataLen = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | 
                    (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4;
    
    const data = bytes.slice(offset, offset + dataLen);
    offset += dataLen;
    
    // Read MMRData value (MiniNumber)
    const { value, bytesRead: valueRead } = readMiniNumberFromBytes(bytes, offset);
    offset += valueRead;
    
    chunks.push({ isLeft, mmrData: { data, value } });
  }
  
  return { chunks };
}

function readMiniNumberFromBytes(bytes: Uint8Array, offset: number): { value: bigint; bytesRead: number } {
  const scale = bytes[offset];
  const length = (bytes[offset + 1] << 24) | (bytes[offset + 2] << 16) | 
                 (bytes[offset + 3] << 8) | bytes[offset + 4];
  
  if (length === 0) {
    return { value: 0n, bytesRead: 5 };
  }
  
  const dataBytes = bytes.slice(offset + 5, offset + 5 + length);
  let value = 0n;
  for (const b of dataBytes) {
    value = (value << 8n) | BigInt(b);
  }
  
  return { value, bytesRead: 5 + length };
}

function serializeSignatureProof(
  publicKey: Uint8Array,
  signature: Uint8Array,
  proof: MMRProof
): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(writeMiniData(publicKey));
  parts.push(writeMiniData(signature));
  parts.push(serializeRealMMRProof(proof));
  return canonicalConcat(...parts);
}

function serializeSignature(signatureProofs: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(writeMiniNumber(BigInt(signatureProofs.length), 0));
  for (const proof of signatureProofs) {
    parts.push(proof);
  }
  return canonicalConcat(...parts);
}

/**
 * Serialize for txnimport with enhanced witness support.
 */
export function serializeEnhancedForTxnImport(
  tx: MinimaTransaction,
  txId: string,
  wotsData: WotsSignatureData | undefined,
  coinProofsHex: string[],
  scriptDescriptors: ScriptDescriptor[],
  extraScripts?: Map<string, string>,
  externalSignatures?: ExternalSignature[]
): Uint8Array {
  console.log(`[EnhancedTxnImport] txId: ${txId}`);
  const parts: Uint8Array[] = [];
  
  parts.push(writeMiniString(txId));
  parts.push(serializeTransaction(tx));
  parts.push(serializeEnhancedWitness(
    wotsData,
    coinProofsHex,
    scriptDescriptors,
    extraScripts,
    externalSignatures
  ));
  
  const result = canonicalConcat(...parts);
  console.log(`[EnhancedTxnImport] TOTAL: ${result.length} bytes`);
  return result;
}

/**
 * Build and serialize a complete transaction for txnimport.
 */
export function buildEnhancedForTxnImport(
  params: EnhancedBuildParams,
  txId: string,
  wotsData?: WotsSignatureData,
  externalSignatures?: ExternalSignature[]
): { buildResult: EnhancedBuildResult; txnImportHex: string } {
  const buildResult = buildEnhancedTransaction(params);
  
  const txnImportBytes = serializeEnhancedForTxnImport(
    buildResult.transaction,
    txId,
    wotsData,
    buildResult.coinProofsHex,
    buildResult.scriptDescriptors,
    buildResult.extraScripts,
    externalSignatures
  );
  
  return {
    buildResult,
    txnImportHex: bytesToHex(txnImportBytes)
  };
}

/**
 * Validate VERIFYOUT expectations against transaction outputs.
 */
export function validateVerifyOutExpectations(
  tx: MinimaTransaction,
  expectations: VerifyOutExpectation[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const exp of expectations) {
    const inputIndex = exp.inputIndex === '@INPUT' ? 0 : exp.inputIndex;
    const outputIndex = inputIndex;
    
    if (outputIndex >= tx.outputs.length) {
      errors.push(`VERIFYOUT: Output index ${outputIndex} does not exist`);
      continue;
    }
    
    const output = tx.outputs[outputIndex];
    
    const expectedAddr = hexToBytes(exp.outputAddress);
    const outputAddr = output.address;
    if (bytesToHex(expectedAddr).toLowerCase() !== bytesToHex(outputAddr).toLowerCase()) {
      errors.push(`VERIFYOUT: Address mismatch at index ${outputIndex}`);
    }
    
    // exp.amount should be in BASE UNITS (unified contract)
    // output.amount is now a decimal string, compare using parseDecimalToBaseUnits
    const expectedAmount = typeof exp.amount === 'string' 
      ? parseDecimalToBaseUnits(exp.amount)
      : exp.amount;
    const outputAmount = parseDecimalToBaseUnits(output.amount);
    if (outputAmount !== expectedAmount) {
      errors.push(`VERIFYOUT: Amount mismatch at index ${outputIndex}. Expected ${expectedAmount}, got ${outputAmount}`);
    }
    
    const expectedToken = hexToBytes(exp.tokenId);
    if (bytesToHex(expectedToken).toLowerCase() !== bytesToHex(output.tokenId).toLowerCase()) {
      errors.push(`VERIFYOUT: TokenId mismatch at index ${outputIndex}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export { hexToBytes, bytesToHex, concat, parseDecimalToBaseUnits, formatBaseUnitsToDecimal };
