/**
 * Recipients List Component
 * Shows all transaction recipients with amounts
 */

import React from 'react';
import { Typography, Card } from '../../atoms';
import { formatAmount } from '../../../../constants';
import type { TokenAmount } from './types';

interface Recipient {
  address: string;
  amount: TokenAmount;
  isContract: boolean;
}

interface RecipientsListProps {
  recipients: Recipient[];
  sourceAddress?: string;
  sourceMode: 'global' | 'focused';
  change?: TokenAmount;
  changeAddress?: string;
}

export function RecipientsList({
  recipients,
  sourceAddress,
  sourceMode,
  change,
  changeAddress
}: RecipientsListProps) {
  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-4)}`;
  };

  return (
    <Card padding="md" style={{ background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          paddingBottom: 'var(--space-1)',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <Typography variant="caption" color="muted" uppercase>
            From
          </Typography>
          <Typography variant="body" mono style={{ fontSize: 'var(--text-sm)' }}>
            {sourceMode === 'global' 
              ? 'Auto-select (Global)' 
              : sourceAddress 
                ? truncateAddress(sourceAddress)
                : 'Selected Address'
            }
          </Typography>
        </div>

        <Typography variant="caption" color="muted" uppercase>
          To
        </Typography>

        {recipients.map((recipient, index) => (
          <div 
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-1) 0',
              borderBottom: index < recipients.length - 1 ? '1px solid var(--border-subtle)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              {recipient.isContract && (
                <span style={{ 
                  fontSize: 'var(--text-xs)',
                  padding: '2px 6px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-warning)'
                }}>
                  Contract
                </span>
              )}
              <Typography 
                variant="body" 
                mono 
                style={{ 
                  fontSize: 'var(--text-sm)',
                  maxWidth: '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {truncateAddress(recipient.address)}
              </Typography>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Typography variant="body" mono bold>
                {formatAmount(recipient.amount.displayAmount, 4)}
              </Typography>
              <Typography variant="caption" color="muted">
                {recipient.amount.symbol}
              </Typography>
            </div>
          </div>
        ))}

        {change && (
          <>
            <div style={{ 
              marginTop: 'var(--space-1)',
              paddingTop: 'var(--space-1)',
              borderTop: '1px solid var(--border-subtle)'
            }}>
              <Typography variant="caption" color="muted" uppercase>
                Change (returned to you)
              </Typography>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-1) 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <span style={{ 
                  fontSize: 'var(--text-xs)',
                  padding: '2px 6px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-success)'
                }}>
                  Your Wallet
                </span>
                {changeAddress && (
                  <Typography 
                    variant="body" 
                    mono 
                    style={{ 
                      fontSize: 'var(--text-sm)',
                      maxWidth: '140px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {truncateAddress(changeAddress)}
                  </Typography>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <Typography variant="body" mono bold color="success">
                  +{formatAmount(change.displayAmount, 4)}
                </Typography>
                <Typography variant="caption" color="muted">
                  {change.symbol}
                </Typography>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
