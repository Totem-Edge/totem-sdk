/**
 * Transaction detail — full view of one TxPoW with an explorer deep link.
 *
 * Mirrors the extension's detail panel: inputs and outputs with decoded token
 * amounts, block height, confirmations, and the minimanode.com link for the
 * canonical view.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../core/WalletContext';
import { fetchPortfolio, fetchTransactionDetail, type TxDetail, type TxLeg } from '../core/api';
import {
  decodeMinimaAmount,
  formatAmount,
  formatWhen,
  groupThousands,
  shortAddress,
  tokenLabel,
} from '../core/format';

const explorerUrl = (txpowid: string) => `https://minimanode.com/#/tx/${txpowid}`;

interface TokenMeta {
  name?: string;
  ticker?: string;
  decimals?: number;
}

export function TxDetailPage() {
  const { activeAccount, session, selectedTxId, closeTx } = useWallet();
  const [tx, setTx] = useState<TxDetail | null>(null);
  const [tokens, setTokens] = useState<Record<string, TokenMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!selectedTxId) return;
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      const [detail, portfolio] = await Promise.all([
        fetchTransactionDetail(selectedTxId),
        activeAccount ? fetchPortfolio(activeAccount.address, session?.identityHash) : Promise.resolve([]),
      ]);
      if (!active) return;

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
      if (detail) setTx(detail);
      else setError('Transaction not found');
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [selectedTxId, activeAccount, session?.identityHash]);

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const decimalsFor = (leg: TxLeg) => {
    if (leg.token_id && leg.token_id.toLowerCase() !== '0x00') {
      return typeof leg.decimals === 'number'
        ? leg.decimals
        : tokens[leg.token_id.toLowerCase()]?.decimals ?? 44;
    }
    return 44;
  };

  const renderLegs = (title: string, legs: TxLeg[]) => (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <p className="label" style={{ marginBottom: 'var(--space-1)' }}>
        {title} ({legs.length})
      </p>
      {legs.length === 0 && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>None</p>
      )}
      {legs.map((leg, index) => {
        const { label } = tokenLabel(leg.token_id, tokens);
        const amount = leg.amount
          ? groupThousands(formatAmount(decodeMinimaAmount(leg.amount, decimalsFor(leg))))
          : '0';
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
              style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', cursor: leg.address ? 'copy' : 'default' }}
            >
              {leg.address ? shortAddress(leg.address) : '—'}
            </span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
              {amount} <span style={{ opacity: 0.6 }}>{label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="page">
      <button
        className="btn btn-sm btn-secondary"
        onClick={closeTx}
        style={{ marginBottom: 'var(--space-2)' }}
      >
        ← Activity
      </button>

      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', marginBottom: 'var(--space-2)' }}>
        Transaction
      </h2>

      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: 'var(--space-3)' }}>
          <div className="error-msg">{error}</div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflowWrap: 'anywhere', marginTop: 4 }}>
            {selectedTxId}
          </p>
        </div>
      )}

      {!loading && tx && (
        <>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <span className={`chip chip-${tx.status === 'confirmed' ? 'success' : 'warning'}`}>{tx.status}</span>
                {tx.confirmations !== null && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {tx.confirmations.toLocaleString('en-GB')} conf.
                  </span>
                )}
              </div>
              <span title={formatWhen(tx.timestamp_ms).full} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {formatWhen(tx.timestamp_ms).short}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '4px 0' }}>
              <span className="label">TxPoW ID</span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => void copyText(tx.txpowid)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void copyText(tx.txpowid); }}
                title={`${tx.txpowid} — click to copy`}
                style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', cursor: 'copy', textAlign: 'right', overflowWrap: 'anywhere' }}
              >
                {copied === tx.txpowid ? 'copied' : shortAddress(tx.txpowid)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '4px 0' }}>
              <span className="label">Block</span>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)' }}>
                {tx.height.toLocaleString('en-GB')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '4px 0' }}>
              <span className="label">Timestamp</span>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', textAlign: 'right' }}>
                {new Date(tx.timestamp_ms).toISOString()}
              </span>
            </div>

            {renderLegs('Inputs', tx.inputs)}
            {renderLegs('Outputs', tx.outputs)}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
            <a
              className="btn btn-primary"
              href={explorerUrl(tx.txpowid)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
            >
              View on minimanode ↗
            </a>
            <button
              className="btn btn-secondary"
              onClick={() => void copyText(explorerUrl(tx.txpowid))}
            >
              {copied === explorerUrl(tx.txpowid) ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: 'var(--space-2)' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowRaw((v) => !v)}
            >
              {showRaw ? 'Hide' : 'Show'} raw JSON
            </button>
            {showRaw && (
              <pre style={{ marginTop: 'var(--space-1)', fontSize: 10, lineHeight: 1.4, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(tx, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
