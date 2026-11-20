/**
 * AXIA TOTEM ACTIVITY PAGE
 *
 * Transaction history from the analytics archive index (via the API), grouped
 * by day, newest first. State-only (zero-amount) updates are hidden behind a
 * toggle so they do not drown out real transfers.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Typography, StatusPill } from '../../components/atoms';
import { usePortfolio } from '../../hooks/usePortfolio';
import {
  formatSignedAmount,
  isZeroAmount,
  shortAddress,
  tokenLabel,
  formatWhen,
  formatAmount,
  decodeMinimaAmount,
} from '../utils/format';
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
  height?: number;
}

interface TotemActivityProps {
  activeAccountAddress?: string;
  onSelectTx?: (txpowid: string) => void;
}

export function TotemActivity({ activeAccountAddress, onSelectTx }: TotemActivityProps) {
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showStateUpdates, setShowStateUpdates] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Cache key is address-scoped: switching accounts must not show another
  // account's history.
  const cacheKey = `activityCache:${activeAccountAddress ?? 'all'}`;

  const { entries } = usePortfolio();

  // tokenid -> display name + scale, resolved from the portfolio the wallet
  // already holds (the history endpoint only returns ids and raw amounts).
  const tokens = useMemo(() => {
    const map: Record<string, { name?: string; ticker?: string; decimals?: number }> = {};
    for (const entry of entries as Array<{ tokenid?: string; name?: string; ticker?: string; decimals?: number }>) {
      if (entry?.tokenid) {
        map[entry.tokenid.toLowerCase()] = {
          name: entry.name,
          ticker: entry.ticker,
          decimals: entry.decimals,
        };
      }
    }
    return map;
  }, [entries]);

  const loadTransactions = useCallback(async () => {
    setLoadingState((prev) => (prev === 'success' ? prev : 'loading'));
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'activity:getTransactions',
        limit: 200,
      });
      if (response?.ok) {
        const fresh: TxEvent[] = response.events || [];
        setEvents(fresh);
        setFromCache(false);
        setLoadingState('success');
        // Persist for instant/offline rendering next time the tab opens.
        try {
          await chrome.storage.local.set({ [cacheKey]: { at: Date.now(), events: fresh } });
        } catch {
          /* quota/unavailable — cache is best-effort */
        }
      } else {
        throw new Error(response?.error || 'Failed to load transactions');
      }
    } catch (err: any) {
      console.error('[TotemActivity] Failed to load transactions:', err);
      // Keep showing whatever we have (cache or previous fetch) instead of
      // blanking the tab on a transient API failure.
      setEvents((prev) => {
        if (prev.length > 0) return prev;
        return prev;
      });
      setError(err.message || 'Failed to load transaction history');
      setLoadingState((prev) => (prev === 'success' ? 'success' : 'error'));
    }
  }, [cacheKey]);

  useEffect(() => {
    let active = true;
    (async () => {
      // 1. Render cached history immediately.
      try {
        const stored = await chrome.storage.local.get(cacheKey);
        const cached = stored?.[cacheKey] as { at?: number; events?: TxEvent[] } | undefined;
        if (active && cached?.events?.length) {
          setEvents(cached.events);
          setFromCache(true);
          setLoadingState('success');
        }
      } catch {
        /* no cache */
      }
      // 2. Then refresh from the API (cache is a fast first paint, not a TTL).
      if (active) await loadTransactions();
    })();
    return () => {
      active = false;
    };
  }, [cacheKey, loadTransactions, activeAccountAddress]);

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // clipboard unavailable; no-op
    }
  }, []);

  /**
   * Node amounts are written at 44 decimal places. Native MINIMA uses all 44,
   * so its text is already the display value; a token's base units must be
   * divided by its own decimals.
   */
  const decimalsFor = useCallback(
    (tokenid?: string) => {
      if (!tokenid || tokenid.toLowerCase() === '0x00') return 44;
      return tokens[tokenid.toLowerCase()]?.decimals ?? 44;
    },
    [tokens]
  );

  const zeroCount = useMemo(
    () =>
      events.filter((e) => isZeroAmount(decodeMinimaAmount(e.amount, decimalsFor(e.tokenid)))).length,
    [events, decimalsFor]
  );

  // Newest first, grouped by local day.
  const groups = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );
    const isZero = (e: TxEvent) =>
      isZeroAmount(decodeMinimaAmount(e.amount, decimalsFor(e.tokenid)));
    const filtered = showStateUpdates ? sorted : sorted.filter((e) => !isZero(e));

    const byDay: Array<{ key: string; label: string; items: TxEvent[] }> = [];
    for (const event of filtered) {
      const when = formatWhen(event.event_date);
      const last = byDay[byDay.length - 1];
      if (last && last.key === when.dayKey) last.items.push(event);
      else byDay.push({ key: when.dayKey, label: when.dayKey, items: [event] });
    }
    return byDay;
  }, [events, showStateUpdates, decimalsFor]);

  const renderRow = (ev: TxEvent) => {
    const isSend = ev.event_type === 'send';
    const { label: unit, known } = tokenLabel(ev.tokenid, tokens);
    const displayAmount = decodeMinimaAmount(ev.amount, decimalsFor(ev.tokenid));
    const when = formatWhen(ev.event_date);
    const zero = isZeroAmount(displayAmount);

    return (
      <button
        key={`${ev.txpowid}-${ev.coinid}-${ev.event_type}`}
        type="button"
        onClick={() => onSelectTx?.(ev.txpowid)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          borderTop: '1px solid var(--border-subtle)',
          padding: 'var(--space-1-5)',
          cursor: onSelectTx ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
            <Typography variant="body" bold uppercase>
              {zero ? 'State update' : isSend ? 'Sent' : 'Received'}
            </Typography>
            <StatusPill variant="success" size="sm">confirmed</StatusPill>
            {!known && (
              <span
                title={`Unknown token ${ev.tokenid}`}
                style={{
                  fontSize: 10,
                  letterSpacing: '0.04em',
                  padding: '1px 6px',
                  borderRadius: 999,
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                token
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            <Typography variant="body" bold mono>
              {formatSignedAmount(displayAmount, isSend)}
            </Typography>
            <Typography variant="caption" color="muted" uppercase>
              {unit}
            </Typography>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginTop: 2 }}>
          <span
            title={when.full}
            style={{ fontSize: 11, color: 'var(--text-muted)' }}
          >
            {when.short}
            {typeof ev.height === 'number' && ev.height > 0 ? ` · block ${ev.height.toLocaleString('en-GB')}` : ''}
          </span>
          <span
            role="button"
            tabIndex={0}
            title={`${ev.txpowid} — click to copy`}
            onClick={(e) => {
              e.stopPropagation();
              void copyText(ev.txpowid);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                void copyText(ev.txpowid);
              }
            }}
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              color: 'var(--text-muted)',
              cursor: 'copy',
            }}
          >
            {copied === ev.txpowid ? 'copied' : shortAddress(ev.txpowid)}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: 'var(--space-2)',
          paddingBottom: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Typography variant="h2" color="accent">Activity</Typography>
            {fromCache && loadingState === 'success' && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }} title="Cached — refreshing">
                cached
              </span>
            )}
          </div>
          {zeroCount > 0 && (
            <button
              type="button"
              onClick={() => setShowStateUpdates((v) => !v)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 999,
                color: 'var(--text-muted)',
                fontSize: 11,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              {showStateUpdates ? 'Hide' : 'Show'} state updates ({zeroCount})
            </button>
          )}
        </div>

        {loadingState === 'loading' && (
          <Card padding="md" shadow>
            <div style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
              <Typography variant="body" uppercase bold>Loading Transactions...</Typography>
            </div>
          </Card>
        )}

        {loadingState === 'error' && (
          <Card padding="md" shadow>
            <div style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
              <Typography variant="body" uppercase bold color="danger">Error Loading Transactions</Typography>
              <Typography variant="caption" style={{ marginTop: 'var(--space-1)' }}>{error}</Typography>
              <button
                type="button"
                onClick={loadTransactions}
                style={{ marginTop: 'var(--space-2)', padding: '6px 14px', cursor: 'pointer' }}
              >
                Retry
              </button>
            </div>
          </Card>
        )}

        {loadingState === 'success' && groups.length === 0 && (
          <Card>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-4)',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ fontSize: 48, opacity: 0.3 }}>📊</div>
              <Typography variant="h3" uppercase>No Transactions Yet</Typography>
              <Typography variant="body" style={{ textAlign: 'center', opacity: 0.7, maxWidth: 280 }}>
                Your transaction history will appear here once you start using your wallet
              </Typography>
            </div>
          </Card>
        )}

        {loadingState === 'success' && groups.length > 0 && (
          <Card padding="none" shadow>
            {groups.map((group) => (
              <div key={group.key}>
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    padding: '4px var(--space-1-5)',
                    background: 'var(--bg-elevated, var(--bg-base))',
                    borderBottom: '1px solid var(--border-accent)',
                  }}
                >
                  <Typography variant="caption" color="muted" uppercase bold>
                    {group.label}
                  </Typography>
                </div>
                {group.items.map(renderRow)}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
