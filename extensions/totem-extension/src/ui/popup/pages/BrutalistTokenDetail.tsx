import React, { useState, useEffect } from 'react';
import { Card, Typography, Button } from '../../components/atoms';
import { ReceiveModal } from '../../components/molecules';
import { formatAmount, parseTokenImageUrl } from '../../../constants';
import { NavTab } from '../../components/organisms';
import { getApiBase, getProjectId } from '../../../core/api/base';
import '../../theme/axia-tokens.css';

export interface TokenDetailData {
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
  type?: string;
  decimals?: number;
  webvalidate?: string;
  owner?: string;
  description?: string;
  mintBlock?: number;
}

interface BrutalistTokenDetailProps {
  token: TokenDetailData;
  onNavigate: (tab: NavTab) => void;
  onSendToken: (token: TokenDetailData) => void;
  onBack: () => void;
}

type VintageTier = 'GENESIS' | 'SPARTACUS' | 'REX' | 'OG' | 'PIONEER' | 'EXPLORER' | 'FRONTIER';

const VINTAGE_META: Record<VintageTier, { label: string; color: string; period: string }> = {
  GENESIS:   { label: 'GENESIS',   color: '#9B59B6', period: 'Q1–Q2 2023' },
  SPARTACUS: { label: 'SPARTACUS', color: '#FFD700', period: 'Q3–Q4 2023' },
  REX:       { label: 'REX',       color: '#00D9B5', period: 'H1 2024'    },
  OG:        { label: 'OG',        color: '#00FF88', period: 'H2 2024'    },
  PIONEER:   { label: 'PIONEER',   color: '#6C8EF5', period: '2025'       },
  EXPLORER:  { label: 'EXPLORER',  color: '#C0C0C0', period: '2026'       },
  FRONTIER:  { label: 'FRONTIER',  color: 'var(--text-muted)', period: '2027+' },
};

function getVintageBadge(ts: number): VintageTier {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = d.getMonth();
  if (y < 2023 || (y === 2023 && m <= 5)) return 'GENESIS';
  if (y === 2023)                          return 'SPARTACUS';
  if (y === 2024 && m <= 5)                return 'REX';
  if (y === 2024)                          return 'OG';
  if (y === 2025)                          return 'PIONEER';
  if (y === 2026)                          return 'EXPLORER';
  return 'FRONTIER';
}

const ANCHOR_BLOCK = 1_977_800;
const ANCHOR_TIME_MS = 1_772_640_000_000;
const AVG_BLOCK_MS = 64_000;

function estimateMintTimestamp(mintBlock: number): number {
  return ANCHOR_TIME_MS - (ANCHOR_BLOCK - mintBlock) * AVG_BLOCK_MS;
}

