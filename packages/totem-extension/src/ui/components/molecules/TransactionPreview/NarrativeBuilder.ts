/**
 * Narrative Builder
 * Generates human-readable explanations for Minima transactions
 */

import type { ScriptDescriptor } from '../../../../core/transaction/types/ScriptTypes';
import type { ContractInsight, RiskFlag, RiskSeverity } from './types';

const SCRIPT_TYPE_LABELS: Record<string, string> = {
  signedby: 'Simple Transfer',
  multisig: 'Multi-Signature',
  multisig_mofn: 'M-of-N Multi-Signature',
  timelock: 'Time-Locked',
  htlc: 'Hash Time-Locked Contract',
  mast: 'MAST Contract',
  exchange: 'Atomic Swap',
  vault: 'Vault Contract',
  flashcash: 'Flash Loan',
  slowcash: 'Rate-Limited Withdrawal',
  stateful: 'Stateful Contract',
  unknown: 'Custom Script'
};

const SCRIPT_TYPE_BADGES: Record<string, string> = {
  signedby: 'var(--color-success)',
  multisig: 'var(--color-warning)',
  multisig_mofn: 'var(--color-warning)',
  timelock: 'var(--axia-aqua)',
  htlc: 'var(--color-accent)',
  mast: 'var(--color-primary)',
  exchange: 'var(--color-info)',
  vault: 'var(--color-warning)',
  flashcash: 'var(--color-danger)',
  slowcash: 'var(--color-warning)',
  stateful: 'var(--color-primary)',
  unknown: 'var(--color-muted)'
};

export function getScriptTypeLabel(scriptType: string): string {
  return SCRIPT_TYPE_LABELS[scriptType] || SCRIPT_TYPE_LABELS.unknown;
}

export function getScriptTypeBadgeColor(scriptType: string): string {
  return SCRIPT_TYPE_BADGES[scriptType] || SCRIPT_TYPE_BADGES.unknown;
}

export function buildContractInsight(descriptor: ScriptDescriptor): ContractInsight {
  const risks: RiskFlag[] = [];
  const details: { label: string; value: string }[] = [];
  
  switch (descriptor.scriptType) {
    case 'signedby':
      return {
        type: 'signedby',
        title: 'Simple Transfer',
        description: 'A standard transfer requiring only your signature to spend.',
        details: [],
        risks: []
      };
      
    case 'multisig':
      const keyCount = descriptor.multisigKeys?.length || 2;
      risks.push({
        severity: 'info',
        title: 'Multiple Signatures Required',
        description: `All ${keyCount} parties must sign before funds can be spent.`,
        icon: '🔐'
      });
      return {
        type: 'multisig',
        title: `${keyCount}-of-${keyCount} Multi-Signature`,
        description: `Requires signatures from all ${keyCount} parties to authorize spending.`,
        details: [
          { label: 'Signers Required', value: `${keyCount} of ${keyCount}` }
        ],
        risks
      };
      
    case 'multisig_mofn':
      const threshold = descriptor.multisigThreshold || 2;
      const totalKeys = descriptor.multisigKeys?.length || 3;
      risks.push({
        severity: 'info',
        title: 'Threshold Signatures',
        description: `${threshold} of ${totalKeys} signatures needed to spend.`,
        icon: '🔐'
      });
      return {
        type: 'multisig_mofn',
        title: `${threshold}-of-${totalKeys} Multi-Signature`,
        description: `Requires ${threshold} signatures from ${totalKeys} authorized parties.`,
        details: [
          { label: 'Threshold', value: `${threshold} of ${totalKeys}` }
        ],
        risks
      };
      
    case 'timelock':
      const unlockBlock = descriptor.timelockBlock?.toString() || 'Unknown';
      risks.push({
        severity: 'warning',
        title: 'Funds Time-Locked',
        description: `Funds cannot be spent until block ${unlockBlock}.`,
        icon: '⏰'
      });
      return {
        type: 'timelock',
        title: 'Time-Locked Transfer',
        description: `Funds are locked until the specified block height is reached.`,
        details: [
          { label: 'Unlock Block', value: unlockBlock }
        ],
        risks
      };
      
    case 'htlc':
      const isRefund = descriptor.wotsRootPublicKey === descriptor.multisigKeys?.[0];
      if (isRefund) {
        risks.push({
          severity: 'info',
          title: 'HTLC Refund Path',
          description: 'Claiming funds via timeout refund mechanism.',
          icon: '↩️'
        });
        return {
          type: 'htlc',
          title: 'HTLC Refund',
          description: 'The timeout has passed. You can reclaim your funds.',
          details: [],
          risks
        };
      } else {
        risks.push({
          severity: 'info',
          title: 'Secret Required',
          description: 'You must provide the correct preimage to claim these funds.',
          icon: '🔑'
        });
        return {
          type: 'htlc',
          title: 'HTLC Claim',
          description: 'Reveal the secret preimage to claim the locked funds.',
          details: [
            { label: 'Hash Lock', value: descriptor.htlcHash?.slice(0, 16) + '...' || 'Unknown' }
          ],
          risks
        };
      }
      
    case 'mast':
      risks.push({
        severity: 'info',
        title: 'MAST Contract',
        description: 'Only the executed branch is revealed on-chain.',
        icon: '🌳'
      });
      return {
        type: 'mast',
        title: 'MAST Contract Execution',
        description: 'Executing one branch of a Merkelized Abstract Syntax Tree contract.',
        details: [],
        risks
      };
      
    case 'exchange':
      risks.push({
        severity: 'warning',
        title: 'Atomic Swap',
        description: 'Transaction must satisfy VERIFYOUT conditions or fail entirely.',
        icon: '🔄'
      });
      return {
        type: 'exchange',
        title: 'Atomic Exchange',
        description: 'An atomic swap that either completes fully or not at all.',
        details: [],
        risks
      };
      
    case 'vault':
      risks.push({
        severity: 'warning',
        title: 'Vault Covenant',
        description: 'Funds can only move to the designated safe house address.',
        icon: '🏛️'
      });
      return {
        type: 'vault',
        title: 'Vault Transaction',
        description: 'Moving funds through a vault with covenant restrictions.',
        details: [],
        risks
      };
      
    case 'flashcash':
      risks.push({
        severity: 'critical',
        title: 'Flash Loan',
        description: 'Funds must be returned with interest in the same block.',
        icon: '⚡'
      });
      return {
        type: 'flashcash',
        title: 'Flash Loan',
        description: 'Borrowed funds that must be returned with interest immediately.',
        details: [],
        risks
      };
      
    case 'slowcash':
      risks.push({
        severity: 'info',
        title: 'Rate Limited',
        description: 'Only a percentage of funds can be withdrawn at a time.',
        icon: '🐢'
      });
      return {
        type: 'slowcash',
        title: 'Rate-Limited Withdrawal',
        description: 'Funds are released gradually over time.',
        details: [],
        risks
      };
      
    case 'stateful':
      risks.push({
        severity: 'info',
        title: 'State Transition',
        description: 'This transaction advances the contract state.',
        icon: '🎮'
      });
      return {
        type: 'stateful',
        title: 'Stateful Contract',
        description: 'Executing a state transition in a multi-round contract.',
        details: [],
        risks
      };
      
    default:
      risks.push({
        severity: 'warning',
        title: 'Custom Script',
        description: 'Review the script carefully before signing.',
        icon: '⚠️'
      });
      return {
        type: 'unknown',
        title: 'Custom Contract',
        description: 'A custom script with non-standard logic.',
        details: [
          { label: 'Script', value: descriptor.script.slice(0, 50) + '...' }
        ],
        risks
      };
  }
}

