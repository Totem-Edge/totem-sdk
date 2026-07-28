/**
 * Transaction Review Component
 * MetaMask-style pre-send confirmation screen
 */

import React from 'react';
import { Card, Typography, Button } from '../atoms';
import { formatAmount } from '../../../constants';
import '../../theme/axia-tokens.css';

export interface TransactionReviewProps {
  recipient: string;
  amount: string;
  tokenSymbol: string;
  tokenId: string;
  sourceAddress?: string;
  sourceMode: 'global' | 'focused';
  burn?: string; // Optional voluntary burn amount (base units)
  balance: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TransactionReview({
  recipient,
  amount,
  tokenSymbol,
  tokenId,
  sourceAddress,
  sourceMode,
  burn,
  balance,
  onConfirm,
  onCancel,
  isLoading = false
}: TransactionReviewProps) {
  const amountNum = parseFloat(amount || '0') || 0;
  const burnNum = parseFloat(burn || '0') || 0;
  const totalDisplay = (amountNum + burnNum).toString();
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 'var(--space-2)',
      padding: 'var(--space-2)'
    }}>
      <Typography variant="h2" color="primary" style={{ textAlign: 'center', marginBottom: 'var(--space-1)' }}>
        Review Transaction
      </Typography>
      
      <Card padding="lg" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
            <Typography variant="caption" color="muted" uppercase>
              You are sending
            </Typography>
            <Typography variant="h1" color="primary" mono style={{ fontSize: '2rem', margin: 'var(--space-1) 0' }}>
              {formatAmount(amount, 8)}
            </Typography>
            <Typography variant="body" color="accent" bold>
              {tokenSymbol}
            </Typography>
          </div>
          
          <div style={{ 
            borderTop: '1px solid var(--border-subtle)', 
            borderBottom: '1px solid var(--border-subtle)',
            padding: 'var(--space-2) 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="muted" uppercase>
                To
              </Typography>
              <Typography variant="body" mono style={{ 
                maxWidth: '200px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {recipient}
              </Typography>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="muted" uppercase>
                From
              </Typography>
              <Typography variant="body" mono>
                {sourceMode === 'global' 
                  ? 'Global (Auto-select)' 
                  : sourceAddress 
                    ? `${sourceAddress.slice(0, 8)}...${sourceAddress.slice(-6)}`
                    : 'Selected Address'
                }
              </Typography>
            </div>
            
            {tokenId !== '0x00' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="muted" uppercase>
                  Token ID
                </Typography>
                <Typography variant="body" mono style={{ fontSize: '0.75rem' }}>
                  {tokenId.slice(0, 10)}...
                </Typography>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="muted" uppercase>
                Amount
              </Typography>
              <Typography variant="body" mono>
                {formatAmount(amount, 8)} {tokenSymbol}
              </Typography>
            </div>
            
            {burnNum > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="muted" uppercase>
                  Burn (Priority)
                </Typography>
                <Typography variant="body" mono color="accent">
                  {formatAmount(burn || '0', 8)} MINIMA
                </Typography>
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 'var(--space-1)',
              marginTop: 'var(--space-1)'
            }}>
              <Typography variant="body" uppercase bold>
                Total
              </Typography>
              <Typography variant="h3" color="primary" mono>
                {formatAmount(totalDisplay, 8)} {tokenSymbol === 'MINIMA' ? 'MINIMA' : tokenSymbol}
              </Typography>
            </div>
          </div>
        </div>
      </Card>
      
      <Card padding="sm" style={{ background: 'rgba(245, 158, 11, 0.05)', borderColor: 'var(--color-warning)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-start' }}>
          <Typography variant="body" color="warning" style={{ fontSize: 'var(--text-lg)' }}>
            !
          </Typography>
          <Typography variant="caption" color="muted">
            Please verify all details. Blockchain transactions are irreversible once confirmed.
          </Typography>
        </div>
      </Card>
      
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
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
          disabled={isLoading}
          style={{ flex: 2 }}
        >
          {isLoading ? '⟳ Processing...' : 'Confirm & Send'}
        </Button>
      </div>
    </div>
  );
}
