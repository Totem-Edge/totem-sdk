/**
 * Transaction Receipt Component
 * MetaMask-style post-send confirmation screen
 */

import React from 'react';
import { Card, Typography, Button } from '../atoms';
import { formatMinimaAmount } from '../../../constants';
import '../../theme/axia-tokens.css';

export type ReceiptStatus = 'submitted' | 'pending' | 'confirmed' | 'unconfirmed' | 'failed';

export interface TransactionReceiptProps {
  txpowid: string;
  status: ReceiptStatus;
  recipient: string;
  amount: string;
  tokenSymbol: string;
  burn?: string; // Optional voluntary burn amount (base units)
  blockHeight?: number;
  explorerUrl?: string;
  errorMessage?: string;
  /** How the TxPoW was mined. 'meg' = MEG node (server-side); 'local' = browser-mined. */
  miningSource?: 'local' | 'meg';
  onClose: () => void;
  onViewActivity?: () => void;
}

const EXPLORER_BASE_URL = 'https://explorer.minima.global';

export function TransactionReceipt({
  txpowid,
  status,
  recipient,
  amount,
  tokenSymbol,
  burn,
  blockHeight,
  explorerUrl,
  errorMessage,
  miningSource,
  onClose,
  onViewActivity
}: TransactionReceiptProps) {
  const finalExplorerUrl = explorerUrl || `${EXPLORER_BASE_URL}/transactions/${txpowid}`;
  
  const getStatusConfig = () => {
    switch (status) {
      case 'submitted':
        return {
          icon: '⟳',
          title: 'Transaction Submitted',
          subtitle: 'Your transaction has been broadcast to the network',
          color: 'var(--axia-aqua)',
          bgColor: 'rgba(0, 217, 181, 0.1)'
        };
      case 'pending':
        return {
          icon: '⏱',
          title: 'Awaiting Confirmation',
          subtitle: 'Transaction is being processed by the network',
          color: 'var(--color-warning)',
          bgColor: 'rgba(245, 158, 11, 0.1)'
        };
      case 'confirmed':
        return {
          icon: '✓',
          title: 'Transaction Confirmed',
          subtitle: blockHeight ? `Confirmed in block ${blockHeight}` : 'Successfully confirmed on chain',
          color: 'var(--color-success)',
          bgColor: 'rgba(34, 197, 94, 0.1)'
        };
      case 'unconfirmed':
        return {
          icon: '?',
          title: 'Confirmation Pending',
          subtitle: 'Transaction was broadcast but not yet confirmed. Check back later or view on explorer.',
          color: 'var(--color-warning)',
          bgColor: 'rgba(245, 158, 11, 0.15)'
        };
      case 'failed':
        return {
          icon: '✗',
          title: 'Transaction Failed',
          subtitle: errorMessage || 'An error occurred',
          color: 'var(--color-danger)',
          bgColor: 'rgba(239, 68, 68, 0.1)'
        };
    }
  };
  
  const config = getStatusConfig();
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 'var(--space-2)',
      padding: 'var(--space-2)'
    }}>
      <div style={{ 
        textAlign: 'center', 
        padding: 'var(--space-3)',
        background: config.bgColor,
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${config.color}`
      }}>
        <div style={{ 
          fontSize: '3rem', 
          marginBottom: 'var(--space-1)',
          color: config.color
        }}>
          {config.icon}
        </div>
        <Typography variant="h2" style={{ color: config.color, marginBottom: 'var(--space-1)' }}>
          {config.title}
        </Typography>
        <Typography variant="body" color="muted">
          {config.subtitle}
        </Typography>
      </div>
      
      <Card padding="lg" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="muted" uppercase>
              Amount Sent
            </Typography>
            <Typography variant="h3" color="primary" mono>
              {formatMinimaAmount(amount, 8)} {tokenSymbol}
            </Typography>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography variant="caption" color="muted" uppercase>
              To
            </Typography>
            <Typography variant="body" mono style={{ 
              textAlign: 'right',
              wordBreak: 'break-all',
              maxWidth: '200px',
              fontSize: '0.8rem'
            }}>
              {recipient}
            </Typography>
          </div>
          
          {burn && BigInt(burn) > 0n && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="muted" uppercase>
                Burn (Priority)
              </Typography>
              <Typography variant="body" mono color="accent">
                {formatMinimaAmount(burn, 8)} MINIMA
              </Typography>
            </div>
          )}

          {miningSource && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="muted" uppercase>
                Mined By
              </Typography>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                background: miningSource === 'local'
                  ? 'rgba(0, 217, 181, 0.15)'
                  : 'rgba(148, 163, 184, 0.15)',
                color: miningSource === 'local'
                  ? 'var(--axia-aqua)'
                  : 'var(--color-text-muted)',
                border: `1px solid ${miningSource === 'local' ? 'var(--axia-aqua)' : 'var(--border-subtle)'}`,
              }}>
                {miningSource === 'local' ? '⚡ Browser' : '☁ MEG Node'}
              </span>
            </div>
          )}
          
          <div style={{ 
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--space-2)',
            marginTop: 'var(--space-1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography variant="caption" color="muted" uppercase>
                Transaction ID
              </Typography>
              <div style={{ textAlign: 'right' }}>
                <Typography variant="body" mono style={{ fontSize: '0.7rem', wordBreak: 'break-all', maxWidth: '180px' }}>
                  {txpowid}
                </Typography>
                <button
                  onClick={() => navigator.clipboard.writeText(txpowid)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--axia-aqua)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    padding: 'var(--space-1) 0',
                    textDecoration: 'underline'
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
          
          {blockHeight && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="muted" uppercase>
                Block Height
              </Typography>
              <Typography variant="body" mono>
                #{blockHeight.toLocaleString()}
              </Typography>
            </div>
          )}
        </div>
      </Card>
      
      {status !== 'failed' && (
        <a
          href={finalExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-2)',
            background: 'rgba(0, 217, 181, 0.05)',
            border: '1px solid var(--axia-aqua)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--axia-aqua)',
            textDecoration: 'none',
            fontSize: '0.9rem'
          }}
        >
          <span>View on Explorer</span>
          <span style={{ fontSize: '0.8rem' }}>↗</span>
        </a>
      )}
      
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
        {onViewActivity && (
          <Button
            variant="secondary"
            size="lg"
            onClick={onViewActivity}
            style={{ flex: 1 }}
          >
            View Activity
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={onClose}
          style={{ flex: onViewActivity ? 1 : undefined }}
          fullWidth={!onViewActivity}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
