/**
 * Transaction Preview Module
 * Exports all components and utilities for transaction preview
 */

export { TransactionPreviewPanel } from './TransactionPreviewPanel';
export { SummaryHeader } from './SummaryHeader';
export { RecipientsList } from './RecipientsList';
export { ContractInsights } from './ContractInsights';
export { AdvancedDetails } from './AdvancedDetails';

export { buildTransactionPreviewViewModel } from './ViewModelBuilder';

export { 
  buildContractInsight,
  buildTransactionNarrative,
  classifyTransactionRisks,
  getScriptTypeLabel,
  getScriptTypeBadgeColor
} from './NarrativeBuilder';

export {
  analyzeTransactionRisks,
  getRiskBadgeStyle,
  getRiskIcon,
  shouldBlockTransaction,
  getBlockReason
} from './RiskClassifier';

export type {
  TransactionPreviewViewModel,
  TransactionPreviewProps,
  RiskFlag,
  RiskSeverity,
  ContractInsight,
  TokenAmount,
  TransactionInput,
  TransactionOutput
} from './types';
