import { 
  verifyTreeSignature, 
  TreeSignature, 
  SignatureProof,
  getRootPublicKey
} from '@totemsdk/core';
import { deserializeMMRProof } from '@totemsdk/core';
import { convertMinimaAddress } from '@totemsdk/core';

/**
 * Client-side TxnCheck Simulator (Preflight Validation)
 * 
 * Performs STRUCTURAL validation before sending to the node. This catches
 * common issues early (missing fields, count mismatches, malformed data)
 * but does NOT perform full cryptographic verification - that's done by the node.
 * 
 * Validation stages (matching Minima's txncheck.java order):
 * 1. BASIC - Transaction structure, amounts, token balances (with TOKENID_CREATE normalization)
 * 2. DUPLICATES - No duplicate coinIds in inputs (double-spend detection)
 * 3. WITNESS_COUNTS - Input/coinProof counts match, ScriptProofs present
 * 4. WITNESS_ORDERING - CoinProofs match corresponding inputs by coinId
 * 5. SIGNATURES - Structural check: proofs exist, pubkeys valid length
 *    (Optional: fullCryptoVerify=true enables verifyTreeSignature for cryptographic verification)
 * 6. SIGNATURE_COVERAGE - All input addresses have matching signatures
 * 7. MMR_PROOFS - Structural check: valid hex, reasonable length, no nulls
 *    (Note: Full MMR tree verification is NOT performed - node handles this)
 * 8. SCRIPTS - Skipped (script execution requires Minima node)
 * 
 * IMPORTANT: A passing preflight check does NOT guarantee node acceptance.
 * This tool catches structural issues; cryptographic/semantic issues are caught by the node.
 * 
 * Verbose mode logs to service worker console for debugging. Enable with verbose=true.
 */

export type ValidationStage = 
  | 'BASIC' 
  | 'DUPLICATES'
  | 'WITNESS_COUNTS' 
  | 'WITNESS_ORDERING'
  | 'SIGNATURES' 
  | 'SIGNATURE_COVERAGE'
  | 'MMR_PROOFS' 
  | 'SCRIPTS';

const TOKENID_CREATE = '0xff';
const TOKENID_MINIMA = '0x00';

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Deserialize SignatureProofData array to TreeSignature
 * 
 * Maps the witness data format to the SDK's TreeSignature format:
 * - publicKeyHex → leafPubkey (Winternitz full public key)
 * - signatureHex → signature (WOTS signature bytes)
 * - mmrProofHex → mmrProof (MMR proof linking leaf to root)
 */
function deserializeSignatureData(
  proofDataArray: SignatureProofData[]
): TreeSignature | null {
  try {
    const proofs: SignatureProof[] = [];
    
    for (const proofData of proofDataArray) {
      if (!proofData.publicKeyHex || !proofData.signatureHex || !proofData.mmrProofHex) {
        return null;
      }
      
      const leafPubkey = hexToBytes(proofData.publicKeyHex);
      const signature = hexToBytes(proofData.signatureHex);
      const mmrProofBytes = hexToBytes(proofData.mmrProofHex);
      
      // Deserialize MMR proof from bytes (returns { proof, blockTime })
      const { proof: mmrProof } = deserializeMMRProof(mmrProofBytes);
      
      proofs.push({
        leafPubkey,
        signature,
        mmrProof
      });
    }
    
    return { proofs };
  } catch (e) {
    console.warn('[TxnCheck] Failed to deserialize signature:', e);
    return null;
  }
}

function normalizeTokenId(tokenId: string): string {
  const normalized = tokenId.toLowerCase().replace(/^0x/, '');
  if (normalized === 'ff' || normalized === TOKENID_CREATE.replace(/^0x/, '')) {
    return TOKENID_MINIMA;
  }
  return tokenId;
}

export interface ValidationError {
  stage: ValidationStage;
  inputIndex?: number;
  field?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  stage: ValidationStage;
  errors: ValidationError[];
  warnings: string[];
  summary: string;
}

export interface TxnCheckInput {
  coinId: string;
  address: string;
  amount: string;
  tokenId: string;
}

export interface TxnCheckOutput {
  address: string;
  amount: string;
  tokenId: string;
}

export interface SignatureProofData {
  publicKeyHex: string;
  signatureHex: string;
  mmrProofHex: string;
}

export interface WitnessData {
  signatures: Array<{
    rootPublicKeyHex: string;
    proofs: SignatureProofData[];
  }>;
  coinProofsHex: string[];
  scriptProofs: Array<{
    script: string;
    address: string;
    rootPublicKeyHex: string;
  }>;
}

export interface TransactionData {
  inputs: TxnCheckInput[];
  outputs: TxnCheckOutput[];
  transactionIdHex: string;
}

export interface TxnCheckContext {
  transaction: TransactionData;
  witness: WitnessData;
  verbose?: boolean;
  /** Enable full cryptographic signature verification (expensive but thorough) */
  fullCryptoVerify?: boolean;
}

