/**
 * AXIA BALANCE CARD
 * Displays wallet balance with MINIMA 44-decimal precision, USD value, and 24h % change
 */

import React from 'react';
import { Card } from '../atoms';
import { Typography } from '../atoms';
import { MinimaLogo } from '../../assets';
import { formatAmount } from '../../../constants';
import '../../theme/axia-tokens.css';

export type StreamingStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'fallback';

export interface BalanceCardProps {
  confirmed: string;      // Confirmed balance (display units, e.g. "16")
  unconfirmed?: string;   // Unconfirmed/pending balance (display units)
  sendable: string;       // Sendable balance (display units)
  label?: string;
  showCurrency?: boolean;
  usdValue?: number;      // Optional USD value
  priceChange24h?: number; // Optional 24h price change percentage
  streamingStatus?: StreamingStatus; // Real-time streaming status
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isBalancePending?: boolean; // True while waiting for first balance data after reconnect

  // Backward compatibility (deprecated)
  totalBalance?: string;
  availableBalance?: string;
}

export function BalanceCard({ 
  confirmed: confirmedProp,
  unconfirmed: unconfirmedProp = '0',
  sendable: sendableProp,
  label = 'Balance',
  showCurrency = true,
  usdValue,
  priceChange24h,
  streamingStatus,
  onRefresh,
  isRefreshing = false,
  isBalancePending = false,
  // Backward compatibility
  totalBalance,
  availableBalance
}: BalanceCardProps) {
  // Support old API for backward compatibility
  const confirmed = confirmedProp || totalBalance || '0';
  const unconfirmed = unconfirmedProp || '0';
  
  // Use centralized formatAmount which handles both display units and base units
  const confirmedFormatted = formatAmount(confirmed, 4);
  const unconfirmedFormatted = formatAmount(unconfirmed, 4);
  
  const hasUnconfirmed = parseFloat(unconfirmed) > 0;

  // Format USD value
  const formatUSD = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    } else if (value >= 1) {
      return `$${value.toFixed(2)}`;
    } else {
      return `$${value.toFixed(4)}`;
    }
  };

  // Determine price change color
  const getPriceChangeColor = (change: number): string => {
    if (change > 0) return 'var(--color-success)';
    if (change < 0) return 'var(--color-danger)';
    return 'var(--text-muted)';
  };
  
  // Streaming status indicator
  const getStreamingIndicator = (status: StreamingStatus | undefined) => {
    if (!status) return null;
    
    const statusConfig: Record<StreamingStatus, { color: string; label: string; pulse?: boolean }> = {
      connected: { color: 'var(--color-success)', label: 'LIVE', pulse: true },
      connecting: { color: 'var(--color-warning)', label: 'Connecting...', pulse: true },
      fallback: { color: 'var(--color-warning)', label: 'Polling', pulse: false },
      error: { color: 'var(--color-danger)', label: 'Offline', pulse: false },
      disconnected: { color: 'var(--text-muted)', label: '', pulse: false }
    };
    
    const config = statusConfig[status];
    if (!config.label) return null;
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        color: config.color,
        opacity: 0.9
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: config.color,
          animation: config.pulse ? 'pulse 2s ease-in-out infinite' : 'none'
        }} />
        {config.label}
      </div>
    );
  };

  return (
    <Card shadow padding="sm" style={{ borderColor: 'var(--axia-aqua)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          {label && (
            <Typography variant="caption" color="muted" uppercase>
              {label}
            </Typography>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-half)', minHeight: '40px' }}>
            {isBalancePending ? (
              <div style={{
                width: '22px',
                height: '22px',
                border: '2.5px solid var(--axia-aqua)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }} />
            ) : (
              <>
                <Typography 
                  variant="h1" 
                  style={{ 
                    fontFamily: 'var(--font-family-mono)',
                    color: 'var(--axia-aqua)'
                  }}
                >
                  {confirmedFormatted}
                </Typography>
                {showCurrency && (
                  <MinimaLogo size={18} style={{ opacity: 0.7, marginLeft: '4px' }} />
                )}
              </>
            )}
          </div>

          {!isBalancePending && usdValue !== undefined && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 'var(--space-1)',
              marginTop: '2px'
            }}>
              <Typography variant="body" color="secondary" style={{ fontFamily: 'var(--font-family-mono)' }}>
                {formatUSD(usdValue)}
              </Typography>
              
              {priceChange24h !== undefined && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  background: priceChange24h >= 0 
                    ? 'rgba(34, 197, 94, 0.1)' 
                    : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${priceChange24h >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}`,
                }}>
                  <Typography 
                    variant="caption" 
                    bold
                    style={{ 
                      color: getPriceChangeColor(priceChange24h),
                      fontSize: 'var(--text-xs)'
                    }}
                  >
                    {priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(priceChange24h).toFixed(2)}%
                  </Typography>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'flex-end', 
          gap: '8px',
          flexShrink: 0,
          paddingTop: '2px'
        }}>
          {getStreamingIndicator(streamingStatus)}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh balance"
              style={{
                width: '28px',
                height: '28px',
                padding: 0,
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                cursor: isRefreshing ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                transition: 'all var(--transition-base)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--minima-green)';
                e.currentTarget.style.color = 'var(--minima-green)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                }}
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {hasUnconfirmed && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-half)',
          marginTop: 'var(--space-1)',
          padding: 'var(--space-1)',
          background: 'rgba(253, 176, 34, 0.1)',
          border: '1px solid #FDB022',
          borderRadius: 'var(--radius-sm)',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <Typography 
            variant="caption" 
            bold
            uppercase
            style={{ color: '#FDB022' }}
          >
            ● Pending
          </Typography>
          <Typography 
            variant="body" 
            bold
            style={{ 
              fontFamily: 'var(--font-family-mono)',
              color: '#FDB022'
            }}
          >
            +{unconfirmedFormatted} <MinimaLogo size={14} style={{ marginLeft: '2px', verticalAlign: 'text-bottom' }} />
          </Typography>
        </div>
      )}

      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Card>
  );
}
