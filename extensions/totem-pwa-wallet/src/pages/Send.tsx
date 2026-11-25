/**
 * Send — full WOTS TxnRow pipeline
 *
 * Steps: form → prepare (watermark, coins, lease, proofs, unsigned build)
 *        → review exact inputs/outputs/hex → sign those bytes → finalizeLease
 *
 * /finalize expects a complete TxnRow hex (not just signature bytes).
 */
import React, { useState, useEffect } from 'react';
import { useWallet } from '../core/WalletContext';
import { QrScanner } from '../components/QrScanner';
import {
  prepareLease, finalizeLease, fetchWatermark,
  fetchCoins, fetchCoinProofs, fetchPortfolio, type PortfolioEntry,
} from '../core/api';
import { WalletManager } from '../core/WalletManager';
import { buildTxnRowHex, normalizeAddressToHex, selectCoins } from '../core/buildTxnRow';
import { addPendingSend } from '../core/pendingSends';
import { track } from '../core/observability';

type Step = 'form' | 'preparing' | 'review' | 'signing' | 'done' | 'error';

interface PreparedSend {
  txId: string;
  createdAt: number;
  lease: Awaited<ReturnType<typeof prepareLease>>;
  selected: ReturnType<typeof selectCoins>['selected'];
  changeAmount: string;
  totalInputAmount: string;
  coinProofsHex: string[];
  toAddress: string;
  toAddressHex: string;
  fromHex: string;
  toAmount: string;
  tokenId: string;
  digestTx: string;
  unsignedHex: string;
}

const PREPARED_TTL_MS = 5 * 60_000;