function log(verbose: boolean, ...args: unknown[]): void {
  if (verbose) {
    console.log('[TxnCheck]', ...args);
  }
}

function logGroup(verbose: boolean, label: string): void {
  if (verbose) {
    console.group(`[TxnCheck] ${label}`);
  }
}

function logGroupEnd(verbose: boolean): void {
  if (verbose) {
    console.groupEnd();
  }
}

/**
 * Stage 1: Basic transaction validation
 * - Inputs and outputs exist
 * - Amounts are positive
 * - Token balances (inputs >= outputs per token)
 */
function validateBasic(ctx: TxnCheckContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const { transaction, verbose = false } = ctx;
  
  logGroup(verbose, 'Stage 1: BASIC');
  
  if (!transaction.inputs || transaction.inputs.length === 0) {
    errors.push({
      stage: 'BASIC',
      message: 'Transaction has no inputs',
    });
  }
  
  if (!transaction.outputs || transaction.outputs.length === 0) {
    errors.push({
      stage: 'BASIC',
      message: 'Transaction has no outputs',
    });
  }
  
  log(verbose, `Inputs: ${transaction.inputs?.length || 0}`);
  log(verbose, `Outputs: ${transaction.outputs?.length || 0}`);
  
  // Use number (float) for Minima decimal amounts - NOT BigInt which can't handle decimals like "0.0001"
  const tokenTotals = new Map<string, { input: number; output: number }>();
  
  for (let i = 0; i < (transaction.inputs?.length || 0); i++) {
    const input = transaction.inputs[i];
    
    if (!input.coinId) {
      errors.push({
        stage: 'BASIC',
        inputIndex: i,
        field: 'coinId',
        message: `Input ${i} has no coinId`,
      });
    }
    
    if (!input.address) {
      errors.push({
        stage: 'BASIC',
        inputIndex: i,
        field: 'address',
        message: `Input ${i} has no address`,
      });
    }
    
    // Minima uses decimal amounts (e.g., "0.0001") - use parseFloat, NOT BigInt
    const amount = parseFloat(input.amount || '0');
    if (isNaN(amount)) {
      errors.push({
        stage: 'BASIC',
        inputIndex: i,
        field: 'amount',
        message: `Input ${i} has invalid amount: ${input.amount}`,
      });
    } else if (amount <= 0) {
      errors.push({
        stage: 'BASIC',
        inputIndex: i,
        field: 'amount',
        message: `Input ${i} has non-positive amount: ${input.amount}`,
      });
    } else {
      const tokenId = normalizeTokenId(input.tokenId || '0x00');
      if (!tokenTotals.has(tokenId)) {
        tokenTotals.set(tokenId, { input: 0, output: 0 });
      }
      tokenTotals.get(tokenId)!.input += amount;
    }
    
    log(verbose, `  Input[${i}]: coinId=${input.coinId?.slice(0, 16)}..., address=${input.address?.slice(0, 16)}..., amount=${input.amount}`);
  }
  
  for (let i = 0; i < (transaction.outputs?.length || 0); i++) {
    const output = transaction.outputs[i];
    
    if (!output.address) {
      errors.push({
        stage: 'BASIC',
        inputIndex: i,
        field: 'address',
        message: `Output ${i} has no address`,
      });
    }
    
    // Minima uses decimal amounts (e.g., "0.0001") - use parseFloat, NOT BigInt
    const amount = parseFloat(output.amount || '0');
    if (isNaN(amount)) {
      errors.push({
        stage: 'BASIC',
        inputIndex: i,
        field: 'amount',
        message: `Output ${i} has invalid amount: ${output.amount}`,
      });
    } else if (amount < 0) {
      errors.push({
        stage: 'BASIC',
        inputIndex: i,
        field: 'amount',
        message: `Output ${i} has negative amount: ${output.amount}`,
      });
    } else {
      const tokenId = normalizeTokenId(output.tokenId || '0x00');
      if (!tokenTotals.has(tokenId)) {
        tokenTotals.set(tokenId, { input: 0, output: 0 });
      }
      tokenTotals.get(tokenId)!.output += amount;
    }
    
    log(verbose, `  Output[${i}]: address=${output.address?.slice(0, 16)}..., amount=${output.amount}`);
  }
  
  // Use small epsilon for floating point comparison
  const EPSILON = 1e-12;
  for (const [tokenId, totals] of tokenTotals) {
    if (totals.input < totals.output - EPSILON) {
      errors.push({
        stage: 'BASIC',
        field: 'tokenBalance',
        message: `Token ${tokenId} has insufficient input: ${totals.input} < ${totals.output}`,
        details: { tokenId, input: totals.input.toString(), output: totals.output.toString() },
      });
    }
    const burn = totals.input - totals.output;
    log(verbose, `  Token ${tokenId.slice(0, 16)}...: input=${totals.input}, output=${totals.output}, burn=${burn}`);
  }
  
  logGroupEnd(verbose);
  return errors;
}

