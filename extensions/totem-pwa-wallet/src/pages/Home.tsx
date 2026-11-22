/**
 * Home — main wallet screen with real-time balance streaming.
 *
 * Mirrors the extension's Home (src/ui/popup/pages/TotemHome.tsx): balance card
 * with fiat value and streaming state, then an Assets / NFTs tabbed list with
 * token artwork, tickers, ids and per-token balances.
 *
 * Uses @totemsdk/realtime PortfolioStreamManager (WebSocket + HTTP fallback)
 * for live balance updates. Falls back to REST polling if the stream cannot
 * connect within 5 s.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../core/WalletContext';
import { fetchPortfolio } from '../core/api';
import { portfolioStreamManager } from '../core/balanceStream';
import type { PortfolioStreamListener, PortfolioEntry } from '@totemsdk/realtime';
import { track } from '../core/observability';
import { formatAmount } from '../core/format';
import { calculateUsdValue, fetchMinimaPrice, formatUsd, type PriceData } from '../core/price';
import { tokenArtwork } from '../core/tokenImage';

type AssetTab = 'assets' | 'nfts';

const MINIMA_GLYPH = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L22 6.5V17.5L12 22L2 17.5V6.5L12 2" />
    <path d="M12 12L22 7.5" />
    <path d="M12 12L12 22" />
    <path d="M12 12L2 7.5" />
  </svg>
);

function TokenRow({ entry, onClick }: { entry: PortfolioEntry; onClick?: () => void }) {
  const [artFailed, setArtFailed] = useState(false);
  const art = artFailed ? undefined : tokenArtwork(entry);
  const isNft = entry.kind === 'nft';
  const isNative = entry.tokenid === '0x00';
  const name = entry.ticker || entry.name || `${entry.tokenid.slice(0, 10)}…`;
  const pending = entry.unconfirmed && entry.unconfirmed !== '0';

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--space-1-5)',
        border: 'none',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'transparent',
        color: 'inherit',
        fontFamily: 'inherit',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Artwork / placeholder */}
      <span
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${isNative ? 'var(--minima-green, var(--axia-aqua))' : 'var(--border-subtle)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isNative ? 'rgba(0, 255, 136, 0.08)' : 'var(--bg-subtle)',
          color: isNative ? 'var(--minima-green, var(--axia-aqua))' : 'var(--text-muted)',
          fontSize: 14,
          fontWeight: 700,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {isNative ? MINIMA_GLYPH : isNft ? '▣' : name.charAt(0).toUpperCase()}
        {art && (
          <img
            src={art}
            alt={name}
            onError={() => setArtFailed(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </span>

      {/* Name + id */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-bold)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
          {isNft && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 4px',
                border: '1px solid var(--text-muted)',
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
                lineHeight: '12px',
              }}
            >
              NFT
            </span>
          )}
          {entry.webvalidate && (
            <span
              title={`Verified by ${entry.webvalidate}`}
              style={{ color: 'var(--minima-green, var(--axia-aqua))', fontSize: 11, lineHeight: '12px' }}
            >
              ★
            </span>
          )}
        </span>
        {!isNative && (
          <span
            style={{
              display: 'block',
              marginTop: 1,
              fontFamily: 'var(--font-family-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.tokenid.slice(0, 16)}…{entry.tokenid.slice(-8)}
          </span>
        )}
      </span>

      {/* Balance */}
      <span style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--weight-bold)' }}>
          {formatAmount(entry.confirmed)}
        </span>
        {pending && (
          <span style={{ display: 'block', fontSize: 9, color: 'var(--color-warning, #e9b949)', fontFamily: 'var(--font-family-mono)' }}>
            +{formatAmount(entry.unconfirmed)} pending
          </span>
        )}
        {!!entry.coins && entry.coins > 1 && (
          <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-family-mono)' }}>
            {entry.coins} coins
          </span>
        )}
      </span>
    </button>
  );
}