export function Send() {
  const { session, activeAccount, setRoute, pendingSendTokenId, setPendingSendTokenId } = useWallet();
  const [step, setStep] = useState<Step>('form');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenId, setTokenId] = useState('0x00');
  const [balances, setBalances] = useState<PortfolioEntry[]>([]);
  const [txId, setTxId] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [sendFailure, setSendFailure] = useState<{ details?: string; rpcResponse?: string; failureId?: string | null } | null>(null);
  const [prepared, setPrepared] = useState<PreparedSend | null>(null);

  // Preselect the token when the user arrived from its detail page.
  useEffect(() => {
    if (pendingSendTokenId) {
      setTokenId(pendingSendTokenId);
      setPendingSendTokenId(null);
    }
  }, [pendingSendTokenId, setPendingSendTokenId]);

  // Load token balances for the selector
  useEffect(() => {
    if (!activeAccount || !session) return;
    fetchPortfolio(activeAccount.address, session.identityHash)
      .then(b => setBalances(b))
      .catch(() => { /* non-fatal — selector falls back to MINIMA */ });
  }, [activeAccount?.address, session?.identityHash]);

  function tokenLabel(tid: string): string {
    if (tid === '0x00') return 'MINIMA';
    const entry = balances.find(b => b.tokenid === tid);
    return entry?.name ?? tid.slice(0, 10) + '…';
  }

  /** Sendable balance of the selected token, for the MAX shortcut. */
  function maxAmount(): string {
    const entry = balances.find(b => b.tokenid === tokenId);
    return entry?.sendable || entry?.confirmed || '0';
  }

  function validateForm(): string | null {
    if (!toAddress.trim()) return 'Recipient address required.';
    try {
      normalizeAddressToHex(toAddress);
    } catch (e) {
      return `Invalid recipient address: ${(e as Error).message}`;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) return 'Invalid amount.';
    return null;
  }

  async function handlePrepare() {
    if (!session || !activeAccount) return;
    const validation = validateForm();
    if (validation) { setError(validation); return; }

    setStep('preparing');
    setError('');
    setPrepared(null);

    try {
      setStatusMsg('Syncing watermark…');
      await fetchWatermark(session.rootPublicKey, session.identityHash);

      setStatusMsg('Loading spendable coins…');
      const coins = await fetchCoins(activeAccount.address, session.identityHash);
      if (!coins.length) throw new Error('No spendable coins found for this address.');

      const selection = selectCoins(coins, amount, tokenId);
      const fromHex = normalizeAddressToHex(activeAccount.address);
      const toHex = normalizeAddressToHex(toAddress);
      const genTxId = `pwa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setStatusMsg('Reserving a one-time WOTS key…');
      const lease = await prepareLease({
        txId: genTxId,
        rootPublicKey: session.rootPublicKey,
        addressIndex: session.activeIndex,
        perAddressPublicKey: activeAccount.publicKey,
      }, session.identityHash);

      setStatusMsg('Fetching coin proofs…');
      const proofs = await fetchCoinProofs(
        lease.leaseToken,
        selection.selected.map(c => c.coinid),
        session.identityHash,
      );
      const coinProofHexes = proofs.map(p => p.coinProofHex).filter(Boolean) as string[];
      if (coinProofHexes.length !== selection.selected.length) {
        throw new Error('Failed to fetch all CoinProofs. Some coins may be unconfirmed.');
      }

      setStatusMsg('Building the exact transaction…');
      const built = await buildTxnRowHex({
        txId: genTxId,
        inputCoinProofsHex: coinProofHexes,
        toAddressHex: toHex,
        toAmount: amount,
        changeAddressHex: fromHex,
        changeAmount: selection.changeAmount,
        perAddressPublicKey: activeAccount.publicKey,
        l1: lease.l1,
        l2: lease.l2,
        sign: false,
      });

      setPrepared({
        txId: genTxId,
        createdAt: Date.now(),
        lease,
        selected: selection.selected,
        changeAmount: selection.changeAmount,
        totalInputAmount: selection.totalInputAmount,
        coinProofsHex: coinProofHexes,
        toAddress,
        toAddressHex: toHex,
        fromHex,
        toAmount: amount,
        tokenId,
        digestTx: built.digestTx,
        unsignedHex: built.txnRowHex,
      });
      setStep('review');
    } catch (e) {
      track('send.prepare.failed', { identityHash: session.identityHash, tokenId, reason: String(e) });
      const rich = e as Error & { details?: string; rpcResponse?: string; failureId?: string | null };
      setSendFailure({ details: rich.details, rpcResponse: rich.rpcResponse, failureId: rich.failureId });
      setError(String(e));
      setStep('error');
    }
  }

  async function handleConfirmPrepared() {
    if (!session || !activeAccount || !prepared) return;
    if (Date.now() - prepared.createdAt > PREPARED_TTL_MS) {
      setPrepared(null);
      setError('That prepared transaction expired. Please review it again.');
      setStep('form');
      return;
    }

    setStep('signing');
    setError('');
    try {
      setStatusMsg('Signing the exact reviewed transaction…');
      const treeKey = await WalletManager.getActiveTreeKey();
      const signed = await buildTxnRowHex({
        txId: prepared.txId,
        treeKey,
        inputCoinProofsHex: prepared.coinProofsHex,
        toAddressHex: prepared.toAddressHex,
        toAmount: prepared.toAmount,
        changeAddressHex: prepared.fromHex,
        changeAmount: prepared.changeAmount,
        perAddressPublicKey: activeAccount.publicKey,
        l1: prepared.lease.l1,
        l2: prepared.lease.l2,
      });
      if (signed.digestTx.toLowerCase() !== prepared.digestTx.toLowerCase()) {
        throw new Error('The prepared transaction changed before signing. Nothing was broadcast; please review again.');
      }

      await WalletManager.flushSigCache();

      setStatusMsg('Broadcasting transaction…');
      track('send.initiated', { identityHash: session.identityHash, tokenId: prepared.tokenId });
      const finalized = await finalizeLease(
        { leaseToken: prepared.lease.leaseToken, signedHex: signed.txnRowHex },
        session.identityHash,
      );
      if (!finalized?.ok) {
        throw new Error(finalized?.error || 'The node did not accept the transaction.');
      }

      const broadcastId = finalized.txpowid || finalized.txid || prepared.txId;
      setTxId(broadcastId);
      const balanceEntry = balances.find((b) => b.tokenid === prepared.tokenId);
      addPendingSend({
        txpowid: broadcastId,
        address: activeAccount.address,
        tokenId: prepared.tokenId,
        amount: prepared.toAmount,
        balanceBefore: balanceEntry?.confirmed ?? balanceEntry?.total ?? '0',
      });

      track('send.completed', { identityHash: session.identityHash, tokenId: prepared.tokenId, txpowid: broadcastId });
      setStep('done');
    } catch (e) {
      track('send.failed', { identityHash: session.identityHash, tokenId: prepared.tokenId, reason: String(e) });
      const rich = e as Error & { details?: string; rpcResponse?: string; failureId?: string | null };
      setSendFailure({ details: rich.details, rpcResponse: rich.rpcResponse, failureId: rich.failureId });
      setError(String(e));
      setStep('error');
    }
  }

  if (step === 'done') {
    return (
      <div className="page" style={{ paddingTop: 'var(--space-6)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>✓</div>
        <h2 style={{
          fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase',
          marginBottom: 'var(--space-2)',
        }}>SENT</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>
          {amount} {tokenLabel(tokenId)} → {toAddress.slice(0, 16)}…
        </p>
        {txId && (
          <p style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)', overflowWrap: 'anywhere' }}>
            TX: {txId}
          </p>
        )}
        {txId && (
          <a
            className="btn btn-secondary btn-full"
            href={`https://minimanode.com/#/tx/${txId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginBottom: 'var(--space-1)' }}
          >
            View on minimanode ↗
          </a>
        )}
        <button className="btn btn-primary btn-full" onClick={() => setRoute('home')}>
          Back to Wallet
        </button>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn btn-secondary btn-sm" onClick={() => setRoute('home')}>←</button>
          <h2 className="page-title">Send Failed</h2>
        </div>
        <div className="error-msg" style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>{error}</div>
        {(sendFailure?.details || sendFailure?.rpcResponse || sendFailure?.failureId) && (
          <details style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <summary style={{ cursor: 'pointer' }}>Technical details</summary>
            {sendFailure?.failureId && (
              <p style={{ marginTop: 6, fontFamily: 'var(--font-family-mono)' }}>failure id: {sendFailure.failureId}</p>
            )}
            {sendFailure?.details && (
              <p style={{ marginTop: 6, fontFamily: 'var(--font-family-mono)', overflowWrap: 'anywhere' }}>{sendFailure.details}</p>
            )}
            {sendFailure?.rpcResponse && (
              <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 10 }}>{sendFailure.rpcResponse}</pre>
            )}
          </details>
        )}
        <button className="btn btn-secondary btn-full" onClick={() => { setPrepared(null); setStep('form'); }}>Try Again</button>
        <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }} onClick={() => setRoute('home')}>Cancel</button>
      </div>
    );
  }

  if (step === 'preparing') {
    return (
      <div className="page" style={{ paddingTop: 'var(--space-6)', textAlign: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32, marginBottom: 'var(--space-3)' }} />
        <p style={{ color: 'var(--text-muted)' }}>{statusMsg || 'Preparing the exact transaction…'}</p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 'var(--space-1)' }}>
          Selecting coins, reserving a one-time WOTS key and building the unsigned transaction.
          Nothing is signed or broadcast yet.
        </p>
      </div>
    );
  }

  if (step === 'signing') {
    return (
      <div className="page" style={{ paddingTop: 'var(--space-6)', textAlign: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32, marginBottom: 'var(--space-3)' }} />
        <p style={{ color: 'var(--text-muted)' }}>{statusMsg}</p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 'var(--space-1)' }}>
          WOTS signing may take 10–40 seconds
        </p>
      </div>
    );
  }

  if (step === 'review' && prepared) {
    const inputRows = prepared.selected.map((coin) => (
      <div key={coin.coinid} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-1)', padding: '6px 0', borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 10, overflowWrap: 'anywhere' }}>
          {coin.coinid.slice(0, 18)}…{coin.coinid.slice(-8)}
        </span>
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
          {coin.amount} {coin.tokenid === '0x00' ? 'MINIMA' : coin.tokenid.slice(0, 8) + '…'}
        </span>
      </div>
    ));
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn btn-secondary btn-sm" onClick={() => { setPrepared(null); setStep('form'); }}>←</button>
          <h2 className="page-title">Review Exact Transaction</h2>
        </div>

        <div className="card" style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="label" style={{ marginBottom: 0 }}>Send</span>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--axia-aqua)' }}>
              {prepared.toAmount} {tokenLabel(prepared.tokenId)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="label" style={{ marginBottom: 0 }}>To</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', textAlign: 'right', overflowWrap: 'anywhere' }}>{prepared.toAddress}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="label" style={{ marginBottom: 0 }}>From</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', textAlign: 'right', overflowWrap: 'anywhere' }}>{activeAccount?.address}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="label" style={{ marginBottom: 0 }}>Change back</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)' }}>{prepared.changeAmount} {tokenLabel(prepared.tokenId)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="label" style={{ marginBottom: 0 }}>Total input</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)' }}>{prepared.totalInputAmount} {tokenLabel(prepared.tokenId)}</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
          <p className="label">Inputs ({prepared.selected.length})</p>
          {inputRows}
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
          <p className="label">Outputs</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: 11 }}>Recipient</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11 }}>{prepared.toAmount} {tokenLabel(prepared.tokenId)}</span>
          </div>
          {prepared.changeAmount !== '0' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 11 }}>Change</span>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11 }}>{prepared.changeAmount} {tokenLabel(prepared.tokenId)}</span>
            </div>
          )}
        </div>

        <details style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          <summary style={{ cursor: 'pointer' }}>Exact unsigned transaction and digest</summary>
          <p style={{ marginTop: 8, overflowWrap: 'anywhere' }}>DIGEST: {prepared.digestTx}</p>
          <textarea
            readOnly
            value={prepared.unsignedHex}
            onFocus={(e) => e.currentTarget.select()}
            style={{ width: '100%', height: 120, marginTop: 6, fontFamily: 'var(--font-family-mono)', fontSize: 10 }}
          />
        </details>

        <div className="error-msg" style={{ marginBottom: 'var(--space-3)' }}>
          These are the exact inputs, outputs and digest that will be signed. Only the WOTS
          signature is added after you confirm, and nothing is broadcast if the rebuilt digest
          differs from the one shown here. WOTS signatures are one-time-use — verify the
          recipient and amounts.
        </div>
        <button className="btn btn-primary btn-full" onClick={handleConfirmPrepared}>Confirm & Sign →</button>
        <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }} onClick={() => { setPrepared(null); setStep('form'); }}>Back</button>
      </div>
    );
  }

  // --- Form ---
  const otherTokens = balances.filter(b => b.tokenid !== '0x00');

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-secondary btn-sm" onClick={() => setRoute('home')}>←</button>
        <h2 className="page-title">Send</h2>
      </div>
      <div style={{ paddingTop: 'var(--space-3)' }}>
        {/* Asset selector — always present, MINIMA plus any custom tokens */}
        <label className="label">Asset</label>
        <select
          className="input"
          style={{ marginBottom: 'var(--space-2)' }}
          value={tokenId}
          onChange={e => { setTokenId(e.target.value); setError(''); }}
        >
          <option value="0x00">MINIMA</option>
          {otherTokens.map(b => (
            <option key={b.tokenid} value={b.tokenid}>
              {b.name || b.ticker || b.tokenid.slice(0, 10) + '…'}
            </option>
          ))}
        </select>

        <label className="label">Recipient Address</label>
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
          <input
            className="input mono"
            style={{ flex: 1 }}
            placeholder="0xMx..."
            value={toAddress}
            onChange={e => { setToAddress(e.target.value); setError(''); }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => setScanOpen(true)} title="Scan a QR code">
            Scan
          </button>
        </div>
        <label className="label">Amount ({tokenLabel(tokenId)})</label>
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
          <input
            className="input"
            style={{ flex: 1 }}
            type="number" min="0" step="any" placeholder="0.0"
            value={amount}
            onChange={e => { setAmount(e.target.value); setError(''); }}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setAmount(maxAmount()); setError(''); }}
            title="Send the full sendable balance"
          >
            MAX
          </button>
        </div>
        {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}
        <button
          className="btn btn-primary btn-full"
          onClick={() => { void handlePrepare(); }}
        >
          Review Exact Transaction →
        </button>
      </div>

      {scanOpen && (
        <QrScanner
          onResult={(value) => { setToAddress(value); setError(''); }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}