/**
 * Stage 2: Witness count validation
 * - Number of coin proofs matches number of inputs
 * - Each input has a corresponding script proof
 */
function validateWitnessCounts(ctx: TxnCheckContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const { transaction, witness, verbose = false } = ctx;
  
  logGroup(verbose, 'Stage 2: WITNESS_COUNTS');
  
  const inputCount = transaction.inputs?.length || 0;
  const coinProofCount = witness.coinProofsHex?.length || 0;
  const scriptProofCount = witness.scriptProofs?.length || 0;
  const signatureCount = witness.signatures?.length || 0;
  
  log(verbose, `Input count: ${inputCount}`);
  log(verbose, `Coin proof count: ${coinProofCount}`);
  log(verbose, `Script proof count: ${scriptProofCount}`);
  log(verbose, `Signature count: ${signatureCount}`);
  
  if (coinProofCount !== inputCount) {
    errors.push({
      stage: 'WITNESS_COUNTS',
      message: `Coin proof count (${coinProofCount}) does not match input count (${inputCount})`,
      details: { coinProofCount, inputCount },
    });
  }
  
  if (signatureCount === 0) {
    errors.push({
      stage: 'WITNESS_COUNTS',
      message: 'No signatures in witness',
    });
  }
  
  const uniqueAddresses = new Set(transaction.inputs.map(i => i.address?.toLowerCase()));
  log(verbose, `Unique input addresses: ${uniqueAddresses.size}`);
  
  for (const addr of uniqueAddresses) {
    if (!addr) continue;
    
    const hasScriptProof = witness.scriptProofs?.some(
      sp => sp.address?.toLowerCase() === addr
    );
    
    if (!hasScriptProof) {
      errors.push({
        stage: 'WITNESS_COUNTS',
        field: 'scriptProof',
        message: `No ScriptProof for input address: ${addr.slice(0, 20)}...`,
        details: { address: addr },
      });
    }
  }
  
  for (let i = 0; i < scriptProofCount; i++) {
    const sp = witness.scriptProofs[i];
    log(verbose, `  ScriptProof[${i}]: address=${sp.address?.slice(0, 16)}..., pubkey=${sp.rootPublicKeyHex?.slice(0, 20)}...`);
    
    if (!sp.rootPublicKeyHex || sp.rootPublicKeyHex.length < 64) {
      errors.push({
        stage: 'WITNESS_COUNTS',
        inputIndex: i,
        field: 'scriptProof.rootPublicKeyHex',
        message: `ScriptProof[${i}] has invalid/empty public key`,
        details: { pubkeyLength: sp.rootPublicKeyHex?.length || 0 },
      });
    }
    
    if (!sp.script || !sp.script.includes('SIGNEDBY')) {
      errors.push({
        stage: 'WITNESS_COUNTS',
        inputIndex: i,
        field: 'scriptProof.script',
        message: `ScriptProof[${i}] has invalid unlock script: ${sp.script?.slice(0, 30)}...`,
      });
    }
  }
  
  logGroupEnd(verbose);
  return errors;
}

/**
 * Stage 3: Signature structural validation
 * - Each signature has valid structure
 * - Public keys are correct length
 * - Signature proofs are present
 * 
 * Note: Full cryptographic verification is optional and expensive
 */
