/**
 * Summary Header Component
 * Shows transaction type, amount, and status at a glance
 */

import React from 'react';
import { Typography } from '../../atoms';
import { formatAmount } from '../../../../constants';
import { formatBaseUnitsToDecimal } from '../../../../core/transaction/MinimaTransactionBuilder';
import type { TokenAmount } from './types';

interface SummaryHeaderProps {
  typeLabel: string;
  badgeColor: string;
  totalAmount: TokenAmount;
  recipientCount: number;
  burn?: TokenAmount;
}

export function SummaryHeader({
  typeLabel,
  badgeColor,
  totalAmount,
  recipientCount,
  burn
}: SummaryHeaderProps) {
  const totalWithBurn = burn 
    ? formatBaseUnitsToDecimal(BigInt(totalAmount.amount) + BigInt(burn.amount))
    : totalAmount.displayAmount;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-2)',
      padding: 'var(--space-3) var(--space-2)',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-subtle)'
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-0-5) var(--space-1-5)',
        background: badgeColor.replace(')', ', 0.15)').replace('var(', 'rgba('),
        border: `1px solid ${badgeColor}`,
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: badgeColor
      }}>
        {typeLabel}
      </div>

      <div style={{ textAlign: 'center' }}>
        <Typography variant="caption" color="muted" uppercase>
          You are sending
        </Typography>
        <div style={{ 
          fontSize: '2rem', 
          fontWeight: 700, 
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          margin: 'var(--space-1) 0'
        }}>
          {formatAmount(totalWithBurn, 8)}
        </div>
        <Typography variant="body" color="accent" bold>
          {totalAmount.symbol}
        </Typography>
      </div>

      {burn && BigInt(burn.amount) > 0n && (
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)'
        }}>
          <span>Amount: {formatAmount(totalAmount.displayAmount, 4)}</span>
          <span>+</span>
          <span style={{ color: 'var(--axia-aqua)' }}>
            Burn: {formatAmount(burn.displayAmount, 4)}
          </span>
        </div>
      )}

      <Typography variant="caption" color="muted">
        to {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
      </Typography>
    </div>
  );
}
