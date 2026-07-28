import type { ScriptDescriptor, StateValue } from '@totemsdk/core/scripts';

export interface EnhancedBuildParams {
  inputs: EnhancedCoinInput[];
  outputs: EnhancedCoinOutput[];
  transactionState?: StateValue[];
  linkHash?: Uint8Array;
}

export interface TransactionWitnessDescriptor {
  signatures?: SignatureWitnessInput[];
  scriptProofs?: ScriptProofWitnessInput[];
  tokenProofs?: TokenProofWitnessInput[];
}

export interface SignatureWitnessInput {
  pubkeyHex: string;
  signature: Uint8Array;
}

export interface ScriptProofWitnessInput {
  script: string;
  scriptProof: string;
  expectedRoot: string;
}

export interface TokenProofWitnessInput {
  tokenId: string;
  proof: string;
}

export interface EnhancedCoinInput {
  coinId: string;
  address: string;
  amount: string;
  tokenId?: string;
  scriptDescriptor: ScriptDescriptor;
  coinProofHex?: string;
  witness?: TransactionWitnessDescriptor;
}

export interface EnhancedCoinOutput {
  address: string;
  amount: string;
  tokenId?: string;
  storeState?: boolean;
  state?: StateValue[];
}