function validateSignatures(ctx: TxnCheckContext, fullVerify: boolean = false): ValidationError[] {
  const errors: ValidationError[] = [];
  const { transaction, witness, verbose = false } = ctx;
  
  logGroup(verbose, 'Stage 3: SIGNATURES');
  
  if (!transaction.transactionIdHex) {
    errors.push({
      stage: 'SIGNATURES',
      message: 'Transaction ID not provided for signature verification',
    });
    logGroupEnd(verbose);
    return errors;
  }
  
  log(verbose, `Transaction ID: ${transaction.transactionIdHex.slice(0, 32)}...`);
  
  for (let sigIdx = 0; sigIdx < (witness.signatures?.length || 0); sigIdx++) {
    const sig = witness.signatures[sigIdx];
    
    log(verbose, `  Signature[${sigIdx}]: rootPubkey=${sig.rootPublicKeyHex?.slice(0, 20)}..., proofs=${sig.proofs?.length || 0}`);
    
    if (!sig.rootPublicKeyHex || sig.rootPublicKeyHex.length < 64) {
      errors.push({
        stage: 'SIGNATURES',
        inputIndex: sigIdx,
        field: 'rootPublicKeyHex',
        message: `Signature[${sigIdx}] has invalid root public key (length: ${sig.rootPublicKeyHex?.length || 0})`,
      });
      continue;
    }
    
    if (!sig.proofs || sig.proofs.length === 0) {
      errors.push({
        stage: 'SIGNATURES',
        inputIndex: sigIdx,
        field: 'proofs',
        message: `Signature[${sigIdx}] has no signature proofs`,
      });
      continue;
    }
    
    // Note: proof count varies by TreeKey depth (2 for address-based, 3 for root-based)
    // We validate that proofs exist, not a specific count
    if (sig.proofs.length < 1 || sig.proofs.length > 3) {
      errors.push({
        stage: 'SIGNATURES',
        inputIndex: sigIdx,
        field: 'proofs.length',
        message: `Signature[${sigIdx}] has unusual proof count: ${sig.proofs.length} (expected 1-3)`,
        details: { actualCount: sig.proofs.length },
      });
    }
    
    log(verbose, `    Proof count: ${sig.proofs.length} (valid range: 1-3)`);
    
    for (let proofIdx = 0; proofIdx < sig.proofs.length; proofIdx++) {
      const proof = sig.proofs[proofIdx];
      
      log(verbose, `    Proof[${proofIdx}]: pubkey=${proof.publicKeyHex?.slice(0, 16)}..., sig=${proof.signatureHex?.length || 0} chars, mmr=${proof.mmrProofHex?.length || 0} chars`);
      
      if (!proof.publicKeyHex || proof.publicKeyHex.length < 64) {
        errors.push({
          stage: 'SIGNATURES',
          inputIndex: sigIdx,
          field: `proofs[${proofIdx}].publicKeyHex`,
          message: `Signature[${sigIdx}].Proof[${proofIdx}] has invalid public key`,
          details: { length: proof.publicKeyHex?.length || 0 },
        });
      }
      
      if (!proof.signatureHex || proof.signatureHex.length < 100) {
        errors.push({
          stage: 'SIGNATURES',
          inputIndex: sigIdx,
          field: `proofs[${proofIdx}].signatureHex`,
          message: `Signature[${sigIdx}].Proof[${proofIdx}] has invalid/empty signature`,
          details: { length: proof.signatureHex?.length || 0 },
        });
      }
      
      if (!proof.mmrProofHex || proof.mmrProofHex.length < 10) {
        errors.push({
          stage: 'SIGNATURES',
          inputIndex: sigIdx,
          field: `proofs[${proofIdx}].mmrProofHex`,
          message: `Signature[${sigIdx}].Proof[${proofIdx}] has invalid/empty MMR proof`,
          details: { length: proof.mmrProofHex?.length || 0 },
        });
      }
    }
    
    // Perform cryptographic verification if requested
    if (fullVerify) {
      log(verbose, `    Performing cryptographic verification...`);
      
      const treeSignature = deserializeSignatureData(sig.proofs);
      
      if (!treeSignature) {
        errors.push({
          stage: 'SIGNATURES',
          inputIndex: sigIdx,
          field: 'proofs',
          message: `Signature[${sigIdx}] could not be deserialized for cryptographic verification`,
        });
        continue;
      }
      
      // Validate transactionIdHex is 32 bytes (64 hex chars)
      const txIdClean = transaction.transactionIdHex.replace(/^0x/i, '');
      if (txIdClean.length !== 64) {
        errors.push({
          stage: 'SIGNATURES',
          inputIndex: sigIdx,
          field: 'transactionIdHex',
          message: `Transaction ID invalid length: ${txIdClean.length} hex chars (expected 64)`,
        });
        continue;
      }
      
      const expectedPubkey = hexToBytes(sig.rootPublicKeyHex);
      const transactionId = hexToBytes(transaction.transactionIdHex);
      
      try {
        // First check: Verify signature's computed root pubkey matches expected pubkey
        // (Matches verify.java: sig.getRootPublicKey() must equal provided pubkey)
        if (treeSignature.proofs.length > 0) {
          const computedRootPubkey = getRootPublicKey(treeSignature.proofs[0]);
          let pubkeyMatch = true;
          
          if (computedRootPubkey.length !== expectedPubkey.length) {
            pubkeyMatch = false;
          } else {
            for (let i = 0; i < expectedPubkey.length; i++) {
              if (computedRootPubkey[i] !== expectedPubkey[i]) {
                pubkeyMatch = false;
                break;
              }
            }
          }
          
          if (!pubkeyMatch) {
            const computedHex = Array.from(computedRootPubkey).map(b => b.toString(16).padStart(2, '0')).join('');
            errors.push({
              stage: 'SIGNATURES',
              inputIndex: sigIdx,
              field: 'crypto_verify.pubkey_mismatch',
              message: `Signature[${sigIdx}] computed root pubkey differs from expected`,
              details: {
                expectedPubkey: sig.rootPublicKeyHex.slice(0, 32) + '...',
                computedPubkey: computedHex.slice(0, 32) + '...'
              },
            });
            continue;
          }
          log(verbose, `    ✓ Signature[${sigIdx}] root pubkey matches`);
        }
        
        // Second check: Full cryptographic verification
        const isValid = verifyTreeSignature(expectedPubkey, transactionId, treeSignature);
        
        if (isValid) {
          log(verbose, `    ✓ Signature[${sigIdx}] cryptographically valid`);
        } else {
          errors.push({
            stage: 'SIGNATURES',
            inputIndex: sigIdx,
            field: 'crypto_verify',
            message: `Signature[${sigIdx}] failed cryptographic verification`,
            details: { 
              rootPubkey: sig.rootPublicKeyHex.slice(0, 32) + '...',
              proofCount: sig.proofs.length 
            },
          });
        }
      } catch (verifyErr: any) {
        errors.push({
          stage: 'SIGNATURES',
          inputIndex: sigIdx,
          field: 'crypto_verify',
          message: `Signature[${sigIdx}] verification threw error: ${verifyErr.message || verifyErr}`,
        });
      }
    }
  }
  
  logGroupEnd(verbose);
  return errors;
}

