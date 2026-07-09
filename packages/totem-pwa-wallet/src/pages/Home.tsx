/**
 * Home — main wallet screen with real-time balance streaming.
 *
 * Uses @totemsdk/realtime PortfolioStreamManager (WebSocket + HTTP fallback)
 * for live balance updates.  Falls back to REST polling if WS/HTTP stream
 * cannot connect within 5 s.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useWallet } from '../core/WalletContext';
import { fetchTxHistory, fetchPortfolio, type TxRecord } from '../core/api';
import { portfolioStreamManager } from '../core/balanceStream';
import type { PortfolioStreamListener, PortfolioEntry } from '@totemsdk/realtime';
import { track } from '../core/observability';

export function Home() {
  const { session, activeAccount, setRoute, lock, switchAccount } = useWallet();
  const [balances, setBalances]     = useState<PortfolioEntry[]>([]);
  const [txs, setTxs]               = useState<TxRecord[]>([]);
  const [loadingBal, setLoadingBal] = useState(true);
  const [error, setError]           = useState('');
  const [copied, setCopied]         = useState(false);
  const [streamOk, setStreamOk]     = useState<boolean | null>(null);
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTxHistory = useCallback(async () => {
    if (!activeAccount || !session) return;
    try {
      const history = await fetchTxHistory(activeAccount.address, session.identityHash, 10);
      setTxs(history);
    } catch { /* non-fatal */ }
  }, [activeAccount, session]);

  // PortfolioStreamManager — WebSocket real-time portfolio streaming
  useEffect(() => {
    if (!activeAccount || !session) return;

    // Initial REST load for fast first paint
    loadTxHistory();

    // Track home view
    track('session.home', { identityHash: session.identityHash });

    // 5-second connection timeout → fall back to REST polling
    const connectTimeout = setTimeout(() => {
      if (portfolioStreamManager.getConnectionState() !== 'connected') {
        setStreamOk(false);
        pollRef.current = setInterval(() => {
          loadTxHistory();
        }, 30_000);
      }
    }, 5_000);

    const listener: PortfolioStreamListener = {
      onPortfolioUpdate(event) {
        clearTimeout(connectTimeout);
        setStreamOk(true);
        setBalances(prev => {
          const addrEntries = event.entries;
          const other = prev.filter(e => !addrEntries.some(n => n.tokenid === e.tokenid && n.address === e.address));
          return [...other, ...addrEntries];
        });
        setLoadingBal(false);
        loadTxHistory();
      },
      onConnectionStateChange(state) {
        if (state === 'connected') {
          clearTimeout(connectTimeout);
          setStreamOk(true);
        } else if (state === 'error' || state === 'fallback') {
          setStreamOk(false);
        }
      },
    };

    portfolioStreamManager.addListener(listener);
    portfolioStreamManager.start([activeAccount.address]).catch(() => {
      setStreamOk(false);
    });

    return () => {
      clearTimeout(connectTimeout);
      portfolioStreamManager.removeListener(listener);
      portfolioStreamManager.stop();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeAccount?.address, session?.identityHash]);

  async function copyAddress() {
    if (!activeAccount) return;
    await navigator.clipboard.writeText(activeAccount.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function manualRefresh() {
    if (!activeAccount || !session) return;
    setLoadingBal(true);
    try {
      const entries = await fetchPortfolio(activeAccount.address, session.identityHash);
      setBalances(entries);
    } finally {
      setLoadingBal(false);
    }
    await loadTxHistory();
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  const nativeEntry  = balances.find(b => b.kind === 'native');
  const tokenEntries = balances.filter(b => b.kind === 'token');
  const nftEntries   = balances.filter(b => b.kind === 'nft');
  const minimaAmount = nativeEntry?.confirmed ?? '0';

  return (
    <div className="page">
      {/* Account switcher */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
      }}>
        <p className="label" style={{ marginBottom: 'var(--space-1)' }}>Account</p>
        {/* Multi-account switcher: shown when wallet has more than one address */}
        {(session?.accounts.length ?? 0) > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
            {session!.accounts.map(acc => (
              <button
                key={acc.index}
                className={`btn btn-sm ${acc.index === session!.activeIndex ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)' }}
                onClick={() => switchAccount(acc.index)}
              >
                {acc.name ?? `Account ${acc.index + 1}`}
              </button>
            ))}
          </div>
        )}
        <p style={{ fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-1)' }}>
          {activeAccount?.name ?? 'Account 1'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span style={{
            fontFamily: 'var(--font-family-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {activeAccount?.address ?? '—'}
          </span>
          <button className="btn btn-sm btn-secondary" onClick={copyAddress}>
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Balance card — native MINIMA */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '2px solid var(--axia-aqua)',
        boxShadow: 'var(--shadow-accent)',
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <p className="label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Balance
            {streamOk === true && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} title="Live" />
            )}
            {streamOk === false && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-warning)', display: 'inline-block' }} title="Polling" />
            )}
          </p>
          {loadingBal && balances.length === 0 ? (
            <span className="spinner" />
          ) : (
            <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', color: 'var(--axia-aqua)' }}>
              {minimaAmount}
            </p>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>MINIMA</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={manualRefresh} disabled={loadingBal}>
          ↻
        </button>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setRoute('send')}>
          Send
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRoute('receive')}>
          Receive
        </button>
      </div>

      {/* Fungible tokens (kind === 'token') */}
      {tokenEntries.length > 0 && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <p className="label" style={{ marginBottom: 'var(--space-1)' }}>Tokens</p>
          {tokenEntries.map(b => (
            <div key={b.tokenid} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: 'var(--space-1) var(--space-1-5)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-sm)' }}>
                {b.name || b.tokenid.slice(0, 10) + '…'}
              </span>
              <span>{b.confirmed}</span>
            </div>
          ))}
        </div>
      )}

      {/* NFTs (kind === 'nft') */}
      {nftEntries.length > 0 && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <p className="label" style={{ marginBottom: 'var(--space-1)' }}>Collectibles</p>
          {nftEntries.map(b => (
            <div key={b.tokenid} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-1) var(--space-1-5)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              {b.artimage && (
                <img
                  src={b.artimage}
                  alt={b.name || 'NFT'}
                  style={{ width: 32, height: 32, objectFit: 'cover', marginRight: 'var(--space-1)' }}
                />
              )}
              <span style={{ flex: 1, fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-sm)' }}>
                {b.name || b.tokenid.slice(0, 10) + '…'}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>NFT</span>
            </div>
          ))}
        </div>
      )}

      {/* TX history */}
      <div>
        <p className="label" style={{ marginBottom: 'var(--space-1)' }}>Recent Transactions</p>
        {txs.length === 0 && !loadingBal && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-3)' }}>
            No transactions yet
          </p>
        )}
        {txs.map(tx => (
          <div key={tx.txid} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-1-5) 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <span className={`chip chip-${tx.direction === 'in' ? 'success' : 'warning'}`}>
                  {tx.direction === 'in' ? 'IN' : 'OUT'}
                </span>
                <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {tx.txid.slice(0, 12)}…
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                {formatDate(tx.date)}
              </p>
            </div>
            <span style={{
              fontWeight: 'var(--weight-bold)',
              color: tx.direction === 'in' ? 'var(--color-success)' : 'var(--text-primary)',
            }}>
              {tx.direction === 'in' ? '+' : '-'}{tx.amount}
            </span>
          </div>
        ))}
      </div>

      {/* Lock footer */}
      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
        <button className="btn btn-secondary btn-sm" onClick={lock} style={{ opacity: 0.7 }}>
          Lock Wallet
        </button>
      </div>
    </div>
  );
}
