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
}
export interface SignRequest {
    addressIndex: number;
    l1: number;
    l2: number;
    digestTx: string;
}
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
    witnessBundle: WitnessBundle;
    signedHex: string;
}
export interface FinalizeRequest {
    leaseToken: string;
    signedHex: string;
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
