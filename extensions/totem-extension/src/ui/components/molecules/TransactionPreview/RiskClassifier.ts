/**
 * Risk Classifier
 * Analyzes transactions for potential risks and generates warnings
 */

import type { ScriptDescriptor } from '../../../../core/transaction/types/ScriptTypes';
import type { RiskFlag, RiskSeverity, TransactionPreviewViewModel } from './types';

export interface RiskAnalysis {
  overallSeverity: RiskSeverity;
  risks: RiskFlag[];
  requiresExtraConfirmation: boolean;
  warningMessage?: string;
}

export function analyzeTransactionRisks(viewModel: TransactionPreviewViewModel): RiskAnalysis {
  const allRisks: RiskFlag[] = [...viewModel.risks];
  
  for (const insight of viewModel.insights) {
    allRisks.push(...insight.risks);
  }
  
  const hasCritical = allRisks.some(r => r.severity === 'critical');
  const hasWarning = allRisks.some(r => r.severity === 'warning');
  
  const overallSeverity: RiskSeverity = hasCritical ? 'critical' : hasWarning ? 'warning' : 'info';
  
  const requiresExtraConfirmation = hasCritical || 
    viewModel.type === 'complex' ||
    allRisks.length > 2;
  
  let warningMessage: string | undefined;
  if (hasCritical) {
    const criticalRisk = allRisks.find(r => r.severity === 'critical');
    warningMessage = criticalRisk?.description;
  } else if (!viewModel.isBalanced) {
    warningMessage = 'Transaction inputs and outputs do not balance. Please review carefully.';
  }
  
  return {
    overallSeverity,
    risks: allRisks,
    requiresExtraConfirmation,
    warningMessage
  };
}

export function getRiskBadgeStyle(severity: RiskSeverity): React.CSSProperties {
  switch (severity) {
    case 'critical':
      return {
        background: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'var(--color-danger)',
        color: 'var(--color-danger)'
      };
    case 'warning':
      return {
        background: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'var(--color-warning)',
        color: 'var(--color-warning)'
      };
    case 'info':
    default:
      return {
        background: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'var(--axia-aqua)',
        color: 'var(--axia-aqua)'
      };
  }
}

export function getRiskIcon(severity: RiskSeverity): string {
  switch (severity) {
    case 'critical':
      return '⛔';
    case 'warning':
      return '⚠️';
    case 'info':
    default:
      return 'ℹ️';
  }
}

export function shouldBlockTransaction(viewModel: TransactionPreviewViewModel): boolean {
  if (!viewModel.isBalanced) {
    return true;
  }
  
  const scriptTypes = viewModel.scriptDescriptors?.map(d => d.scriptType) || [];
  if (scriptTypes.includes('flashcash')) {
    const hasReturnOutput = viewModel.outputs.some(o => 
      o.stateVariables && o.stateVariables.length > 0
    );
    if (!hasReturnOutput) {
      return true;
    }
  }
  
  if (viewModel.signatureStatus) {
    if (viewModel.signatureStatus.collected < viewModel.signatureStatus.required) {
      return true;
    }
  }
  
  return false;
}

export function getBlockReason(viewModel: TransactionPreviewViewModel): string | null {
  if (!viewModel.isBalanced) {
    return 'Transaction is unbalanced. Inputs must equal outputs.';
  }
  
  if (viewModel.signatureStatus) {
    const { required, collected, missingKeys } = viewModel.signatureStatus;
    if (collected < required) {
      return `Missing ${required - collected} signature(s). Waiting for: ${missingKeys.slice(0, 2).map(k => k.slice(0, 8) + '...').join(', ')}`;
    }
  }
  
  return null;
}