export function BrutalistTokenDetail({ token, onNavigate, onSendToken, onBack }: BrutalistTokenDetailProps) {
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedOwner, setCopiedOwner] = useState(false);

  const isMinima = token.tokenId === '0x00';
  const isNFT = !isMinima && (token.decimals === 0 || token.type === 'NFT');
  const isVerified = !!token.webvalidate;
  const displayName = token.ticker || token.tokenName;
  const hasUnconfirmed = token.unconfirmed && token.unconfirmed !== '0';
  const formattedBalance = formatAmount(token.balance, 8);
  const formattedSendable = token.sendable ? formatAmount(token.sendable, 8) : formattedBalance;
  const formattedUnconfirmed = hasUnconfirmed ? formatAmount(token.unconfirmed!, 4) : null;

  const initialArtworkUrl = parseTokenImageUrl(token.icon) || parseTokenImageUrl(token.url);
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>(initialArtworkUrl);
  const [artworkLoading, setArtworkLoading] = useState(isNFT && !initialArtworkUrl);
  const [artworkError, setArtworkError] = useState(false);
  const [artworkSrc, setArtworkSrc] = useState<string | undefined>(undefined);
  const [totalSupply, setTotalSupply] = useState<string | undefined>(
    token.total && parseFloat(token.total) > 0 ? token.total : undefined
  );
  const [mintBlock, setMintBlock] = useState<number | null>(token.mintBlock ?? null);
  const [mintTimestamp, setMintTimestamp] = useState<number | null>(
    token.mintBlock ? estimateMintTimestamp(token.mintBlock) : null
  );

  useEffect(() => {
    const loadAddress = async () => {
      try {
        const stored = await chrome.storage.local.get('walletAddresses');
        if (stored.walletAddresses?.length > 0) {
          setCurrentAddress(stored.walletAddresses[0].address);
        }
      } catch (e) {
        console.warn('[TokenDetail] Failed to load address:', e);
      }
    };
    loadAddress();
  }, []);

  useEffect(() => {
    if (!artworkUrl) {
      setArtworkSrc(undefined);
      return;
    }
    if (!artworkUrl.startsWith('data:')) {
      setArtworkSrc(artworkUrl);
      return;
    }
    let objectUrl: string | undefined;
    try {
      const commaIdx = artworkUrl.indexOf(',');
      const header = artworkUrl.slice(0, commaIdx);
      const base64 = artworkUrl.slice(commaIdx + 1);
      const mime = header.split(':')[1]?.split(';')[0] || 'image/jpeg';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      objectUrl = URL.createObjectURL(blob);
      setArtworkSrc(objectUrl);
    } catch {
      setArtworkSrc(artworkUrl);
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [artworkUrl]);

  useEffect(() => {
    if (!isNFT) return;

    let cancelled = false;

    const fetchMetadata = async () => {
      try {
        const [apiBase, projectId] = await Promise.all([getApiBase(), getProjectId()]);
        const headers = { 'x-api-key': projectId };
        const res = await fetch(
          `${apiBase}/v1/wallet/tokens/${encodeURIComponent(token.tokenId)}/metadata`,
          { headers }
        );
        if (!res.ok) return;
        const meta = await res.json();
        if (cancelled) return;
        if (meta.url) {
          const parsed = parseTokenImageUrl(meta.url);
          if (parsed) setArtworkUrl(parsed);
        }
        if (meta.totalSupply) setTotalSupply(meta.totalSupply);
      } catch {
      } finally {
        if (!cancelled) setArtworkLoading(false);
      }
    };

    fetchMetadata();
    return () => { cancelled = true; };
  }, [isNFT, token.tokenId]);

  const handleCopyTokenId = async () => {
    try {
      await navigator.clipboard.writeText(token.tokenId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('[TokenDetail] Copy failed:', e);
    }
  };

  const handleCopyOwner = async () => {
    if (!token.owner) return;
    try {
      await navigator.clipboard.writeText(token.owner);
      setCopiedOwner(true);
      setTimeout(() => setCopiedOwner(false), 2000);
    } catch (e) {
      console.error('[TokenDetail] Copy owner failed:', e);
    }
  };

  const handleSend = () => onSendToken(token);

  if (isNFT) {
    const editionsOwned = parseInt(token.balance || '0', 10);
    const supplyNum = totalSupply ? parseInt(totalSupply, 10) : undefined;
    const isOneOfOne = supplyNum === 1;
    const rarityLabel = !supplyNum      ? undefined
                      : supplyNum === 1  ? 'UNIQUE'
                      : supplyNum <= 10  ? 'ULTRA RARE'
                      : supplyNum <= 100 ? 'RARE'
                      : supplyNum <= 1000? 'LIMITED EDITION'
                      : 'OPEN EDITION';
    const vintageTier = mintTimestamp ? getVintageBadge(mintTimestamp) : null;
    const vintage = vintageTier ? VINTAGE_META[vintageTier] : null;
    const mintDateLabel = mintTimestamp
      ? new Date(mintTimestamp).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null;
    const verifiedDomain = token.webvalidate
      ? (() => { try { return new URL(token.webvalidate!).hostname; } catch { return token.webvalidate; } })()
      : null;

    return (
      <div style={{ height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        <div style={{ position: 'relative', width: '100%', height: '260px', flexShrink: 0, background: '#000', overflow: 'hidden' }}>
          {(artworkLoading || (artworkUrl && !artworkSrc && !artworkError)) && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%)',
              backgroundSize: '200% 100%',
              animation: 'nftShimmer 1.5s ease-in-out infinite',
            }} />
          )}
          {artworkSrc && !artworkError ? (
            <img
              src={artworkSrc}
              alt={displayName}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              onError={() => setArtworkError(true)}
            />
          ) : (!artworkLoading && !(artworkUrl && !artworkSrc) && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: '8px',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                No Artwork
              </span>
            </div>
          ))}

          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}>
            <button onClick={onBack} style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.9)', cursor: 'pointer',
              padding: '4px 10px', borderRadius: '3px',
              fontFamily: 'var(--font-family)', fontSize: '11px',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              ← Back
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {vintage && (
                <span
                  title={vintage.period}
                  style={{
                    fontSize: '9px', fontWeight: 700, padding: '3px 7px',
                    borderRadius: '2px', letterSpacing: '0.08em',
                    background: `rgba(${hexToRgb(vintage.color)}, 0.18)`,
                    border: `1px solid ${vintage.color}`,
                    color: vintage.color,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {vintage.label}
                </span>
              )}
              {rarityLabel && (
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '3px 7px',
                  borderRadius: '2px', letterSpacing: '0.08em',
                  background: 'rgba(0, 217, 181, 0.15)',
                  border: '1px solid rgba(0, 217, 181, 0.5)',
                  color: '#00D9B5',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {rarityLabel}
                </span>
              )}
              {isVerified && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#00FF88" stroke="none" aria-label="Verified">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 12px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
              <Typography variant="h2" color="primary" bold style={{ fontSize: 'var(--text-xl)', lineHeight: 1.2 }}>
                {displayName}
              </Typography>
              <span style={{
                fontSize: '9px', fontWeight: 700, padding: '2px 6px',
                border: '1px solid var(--text-muted)', color: 'var(--text-muted)',
                borderRadius: '2px', letterSpacing: '0.05em', flexShrink: 0,
              }}>NFT</span>
            </div>
            {token.ticker && token.ticker !== token.tokenName && (
              <Typography variant="caption" color="muted" style={{ marginTop: '2px' }}>
                {token.tokenName}
              </Typography>
            )}
          </div>

          <div style={{ padding: '0 12px 8px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(0, 217, 181, 0.06)',
              border: '1px solid rgba(0, 217, 181, 0.35)',
              borderRadius: '3px',
            }}>
              {isOneOfOne ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
                  <span style={{ color: '#FFD700', fontSize: '16px' }}>◈</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                    color: '#FFD700', fontWeight: 700, letterSpacing: '0.1em',
                  }}>ONE OF ONE</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ color: '#00D9B5', fontSize: '14px' }}>◈</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)', fontWeight: 700 }}>
                      {editionsOwned}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                      / {supplyNum != null ? supplyNum : '?'} editions
                    </span>
                  </div>
                  {rarityLabel && (
                    <span style={{
                      fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      {rarityLabel}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Button variant="primary" size="md" fullWidth onClick={() => setShowReceiveModal(true)}>
              ↓ Receive
            </Button>
            <Button variant="secondary" size="md" fullWidth onClick={handleSend}>
              ↑ Send
            </Button>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0 12px' }} />

          <div style={{ padding: '8px 0' }}>
            {mintBlock != null && (
              <NftMetaRow label="VINTAGE">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {vintage && (
                    <span style={{
                      fontSize: '9px', fontWeight: 700, padding: '2px 5px',
                      borderRadius: '2px', letterSpacing: '0.08em',
                      background: `rgba(${hexToRgb(vintage.color)}, 0.15)`,
                      border: `1px solid ${vintage.color}`,
                      color: vintage.color,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {vintage.label}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    Block #{mintBlock.toLocaleString()}{mintDateLabel ? ` · ${mintDateLabel}` : ''}
                  </span>
                </div>
              </NftMetaRow>
            )}

            {token.description && (
              <NftMetaRow label="DESCRIPTION">
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {token.description}
                </span>
              </NftMetaRow>
            )}

            {token.owner && (
              <NftMetaRow label="CREATOR">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px',
                  }}>
                    {token.owner}
                  </span>
                  <button onClick={handleCopyOwner} style={{
                    background: 'none', border: 'none', flexShrink: 0,
                    color: copiedOwner ? 'var(--minima-green)' : 'var(--text-muted)',
                    cursor: 'pointer', padding: '2px', fontSize: '11px',
                  }}>
                    {copiedOwner ? '✓' : '⧉'}
                  </button>
                </div>
              </NftMetaRow>
            )}

            {verifiedDomain && (
              <NftMetaRow label="VERIFIED BY">
                <a
                  href={token.webvalidate}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 'var(--text-xs)', color: 'var(--minima-green)',
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px',
                  }}
                >
                  {verifiedDomain}
                  <span style={{ fontSize: '9px', opacity: 0.7 }}>↗</span>
                </a>
              </NftMetaRow>
            )}

            {token.coins != null && token.coins > 1 && (
              <NftMetaRow label="COINS">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {token.coins} UTXOs
                </span>
              </NftMetaRow>
            )}

            <NftMetaRow label="TOKEN ID">
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px',
                }}>
                  {token.tokenId}
                </span>
                <button onClick={handleCopyTokenId} style={{
                  background: 'none', border: 'none', flexShrink: 0,
                  color: copied ? 'var(--minima-green)' : 'var(--text-muted)',
                  cursor: 'pointer', padding: '2px', fontSize: '11px',
                }}>
                  {copied ? '✓' : '⧉'}
                </button>
              </div>
            </NftMetaRow>
          </div>
        </div>

        <style>{`
          @keyframes nftShimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>

        {showReceiveModal && currentAddress && (
          <ReceiveModal address={currentAddress} onClose={() => setShowReceiveModal(false)} />
        )}
      </div>
    );
  }

  return (
    <div style={{
      height: '100%', minHeight: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flex: 1, minHeight: 0, padding: 'var(--space-2)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-half)',
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', padding: 'var(--space-half) 0',
            fontFamily: 'var(--font-family)', fontSize: 'var(--text-sm)',
            textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)',
          }}
        >
          <span style={{ fontSize: '16px' }}>←</span> Back
        </button>

        <Card padding="none">
          <div style={{
            padding: 'var(--space-3)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 'var(--space-2)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: 'var(--radius-sm)',
              border: `2px solid ${isMinima ? 'var(--minima-green)' : 'var(--border-default)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMinima ? 'rgba(0, 255, 136, 0.08)' : 'var(--bg-subtle)',
              fontSize: '24px', fontWeight: 700,
              color: isMinima ? 'var(--minima-green)' : 'var(--text-muted)',
              overflow: 'hidden', position: 'relative',
            }}>
              {isMinima ? 'M' : displayName.charAt(0).toUpperCase()}
              {parseTokenImageUrl(token.icon) && (
                <img
                  src={parseTokenImageUrl(token.icon)!}
                  alt={displayName}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Typography variant="h2" color="primary" bold style={{ fontSize: 'var(--text-xl)' }}>
                  {displayName}
                </Typography>
                {isVerified && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--minima-green)" stroke="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
              </div>
              {token.ticker && token.ticker !== token.tokenName && (
                <Typography variant="caption" color="muted" style={{ marginTop: '2px' }}>
                  {token.tokenName}
                </Typography>
              )}
            </div>
          </div>

          <div style={{
            padding: 'var(--space-3)', textAlign: 'center',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <Typography variant="caption" color="muted" uppercase style={{ marginBottom: 'var(--space-half)' }}>
              Balance
            </Typography>
            <Typography variant="h2" color="primary" mono bold style={{ fontSize: 'var(--text-2xl)' }}>
              {formattedBalance}
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-1-5)' }}>
              <div>
                <Typography variant="caption" color="muted" uppercase style={{ fontSize: '9px' }}>Sendable</Typography>
                <Typography variant="body" color="secondary" mono style={{ fontSize: 'var(--text-sm)' }}>
                  {formattedSendable}
                </Typography>
              </div>
              {hasUnconfirmed && (
                <div>
                  <Typography variant="caption" color="muted" uppercase style={{ fontSize: '9px' }}>Pending</Typography>
                  <Typography variant="body" color="warning" mono style={{ fontSize: 'var(--text-sm)' }}>
                    +{formattedUnconfirmed}
                  </Typography>
                </div>
              )}
              {token.coins !== undefined && token.coins > 0 && (
                <div>
                  <Typography variant="caption" color="muted" uppercase style={{ fontSize: '9px' }}>Coins</Typography>
                  <Typography variant="body" color="secondary" mono style={{ fontSize: 'var(--text-sm)' }}>
                    {token.coins}
                  </Typography>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-1-5)', padding: 'var(--space-2)' }}>
            <Button variant="primary" size="md" fullWidth onClick={() => setShowReceiveModal(true)}>
              ↓ Receive
            </Button>
            <Button variant="secondary" size="md" fullWidth onClick={handleSend}>
              ↑ Send
            </Button>
          </div>
        </Card>

        <Card padding="none">
          <div style={{ padding: 'var(--space-1-5)', borderBottom: '1px solid var(--border-subtle)' }}>
            <Typography variant="caption" color="muted" uppercase bold>Token Details</Typography>
          </div>
          <div style={{ padding: 0 }}>
            <DetailRow label="Token ID" value={token.tokenId} mono truncate onCopy={handleCopyTokenId} copied={copied} />
            <DetailRow label="Type" value={isMinima ? 'Native' : 'Standard Token'} />
            {token.description && <DetailRow label="Description" value={token.description} />}
            {token.webvalidate && <DetailRow label="Verified" value={token.webvalidate} mono truncate />}
            {token.owner && <DetailRow label="Owner" value={token.owner} mono truncate />}
          </div>
        </Card>

        {showReceiveModal && currentAddress && (
          <ReceiveModal address={currentAddress} onClose={() => setShowReceiveModal(false)} />
        )}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  if (hex.startsWith('var(')) return '128,128,128';
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '128,128,128';
  return `${r},${g},${b}`;
}

function NftMetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
      gap: '12px',
    }}>
      <span style={{
        fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, justifyContent: 'flex-end' }}>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, truncate, onCopy, copied }: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 'var(--space-1) var(--space-1-5)',
      borderBottom: '1px solid var(--border-subtle)', gap: 'var(--space-2)',
    }}>
      <Typography variant="caption" color="muted" uppercase style={{ flexShrink: 0, fontSize: '10px' }}>
        {label}
      </Typography>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-half)', minWidth: 0 }}>
        <Typography
          variant="body" color="secondary" mono={mono}
          style={{
            fontSize: 'var(--text-xs)', textAlign: 'right',
            ...(truncate ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: '180px' } : {}),
          }}
        >
          {value}
        </Typography>
        {onCopy && (
          <button onClick={onCopy} style={{
            background: 'none', border: 'none',
            color: copied ? 'var(--minima-green)' : 'var(--text-muted)',
            cursor: 'pointer', padding: '2px', fontSize: '11px', flexShrink: 0,
          }}>
            {copied ? '✓' : '⧉'}
          </button>
        )}
      </div>
    </div>
  );
}