/**
 * Stage 4: MMR proof structural validation
 * - Coin proofs are valid hex
 * - Structure appears valid (length checks)
 */
function validateMMRProofs(ctx: TxnCheckContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const { witness, verbose = false } = ctx;
  
  logGroup(verbose, 'Stage 4: MMR_PROOFS');
  
  for (let i = 0; i < (witness.coinProofsHex?.length || 0); i++) {
    const proofHex = witness.coinProofsHex[i];
    
    if (!proofHex) {
      errors.push({
        stage: 'MMR_PROOFS',
        inputIndex: i,
        message: `CoinProof[${i}] is null/undefined`,
      });
      continue;
    }
    
    const cleanHex = proofHex.replace(/^0x/i, '');
    
    if (cleanHex.length === 0) {
      errors.push({
        stage: 'MMR_PROOFS',
        inputIndex: i,
        message: `CoinProof[${i}] is empty`,
      });
      continue;
    }
    
    if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
      errors.push({
        stage: 'MMR_PROOFS',
        inputIndex: i,
        message: `CoinProof[${i}] contains invalid hex characters`,
      });
      continue;
    }
    
    if (cleanHex.length % 2 !== 0) {
      errors.push({
        stage: 'MMR_PROOFS',
        inputIndex: i,
        message: `CoinProof[${i}] has odd hex length: ${cleanHex.length}`,
      });
      continue;
    }
    
    const byteLength = cleanHex.length / 2;
    log(verbose, `  CoinProof[${i}]: ${byteLength} bytes, hex=${proofHex.slice(0, 40)}...`);
    
    if (byteLength < 50) {
      errors.push({
        stage: 'MMR_PROOFS',
        inputIndex: i,
        message: `CoinProof[${i}] suspiciously short: ${byteLength} bytes`,
        details: { byteLength },
      });
    }
  }
  
  logGroupEnd(verbose);
  return errors;
}

/**
 * Stage 5: Duplicate coinId detection
 * - Same coinId should not appear twice in inputs (double-spend attempt)
 */
function validateDuplicates(ctx: TxnCheckContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const { transaction, verbose = false } = ctx;
  
  logGroup(verbose, 'Stage: DUPLICATES');
  
  const seenCoinIds = new Map<string, number>();
  
  for (let i = 0; i < (transaction.inputs?.length || 0); i++) {
    const input = transaction.inputs[i];
    const coinIdLower = input.coinId?.toLowerCase();
    
    if (!coinIdLower) continue;
    
    if (seenCoinIds.has(coinIdLower)) {
      const firstIndex = seenCoinIds.get(coinIdLower)!;
      errors.push({
        stage: 'DUPLICATES',
        inputIndex: i,
        field: 'coinId',
        message: `Duplicate coinId: Input[${i}] has same coinId as Input[${firstIndex}]`,
        details: { coinId: input.coinId, firstIndex, duplicateIndex: i },
      });
    } else {
      seenCoinIds.set(coinIdLower, i);
    }
  }
  
  log(verbose, `Checked ${transaction.inputs?.length || 0} inputs for duplicates`);
  log(verbose, `Unique coinIds: ${seenCoinIds.size}`);
  if (errors.length === 0) {
    log(verbose, '✓ No duplicate coinIds found');
  }
  
  logGroupEnd(verbose);
  return errors;
}

/**
 * Stage 6: Witness ordering validation
 * - CoinProofs must be in same order as inputs
 * - Parse coinProof to extract coinId and verify it matches inputs[i]
 * 
 * CoinProof format: [Coin][MMRProof]
 * Coin starts with: [coinId as MiniData (4-byte len + 32 bytes)]
 */
