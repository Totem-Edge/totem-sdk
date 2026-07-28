import type { MMRData, MMRProofChunk, MMRProof } from '../mmr.js';
export type { MMRProof };

function kissHex(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return '0x' + raw.toUpperCase();
}

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

export type ScriptType =
  | 'signedby'
  | 'multisig'
  | 'multisig_mofn'
  | 'timelock'
  | 'htlc'
  | 'mast'
  | 'exchange'
  | 'vault'
  | 'flashcash'
  | 'slowcash'
  | 'stateful'
  | 'custom';

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

export function convertFlatChunkToSDK(chunk: FlatMMRProofChunk): MMRProofChunk {
  return {
    isLeft: chunk.isLeft,
    mmrData: { data: chunk.data, value: 0n }
  };
}

export function convertLegacyProofToSDK(legacy: LegacyMMRProof): { proof: MMRProof; blockTime: bigint } {
  return {
    proof: {
      chunks: legacy.proofChain.map(convertFlatChunkToSDK)
    },
    blockTime: legacy.blockTime
  };
}

export function createEmptyMMRProof(): MMRProof {
  return { chunks: [] };
}

export function createSignedByDescriptor(address: string, wotsRootPublicKey: string): ScriptDescriptor {
  return {
    address,
    scriptType: 'signedby',
    script: `RETURN SIGNEDBY(${kissHex(wotsRootPublicKey)})`,
    wotsRootPublicKey,
    mastProof: createEmptyMMRProof(),
    storeState: false
  };
}

export function createMultisigDescriptor(address: string, publicKey1: string, publicKey2: string, ownPublicKey: string): ScriptDescriptor {
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

export function createMofNMultisigDescriptor(address: string, threshold: number, publicKeys: string[], ownPublicKey: string): ScriptDescriptor {
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

export function createTimelockDescriptor(address: string, publicKey: string, unlockBlock: bigint): ScriptDescriptor {
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

export function createHTLCDescriptor(address: string, ownerPublicKey: string, recipientPublicKey: string, hashLock: string, timeoutBlock: bigint, isOwner: boolean, preimage?: string): ScriptDescriptor {
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
    descriptor.stateVariables = [{ port: 1, value: preimage, type: 'string' }];
  }
  return descriptor;
}

export function createMASTDescriptor(address: string, rootHash: string, branchScript: string, branchProof: string, wotsPublicKey?: string): ScriptDescriptor {
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

export function createExchangeDescriptor(address: string, ownerPublicKey: string, desiredAddress: string, desiredAmount: string, desiredTokenId: string): ScriptDescriptor {
  const ownerPk = kissHex(ownerPublicKey);
  const script = `IF SIGNEDBY(PREVSTATE(0)) THEN RETURN TRUE ENDIF ASSERT VERIFYOUT(@INPUT PREVSTATE(1) PREVSTATE(2) PREVSTATE(3) TRUE) RETURN TRUE`;
  return {
    address,
    scriptType: 'exchange',
    script,
    wotsRootPublicKey: ownerPublicKey,
    stateVariables: [
      { port: 0, value: ownerPk, type: 'hex' },
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

export function createFlashCashDescriptor(address: string, ownerPublicKey: string, interestMultiplier: string = '1.01'): ScriptDescriptor {
  const script = `IF SIGNEDBY(PREVSTATE(1)) THEN RETURN TRUE ENDIF ASSERT SAMESTATE(1 1) RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT*${interestMultiplier} @TOKENID TRUE)`;
  return {
    address,
    scriptType: 'flashcash',
    script,
    wotsRootPublicKey: ownerPublicKey,
    stateVariables: [{ port: 1, value: ownerPublicKey, type: 'hex' }],
    mastProof: createEmptyMMRProof(),
    storeState: true
  };
}

export function createSlowCashDescriptor(address: string, ownerPublicKey: string, withdrawalPercent: string = '0.9', cooldownBlocks: bigint = 10000n): ScriptDescriptor {
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
