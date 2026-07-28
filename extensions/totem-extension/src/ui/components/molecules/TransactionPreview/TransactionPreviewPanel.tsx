/**
 * Transaction Preview Panel
 * Main component that assembles all preview sub-components
 */

import React from 'react';
import { Typography, Button, Card } from '../../atoms';
import { SummaryHeader } from './SummaryHeader';
import { RecipientsList } from './RecipientsList';
import { ContractInsights } from './ContractInsights';
import { AdvancedDetails } from './AdvancedDetails';
import { analyzeTransactionRisks, shouldBlockTransaction, getBlockReason, getRiskBadgeStyle } from './RiskClassifier';
import { buildTransactionNarrative } from './NarrativeBuilder';
import { formatBaseUnitsToDecimal, parseDecimalToBaseUnits } from '../../../../core/transaction/MinimaTransactionBuilder';
import type { TransactionPreviewProps, TokenAmount } from './types';

export function TransactionPreviewPanel({
  viewModel,
  isLoading = false,
  error,
  onConfirm,
  onCancel,
  showAdvanced = true
}: TransactionPreviewProps) {
  const riskAnalysis = analyzeTransactionRisks(viewModel);
  const isBlocked = shouldBlockTransaction(viewModel);
  const blockReason = getBlockReason(viewModel);
  
  const narrative = buildTransactionNarrative(
    viewModel.scriptDescriptors || [],
    viewModel.outputs.length,
    viewModel.change !== undefined
  );

  const recipientTotal: TokenAmount = (() => {
    if (viewModel.recipients.length > 0) {
      const symbol = viewModel.recipients[0].amount.symbol;
      const tokenId = viewModel.recipients[0].amount.tokenId;
      const sum = viewModel.recipients.reduce(
        (acc, r) => acc + parseDecimalToBaseUnits(r.amount.displayAmount),
        0n
      );
      return {
        tokenId,
        symbol,
        amount: sum.toString(),
        displayAmount: formatBaseUnitsToDecimal(sum)
      };
    }
    return viewModel.totalOut[0] || { tokenId: '0x00', symbol: 'MINIMA', amount: '0', displayAmount: '0' };
  })();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-2)',
        minHeight: '400px',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--axia-aqua)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <Typography variant="body" color="muted">
          Preparing transaction preview...
        </Typography>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-2)'
      }}>
        <Card padding="lg" style={{ 
          background: 'rgba(239, 68, 68, 0.05)',
          borderColor: 'var(--color-danger)',
          textAlign: 'center'
        }}>
          <Typography variant="h3" color="danger" style={{ marginBottom: 'var(--space-1)' }}>
            ⚠️ Error
          </Typography>
          <Typography variant="body" color="muted">
            {error}
          </Typography>
        </Card>
        <Button variant="secondary" size="lg" onClick={onCancel} fullWidth>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      padding: 'var(--space-2)',
      paddingBottom: 'var(--space-4)'
    }}>
      <Typography variant="h2" color="primary" style={{ textAlign: 'center' }}>
        Review Transaction
      </Typography>

      <SummaryHeader
        typeLabel={viewModel.typeLabel}
        badgeColor={viewModel.typeBadgeColor}
        totalAmount={recipientTotal}
        recipientCount={viewModel.recipients.length}
        burn={viewModel.burn}
      />

      <RecipientsList
        recipients={viewModel.recipients}
        sourceAddress={viewModel.inputs[0]?.address}
        sourceMode={viewModel.sourceMode || 'global'}
        change={viewModel.change}
        changeAddress={viewModel.outputs.find(o => o.isChange)?.address}
      />

      <ContractInsights
        insights={viewModel.insights}
        risks={riskAnalysis.risks}
        narrative={narrative}
      />

      {viewModel.signatureStatus && viewModel.signatureStatus.required > 1 && (
        <Card padding="md" style={{ 
          background: viewModel.signatureStatus.collected >= viewModel.signatureStatus.required 
            ? 'rgba(34, 197, 94, 0.05)' 
            : 'rgba(245, 158, 11, 0.05)',
          borderColor: viewModel.signatureStatus.collected >= viewModel.signatureStatus.required
            ? 'var(--color-success)'
            : 'var(--color-warning)'
        }}>
          <Typography variant="caption" uppercase bold style={{ marginBottom: 'var(--space-0-5)' }}>
            Signature Status
          </Typography>
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <div style={{
              flex: 1,
              height: '8px',
              background: 'var(--bg-elevated)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(viewModel.signatureStatus.collected / viewModel.signatureStatus.required) * 100}%`,
                height: '100%',
                background: viewModel.signatureStatus.collected >= viewModel.signatureStatus.required
                  ? 'var(--color-success)'
                  : 'var(--color-warning)',
                transition: 'width 0.3s'
              }} />
            </div>
            <Typography variant="caption" mono>
              {viewModel.signatureStatus.collected}/{viewModel.signatureStatus.required}
            </Typography>
          </div>
          {viewModel.signatureStatus.missingKeys.length > 0 && (
            <Typography variant="caption" color="muted" style={{ marginTop: 'var(--space-0-5)' }}>
              Waiting for: {viewModel.signatureStatus.missingKeys.slice(0, 2).map(k => k.slice(0, 8) + '...').join(', ')}
            </Typography>
          )}
        </Card>
      )}

      {showAdvanced && (
        <AdvancedDetails
          inputs={viewModel.inputs}
          outputs={viewModel.outputs}
          rawTransaction={viewModel.rawTransaction}
          rawScripts={viewModel.rawScripts}
        />
      )}

      {riskAnalysis.warningMessage && (
        <Card padding="sm" style={{
          ...getRiskBadgeStyle(riskAnalysis.overallSeverity),
          marginTop: 'var(--space-1)'
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-start' }}>
            <Typography variant="body" style={{ fontSize: 'var(--text-lg)' }}>
              {riskAnalysis.overallSeverity === 'critical' ? '⛔' : '⚠️'}
            </Typography>
            <Typography variant="caption">
              {riskAnalysis.warningMessage}
            </Typography>
          </div>
        </Card>
      )}

      {isBlocked && blockReason && (
        <Card padding="md" style={{ 
          background: 'rgba(239, 68, 68, 0.05)',
          borderColor: 'var(--color-danger)'
        }}>
          <Typography variant="caption" color="danger" bold>
            {blockReason}
          </Typography>
        </Card>
      )}

      <Card padding="sm" style={{ 
        background: 'rgba(245, 158, 11, 0.05)', 
        borderColor: 'var(--color-warning)',
        marginTop: 'var(--space-1)'
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-start' }}>
          <Typography variant="body" color="warning" style={{ fontSize: 'var(--text-lg)' }}>
            !
          </Typography>
          <Typography variant="caption" color="muted">
            Please verify all details. Blockchain transactions are irreversible once confirmed.
          </Typography>
        </div>
      </Card>

      <div style={{ 
        display: 'flex', 
        gap: 'var(--space-1)', 
        marginTop: 'var(--space-2)',
        position: 'sticky',
        bottom: 0,
        background: 'var(--bg-base)',
        padding: 'var(--space-1) 0'
      }}>
        <Button
          variant="secondary"
          size="lg"
          onClick={onCancel}
          disabled={isLoading}
          style={{ flex: 1 }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onConfirm}
          disabled={isLoading || isBlocked}
          style={{ flex: 2 }}
        >
          {isLoading ? '⟳ Processing...' : 'Confirm & Send'}
        </Button>
      </div>
    </div>
  );
}