function validateWitnessOrdering(ctx: TxnCheckContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const { transaction, witness, verbose = false } = ctx;
  
  logGroup(verbose, 'Stage: WITNESS_ORDERING');
  
  const inputCount = transaction.inputs?.length || 0;
  const coinProofCount = witness.coinProofsHex?.length || 0;
  
  if (coinProofCount !== inputCount) {
    log(verbose, `Skipping ordering check: count mismatch (inputs=${inputCount}, proofs=${coinProofCount})`);
    logGroupEnd(verbose);
    return errors;
  }
  
  for (let i = 0; i < inputCount; i++) {
    const input = transaction.inputs[i];
    const proofHex = witness.coinProofsHex[i];
    
    if (!proofHex) {
      errors.push({
        stage: 'WITNESS_ORDERING',
        inputIndex: i,
        message: `CoinProof[${i}] is missing`,
      });
      continue;
    }
    
    const parsed = extractCoinDataFromProof(proofHex);
    
    if (!parsed || parsed.parseError) {
      errors.push({
        stage: 'WITNESS_ORDERING',
        inputIndex: i,
        field: 'coinProof',
        message: `CoinProof[${i}] parse failed: ${parsed?.parseError || 'null result'}`,
        details: { proofLength: proofHex.length, proofIndex: i }
      });
      continue;
    }
    
    const inputCoinIdNorm = input.coinId?.toLowerCase().replace(/^0x/, '');
    const extractedCoinIdNorm = parsed.coinId.toLowerCase().replace(/^0x/, '');
    
    if (inputCoinIdNorm !== extractedCoinIdNorm) {
      errors.push({
        stage: 'WITNESS_ORDERING',
        inputIndex: i,
        field: 'coinProof.coinId',
        message: `CoinProof[${i}] coinId mismatch: expected ${inputCoinIdNorm?.slice(0, 16)}..., got ${extractedCoinIdNorm.slice(0, 16)}...`,
        details: { 
          expectedCoinId: input.coinId, 
          extractedCoinId: parsed.coinId,
          proofIndex: i 
        },
      });
    } else {
      log(verbose, `  CoinProof[${i}]: ✓ coinId matches Input[${i}]`);
    }
    
    // Convert Mx address to hex for comparison (Mx format is base32 encoded, CoinProof contains raw hex)
    let inputAddressHex: string;
    if (input.address?.toLowerCase().startsWith('mx')) {
      try {
        inputAddressHex = convertMinimaAddress(input.address).toLowerCase().replace(/^0x/, '');
      } catch (e: any) {
        errors.push({
          stage: 'WITNESS_ORDERING',
          inputIndex: i,
          field: 'input.address',
          message: `Input[${i}] address conversion failed: ${e.message || e}`,
          details: { address: input.address }
        });
        continue;
      }
    } else {
      inputAddressHex = input.address?.toLowerCase().replace(/^0x/, '') || '';
    }
    const extractedAddressNorm = parsed.address.toLowerCase().replace(/^0x/, '');
    
    if (inputAddressHex && inputAddressHex !== extractedAddressNorm) {
      errors.push({
        stage: 'WITNESS_ORDERING',
        inputIndex: i,
        field: 'coinProof.address',
        message: `CoinProof[${i}] address mismatch: expected ${inputAddressHex.slice(0, 16)}..., got ${extractedAddressNorm.slice(0, 16)}...`,
        details: { 
          expectedAddress: input.address, 
          expectedAddressHex: '0x' + inputAddressHex,
          extractedAddress: parsed.address,
          proofIndex: i 
        },
      });
    } else if (inputAddressHex) {
      log(verbose, `  CoinProof[${i}]: ✓ address matches Input[${i}]`);
    }
  }
  
  if (errors.length === 0) {
    log(verbose, `✓ All ${inputCount} coinProofs match their corresponding inputs`);
  }
  
  logGroupEnd(verbose);
  return errors;
}

/**
 * Extract coinId and address from CoinProof hex data
 * 
 * CoinProof format: [Coin][MMRProof]
 * Coin format (per Minima's Coin.java writeDataStream):
 *   [coinId: MiniData 4-byte len + 32 bytes]
 *   [address: MiniData 4-byte len + 32 bytes]
 *   [amount: MiniNumber variable]
 *   [tokenId: MiniData 4-byte len + variable]
 *   ...remaining fields
 * 
 * MiniData format: 4-byte big-endian length + data bytes
 */
interface CoinProofParsed {
  coinId: string;
  address: string;
  parseError?: string;
}

function extractCoinDataFromProof(proofHex: string): CoinProofParsed | null {
  try {
    const hex = proofHex.replace(/^0x/i, '');
    
    if (hex.length < 144) {
      return { coinId: '', address: '', parseError: `Proof too short: ${hex.length} chars (need 144 for coinId+address)` };
    }
    
    let offset = 0;
    
    const coinIdLengthHex = hex.slice(offset, offset + 8);
    const coinIdLength = parseInt(coinIdLengthHex, 16);
    offset += 8;
    
    if (coinIdLength !== 32) {
      return { coinId: '', address: '', parseError: `Unexpected coinId length: ${coinIdLength} (expected 32)` };
    }
    
    const coinIdHex = hex.slice(offset, offset + 64);
    offset += 64;
    
    const addressLengthHex = hex.slice(offset, offset + 8);
    const addressLength = parseInt(addressLengthHex, 16);
    offset += 8;
    
    if (addressLength !== 32) {
      return { coinId: '0x' + coinIdHex, address: '', parseError: `Unexpected address length: ${addressLength} (expected 32)` };
    }
    
    const addressHex = hex.slice(offset, offset + 64);
    
    return {
      coinId: '0x' + coinIdHex,
      address: '0x' + addressHex
    };
  } catch (e: any) {
    return { coinId: '', address: '', parseError: `Parse exception: ${e.message || e}` };
  }
}