export function buildTransactionNarrative(
  scriptDescriptors: ScriptDescriptor[],
  outputCount: number,
  hasChange: boolean
): string {
  if (scriptDescriptors.length === 0) {
    return 'Simple transfer transaction.';
  }
  
  const primaryType = scriptDescriptors[0].scriptType;
  const typeLabel = getScriptTypeLabel(primaryType);
  
  const recipientCount = hasChange ? outputCount - 1 : outputCount;
  const recipientText = recipientCount === 1 ? '1 recipient' : `${recipientCount} recipients`;
  
  switch (primaryType) {
    case 'signedby':
      return `Sending funds to ${recipientText}.`;
    case 'multisig':
    case 'multisig_mofn':
      return `${typeLabel} transaction sending to ${recipientText}. Multiple signatures required.`;
    case 'timelock':
      return `Creating time-locked output to ${recipientText}.`;
    case 'htlc':
      return `Hash Time-Locked Contract transaction to ${recipientText}.`;
    case 'mast':
      return `Executing MAST contract branch to ${recipientText}.`;
    case 'exchange':
      return `Atomic exchange with ${recipientText}.`;
    case 'vault':
      return `Vault covenant transaction to ${recipientText}.`;
    case 'flashcash':
      return `Flash loan transaction - funds must be returned immediately.`;
    case 'slowcash':
      return `Rate-limited withdrawal to ${recipientText}.`;
    case 'stateful':
      return `Stateful contract state transition.`;
    default:
      return `Custom contract transaction to ${recipientText}.`;
  }
}

export function classifyTransactionRisks(
  viewModel: {
    scriptDescriptors?: ScriptDescriptor[];
    isBalanced: boolean;
    hasStateVariables: boolean;
    hasExternalSignatures: boolean;
    totalOut: { amount: string }[];
  }
): RiskFlag[] {
  const risks: RiskFlag[] = [];
  
  if (!viewModel.isBalanced) {
    risks.push({
      severity: 'critical',
      title: 'Unbalanced Transaction',
      description: 'Transaction inputs do not equal outputs. This may result in lost funds.',
      icon: '⚠️'
    });
  }
  
  const totalAmount = viewModel.totalOut.reduce((sum, t) => sum + BigInt(t.amount || '0'), 0n);
  const threshold = 1000n * (10n ** 44n);
  if (totalAmount > threshold) {
    risks.push({
      severity: 'warning',
      title: 'Large Transaction',
      description: 'This is a high-value transaction. Please verify all details carefully.',
      icon: '💰'
    });
  }
  
  if (viewModel.hasExternalSignatures) {
    risks.push({
      severity: 'info',
      title: 'External Signatures',
      description: 'This transaction includes signatures from other parties.',
      icon: '✍️'
    });
  }
  
  if (viewModel.hasStateVariables) {
    risks.push({
      severity: 'info',
      title: 'State Variables',
      description: 'This transaction includes contract state data.',
      icon: '📊'
    });
  }
  
  return risks;
}
