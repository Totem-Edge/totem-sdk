/**
 * TransactionArtifact
 * 
 * A complete, pre-assembled transaction ready for preview and signing.
 * This artifact contains all inputs, outputs, proofs, scripts, and serialization
 * needed to display a full transaction preview to the user before they sign.
 * 
 * IMPORTANT: Minima has NO transaction fees - only optional user-specified burns.
 */

import type { MinimaTransaction, TransactionBuildResult } from './MinimaTransactionBuilder';
import type { ScriptDescriptor } from './types/ScriptTypes';
import type { SpendableCoin, CoinSelectionResult, SendMode } from './CoinSelectionService';

export type TransactionType = 
  | 'simple_send'
  | 'multisig'
  | 'multisig_mofn'
  | 'timelock'
  | 'htlc'
  | 'mast'
  | 'exchange'
  | 'vault'
  | 'flashcash'
  | 'slowcash'
  | 'stateful_game'
  | 'custom';

export interface TransactionInputArtifact {
  coinId: string;
  address: string;
  amount: string;
  tokenId: string;
  scriptType: string;
  scriptDescription?: string;
  mmrProof?: string;
  coinProof?: string;
}

export interface TransactionOutputArtifact {
  address: string;
  amount: string;
  tokenId: string;
  isChange: boolean;
  stateVariables?: { port: number; value: string }[];
}

export interface TransactionArtifact {
  id: string;
  createdAt: number;
  
  type: TransactionType;
  
  transaction: MinimaTransaction;
  buildResult: TransactionBuildResult;
  
  inputs: TransactionInputArtifact[];
  outputs: TransactionOutputArtifact[];
  
  totalIn: { tokenId: string; amount: string }[];
  totalOut: { tokenId: string; amount: string }[];
  
  burn?: string;
  change?: string;
  
  scriptDescriptors: ScriptDescriptor[];
  
  rawTransactionHex: string;
  digestTxHex: string;
  
  coinSelection: CoinSelectionResult;
  
  sourceMode: SendMode;
  sourceAddress?: string;
  walletAddresses: string[];
  
  recipient: string;
  requestedAmount: string;
  tokenId: string;
  tokenSymbol: string;
  
  isValid: boolean;
  validationErrors: string[];
  
  requiresExternalSignatures: boolean;
  externalSignatureKeys?: string[];
  collectedSignatures?: { publicKey: string; signature: string; validated: boolean }[];
}

export interface TransactionAssemblyRequest {
  type: TransactionType;
  
  recipient: string;
  amount: string;
  tokenId: string;
  tokenSymbol: string;
  
  sourceMode: SendMode;
  sourceAddress?: string;
  excludedAddresses?: string[];
  
  burn?: string;
  
  walletAddresses: string[];
  wotsRootPublicKey: string;
  
  scriptDescriptor?: ScriptDescriptor;
  
  timelockHeight?: number;
  htlcSecret?: string;
  htlcHashlock?: string;
  htlcTimeout?: number;
  
  multisigKeys?: string[];
  multisigThreshold?: number;
  
  mastBranches?: { condition: string; script: string }[];
  mastSelectedBranch?: number;
  
  externalSignatures?: { publicKey: string; signature: string }[];
}

export interface TransactionAssemblyResult {
  success: boolean;
  artifact?: TransactionArtifact;
  error?: string;
  errorCode?: 'INSUFFICIENT_FUNDS' | 'COIN_FETCH_FAILED' | 'BUILD_FAILED' | 'VALIDATION_FAILED' | 'PROOF_FETCH_FAILED';
}

export function generateArtifactId(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(36)).join('').slice(0, 7);
  return `txart_${Date.now()}_${rand}`;
}
