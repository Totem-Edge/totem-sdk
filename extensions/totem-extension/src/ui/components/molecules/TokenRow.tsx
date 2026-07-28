import React from 'react';
import { Typography } from '../atoms';
import { formatAmount } from '../../../constants';
import '../../theme/axia-tokens.css';

export interface TokenRowProps {
  tokenId: string;
  tokenName: string;
  ticker?: string;
  balance: string;
  sendable?: string;
  unconfirmed?: string;
  coins?: number;
  decimals?: number;
  type?: string;
  icon?: string;
  webvalidate?: string;
  description?: string;
  onClick?: () => void;
}

export function TokenRow({ 
  tokenId, 
  tokenName,
  ticker,
  balance, 
  sendable,
  unconfirmed,
  coins,
  decimals = 44,
  type,
  icon,
  webvalidate,
  description,
  onClick 
}: TokenRowProps) {
  const formatted = formatAmount(balance, 4);
  const isClickable = !!onClick;
  const isNFT = type === 'NFT';
  const isVerified = !!webvalidate;
  const isMinima = tokenId === '0x00';
  const displayName = ticker || tokenName;
  const hasUnconfirmed = unconfirmed && unconfirmed !== '0';

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-1-5)',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background var(--transition-fast)',
        background: 'transparent',
        gap: 'var(--space-1)',
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
      {/* Token Icon / Placeholder */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${isMinima ? 'var(--minima-green)' : 'var(--border-subtle)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: isMinima ? 'rgba(0, 255, 136, 0.08)' : 'var(--bg-subtle)',
        fontSize: '14px',
        fontWeight: 700,
        color: isMinima ? 'var(--minima-green)' : 'var(--text-muted)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {isMinima ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Minima cube/block icon */}
            <path d="M12 2L22 6.5V17.5L12 22L2 17.5V6.5L12 2" />
            <path d="M12 12L22 7.5" />
            <path d="M12 12L12 22" />
            <path d="M12 12L2 7.5" />
          </svg>
        ) : isNFT ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d="M15 3v18" />
          </svg>
        ) : displayName.charAt(0).toUpperCase()}
        {icon && (
          <img 
            src={icon} 
            alt={displayName} 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>

      {/* Token Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Typography variant="body" color="primary" bold style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayName}
          </Typography>
          {isNFT && (
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: '2px',
              border: '1px solid var(--text-muted)',
              color: 'var(--text-muted)',
              letterSpacing: '0.5px',
              lineHeight: '12px',
            }}>
              NFT
            </span>
          )}
          {isVerified && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--minima-green)" stroke="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          )}
        </div>
        {!isMinima && (
          <Typography 
            variant="caption" 
            color="muted" 
            mono
            style={{ 
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              marginTop: '1px',
              fontSize: '9px',
            }}
          >
            {tokenId.substring(0, 16)}...{tokenId.substring(tokenId.length - 8)}
          </Typography>
        )}
      </div>

      {/* Balance + Metadata */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography 
          variant="body" 
          color="primary" 
          mono
          bold
        >
          {formatted}
        </Typography>
        {(hasUnconfirmed || (coins && coins > 1)) && (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '1px' }}>
            {hasUnconfirmed && (
              <Typography variant="caption" color="warning" mono style={{ fontSize: '9px' }}>
                +{formatAmount(unconfirmed!, 2)} pending
              </Typography>
            )}
            {coins && coins > 1 && (
              <Typography variant="caption" color="muted" mono style={{ fontSize: '9px' }}>
                {coins} coins
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