/**
 * Stage 7: Signature coverage validation
 * - Ensure all unique input addresses have corresponding signatures
 * - Verify ScriptProof pubkeys match signature rootPubkeys
 */
function validateSignatureCoverage(ctx: TxnCheckContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const { transaction, witness, verbose = false } = ctx;
  
  logGroup(verbose, 'Stage: SIGNATURE_COVERAGE');
  
  const uniqueAddresses = new Set(
    transaction.inputs
      .map(i => i.address?.toLowerCase())
      .filter((a): a is string => !!a)
  );
  
  log(verbose, `Unique input addresses: ${uniqueAddresses.size}`);
  log(verbose, `Signatures: ${witness.signatures?.length || 0}`);
  log(verbose, `ScriptProofs: ${witness.scriptProofs?.length || 0}`);
  
  const scriptProofPubkeys = new Map<string, string>();
  for (const sp of witness.scriptProofs || []) {
    if (sp.address && sp.rootPublicKeyHex) {
      scriptProofPubkeys.set(sp.address.toLowerCase(), sp.rootPublicKeyHex.toLowerCase());
    }
  }
  
  const signatureRootPubkeys = new Set(
    (witness.signatures || [])
      .map(s => s.rootPublicKeyHex?.toLowerCase())
      .filter((p): p is string => !!p)
  );
  
  log(verbose, `Signature root pubkeys: ${signatureRootPubkeys.size}`);
  
  for (const addr of uniqueAddresses) {
    const scriptProofPubkey = scriptProofPubkeys.get(addr);
    
    if (!scriptProofPubkey) {
      errors.push({
        stage: 'SIGNATURE_COVERAGE',
        field: 'scriptProof',
        message: `Address ${addr.slice(0, 20)}... has no ScriptProof`,
        details: { address: addr },
      });
      continue;
    }
    
    if (!signatureRootPubkeys.has(scriptProofPubkey)) {
      errors.push({
        stage: 'SIGNATURE_COVERAGE',
        field: 'signature',
        message: `Address ${addr.slice(0, 20)}... ScriptProof pubkey not found in signatures`,
        details: { 
          address: addr, 
          scriptProofPubkey: scriptProofPubkey.slice(0, 20) + '...',
          availableSignatures: Array.from(signatureRootPubkeys).map(p => p.slice(0, 20) + '...')
        },
      });
    } else {
      log(verbose, `  Address ${addr.slice(0, 16)}...: ✓ has matching signature`);
    }
  }
  
  if (errors.length === 0) {
    log(verbose, `✓ All ${uniqueAddresses.size} addresses have matching signatures`);
  }
  
  logGroupEnd(verbose);
  return errors;
}

/**
 * Stage 8: Script validation (node-only)
 * We cannot execute Minima scripts client-side, so this is informational only
 */
function validateScripts(ctx: TxnCheckContext): ValidationError[] {
  const { verbose = false } = ctx;
  
  logGroup(verbose, 'Stage: SCRIPTS');
  log(verbose, '  [SKIPPED] Script execution requires Minima node - will be verified on import');
  logGroupEnd(verbose);
  
  return [];
}

/**
 * Run all validation stages and return comprehensive result
 * 
 * Validation order (matches Minima's txncheck.java):
 * 1. BASIC - Transaction structure, amounts, token balances (with TOKENID_CREATE normalization)
 * 2. DUPLICATES - No duplicate coinIds in inputs
 * 3. WITNESS_COUNTS - Input/coinProof counts match, ScriptProofs present
 * 4. WITNESS_ORDERING - CoinProofs match corresponding inputs by coinId
 * 5. SIGNATURES - Signature proofs exist with valid structure
 * 6. SIGNATURE_COVERAGE - All addresses have matching signatures
 * 7. MMR_PROOFS - CoinProofs are valid hex with reasonable structure
 * 8. SCRIPTS - Skipped (node-only)
 */
