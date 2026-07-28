/**
 * AXIA TRANSACTION ROW
 * Displays transaction in activity feed
 */

import React from 'react';
import { Typography, StatusPill } from '../atoms';
import { formatAmount } from '../../../constants';
import '../../theme/axia-tokens.css';

export type TxStatus = 'confirmed' | 'pending' | 'failed';
export type TxType = 'send' | 'receive' | 'contract';

export interface TxRowProps {
  txId: string;
  type: TxType;
  status: TxStatus;
  amount: string; // Base units
  timestamp: number;
  onClick?: () => void;
}

export function TxRow({ 
  txId, 
  type, 
  status, 
  amount, 
  timestamp, 
  onClick 
}: TxRowProps) {
  const formatted = formatAmount(amount, 4);
  const isClickable = !!onClick;
  
  // Format timestamp
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  // Determine status variant
  const statusVariant = status === 'confirmed' ? 'success' : 
                       status === 'pending' ? 'pending' : 'failed';

  // Determine icon
  const typeIcon = type === 'send' ? '↑' : type === 'receive' ? '↓' : '⚙';
  const typeColor = type === 'send' ? 'var(--color-danger)' : 
                    type === 'receive' ? 'var(--color-success)' : 
                    'var(--color-info)';

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1-5)',
        padding: 'var(--space-1-5)',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background var(--transition-fast)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.background = 'var(--bg-subtle)';
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {/* Type Icon */}
      <div style={{
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px solid ${typeColor}`,
        fontSize: 'var(--text-lg)',
      }}>
        {typeIcon}
      </div>

      {/* Transaction Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: '2px' }}>
          <Typography variant="body" color="primary" bold uppercase>
            {type}
          </Typography>
          <StatusPill variant={statusVariant}>
            {status}
          </StatusPill>
        </div>
        <Typography 
          variant="caption" 
          color="muted" 
          mono
          style={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block'
          }}
        >
          {txId}
        </Typography>
      </div>

      {/* Amount & Time */}
      <div style={{ textAlign: 'right' }}>
        <Typography 
          variant="body" 
          color={type === 'send' ? 'danger' : type === 'receive' ? 'success' : 'primary'}
          mono
          bold
        >
          {type === 'send' ? '-' : '+'}{formatted}
        </Typography>
        <Typography variant="caption" color="muted" style={{ marginTop: '2px' }}>
          {timeStr} • {dateStr}
        </Typography>
      </div>
    </div>
  );
}
