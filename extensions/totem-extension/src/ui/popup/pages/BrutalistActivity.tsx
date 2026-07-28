/**
 * AXIA TOTEM ACTIVITY PAGE - BRUTALIST REDESIGN
 * Transaction history fetched via TxpowIndexer SQL backend
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Button, StatusPill } from '../../components/atoms';
import '../../theme/axia-tokens.css';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface TxEvent {
  txpowid: string;
  event_type: 'receive' | 'send';
  amount: string;
  tokenid: string;
  token_name?: string;
  event_date: string;
  coinid: string;
  localAddress: string;
}

interface BrutalistActivityProps {
  activeAccountAddress?: string;
}

export function BrutalistActivity({ activeAccountAddress }: BrutalistActivityProps) {
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoadingState('loading');
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'activity:getTransactions',
        limit: 50,
      });
      if (response?.ok) {
        setEvents(response.events || []);
        setLoadingState('success');
      } else {
        throw new Error(response?.error || 'Failed to load transactions');
      }
    } catch (err: any) {
      console.error('[BrutalistActivity] Failed to load transactions:', err);
      setError(err.message || 'Failed to load transaction history');
      setLoadingState('error');
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, activeAccountAddress]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 3_600_000) {
      const mins = Math.floor(diff / 60_000);
      return mins <= 1 ? 'Just now' : `${mins}m ago`;
    }
    if (diff < 86_400_000) {
      return `${Math.floor(diff / 3_600_000)}h ago`;
    }
    if (diff < 604_800_000) {
      return `${Math.floor(diff / 86_400_000)}d ago`;
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    if (num < 0.01) return num.toFixed(8);
    if (num < 1) return num.toFixed(4);
    return num.toFixed(2);
  };

  const truncateTxId = (id: string): string => {
    if (id.length <= 14) return id;
    return id.slice(0, 8) + '…' + id.slice(-4);
  };

  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flex: 1,
        minHeight: 0,
        padding: 'var(--space-2)',
        paddingBottom: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}>
        <Typography variant="h2" color="accent">
          Activity
        </Typography>

        {loadingState === 'loading' && (
          <Card padding="md" shadow>
            <div style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
              <Typography variant="body" uppercase bold>
                Loading Transactions...
              </Typography>
            </div>
          </Card>
        )}

        {loadingState === 'error' && (
          <Card padding="md" shadow>
            <div style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
              <Typography variant="body" uppercase bold color="danger">
                Error Loading Transactions
              </Typography>
              <Typography variant="caption" style={{ marginTop: 'var(--space-1)' }}>
                {error}
              </Typography>
              <Button
                variant="primary"
                size="sm"
                onClick={loadTransactions}
                style={{ marginTop: 'var(--space-2)' }}
              >
                Retry
              </Button>
            </div>
          </Card>
        )}

        {loadingState === 'success' && events.length === 0 && (
          <Card>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-4)',
              gap: 'var(--space-2)',
            }}>
              <div style={{ fontSize: '48px', opacity: 0.3 }}>📊</div>
              <Typography variant="h3" uppercase>No Transactions Yet</Typography>
              <Typography variant="body" style={{ textAlign: 'center', opacity: 0.7, maxWidth: '280px' }}>
                Your transaction history will appear here once you start using your wallet
              </Typography>
            </div>
          </Card>
        )}

        {loadingState === 'success' && events.length > 0 && (
          <Card padding="none" shadow>
            <div style={{ padding: 'var(--space-1-5)', borderBottom: '2px solid var(--border-accent)' }}>
              <Typography variant="body" uppercase bold>Transaction History</Typography>
            </div>
            <div>
              {events.map((ev, index) => {
                const isSend = ev.event_type === 'send';
                const tokenLabel = ev.token_name || (ev.tokenid === '0x00' ? 'MINIMA' : ev.tokenid.slice(0, 8));
                return (
                  <div
                    key={`${ev.txpowid}-${ev.coinid}-${ev.event_type}`}
                    style={{
                      padding: 'var(--space-1-5)',
                      borderBottom: index < events.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <Typography variant="body" bold uppercase>
                          {isSend ? 'Sent' : 'Received'}
                        </Typography>
                        <StatusPill variant="success" size="sm">confirmed</StatusPill>
                      </div>
                      <Typography variant="body" bold>
                        {isSend ? '–' : '+'}{formatAmount(ev.amount)} {tokenLabel}
                      </Typography>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="muted">
                        {formatDate(ev.event_date)}
                      </Typography>
                      <Typography variant="caption" color="muted" mono>
                        {truncateTxId(ev.txpowid)}
                      </Typography>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
