import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, StatusPill } from '../../components/atoms';
import '../../theme/axia-tokens.css';

interface TokenLimit {
  tokenId: string;
  tokenSymbol: string;
  maxAmountPerTx: string;
  maxDailyAmount: string;
  dailyUsed: string;
  lastResetDate: string;
}

interface TransactionPermissions {
  grantedAt: number;
  expiresAt: number;
  allowedIntents: string[];
  tokenLimits: TokenLimit[];
  totalTransactions: number;
  lastTransactionAt?: number;
}

type CapacityLevel = 'ok' | 'warning' | 'critical' | 'exhausted';

interface SignatureCapacity {
  used: number;
  total: number;
  remaining: number;
  percentage: number;
  level: CapacityLevel;
}

interface ConnectedSite {
  origin: string;
  addressIndex: number;
  minimaAddress: string;
  connectedAt: number;
  lastUsedAt: number;
  permissions: {
    canConnect: boolean;
    canVerify: boolean;
    canRequestSignature: boolean;
    canSendTransaction: boolean;
  };
  transactionPermissions?: TransactionPermissions;
  capacity?: SignatureCapacity;
}

const CAPACITY_COPY: Record<CapacityLevel, { title: string; body: string; color: string; pill: 'warning' | 'failed' } | null> = {
  ok: null,
  warning: {
    title: 'Address running low on signatures',
    body: 'This address has used over 80% of its one-time signatures. Consider rotating to a different address for this dApp.',
    color: 'var(--color-warning, #f59e0b)',
    pill: 'warning',
  },
  critical: {
    title: 'Address almost out of signatures',
    body: 'This address is over 95% used. Switch to another address or generate a new one before signing again.',
    color: 'var(--color-danger, #ef4444)',
    pill: 'failed',
  },
  exhausted: {
    title: 'Address has no signatures left',
    body: 'This address has no remaining one-time signatures. Switch to another address or generate a new one — it can no longer sign.',
    color: 'var(--color-danger, #ef4444)',
    pill: 'failed',
  },
};

interface ConnectedSitesProps {
  onBack: () => void;
}

