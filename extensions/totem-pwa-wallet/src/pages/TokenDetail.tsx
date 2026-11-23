/**
 * Token detail — the page behind a Home row.
 *
 * Tokens and NFTs share one page: a large hero artwork (NFTs render the full
 * media instead of a cropped thumbnail), balance, send/receive, and the
 * token's economics — id, author/owner, creation date, max supply, decimals,
 * description, website and verification.
 *
 * Creation date and max supply come from the node's own token descriptor
 * (`/v1/wallet/coins` → `token.created` / `token.total`). The archive index is
 * not consulted for these because it deliberately stores display fields only.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../core/WalletContext';
import {
  fetchHeldCoins,
  fetchPortfolio,
  fetchTokenVintage,
  type HeldCoin,
  type TokenVintage,
} from '../core/api';
import type { PortfolioEntry } from '@totemsdk/realtime';
import { formatAmount } from '../core/format';
import { parseTokenImageUrl, tokenArtwork } from '../core/tokenImage';

type VintageTier = 'GENESIS' | 'SPARTACUS' | 'REX' | 'OG' | 'PIONEER' | 'EXPLORER' | 'FRONTIER';

const VINTAGE_META: Record<VintageTier, { label: string; color: string; period: string }> = {
  GENESIS:   { label: 'GENESIS',   color: '#9B59B6', period: 'Q1–Q2 2023' },
  SPARTACUS: { label: 'SPARTACUS', color: '#FFD700', period: 'Q3–Q4 2023' },
  REX:       { label: 'REX',       color: '#00D9B5', period: 'H1 2024' },
  OG:        { label: 'OG',        color: '#00FF88', period: 'H2 2024' },
  PIONEER:   { label: 'PIONEER',   color: '#6C8EF5', period: '2025' },
  EXPLORER:  { label: 'EXPLORER',  color: '#C0C0C0', period: '2026' },
  FRONTIER:  { label: 'FRONTIER',  color: 'var(--text-muted)', period: '2027+' },
};

const ANCHOR_BLOCK = 1_977_800;
const ANCHOR_TIME_MS = 1_772_640_000_000;
const AVG_BLOCK_MS = 64_000;

function estimateMintTimestamp(mintBlock: number): number {
  return ANCHOR_TIME_MS - (ANCHOR_BLOCK - mintBlock) * AVG_BLOCK_MS;
}

function getVintageTier(ts: number): VintageTier {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = d.getMonth();
  if (y < 2023 || (y === 2023 && m <= 5)) return 'GENESIS';
  if (y === 2023) return 'SPARTACUS';
  if (y === 2024 && m <= 5) return 'REX';
  if (y === 2024) return 'OG';
  if (y === 2025) return 'PIONEER';
  if (y === 2026) return 'EXPLORER';
  return 'FRONTIER';
}

function parseDocument(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function MetaRow({ label, value, mono, copy, copied }: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: string;
  copied?: string | null;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="label" style={{ marginBottom: 0 }}>{label}</span>
      <span
        role={copy ? 'button' : undefined}
        tabIndex={copy ? 0 : undefined}
        onClick={copy ? () => void navigator.clipboard.writeText(copy) : undefined}
        onKeyDown={copy ? (e) => { if (e.key === 'Enter' || e.key === ' ') void navigator.clipboard.writeText(copy); } : undefined}
        title={copy ? `${copy} — click to copy` : value}
        style={{
          fontSize: 'var(--text-xs)',
          fontFamily: mono ? 'var(--font-family-mono)' : 'inherit',
          textAlign: 'right',
          overflowWrap: 'anywhere',
          cursor: copy ? 'copy' : 'default',
          color: 'var(--text-primary)',
          maxWidth: '62%',
        }}
      >
        {copied === copy ? 'copied' : value}
      </span>
    </div>
  );
}

export function TokenDetail() {
  const { activeAccount, session, selectedTokenId, closeToken, setRoute, setPendingSendTokenId } = useWallet();
  const [entry, setEntry] = useState<PortfolioEntry | null>(null);
  const [heldCoins, setHeldCoins] = useState<HeldCoin[]>([]);
  const [vintage, setVintage] = useState<TokenVintage | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [artFailed, setArtFailed] = useState(false);

  const tokenId = selectedTokenId ?? '';
  const addresses = useMemo(() => {
    const list = (session?.accounts ?? []).map((a) => a.address).filter(Boolean);
    if (activeAccount?.address && !list.includes(activeAccount.address)) list.push(activeAccount.address);
    return list;
  }, [session?.accounts, activeAccount?.address]);

  useEffect(() => {
    if (!activeAccount || !selectedTokenId) return;
    let active = true;
    setLoading(true);

    Promise.all([
      fetchPortfolio(activeAccount.address, session?.identityHash),
      fetchHeldCoins(addresses),
    ])
      .then(([entries, coins]) => {
        if (!active) return;
        setEntry(entries.find((e) => e.tokenid.toLowerCase() === selectedTokenId.toLowerCase()) ?? null);
        setHeldCoins(coins);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });

    if (selectedTokenId !== '0x00') {
      fetchTokenVintage(selectedTokenId).then((v) => { if (active) setVintage(v); }).catch(() => undefined);
    }

    return () => { active = false; };
  }, [activeAccount?.address, session?.identityHash, selectedTokenId, addresses.join('|')]);

  const tokenCoin = useMemo(
    () => heldCoins.find((c) => c.tokenId?.toLowerCase() === tokenId.toLowerCase() && c.token?.tokenid),
    [heldCoins, tokenId]
  );
  const descriptor = tokenCoin?.token;

  const document = useMemo(() => parseDocument(descriptor?.name), [descriptor?.name]);

  const art = useMemo(() => {
    if (artFailed) return undefined;
    const fromEntry = entry ? tokenArtwork(entry) : undefined;
    if (fromEntry) return fromEntry;
    const docUrl = typeof document.url === 'string' ? document.url : undefined;
    const docIcon = typeof document.icon === 'string' ? document.icon : undefined;
    const docArt = typeof document.artimage === 'string' ? document.artimage : undefined;
    return parseTokenImageUrl(docIcon) || parseTokenImageUrl(docUrl) || parseTokenImageUrl(docArt);
  }, [entry, document, artFailed]);

  const isNft = entry?.kind === 'nft' || (descriptor?.decimals === 0 && tokenId !== '0x00');
  const isNative = !selectedTokenId || selectedTokenId === '0x00';
  const name =
    entry?.ticker ||
    entry?.name ||
    (typeof document.ticker === 'string' && document.ticker) ||
    (typeof document.name === 'string' && document.name) ||
    (tokenId ? tokenId.slice(0, 12) : 'Token');
  const description =
    entry?.description ||
    (typeof document.description === 'string' && document.description) ||
    '';
  const author =
    entry?.owner ||
    (typeof document.owner === 'string' && document.owner) ||
    (typeof document.author === 'string' && document.author) ||
    '';
  const website =
    entry?.url && !entry.url.startsWith('<artimage>')
      ? entry.url
      : typeof document.external_url === 'string'
        ? document.external_url
        : '';
  const verified = !!entry?.webvalidate;

  const createdBlock = useMemo(() => {
    const raw = descriptor?.created ?? vintage?.mintBlock;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [descriptor?.created, vintage?.mintBlock]);

  const mintTimestamp =
    vintage?.mintTimestamp ??
    (createdBlock != null ? estimateMintTimestamp(createdBlock) : null);
  const vintageMeta = mintTimestamp ? VINTAGE_META[getVintageTier(mintTimestamp)] : null;

  const maxSupply = descriptor?.total ?? undefined;
  const decimals = entry?.decimals ?? descriptor?.decimals;

  // Wallet-wide holding of this token, summed across accounts.
  const heldBalance = useMemo(() => {
    const coins = heldCoins.filter((c) => c.tokenId?.toLowerCase() === tokenId.toLowerCase());
    if (coins.length === 0) return entry?.confirmed ?? '0';
    const total = coins.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    return Number.isFinite(total) ? String(total) : (entry?.confirmed ?? '0');
  }, [heldCoins, tokenId, entry?.confirmed]);

  const fmtSupply = (raw?: string) => {
    if (raw === undefined || raw === null || raw === '') return '—';
    const n = Number(raw);
    if (!Number.isFinite(n)) return String(raw);
    return n.toLocaleString('en-GB', { maximumFractionDigits: 8 });
  };

  return (
    <div className="page">
      <button className="btn btn-sm btn-secondary" onClick={closeToken} style={{ marginBottom: 'var(--space-2)' }}>
        ← Wallet
      </button>

      {loading && !entry && (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
          <span className="spinner" />
        </div>
      )}

      {/* Hero artwork — NFTs get the full media, not a cropped chip. */}
      {!isNative && art && (
        <div
          style={{
            width: '100%',
            background: '#08090c',
            border: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            minHeight: isNft ? 280 : 160,
            maxHeight: isNft ? 420 : 220,
          }}
        >
          <img
            src={art}
            alt={name}
            onError={() => setArtFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              maxHeight: isNft ? 420 : 220,
              objectFit: isNft ? 'contain' : 'cover',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <span
            style={{
              width: 56,
              height: 56,
              flexShrink: 0,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {isNft ? '▣' : name.charAt(0).toUpperCase()}
            {art && (
              <img
                src={art}
                alt={name}
                onError={() => setArtFailed(true)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </span>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </span>
              {isNft && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', border: '1px solid var(--text-muted)', color: 'var(--text-muted)' }}>
                  NFT
                </span>
              )}
              {verified && (
                <span title={`Verified by ${entry?.webvalidate}`} style={{ color: 'var(--minima-green, var(--axia-aqua))', fontSize: 14 }}>★</span>
              )}
            </div>
            {vintageMeta && (
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    padding: '1px 6px',
                    borderRadius: 999,
                    border: `1px solid ${vintageMeta.color}`,
                    color: vintageMeta.color,
                  }}
                >
                  {vintageMeta.label}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {vintageMeta.period}
                  {mintTimestamp
                    ? ` · ${new Date(mintTimestamp).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                    : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        <p className="label" style={{ marginBottom: 2 }}>Balance</p>
        <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--axia-aqua)', fontFamily: 'var(--font-family-mono)' }}>
          {formatAmount(heldBalance)}
        </p>
        {entry?.unconfirmed && entry.unconfirmed !== '0' && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning, #e9b949)' }}>
            +{formatAmount(entry.unconfirmed)} pending
          </p>
        )}
        {isNft && maxSupply === '1' && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>1 of 1</p>
        )}
        {isNft && maxSupply && maxSupply !== '1' && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Owned: {formatAmount(heldBalance)} of {fmtSupply(maxSupply)}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              if (!isNative && selectedTokenId) setPendingSendTokenId(selectedTokenId);
              setRoute('send');
            }}
          >
            Send
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRoute('receive')}>
            Receive
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: 'var(--space-2) var(--space-3)' }}>
        <MetaRow label="Type" value={isNative ? 'Native' : isNft ? 'NFT' : 'Standard Token'} />
        <MetaRow
          label="Token ID"
          value={selectedTokenId ? `${selectedTokenId.slice(0, 18)}…${selectedTokenId.slice(-10)}` : '—'}
          mono
          copy={selectedTokenId ?? undefined}
          copied={copied}
        />
        <MetaRow label="Author" value={author || 'Not published'} mono={!!author} />
        <MetaRow
          label="Created"
          value={
            mintTimestamp
              ? new Date(mintTimestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'
          }
        />
        {createdBlock != null && <MetaRow label="Mint block" value={createdBlock.toLocaleString('en-GB')} />}
        <MetaRow label="Max supply" value={fmtSupply(maxSupply)} />
        <MetaRow label="Your balance" value={formatAmount(heldBalance)} />
        {decimals !== undefined && <MetaRow label="Decimals" value={String(decimals)} />}
        {!!entry?.coins && <MetaRow label="UTXOs" value={String(entry.coins)} />}
        {description && <MetaRow label="Description" value={description} />}
        {author && <MetaRow label="Owner address" value={author} mono />}
        {entry?.webvalidate && <MetaRow label="Verified by" value={entry.webvalidate} mono />}
        {website && <MetaRow label="Website" value={website} mono />}
        {descriptor?.script && <MetaRow label="Token script" value={descriptor.script} mono />}
      </div>

      <div style={{ height: 'var(--space-4)' }} />
    </div>
  );
}
