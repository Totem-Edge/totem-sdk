/**
 * Token detail — the page behind a Home row, mirroring the extension's
 * TotemTokenDetail: artwork, balance, send/receive, and the token's metadata
 * (id, type, decimals, description, owner, verification, website).
 *
 * NFTs additionally get the vintage badge derived from the mint date, using the
 * same tier table and block-time estimate as the extension.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../core/WalletContext';
import { fetchPortfolio, fetchTokenVintage, type TokenVintage } from '../core/api';
import type { PortfolioEntry } from '@totemsdk/realtime';
import { formatAmount } from '../core/format';
import { tokenArtwork } from '../core/tokenImage';

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
  const [vintage, setVintage] = useState<TokenVintage | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    if (!activeAccount || !selectedTokenId) return;
    let active = true;
    setLoading(true);

    fetchPortfolio(activeAccount.address, session?.identityHash)
      .then((entries) => {
        if (!active) return;
        setEntry(entries.find((e) => e.tokenid.toLowerCase() === selectedTokenId.toLowerCase()) ?? null);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });

    if (selectedTokenId !== '0x00') {
      fetchTokenVintage(selectedTokenId).then((v) => { if (active) setVintage(v); }).catch(() => undefined);
    }

    return () => { active = false; };
  }, [activeAccount?.address, session?.identityHash, selectedTokenId]);

  const art = useMemo(
    () => (artFailed || !entry ? undefined : tokenArtwork(entry)),
    [entry, artFailed]
  );

  const isNft = entry?.kind === 'nft';
  const isNative = !selectedTokenId || selectedTokenId === '0x00';
  const name = entry?.ticker || entry?.name || (selectedTokenId ?? '').slice(0, 12);
  const verified = !!entry?.webvalidate;

  const mintTimestamp =
    vintage?.mintTimestamp ??
    (vintage?.mintBlock != null ? estimateMintTimestamp(vintage.mintBlock) : null);
  const vintageMeta = mintTimestamp ? VINTAGE_META[getVintageTier(mintTimestamp)] : null;

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
          {formatAmount(entry?.confirmed ?? '0')}
        </p>
        {entry?.unconfirmed && entry.unconfirmed !== '0' && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning, #e9b949)' }}>
            +{formatAmount(entry.unconfirmed)} pending
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
        {entry?.decimals !== undefined && <MetaRow label="Decimals" value={String(entry.decimals)} />}
        {!!entry?.coins && <MetaRow label="UTXOs" value={String(entry.coins)} />}
        {entry?.description && <MetaRow label="Description" value={entry.description} />}
        {entry?.owner && <MetaRow label="Owner" value={entry.owner} mono />}
        {entry?.webvalidate && <MetaRow label="Verified by" value={entry.webvalidate} mono />}
        {entry?.url && <MetaRow label="Website" value={entry.url} mono />}
        {vintage?.mintBlock != null && <MetaRow label="Mint block" value={vintage.mintBlock.toLocaleString('en-GB')} />}
      </div>
    </div>
  );
}