export function runTxnCheck(ctx: TxnCheckContext): ValidationResult {
  const allErrors: ValidationError[] = [];
  const warnings: string[] = [];
  let currentStage: ValidationStage = 'BASIC';
  let previousStageHadErrors = false;
  
  const cryptoMode = ctx.fullCryptoVerify ? 'WITH CRYPTO VERIFY' : 'structural only';
  console.log('[TxnCheck] ═══════════════════════════════════════════════════════════');
  console.log(`[TxnCheck] Starting preflight transaction validation (8 stages, ${cryptoMode})`);
  console.log('[TxnCheck] ═══════════════════════════════════════════════════════════');
  
  const basicErrors = validateBasic(ctx);
  allErrors.push(...basicErrors);
  if (basicErrors.length > 0) {
    currentStage = 'BASIC';
    previousStageHadErrors = true;
  }
  
  const duplicateErrors = validateDuplicates(ctx);
  allErrors.push(...duplicateErrors);
  if (duplicateErrors.length > 0 && !previousStageHadErrors) {
    currentStage = 'DUPLICATES';
    previousStageHadErrors = true;
  }
  
  const witnessCountErrors = validateWitnessCounts(ctx);
  allErrors.push(...witnessCountErrors);
  if (witnessCountErrors.length > 0 && !previousStageHadErrors) {
    currentStage = 'WITNESS_COUNTS';
    previousStageHadErrors = true;
  }
  
  const witnessOrderErrors = validateWitnessOrdering(ctx);
  allErrors.push(...witnessOrderErrors);
  if (witnessOrderErrors.length > 0 && !previousStageHadErrors) {
    currentStage = 'WITNESS_ORDERING';
    previousStageHadErrors = true;
  }
  
  const sigErrors = validateSignatures(ctx, ctx.fullCryptoVerify ?? false);
  allErrors.push(...sigErrors);
  if (sigErrors.length > 0 && !previousStageHadErrors) {
    currentStage = 'SIGNATURES';
    previousStageHadErrors = true;
  }
  
  const sigCoverageErrors = validateSignatureCoverage(ctx);
  allErrors.push(...sigCoverageErrors);
  if (sigCoverageErrors.length > 0 && !previousStageHadErrors) {
    currentStage = 'SIGNATURE_COVERAGE';
    previousStageHadErrors = true;
  }
  
  const mmrErrors = validateMMRProofs(ctx);
  allErrors.push(...mmrErrors);
  if (mmrErrors.length > 0 && !previousStageHadErrors) {
    currentStage = 'MMR_PROOFS';
    previousStageHadErrors = true;
  }
  
  const scriptErrors = validateScripts(ctx);
  allErrors.push(...scriptErrors);
  
  if (allErrors.length === 0) {
    currentStage = 'SCRIPTS';
    warnings.push('Script validation skipped (node-only) - transaction will be fully validated on import');
  }
  
  const valid = allErrors.length === 0;
  
  let summary: string;
  if (valid) {
    summary = `✅ Preflight validation PASSED (${ctx.transaction.inputs.length} inputs, ${ctx.transaction.outputs.length} outputs)`;
  } else {
    const errorsByStage = new Map<ValidationStage, number>();
    for (const err of allErrors) {
      errorsByStage.set(err.stage, (errorsByStage.get(err.stage) || 0) + 1);
    }
    const stageBreakdown = Array.from(errorsByStage.entries())
      .map(([stage, count]) => `${stage}:${count}`)
      .join(', ');
    summary = `❌ Preflight validation FAILED at ${currentStage} stage (${allErrors.length} errors: ${stageBreakdown})`;
  }
  
  console.log('[TxnCheck] ═══════════════════════════════════════════════════════════');
  console.log(`[TxnCheck] ${summary}`);
  if (allErrors.length > 0) {
    console.log('[TxnCheck] Errors:');
    for (const err of allErrors) {
      console.log(`[TxnCheck]   [${err.stage}] ${err.message}${err.inputIndex !== undefined ? ` (index: ${err.inputIndex})` : ''}`);
    }
  }
  console.log('[TxnCheck] ═══════════════════════════════════════════════════════════');
  
  return {
    valid,
    stage: currentStage,
    errors: allErrors,
    warnings,
    summary,
  };
}

/**
 * Helper to build TxnCheckContext from common extension data structures
 */
export function buildTxnCheckContext(
  inputs: Array<{ coinId: string; address: string; amount: string; tokenId?: string }>,
  outputs: Array<{ address: string; amount: string; tokenId?: string }>,
  transactionIdHex: string,
  wotsData: {
    rootPublicKey: string;
    hierarchical?: boolean;
    proofs?: Array<{ publicKeyHex: string; signatureHex: string; mmrProofHex: string }>;
  },
  coinProofsHex: string[],
  inputScripts: Array<{ address: string; rootPublicKey: string }>,
  verbose: boolean = false
): TxnCheckContext {
  return {
    transaction: {
      inputs: inputs.map(i => ({
        coinId: i.coinId,
        address: i.address,
        amount: i.amount,
        tokenId: i.tokenId || '0x00',
      })),
      outputs: outputs.map(o => ({
        address: o.address,
        amount: o.amount,
        tokenId: o.tokenId || '0x00',
      })),
      transactionIdHex,
    },
    witness: {
      signatures: [{
        rootPublicKeyHex: wotsData.rootPublicKey,
        proofs: wotsData.proofs || [],
      }],
      coinProofsHex,
      scriptProofs: inputScripts.map(is => ({
        script: `RETURN SIGNEDBY(0x${is.rootPublicKey.replace(/^0x/i, '').toUpperCase()})`,
        address: is.address,
        rootPublicKeyHex: is.rootPublicKey,
      })),
    },
    verbose,
  };
}
