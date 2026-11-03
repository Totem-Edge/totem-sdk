/**
 * AXIA TOTEM HOME PAGE - TOTEM REDESIGN
 * Balance dashboard with USD value, price change, and token list
 * Now with real-time SmartRouter balance streaming
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BalanceCard, TokenRow } from '../../components/molecules';
import { Card, Typography, Button } from '../../components/atoms';
import { fetchMinimaPrice, calculateUSDValue, PriceData } from '../../../core/price/coincap';
import { parseTokenImageUrl } from '../../../constants';
import { NavTab } from '../../components/organisms';
import { usePortfolio } from '../../hooks';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import '../../theme/axia-tokens.css';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface TokenData {
  tokenId: string;
  tokenName: string;
  ticker?: string;
  balance: string;
  sendable?: string;
  unconfirmed?: string;
  coins?: number;
  total?: string;
  icon?: string;
  url?: string;
  artimage?: string;
  type?: string;
  webvalidate?: string;
  owner?: string;
  description?: string;
  decimals?: number;
  mintBlock?: number;
}

interface TotemHomeProps {
  onNavigate: (tab: NavTab) => void;
  onSelectToken?: (token: TokenData) => void;
  activeAccountAddress?: string;
}

function formatSyncAge(timestamp: number | null, now: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return 'at an unknown time';

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function TotemHome({ onNavigate, onSelectToken, activeAccountAddress }: TotemHomeProps) {
  const [balanceDetails, setBalanceDetails] = useState<{ confirmed: string; unconfirmed: string; sendable: string }>({
    confirmed: '0',
    unconfirmed: '0',
    sendable: '0'
  });
  const [balanceState, setBalanceState] = useState<LoadingState>('idle');
  const hasValidBalanceRef = useRef(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [tokensState, setTokensState] = useState<LoadingState>('idle');
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [activeAssetTab, setActiveAssetTab] = useState<'assets' | 'nfts'>('assets');

  // Price data state
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [usdValue, setUsdValue] = useState<number | undefined>(undefined);
  
  const [currentAddress, setCurrentAddress] = useState<string>('');
  
  
  // Manual refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Announcement system
  const { 
    announcements, 
    showAnnouncements, 
    dismiss: dismissAnnouncement 
  } = useAnnouncements();

  const {
    entries,
    status,
    connectionState,
    error: portfolioError,
    lastSyncedAt,
    startStream,
  } = usePortfolio();
  const isLoading = status === 'loading';

  // The transport is plain HTTP polling, so `connectionState` stays
  // "fallback" even when every poll succeeds. Prefer the data status for the
  // badge: LIVE when the last poll succeeded, Cached for a cache-only
  // snapshot, and Offline only after a real failure.
  const streamingStatus =
    connectionState === 'error'
      ? 'error'
      : status === 'live'
        ? 'connected'
        : status === 'cached'
          ? 'fallback'
          : connectionState;
  const [syncAgeNow, setSyncAgeNow] = useState(() => Date.now());

  // Keep the stale-balance age text current while the service is unavailable.
  useEffect(() => {
    if (connectionState !== 'error') return;
    setSyncAgeNow(Date.now());
    const interval = setInterval(() => setSyncAgeNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [connectionState]);

  // Derive balance details and token list from PortfolioEntry[] whenever entries change
  useEffect(() => {
    if (entries.length === 0) return;
    const native = entries.find(e => e.kind === 'native' || e.tokenid === '0x00');
    if (native) {
      setBalanceDetails({
        confirmed:   native.confirmed   ?? '0',
        unconfirmed: native.unconfirmed ?? '0',
        sendable:    native.confirmed   ?? '0',
      });
      hasValidBalanceRef.current = true;
      setBalanceState('success');
    }
    const tokenDataList: TokenData[] = entries
      .filter(e => e.kind !== 'native' && e.tokenid !== '0x00')
      .map(t => ({
        tokenId:     t.tokenid,
        tokenName:   t.name || (t.tokenid ? t.tokenid.substring(0, 10) + '...' : 'Unknown'),
        ticker:      t.ticker ?? undefined,
        balance:     t.confirmed   ?? '0',
        sendable:    t.confirmed   ?? '0',
        unconfirmed: t.unconfirmed ?? '0',
        coins:       t.coins,
        total:       t.total,
        icon:        parseTokenImageUrl(t.icon) || parseTokenImageUrl(t.url) || parseTokenImageUrl(t.artimage),
        url:         t.url   ?? undefined,
        artimage:    t.artimage ?? undefined,
        type:        t.kind ?? 'token',
        webvalidate: t.webvalidate ?? undefined,
        owner:       t.owner ?? undefined,
        description: t.description ?? undefined,
        decimals:    t.decimals,
      }));
    setTokens(tokenDataList);
    setTokensState('success');
    setTokensError(null);
  }, [entries]);

  // Manual refresh balance handler — triggers a cache replay without re-subscribing
  const handleRefreshBalance = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    console.log('[TotemHome] Manual refresh triggered');
    try {
      await chrome.runtime.sendMessage({ type: 'balance:refresh' });
    } catch (error) {
      console.error('[TotemHome] Refresh failed:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [isRefreshing]);

  // Stream only the active account address passed from the App shell
  useEffect(() => {
    if (!activeAccountAddress) return;
    setCurrentAddress(activeAccountAddress);
    console.log('[TotemHome] Starting balance stream for address:', activeAccountAddress);
    startStream([activeAccountAddress]);
  }, [activeAccountAddress, startStream]);

  // Balance loading is now handled by PortfolioStreamManager via usePortfolio hook
  // No direct RPC calls needed — PortfolioStreamManager is the single source of truth
  useEffect(() => {
    if (isLoading) {
      setBalanceState('loading');
    } else if (connectionState === 'error' && !hasValidBalanceRef.current) {
      // Only show error state if we have never successfully displayed a balance.
      // Once a valid balance has been shown, keep it visible through WS reconnects.
      setBalanceState('error');
      setBalanceError(portfolioError || 'Balance service unavailable');
    } else {
      // Stream is ready — exit any stuck loading/error state.
      // BalanceCard will show a spinner placeholder until portfolio entries arrive via the stream.
      setBalanceState(prev => (prev === 'loading' || prev === 'error' ? 'idle' : prev));
    }
  }, [isLoading, connectionState, portfolioError]);

  useEffect(() => {
    if (currentAddress && entries.length === 0) {
      setTokensState('loading');
    }
  }, [currentAddress, entries.length]);

  // Fetch price data IMMEDIATELY on mount - try background cache first for speed
  useEffect(() => {
    const loadPriceData = async () => {
      // First try to get cached price from background (instant if available)
      try {
        const cachedResponse = await chrome.runtime.sendMessage({ 
          type: 'price:get', 
          id: Date.now() 
        });
        if (cachedResponse?.result?.usd) {
          console.log('[TotemHome] Using background cached price:', cachedResponse.result.usd);
          setPriceData({
            usd: cachedResponse.result.usd,
            change24h: cachedResponse.result.change24h || 0,
            lastUpdated: cachedResponse.result.lastUpdated || Date.now()
          });
          return;
        }
      } catch (e) {
        console.warn('[TotemHome] Background price cache miss, fetching fresh');
      }
      
      // Fallback to direct CoinGecko fetch
      const price = await fetchMinimaPrice();
      if (price) {
        setPriceData(price);
      }
    };

    // Load price immediately on mount
    loadPriceData();
    
    // Refresh price every 1 minute
    const interval = setInterval(loadPriceData, 60000);
    
    return () => clearInterval(interval);
  }, []); // No dependencies - fetch once on mount
  
  // Calculate USD value whenever balance OR price changes
  useEffect(() => {
    if (priceData && balanceDetails.confirmed && balanceDetails.confirmed !== '0') {
      const usd = calculateUSDValue(balanceDetails.confirmed, priceData.usd);
      setUsdValue(usd);
    }
  }, [balanceDetails.confirmed, priceData]);
  
  useEffect(() => {
    const handleBalanceChange = (event: any) => {
      console.log('[TotemHome] Mock RPC balance event (WS delivers the real update):', event.detail);
    };

    window.addEventListener('mock-rpc-balance-changed', handleBalanceChange);
    window.addEventListener('mock-rpc-token-created', handleBalanceChange);

    return () => {
      window.removeEventListener('mock-rpc-balance-changed', handleBalanceChange);
      window.removeEventListener('mock-rpc-token-created', handleBalanceChange);
    };
  }, []);

  return (
    <div style={{
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
    <div style={{
      flex: 1,
      minHeight: 0,
      padding: 'var(--space-2)',
      paddingBottom: 'var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
    }}>
      {/* Balance Card with USD Value and 24h % Change */}
      {balanceState === 'loading' && (
        <Card padding="md" shadow>
          <div style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
            <Typography variant="body" uppercase bold>
              Loading Balance...
            </Typography>
          </div>
        </Card>
      )}

      {balanceState === 'error' && (
        <Card padding="md" shadow>
          <div style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
            <Typography variant="body" uppercase bold color="danger">
              Error Loading Balance
            </Typography>
            <Typography variant="caption" style={{ marginTop: 'var(--space-1)' }}>
              {balanceError}
            </Typography>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => handleRefreshBalance()}
              style={{ marginTop: 'var(--space-2)' }}
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      {(balanceState === 'success' || balanceState === 'idle') && (
        <BalanceCard
          confirmed={balanceDetails.confirmed}
          unconfirmed={balanceDetails.unconfirmed}
          sendable={balanceDetails.sendable}
          label=""
          usdValue={usdValue}
          priceChange24h={priceData?.change24h}
          streamingStatus={streamingStatus}
          onRefresh={handleRefreshBalance}
          isRefreshing={isRefreshing}
          isBalancePending={balanceState === 'idle'}
        />
      )}

      {connectionState === 'error' && balanceState === 'success' && (
        <div style={{
          border: '1px solid var(--color-danger)',
          padding: 'var(--space-1-5) var(--space-2)',
          textAlign: 'center',
        }}>
          <Typography variant="caption" color="danger">
            {portfolioError || 'Balance service unavailable'} — showing last known balance
            {lastSyncedAt
              ? ` (last synced ${formatSyncAge(lastSyncedAt, syncAgeNow)})`
              : ' (sync time unknown)'}.
          </Typography>
        </div>
      )}

      {/* Announcement Banner - between Balance Card and Assets */}
      <AnnouncementBanner
        announcements={announcements}
        onDismiss={dismissAnnouncement}
        visible={showAnnouncements}
      />

      {/* Token List */}
      <Card padding="none" shadow>
        {/* Tab Header */}
        <div style={{ 
          display: 'flex',
          borderBottom: '2px solid var(--border-accent)'
        }}>
          {(['assets', 'nfts'] as const).map(tab => {
            const isActive = activeAssetTab === tab;
            const isNft = (t: TokenData) => t.type === 'nft' || t.type === 'NFT';
            const fungibleTokens = tokens.filter(t => !isNft(t));
            const nftTokens = tokens.filter(isNft);
            const count = tab === 'assets' ? fungibleTokens.length : nftTokens.length;
            return (
              <button
                key={tab}
                onClick={() => setActiveAssetTab(tab)}
                style={{
                  flex: 1,
                  padding: 'var(--space-1-5)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--axia-aqua)' : '2px solid transparent',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: isActive ? 700 : 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'all var(--transition-base)',
                }}
              >
                {tab === 'assets' ? 'Assets' : 'NFTs'}
                {count > 0 && (
                  <span style={{
                    marginLeft: '6px',
                    fontSize: '10px',
                    opacity: 0.6,
                  }}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {tokensState === 'loading' && (
          <div style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
            <Typography variant="caption" uppercase>
              Loading Tokens...
            </Typography>
          </div>
        )}

        {/* Error State */}
        {tokensState === 'error' && (
          <div style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
            <Typography variant="caption" color={tokensError === 'Token streaming unavailable' ? 'muted' : 'danger'}>
              {tokensError === 'Token streaming unavailable' 
                ? 'No Tokens' 
                : tokensError}
            </Typography>
            {tokensError !== 'Token streaming unavailable' && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleRefreshBalance()}
                style={{ marginTop: 'var(--space-1)' }}
              >
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Token Rows */}
        {tokensState === 'success' && (() => {
          const isNft = (t: TokenData) => t.type === 'nft' || t.type === 'NFT';
            const fungibleTokens = tokens.filter(t => !isNft(t));
          const nftTokens = tokens.filter(isNft);
          const displayTokens = activeAssetTab === 'assets' ? fungibleTokens : nftTokens;
          const emptyLabel = activeAssetTab === 'assets' ? 'No Custom Tokens' : 'No NFTs';

          if (displayTokens.length === 0) {
            return (
              <div style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                <Typography variant="caption" color="muted" uppercase>
                  {emptyLabel}
                </Typography>
              </div>
            );
          }

          return (
            <div>
              {displayTokens.map((token) => (
                <TokenRow
                  key={token.tokenId}
                  tokenId={token.tokenId}
                  tokenName={token.tokenName}
                  ticker={token.ticker}
                  balance={token.balance}
                  sendable={token.sendable}
                  unconfirmed={token.unconfirmed}
                  coins={token.coins}
                  decimals={token.decimals}
                  type={token.type}
                  icon={token.icon}
                  webvalidate={token.webvalidate}
                  description={token.description}
                  onClick={() => onSelectToken?.(token)}
                />
              ))}
            </div>
          );
        })()}

      </Card>


    </div>
    </div>
  );
}
