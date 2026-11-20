/**
 * AXIA TOTEM TRANSACTION DETAIL
 *
 * Full transaction view reachable from the activity list and by deep link
 * (#/0x<txid>). Mirrors the explorer URL so a shared link opens the same tx at
 * minimamore.com.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Typography, StatusPill } from '../../components/atoms';
import { usePortfolio } from '../../hooks/usePortfolio';
import { formatAmount, groupThousands, shortAddress, tokenLabel, formatWhen, decodeMinimaAmount } from '../utils/format';
import '../../theme/axia-tokens.css';

interface Leg {
  coin_id: string;
  address: string | null;
  token_id: string;
  amount: string | null;
  /** Token scale supplied by the archive index; null when unknown. */
  decimals?: number | null;
}

interface TxDetail {
  txpowid: string;
  height: number;
  timestamp_ms: number;
  confirmations: number | null;
  status: string;
  inputs: Leg[];
  outputs: Leg[];
}

interface TotemTxDetailProps {
  txpowid: string;
  onBack: () => void;
}

const explorerUrl = (txpowid: string) => `https://minimanode.com/#/${txpowid}`;

export function TotemTxDetail({ txpowid, onBack }: TotemTxDetailProps) {
  const [tx, setTx] = useState<TxDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const { entries } = usePortfolio();
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

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await chrome.runtime.sendMessage({ method: 'activity:getTransaction', txpowid });
        if (!active) return;
        if (response?.ok && response.tx) {
          setTx(response.tx);
        } else {
          setError(response?.error || 'Transaction not found');
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Transaction lookup failed');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [txpowid]);

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const copyRow = (label: string, value: string, copyValue = value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '4px 0' }}>
      <Typography variant="caption" color="muted" uppercase>{label}</Typography>
      <span
        role="button"
        tabIndex={0}
        onClick={() => void copyText(copyValue)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') void copyText(copyValue);
        }}
        title={`${copyValue} — click to copy`}
        style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 12,
          cursor: 'copy',
          overflowWrap: 'anywhere',
          textAlign: 'right',
        }}
      >
        {copied === copyValue ? 'copied' : value}
      </span>
    </div>
  );

  const renderLegs = (title: string, legs: Leg[]) => (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <Typography variant="caption" color="muted" uppercase bold>
        {title} ({legs.length})
      </Typography>
      {legs.length === 0 && (
        <Typography variant="caption" color="muted">None</Typography>
      )}
      {legs.map((leg, index) => {
        const { label } = tokenLabel(leg.token_id, tokens);
        const decimals =
          leg.token_id && leg.token_id.toLowerCase() !== '0x00'
            ? (typeof leg.decimals === 'number' ? leg.decimals : tokens[leg.token_id.toLowerCase()]?.decimals ?? 44)
            : 44;
        return (
          <div
            key={`${leg.coin_id}-${index}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
              padding: '4px 0',
              borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <span
              role="button"
              tabIndex={0}
              onClick={() => leg.address && void copyText(leg.address)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && leg.address) void copyText(leg.address);
              }}
              title={leg.address ?? ''}
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 11,
                cursor: leg.address ? 'copy' : 'default',
              }}
            >
              {leg.address ? shortAddress(leg.address) : '—'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, whiteSpace: 'nowrap' }}>
              {leg.amount
                ? groupThousands(formatAmount(decodeMinimaAmount(leg.amount, decimals)))
                : '0'}{' '}
              <span style={{ opacity: 0.6 }}>{label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ padding: 'var(--space-2)', paddingBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <button
        type="button"
        onClick={onBack}
        style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
      >
        ← Activity
      </button>

      <Typography variant="h2" color="accent">Transaction</Typography>

      {loading && (
        <Card padding="md" shadow>
          <Typography variant="body" uppercase bold>Loading transaction…</Typography>
        </Card>
      )}

      {error && !loading && (
        <Card padding="md" shadow>
          <Typography variant="body" bold color="danger">{error}</Typography>
          <Typography variant="caption" color="muted" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>
            {txpowid}
          </Typography>
        </Card>
      )}

      {tx && !loading && (
        <>
          <Card padding="md" shadow>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <StatusPill variant={tx.status === 'confirmed' ? 'success' : 'warning'} size="sm">
                  {tx.status}
                </StatusPill>
                {tx.confirmations !== null && (
                  <Typography variant="caption" color="muted">
                    {tx.confirmations.toLocaleString('en-GB')} conf.
                  </Typography>
                )}
              </div>
              <span title={formatWhen(tx.timestamp_ms).full} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {formatWhen(tx.timestamp_ms).short}
              </span>
            </div>

            <div style={{ marginTop: 'var(--space-2)' }}>
              {copyRow('TxPoW ID', shortAddress(tx.txpowid), tx.txpowid)}
              {copyRow('Block', tx.height.toLocaleString('en-GB'), String(tx.height))}
              {copyRow('Timestamp', new Date(tx.timestamp_ms).toISOString(), new Date(tx.timestamp_ms).toISOString())}
            </div>

            {renderLegs('Inputs', tx.inputs)}
            {renderLegs('Outputs', tx.outputs)}
          </Card>

          <Card padding="md" shadow>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <a
                href={explorerUrl(tx.txpowid)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-accent)',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                View on minimanode ↗
              </a>
              <button
                type="button"
                onClick={() => void copyText(explorerUrl(tx.txpowid))}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {copied === explorerUrl(tx.txpowid) ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </Card>

          <Card padding="md" shadow>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
            >
              {showRaw ? 'Hide' : 'Show'} raw JSON
            </button>
            {showRaw && (
              <pre
                style={{
                  marginTop: 'var(--space-1)',
                  fontSize: 10,
                  lineHeight: 1.4,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {JSON.stringify(tx, null, 2)}
              </pre>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
