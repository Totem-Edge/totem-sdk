import type { ScriptDescriptor, StateValue } from '@totemsdk/core/scripts';

export interface EnhancedBuildParams {
  inputs: EnhancedCoinInput[];
  outputs: EnhancedCoinOutput[];
  transactionState?: StateValue[];
  linkHash?: Uint8Array;
}

export interface EnhancedCoinInput {
  coinId: string;
  address: string;
  amount: string;
  tokenId?: string;
  scriptDescriptor: ScriptDescriptor;
  coinProofHex?: string;
}

export interface EnhancedCoinOutput {
  address: string;
  amount: string;
  tokenId?: string;
  storeState?: boolean;
  state?: StateValue[];
}
