/**
 * @module Transaction Types
 * Type definitions for transaction service
 */

export interface WotsIndices {
  addressIndex: number;
  l1: number;
  l2: number;
}

export interface PrepareRequest {
  to: string;
  amount: string;
  tokenId?: string;
  burn?: string;
  txId?: string;
  addressIndex?: number; // Required by v2-spec backend (0-63, must match the coin's address)
}

export interface PrepareResponse {
  addressIndex: number;
  l1: number;
  l2: number;
  leaseToken: string;
  digestTx: string;
  digestL2: string | null;
  digestL3: string | null;
  txId: string;
  rootPublicKey: string;
  paramSet: string;
  leaseId: string;
  leaseTTL: number;
  perAddressScript?: string | null; // RETURN SIGNEDBY(<perAddressPublicKey>) — present in RootTree mode
}

export interface SignRequest {
  addressIndex: number;
  l1: number;
  l2: number;
  digestTx: string;
}

/**
 * Per-proof entry in a hierarchical TreeKey signature chain.
 * Each proof represents one parent→child signing step.
 */
export interface SignatureProofHex {
  leafPubkey: string;   // 32-byte WOTS public key DIGEST as hex (SHA3-256 of full key)
  signature: string;    // 1088-byte WOTS signature as hex
  mmrProof: string;     // Serialized MMR proof as hex
}

/**
 * Hierarchical witness bundle produced by per-address TreeKey signing.
 *
 * Index mapping:
 *   addressIndex — which HD address (0-63)
 *   l1           — L1 index within per-address TreeKey (0-63)
 *   l2           — L2 index within per-address TreeKey (0-63)
 *
 * proofs contains 3 entries for depth-3 TreeKeys (Root→L1→L2→DATA),
 * matching Minima's TreeKey.sign() exactly.
 */
export interface HierarchicalWitnessBundle {
  addressIndex: number;
  l1: number;
  l2: number;
  rootPublicKey: string;
  proofs: SignatureProofHex[];
}

/**
 * @deprecated Use HierarchicalWitnessBundle. Kept for backward compatibility.
 */
export interface WitnessBundle {
  addressIndex: number;
  l1: number;
  l2: number;
  signatures: {
    l1Proof: string[];
    l2Proof: string[];
    l3Proof: string[];
  };
}

export interface SignResult {
  witnessBundle: HierarchicalWitnessBundle;
  signedHex: string;
}

export interface FinalizeRequest {
  leaseToken: string;
  signedHex?: string;        // Hex-encoded signed transaction
  signedBase64?: string;     // Base64-encoded signed transaction (preferred, bypasses WAF)
  transactionHex?: string;   // Optional: the unsigned transaction body
  importId?: string;         // Optional: client-provided import ID for txnimport
}

export interface FinalizeResponse {
  ok: boolean;
  leaseId: string;
  txpowid: string;
}

export interface TransactionMetadata {
  to: string;
  amount: string;
  tokenId: string;
}

export interface TransactionReceipt {
  txpowid: string;
  timestamp: number;
  to: string;
  amount: string;
  tokenId: string;
  indices: WotsIndices;
  status: 'confirmed' | 'pending' | 'failed';
  txId?: string;
  leaseId?: string;
}

export interface TransactionError {
  code: number;
  message: string;
  userMessage: string;
}
