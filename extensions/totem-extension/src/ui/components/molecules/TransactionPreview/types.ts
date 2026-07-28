/**
 * Transaction Preview Types
 * Data models for the transaction preview panel
 */

import type { ScriptDescriptor } from '../../../../core/transaction/types/ScriptTypes';

export type RiskSeverity = 'info' | 'warning' | 'critical';

export interface RiskFlag {
  severity: RiskSeverity;
  title: string;
  description: string;
  icon: string;
}

export interface TokenAmount {
  tokenId: string;
  symbol: string;
  amount: string;
  displayAmount: string;
}

export interface TransactionInput {
  coinId: string;
  address: string;
  amount: string;
  tokenId: string;
  scriptType: string;
  scriptDescription?: string;
}

export interface TransactionOutput {
  address: string;
  amount: string;
  tokenId: string;
  isChange: boolean;
  stateVariables?: { port: number; value: string }[];
}

export interface ContractInsight {
  type: string;
  title: string;
  description: string;
  details?: { label: string; value: string }[];
  risks: RiskFlag[];
}

export interface TransactionPreviewViewModel {
  type: 'simple' | 'complex';
  typeLabel: string;
  typeBadgeColor: string;
  
  totalIn: TokenAmount[];
  totalOut: TokenAmount[];
  fee?: TokenAmount;
  burn?: TokenAmount;
  change?: TokenAmount;
  
  recipients: {
    address: string;
    amount: TokenAmount;
    isContract: boolean;
  }[];
  
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  
  insights: ContractInsight[];
  risks: RiskFlag[];
  
  rawTransaction?: string;
  rawScripts?: { address: string; script: string }[];
  
  scriptDescriptors?: ScriptDescriptor[];
  
  isBalanced: boolean;
  hasStateVariables: boolean;
  hasExternalSignatures: boolean;
  signatureStatus?: {
    required: number;
    collected: number;
    missingKeys: string[];
  };
  
  sourceMode?: 'global' | 'focused';
}

export interface TransactionPreviewProps {
  viewModel: TransactionPreviewViewModel;
  isLoading?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  showAdvanced?: boolean;
}