export function ConnectedSites({ onBack }: ConnectedSitesProps) {
  const [sites, setSites] = useState<ConnectedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [activeAccountIndex, setActiveAccountIndex] = useState<number>(0);

  useEffect(() => {
    loadSites();
    chrome.storage.local.get(['selectedAccountIndex'], (result) => {
      setActiveAccountIndex(result.selectedAccountIndex ?? 0);
    });
  }, []);

  const loadSites = async () => {
    try {
      setLoading(true);
      const response = await chrome.runtime.sendMessage({
        method: 'GET_CONNECTED_SITES',
        id: Date.now().toString(),
      });
      if (response?.result) {
        setSites(response.result);
      }
    } catch (error) {
      console.error('[ConnectedSites] Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (origin: string) => {
    if (!confirm(`Disconnect ${getDomain(origin)}? This site will need to reconnect to access your wallet.`)) return;
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'DISCONNECT_SITE',
        params: { origin },
        id: Date.now().toString(),
      });
      if (response?.error) { alert(`Failed to disconnect: ${response.error}`); return; }
      if (expandedSite === origin) setExpandedSite(null);
      setSites(sites.filter((s) => s.origin !== origin));
    } catch (error) {
      console.error('[ConnectedSites] Disconnect failed:', error);
      alert('Failed to disconnect site. Please try again.');
    }
  };

  const handleRevokeTransactions = async (origin: string) => {
    if (!confirm(`Revoke transaction permissions for ${getDomain(origin)}?`)) return;
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'TOTEM_REVOKE_TX_PERMISSION',
        params: { origin },
        id: Date.now().toString(),
      });
      if (response?.error) { alert(`Failed to revoke permissions: ${response.error}`); return; }
      await loadSites();
    } catch (error) {
      console.error('[ConnectedSites] Revoke failed:', error);
      alert('Failed to revoke permissions. Please try again.');
    }
  };

  const handleDisconnectAll = async () => {
    if (!confirm('Disconnect all sites? All sites will need to reconnect.')) return;
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'DISCONNECT_ALL_SITES',
        id: Date.now().toString(),
      });
      if (response?.error) { alert(`Failed to disconnect all sites: ${response.error}`); return; }
      setExpandedSite(null);
      setSites([]);
    } catch (error) {
      console.error('[ConnectedSites] Disconnect all failed:', error);
      alert('Failed to disconnect all sites. Please try again.');
    }
  };

  const getDomain = (origin: string): string => {
    try { return new URL(origin).hostname; } catch { return origin; }
  };

  const formatDate = (timestamp: number): string =>
    new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const formatAddress = (address: string): string =>
    address.length > 16 ? `${address.slice(0, 10)}...${address.slice(-6)}` : address;

  const isExpired = (expiresAt: number): boolean => Date.now() > expiresAt;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Fixed header */}
      <div style={{
        padding: 'var(--space-2)',
        borderBottom: '2px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        flexShrink: 0,
        background: 'var(--bg-base)',
      }}>
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <Typography variant="h3" uppercase>Connected Sites</Typography>
      </div>

      {/* Scrollable body */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: 'var(--space-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}>

        {loading ? (
          <Card>
            <Typography variant="caption" color="muted">Loading...</Typography>
          </Card>
        ) : sites.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 'var(--space-3) 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '2px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Typography variant="body" color="muted" style={{ fontSize: '20px' }}>⬡</Typography>
              </div>
              <Typography variant="body" uppercase color="muted">No connected sites</Typography>
              <Typography variant="caption" color="muted">
                Sites appear here when you connect your wallet to dApps
              </Typography>
            </div>
          </Card>
        ) : (
          <>
            {sites.map((site) => {
              const isActive = site.addressIndex === activeAccountIndex;
              const expanded = expandedSite === site.origin;
              const txPerm = site.transactionPermissions;
              const txActive = site.permissions.canSendTransaction && txPerm && !isExpired(txPerm.expiresAt);
              const txExpired = site.permissions.canSendTransaction && txPerm && isExpired(txPerm.expiresAt);

              return (
                <Card
                  key={site.origin}
                  style={isActive ? { borderColor: 'var(--axia-aqua)' } : undefined}
                >
                  {/* Clickable header row */}
                  <div
                    onClick={() => setExpandedSite(expanded ? null : site.origin)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div>
                      <Typography variant="body" bold uppercase>
                        {getDomain(site.origin)}
                      </Typography>
                      <Typography variant="caption" color="muted" style={{ marginTop: '2px', display: 'block' }}>
                        Connected {formatDate(site.connectedAt)}
                      </Typography>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                      <StatusPill variant={isActive ? 'info' : 'neutral'} size="sm">
                        #{site.addressIndex + 1}
                      </StatusPill>
                      {txActive && <StatusPill variant="success" size="sm">TX</StatusPill>}
                      {txExpired && <StatusPill variant="warning" size="sm">TX Expired</StatusPill>}
                      {site.capacity && CAPACITY_COPY[site.capacity.level] && (
                        <StatusPill variant={CAPACITY_COPY[site.capacity.level]!.pill} size="sm">
                          {site.capacity.level === 'exhausted' ? 'No sigs' : 'Low sigs'}
                        </StatusPill>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '2px' }}>
                        {expanded ? '▴' : '▾'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div style={{
                      borderTop: '1px solid var(--border-subtle)',
                      marginTop: 'var(--space-2)',
                      paddingTop: 'var(--space-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                    }}>
                      {site.capacity && CAPACITY_COPY[site.capacity.level] && (
                        <div
                          data-testid="capacity-warning"
                          style={{
                            border: `1px solid ${CAPACITY_COPY[site.capacity.level]!.color}`,
                            background: site.capacity.level === 'warning'
                              ? 'rgba(245, 158, 11, 0.08)'
                              : 'rgba(239, 68, 68, 0.08)',
                            padding: 'var(--space-1) var(--space-1-5)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <Typography
                            variant="caption"
                            uppercase
                            bold
                            style={{ color: CAPACITY_COPY[site.capacity.level]!.color }}
                          >
                            ⚠ {CAPACITY_COPY[site.capacity.level]!.title}
                          </Typography>
                          <Typography variant="caption" color="muted" style={{ lineHeight: 1.4 }}>
                            {CAPACITY_COPY[site.capacity.level]!.body}
                          </Typography>
                          <Typography
                            variant="caption"
                            mono
                            style={{ color: CAPACITY_COPY[site.capacity.level]!.color }}
                          >
                            {site.capacity.used.toLocaleString()} / {site.capacity.total.toLocaleString()} used
                            {' '}({site.capacity.percentage.toFixed(1)}%) — {site.capacity.remaining.toLocaleString()} remaining
                          </Typography>
                        </div>
                      )}

                      {/* Address + last used */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="muted" uppercase>Address</Typography>
                          <Typography variant="caption" mono>{formatAddress(site.minimaAddress)}</Typography>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="muted" uppercase>Last used</Typography>
                          <Typography variant="caption" mono>{formatDate(site.lastUsedAt)}</Typography>
                        </div>
                      </div>

                      {/* Permissions */}
                      <div>
                        <Typography variant="caption" color="muted" uppercase style={{ display: 'block', marginBottom: 'var(--space-1)' }}>
                          Permissions
                        </Typography>
                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                          {site.permissions.canConnect && (
                            <StatusPill variant="info" size="sm">Connect</StatusPill>
                          )}
                          {site.permissions.canVerify && (
                            <StatusPill variant="info" size="sm">Verify</StatusPill>
                          )}
                          {site.permissions.canRequestSignature && (
                            <StatusPill variant="info" size="sm">Sign</StatusPill>
                          )}
                          {site.permissions.canSendTransaction && (
                            <StatusPill variant={txActive ? 'success' : 'warning'} size="sm">
                              Transactions
                            </StatusPill>
                          )}
                        </div>
                      </div>

                      {/* TX stats */}
                      {txPerm && (
                        <div style={{
                          padding: 'var(--space-1) var(--space-1-5)',
                          background: 'var(--bg-inset, rgba(0,0,0,0.2))',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}>
                          <Typography variant="caption" uppercase bold style={{ display: 'block' }}>
                            Transaction Stats
                          </Typography>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="muted">Total</Typography>
                            <Typography variant="caption" mono>{txPerm.totalTransactions} txns</Typography>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="muted">Expires</Typography>
                            <Typography variant="caption" mono style={isExpired(txPerm.expiresAt) ? { color: 'var(--color-danger)' } : {}}>
                              {formatDate(txPerm.expiresAt)}{isExpired(txPerm.expiresAt) ? ' (expired)' : ''}
                            </Typography>
                          </div>
                          {txPerm.tokenLimits.length > 0 && txPerm.tokenLimits.map((limit) => (
                            <div key={limit.tokenId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="muted">{limit.tokenSymbol}</Typography>
                              <Typography variant="caption" mono>{limit.dailyUsed}/{limit.maxDailyAmount} daily</Typography>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                        {site.permissions.canSendTransaction && txPerm && (
                          <Button
                            variant="secondary"
                            size="sm"
                            style={{ flex: 1 }}
                            onClick={(e) => { e.stopPropagation(); handleRevokeTransactions(site.origin); }}
                          >
                            Revoke TX
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          style={{ flex: 1 }}
                          onClick={(e) => { e.stopPropagation(); handleDisconnect(site.origin); }}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            <Button variant="danger" fullWidth onClick={handleDisconnectAll}>
              Disconnect All Sites
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
