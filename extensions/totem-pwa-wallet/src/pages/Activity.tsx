/**
 * Activity — on-chain transaction history.
 *
 * Mirrors the extension's Activity tab: every wallet address is queried (not
 * only the active one), rows are deduped and sorted newest first, grouped by
 * local day, and cached so the list paints before the network replies.
 *
 * Sends submitted by this wallet are shown immediately as "processing" rows:
 * the archive index can lag the tip by minutes, and a user who just pressed
 * Send must not see an empty history.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '../core/WalletContext';
import {
  fetchActivityForAddresses,
  fetchPortfolio,
  type ActivityEvent,
} from '../core/api';
import {
  decodeMinimaAmount,
  formatAmount,
  formatSignedAmount,
  formatWhen,
  isZeroAmount,
  shortAddress,
  tokenLabel,
} from '../core/format';
import { usePendingSends, removePendingSend, type PendingSend } from '../core/pendingSends';

const CACHE_PREFIX = 'totem.activity.v2:';
const REFRESH_MS = 30_000;

interface TokenMeta {
  name?: string;
  ticker?: string;
  decimals?: number;
}

function readCache(key: string): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.events) ? (parsed.events as ActivityEvent[]) : [];
  } catch {
    return [];
  }
}

function writeCache(key: string, events: ActivityEvent[]): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ at: Date.now(), events })
    );
  } catch {
    /* quota — cache is best-effort */
  }
}

function PendingRow({ send, label, onClick }: { send: PendingSend; label: string; onClick?: () => void }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--space-2)',
        padding: 'var(--space-1-5) var(--space-2)',
        borderBottom: '1px solid var(--border-subtle)',
        opacity: 0.9,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
        <span className="spinner" style={{ width: 12, height: 12 }} />
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}>
          Sent
        </span>
        <span className="chip" style={{ fontSize: 10, borderColor: 'var(--axia-aqua)', color: 'var(--axia-aqua)' }}>
          processing
        </span>
      </div>
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--weight-bold)' }}>
          −{formatAmount(send.amount)}
        </div>
        <div
          title={label}
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
          {label}
        </div>
      </div>
    </div>
  );
}

export function Activity() {
  const { activeAccount, session, openTx } = useWallet();
  const pendingSends = usePendingSends(activeAccount?.address);

  // The extension merges every stored address; do the same so switching
  // accounts (or adding a new one) never empties the history.
  const addresses = useMemo(() => {
    const list = (session?.accounts ?? []).map((a) => a.address).filter(Boolean);
    if (activeAccount?.address && !list.includes(activeAccount.address)) {
      list.push(activeAccount.address);
    }
    return list;
  }, [session?.accounts, activeAccount?.address]);
  const addressesKey = useMemo(
    () => [...addresses].sort().join('|') || activeAccount?.address || '',
    [addresses, activeAccount?.address]
  );

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [tokens, setTokens] = useState<Record<string, TokenMeta>>({});
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStateUpdates, setShowStateUpdates] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (addresses.length === 0) return;
    setError(null);
    try {
      const [result, portfolios] = await Promise.all([
        fetchActivityForAddresses(addresses, 200),
        Promise.all(
          addresses.map((address) => fetchPortfolio(address, session?.identityHash))
        ),
      ]);

      const map: Record<string, TokenMeta> = {};
      for (const portfolio of portfolios) {
        for (const entry of portfolio) {
          if (entry?.tokenid) {
            map[entry.tokenid.toLowerCase()] = {
              name: entry.name,
              ticker: entry.ticker,
              decimals: entry.decimals,
            };
          }
        }
      }
      setTokens(map);

      if (result.failed === result.queried && result.queried > 0) {
        setError('Activity service is temporarily unavailable');
      }

      // Keep the cached list if the refresh came back empty (transient API
      // failure or an indexer that is still catching up) instead of blanking
      // the tab.
      if (result.events.length > 0) {
        setEvents(result.events);
        setFromCache(false);
        writeCache(addressesKey, result.events);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addressesKey, session?.identityHash]);

  // Any event the indexer has returned means the send is no longer pending.
  useEffect(() => {
    if (events.length === 0 || pendingSends.length === 0) return;
    const seen = new Set(events.map((e) => e.txpowid.toLowerCase()));
    for (const send of pendingSends) {
      if (seen.has(send.txpowid.toLowerCase())) removePendingSend(send.txpowid);
    }
  }, [events, pendingSends]);

  useEffect(() => {
    if (addresses.length === 0) return;
    const cached = readCache(addressesKey);
    if (cached.length > 0) {
      setEvents(cached);
      setFromCache(true);
      setLoading(false);
    }
    void load();
  }, [addressesKey, load]);

  // The archive index can take a minute or two; keep the tab current while it
  // is open instead of requiring a manual reload.
  useEffect(() => {
    if (addresses.length === 0) return;
    const timer = setInterval(() => { void load(); }, REFRESH_MS);
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [addresses.length, load]);

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    void load();
  }

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

  // Hide a pending row as soon as its transaction appears in the index.
  const pendingRows = useMemo(() => {
    const seen = new Set(events.map((e) => e.txpowid.toLowerCase()));
    return pendingSends.filter((p) => !seen.has(p.txpowid.toLowerCase()));
  }, [pendingSends, events]);

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
        key={`${ev.txpowid}-${ev.coinid}-${ev.event_type}-${ev.localAddress}`}
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

  const empty = groups.length === 0 && pendingRows.length === 0;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)', gap: 'var(--space-1)' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          {zeroCount > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowStateUpdates((v) => !v)}
            >
              {showStateUpdates ? 'Hide' : 'Show'} state updates ({zeroCount})
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={refreshing} title="Refresh activity">
            {refreshing ? <span className="spinner" /> : '↻'}
          </button>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && empty && (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 8 }}>≡</div>
          <p style={{ fontSize: 'var(--text-sm)' }}>No transactions yet</p>
          <p style={{ fontSize: 'var(--text-xs)', marginTop: 4, opacity: 0.8 }}>
            Recent sends appear instantly; the chain index can take a few minutes to confirm them.
          </p>
        </div>
      )}

      {pendingRows.length > 0 && (
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <div
            style={{
              padding: '4px var(--space-2)',
              background: 'var(--bg-base)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 'var(--text-xs)',
              color: 'var(--axia-aqua)',
              textTransform: 'uppercase',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: 'var(--tracking-wide)',
            }}
          >
            Processing
          </div>
          {pendingRows.map((send) => (
            <PendingRow
              key={send.txpowid}
              send={send}
              label={send.tokenId === '0x00' ? 'MINIMA' : tokenLabel(send.tokenId, tokens).label}
              onClick={() => openTx(send.txpowid)}
            />
          ))}
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
