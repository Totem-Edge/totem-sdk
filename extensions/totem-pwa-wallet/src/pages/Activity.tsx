/**
 * Activity — on-chain transaction history.
 *
 * Mirrors the extension's Activity tab: one row per (transaction, token) with
 * the net movement for the address, grouped by local day, newest first, with a
 * local cache so the list paints before the network replies.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '../core/WalletContext';
import { fetchActivity, fetchPortfolio, type ActivityEvent } from '../core/api';
import {
  decodeMinimaAmount,
  formatAmount,
  formatSignedAmount,
  formatWhen,
  isZeroAmount,
  shortAddress,
  tokenLabel,
} from '../core/format';

const CACHE_PREFIX = 'totem.activity.v1:';

interface TokenMeta {
  name?: string;
  ticker?: string;
  decimals?: number;
}

function readCache(address: string): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + address);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.events) ? (parsed.events as ActivityEvent[]) : [];
  } catch {
    return [];
  }
}

function writeCache(address: string, events: ActivityEvent[]): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + address,
      JSON.stringify({ at: Date.now(), events })
    );
  } catch {
    /* quota — cache is best-effort */
  }
}

export function Activity() {
  const { activeAccount, session, openTx } = useWallet();
  const address = activeAccount?.address ?? '';

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [tokens, setTokens] = useState<Record<string, TokenMeta>>({});
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStateUpdates, setShowStateUpdates] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setError(null);
    try {
      const [fresh, portfolio] = await Promise.all([
        fetchActivity(address, 200),
        fetchPortfolio(address, session?.identityHash),
      ]);

      const map: Record<string, TokenMeta> = {};
      for (const entry of portfolio) {
        if (entry?.tokenid) {
          map[entry.tokenid.toLowerCase()] = {
            name: entry.name,
            ticker: entry.ticker,
            decimals: entry.decimals,
          };
        }
      }
      setTokens(map);

      // Keep the cached list if the refresh came back empty (transient API
      // failure) instead of blanking the tab.
      if (fresh.length > 0) {
        setEvents(fresh);
        setFromCache(false);
        writeCache(address, fresh);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load activity');
    } finally {
      setLoading(false);
    }
  }, [address, session?.identityHash]);

  useEffect(() => {
    if (!address) return;
    const cached = readCache(address);
    if (cached.length > 0) {
      setEvents(cached);
      setFromCache(true);
      setLoading(false);
    }
    void load();
  }, [address, load]);

  /**
   * Node amounts are written at 44 decimal places. Native MINIMA uses all 44,
   * so its text is already the display value; a token's base units must be
   * divided by the token's own scale. The index supplies the scale, which also
   * covers tokens the wallet no longer holds.
   */
  const decimalsFor = useCallback(
    (tokenid?: string, fromServer?: number | null) => {
      if (tokenid && tokenid.toLowerCase() !== '0x00' && typeof fromServer === 'number') {
        return fromServer;
      }
      if (!tokenid || tokenid.toLowerCase() === '0x00') return 44;
      return tokens[tokenid.toLowerCase()]?.decimals ?? 44;
    },
    [tokens]
  );

  const displayAmount = useCallback(
    (e: ActivityEvent) => decodeMinimaAmount(e.amount, decimalsFor(e.tokenid, e.decimals)),
    [decimalsFor]
  );

  const zeroCount = useMemo(
    () => events.filter((e) => isZeroAmount(displayAmount(e))).length,
    [events, displayAmount]
  );

  const groups = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );
    const filtered = showStateUpdates
      ? sorted
      : sorted.filter((e) => !isZeroAmount(displayAmount(e)));

    const byDay: Array<{ key: string; label: string; items: ActivityEvent[] }> = [];
    for (const event of filtered) {
      const when = formatWhen(event.event_date);
      const last = byDay[byDay.length - 1];
      if (last && last.key === when.dayKey) last.items.push(event);
      else byDay.push({ key: when.dayKey, label: when.dayKey, items: [event] });
    }
    return byDay;
  }, [events, showStateUpdates, displayAmount]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  const renderRow = (ev: ActivityEvent) => {
    const isSend = ev.event_type === 'send';
    const { label: unit, known } = tokenLabel(ev.tokenid, tokens);
    const value = displayAmount(ev);
    const zero = isZeroAmount(value);
    const when = formatWhen(ev.event_date);

    return (
      <button
        key={`${ev.txpowid}-${ev.coinid}-${ev.event_type}`}
        className="tx-row"
        onClick={() => openTx(ev.txpowid)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border-subtle)',
          padding: 'var(--space-1-5) var(--space-2)',
          cursor: 'pointer',
          color: 'inherit',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}>
              {zero ? 'State update' : isSend ? 'Sent' : 'Received'}
            </span>
            <span className="chip chip-success" style={{ fontSize: 10 }}>confirmed</span>
            {!known && (
              <span className="chip" style={{ fontSize: 10 }} title={`Unknown token ${ev.tokenid}`}>
                token
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            <div
              style={{
                fontFamily: 'var(--font-family-mono)',
                fontWeight: 'var(--weight-bold)',
                color: isSend && !zero ? 'var(--text-primary)' : 'var(--color-success)',
              }}
            >
              {zero ? formatAmount('0') : formatSignedAmount(value, isSend)}
            </div>
            <div
              title={unit}
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                maxWidth: 132,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginLeft: 'auto',
              }}
            >
              {unit}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginTop: 2 }}>
          <span title={when.full} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {when.short}
            {ev.height > 0 ? ` · block ${ev.height.toLocaleString('en-GB')}` : ''}
          </span>
          <span
            role="button"
            tabIndex={0}
            title={`${ev.txpowid} — click to copy`}
            onClick={(e) => {
              e.stopPropagation();
              void copy(ev.txpowid);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                void copy(ev.txpowid);
              }
            }}
            style={{
              fontFamily: 'var(--font-family-mono)',
              fontSize: 'var(--text-xs)',
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
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
            Activity
          </h2>
          {fromCache && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }} title="Cached — refreshing">
              cached
            </span>
          )}
        </div>
        {zeroCount > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowStateUpdates((v) => !v)}
          >
            {showStateUpdates ? 'Hide' : 'Show'} state updates ({zeroCount})
          </button>
        )}
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 8 }}>≡</div>
          <p style={{ fontSize: 'var(--text-sm)' }}>No transactions yet</p>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.key} style={{ marginBottom: 'var(--space-2)' }}>
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              padding: '4px var(--space-2)',
              background: 'var(--bg-base)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: 'var(--tracking-wide)',
            }}
          >
            {group.label}
          </div>
          {group.items.map(renderRow)}
        </div>
      ))}
    </div>
  );
}