export function Home() {
  const { session, activeAccount, setRoute, lock, switchAccount, openToken } = useWallet();
  const [balances, setBalances] = useState<PortfolioEntry[]>([]);
  const [loadingBal, setLoadingBal] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [streamOk, setStreamOk] = useState<boolean | null>(null);
  const [assetTab, setAssetTab] = useState<AssetTab>('assets');
  const [price, setPrice] = useState<PriceData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Live balance stream (WebSocket with REST polling fallback)
  useEffect(() => {
    if (!activeAccount || !session) return;

    track('session.home', { identityHash: session.identityHash });

    const connectTimeout = setTimeout(() => {
      if (portfolioStreamManager.getConnectionState() !== 'connected') {
        setStreamOk(false);
      }
    }, 5_000);

    const listener: PortfolioStreamListener = {
      onPortfolioUpdate(event) {
        clearTimeout(connectTimeout);
        setStreamOk(true);
        setBalances((prev) => {
          const addrEntries = event.entries;
          const other = prev.filter(
            (e) => !addrEntries.some((n) => n.tokenid === e.tokenid && n.address === e.address)
          );
          return [...other, ...addrEntries];
        });
        setLoadingBal(false);
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
    };
  }, [activeAccount?.address, session?.identityHash]);

  // If the stream could not connect, keep the balance fresh by polling REST.
  useEffect(() => {
    if (streamOk !== false || !activeAccount || !session) return;
    const timer = setInterval(() => {
      void fetchPortfolio(activeAccount.address, session.identityHash)
        .then((entries) => setBalances(entries))
        .catch(() => undefined);
    }, 30_000);
    return () => clearInterval(timer);
  }, [streamOk, activeAccount?.address, session?.identityHash]);

  // Spot price for the fiat line (same source as the extension)
  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await fetchMinimaPrice();
      if (active) setPrice(data);
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function copyAddress() {
    if (!activeAccount) return;
    await navigator.clipboard.writeText(activeAccount.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function manualRefresh() {
    if (!activeAccount || !session || refreshing) return;
    setRefreshing(true);
    try {
      const entries = await fetchPortfolio(activeAccount.address, session.identityHash);
      setBalances(entries);
      setError('');
    } catch {
      setError('Could not refresh balance');
    } finally {
      setRefreshing(false);
      setLoadingBal(false);
    }
  }

  const nativeEntry = balances.find((b) => b.kind === 'native');
  const tokenEntries = useMemo(() => balances.filter((b) => b.kind === 'token'), [balances]);
  const nftEntries = useMemo(() => balances.filter((b) => b.kind === 'nft'), [balances]);
  const minimaAmount = nativeEntry?.confirmed ?? '0';

  const usdValue = price ? calculateUsdValue(minimaAmount, price.usd) : undefined;
  const displayed = assetTab === 'assets' ? tokenEntries : nftEntries;

  return (
    <div className="page">
      {/* Account */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <p className="label" style={{ marginBottom: 'var(--space-1)' }}>Account</p>
        {(session?.accounts.length ?? 0) > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
            {session!.accounts.map((acc) => (
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
          <span
            style={{
              fontFamily: 'var(--font-family-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeAccount?.address ?? '—'}
          </span>
          <button className="btn btn-sm btn-secondary" onClick={copyAddress}>
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Balance card */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '2px solid var(--axia-aqua)',
          boxShadow: 'var(--shadow-accent)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-3)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ minWidth: 0 }}>
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
            <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', color: 'var(--axia-aqua)', fontFamily: 'var(--font-family-mono)' }}>
              {formatAmount(minimaAmount)}
            </p>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>MINIMA</p>

          {usdValue !== undefined && usdValue > 0 && (
            <p style={{ marginTop: 2, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {formatUsd(usdValue)}
              {price?.change24h !== undefined && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 'var(--text-xs)',
                    color: price.change24h >= 0 ? 'var(--color-success)' : 'var(--color-danger, #ff6b6b)',
                  }}
                >
                  {price.change24h >= 0 ? '▲' : '▼'} {Math.abs(price.change24h).toFixed(2)}% 24h
                </span>
              )}
            </p>
          )}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={manualRefresh} disabled={refreshing} title="Refresh balance">
          {refreshing ? <span className="spinner" /> : '↻'}
        </button>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setRoute('send')}>
          Send
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRoute('receive')}>
          Receive
        </button>
      </div>

      {/* Assets / NFTs */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border-accent, var(--border-subtle))' }}>
          {(['assets', 'nfts'] as const).map((tab) => {
            const isActive = assetTab === tab;
            const count = tab === 'assets' ? tokenEntries.length : nftEntries.length;
            return (
              <button
                key={tab}
                onClick={() => setAssetTab(tab)}
                style={{
                  flex: 1,
                  padding: 'var(--space-1-5)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--axia-aqua)' : '2px solid transparent',
                  marginBottom: -2,
                  cursor: 'pointer',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: isActive ? 700 : 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {tab === 'assets' ? 'Assets' : 'NFTs'}
                {count > 0 && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>({count})</span>}
              </button>
            );
          })}
        </div>

        {displayed.length === 0 ? (
          <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
            {assetTab === 'assets' ? 'No Custom Tokens' : 'No NFTs'}
          </div>
        ) : (
          displayed.map((entry) => <TokenRow key={`${entry.tokenid}:${entry.address}`} entry={entry} />)
        )}
      </div>

      {/* Activity lives in its own tab, exactly like the extension */}
      <button className="btn btn-secondary btn-full" onClick={() => setRoute('activity')} style={{ marginBottom: 'var(--space-3)' }}>
        View activity →
      </button>

      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
        <button className="btn btn-secondary btn-sm" onClick={lock} style={{ opacity: 0.7 }}>
          Lock Wallet
        </button>
      </div>
    </div>
  );
}
