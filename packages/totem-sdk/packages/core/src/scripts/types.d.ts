import type { MMRProofChunk, MMRProof } from '../mmr.js';
export type { MMRProof };
export type StateVariableType = 'STATE' | 'PREVSTATE' | 'SAMESTATE';
export interface StateValue {
    port: number;
    value: string | bigint | Uint8Array | boolean;
    type: 'bool' | 'number' | 'hex' | 'string';
}
export interface VerifyOutExpectation {
    inputIndex: number | '@INPUT';
    outputAddress: string;
    amount: string | bigint;
    tokenId: string;
    keepState: boolean;
}
export type ScriptType = 'signedby' | 'multisig' | 'multisig_mofn' | 'timelock' | 'htlc' | 'mast' | 'exchange' | 'vault' | 'flashcash' | 'slowcash' | 'stateful' | 'custom';
export interface ScriptDescriptor {
    address: string;
    scriptType: ScriptType;
    script: string;
    wotsRootPublicKey?: string;
    mastProof?: MMRProof;
    extraScripts?: Map<string, string>;
    stateVariables?: StateValue[];
    storeState?: boolean;
    verifyOutExpectations?: VerifyOutExpectation[];
    timelockBlock?: bigint;
    htlcHash?: string;
    htlcPreimage?: string;
    multisigKeys?: string[];
    multisigThreshold?: number;
    externalSignatures?: ExternalSignature[];
}
export interface ExternalSignature {
    publicKey: string;
    signature: string;
    proof?: MMRProof;
    signatureType: 'wots' | 'standard';
    validated?: boolean;
}
export interface ScriptCatalogEntry {
    address: string;
    script: string;
    scriptType: ScriptType;
    createdAt: number;
    lastUsed: number;
}
export interface ScriptProofResult {
    script: string;
    proof: MMRProof;
    serialized: Uint8Array;
}
export interface TransactionRoundState {
    round: number;
    previousRound: number;
    preservedPorts: number[];
    newStates: StateValue[];
}
export interface FlatMMRProofChunk {
    isLeft: boolean;
    data: Uint8Array;
}
export interface LegacyMMRProof {
    blockTime: bigint;
    proofChain: FlatMMRProofChunk[];
}
export declare function convertFlatChunkToSDK(chunk: FlatMMRProofChunk): MMRProofChunk;
export declare function convertLegacyProofToSDK(legacy: LegacyMMRProof): {
    proof: MMRProof;
    blockTime: bigint;
};
export declare function createEmptyMMRProof(): MMRProof;
export declare function createSignedByDescriptor(address: string, wotsRootPublicKey: string): ScriptDescriptor;
export declare function createMultisigDescriptor(address: string, publicKey1: string, publicKey2: string, ownPublicKey: string): ScriptDescriptor;
export declare function createMofNMultisigDescriptor(address: string, threshold: number, publicKeys: string[], ownPublicKey: string): ScriptDescriptor;
export declare function createTimelockDescriptor(address: string, publicKey: string, unlockBlock: bigint): ScriptDescriptor;
export declare function createHTLCDescriptor(address: string, ownerPublicKey: string, recipientPublicKey: string, hashLock: string, timeoutBlock: bigint, isOwner: boolean, preimage?: string): ScriptDescriptor;
export declare function createMASTDescriptor(address: string, rootHash: string, branchScript: string, branchProof: string, wotsPublicKey?: string): ScriptDescriptor;
export declare function createExchangeDescriptor(address: string, ownerPublicKey: string, desiredAddress: string, desiredAmount: string, desiredTokenId: string): ScriptDescriptor;
export declare function createFlashCashDescriptor(address: string, ownerPublicKey: string, interestMultiplier?: string): ScriptDescriptor;
export declare function createSlowCashDescriptor(address: string, ownerPublicKey: string, withdrawalPercent?: string, cooldownBlocks?: bigint): ScriptDescriptor;
