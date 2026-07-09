/**
 * Send — full WOTS TxnRow pipeline
 *
 * Steps: form → confirm → watermark sync → fetchCoins → selectCoins →
 *        prepareLease → fetchCoinProofs → buildTxnRowHex → finalizeLease
 *
 * /finalize expects a complete TxnRow hex (not just signature bytes).
 */
import React, { useState, useEffect } from 'react';
import { useWallet } from '../core/WalletContext';
import {
  prepareLease, finalizeLease, fetchWatermark,
  fetchCoins, fetchCoinProofs, fetchPortfolio, type PortfolioEntry,
} from '../core/api';
import { WalletManager } from '../core/WalletManager';
import { buildTxnRowHex, selectCoins } from '../core/buildTxnRow';
import { track } from '../core/observability';

type Step = 'form' | 'confirm' | 'signing' | 'done' | 'error';

export function Send() {
  const { session, activeAccount, setRoute } = useWallet();
  const [step, setStep] = useState<Step>('form');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenId, setTokenId] = useState('0x00');
  const [balances, setBalances] = useState<PortfolioEntry[]>([]);
  const [txId, setTxId] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

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

  function validateForm(): string | null {
    if (!toAddress.trim()) return 'Recipient address required.';
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) return 'Invalid amount.';
    return null;
  }

  async function handleSend() {
    if (!session || !activeAccount) return;
    setStep('signing');
    setError('');

    try {
      setStatusMsg('Syncing watermark…');
      await fetchWatermark(session.rootPublicKey, session.identityHash);

      setStatusMsg('Loading spendable coins…');
      const coins = await fetchCoins(activeAccount.address, session.identityHash);
      if (!coins.length) throw new Error('No spendable coins found for this address.');

      const { selected, changeAmount } = selectCoins(coins, amount, tokenId);
      const fromHex = activeAccount.address.replace(/^0x/i, '').padStart(64, '0');
      const toHex   = toAddress.replace(/^0x/i, '').padStart(64, '0');

      setStatusMsg('Requesting signing lease…');
      const genTxId = `pwa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setTxId(genTxId);

      const lease = await prepareLease({
        txId: genTxId,
        rootPublicKey: session.rootPublicKey,
        addressIndex: session.activeIndex,
        perAddressPublicKey: activeAccount.publicKey,
      }, session.identityHash);

      setStatusMsg('Fetching coin proofs…');
      const proofs = await fetchCoinProofs(
        lease.leaseToken,
        selected.map(c => c.coinid),
        session.identityHash,
      );
      const coinProofHexes = proofs.map(p => p.coinProofHex).filter(Boolean) as string[];
      if (coinProofHexes.length !== selected.length) {
        throw new Error('Failed to fetch all CoinProofs. Some coins may be unconfirmed.');
      }

      setStatusMsg('Building and signing transaction…');
      const treeKey = await WalletManager.getActiveTreeKey();
      const { txnRowHex } = await buildTxnRowHex({
        txId: genTxId,
        treeKey,
        inputCoinProofsHex: coinProofHexes,
        toAddressHex: toHex,
        toAmount: amount,
        changeAddressHex: fromHex,
        changeAmount,
        perAddressPublicKey: activeAccount.publicKey,
        l1: lease.l1,
        l2: lease.l2,
      });

      // Persist parent-child sig proofs so next sign is fast
      await WalletManager.flushSigCache();

      setStatusMsg('Broadcasting transaction…');
      track('send.initiated', { identityHash: session.identityHash, tokenId });
      await finalizeLease({ leaseToken: lease.leaseToken, signedHex: txnRowHex }, session.identityHash);

      track('send.completed', { identityHash: session.identityHash, tokenId });
      setStep('done');
    } catch (e) {
      track('send.failed', { identityHash: session.identityHash, tokenId, reason: String(e) });
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
          <p style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
            TX: {txId}
          </p>
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
        <div className="error-msg" style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>{error}</div>
        <button className="btn btn-secondary btn-full" onClick={() => setStep('form')}>Try Again</button>
        <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }} onClick={() => setRoute('home')}>Cancel</button>
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

  if (step === 'confirm') {
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn btn-secondary btn-sm" onClick={() => setStep('form')}>←</button>
          <h2 className="page-title">Confirm Send</h2>
        </div>
        <div className="card" style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="label" style={{ marginBottom: 0 }}>Token</span>
            <span style={{ fontWeight: 'var(--weight-bold)' }}>{tokenLabel(tokenId)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="label" style={{ marginBottom: 0 }}>Amount</span>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--axia-aqua)' }}>
              {amount} {tokenLabel(tokenId)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="label" style={{ marginBottom: 0 }}>To</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)' }}>
              {toAddress.slice(0, 20)}…
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="label" style={{ marginBottom: 0 }}>From</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)' }}>
              {activeAccount?.address.slice(0, 20)}…
            </span>
          </div>
        </div>
        <div className="error-msg" style={{ marginBottom: 'var(--space-3)' }}>
          ⚠ WOTS signatures are one-time-use. Verify the address carefully.
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSend}>Confirm & Sign →</button>
        <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }} onClick={() => setStep('form')}>Cancel</button>
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
        {/* Token selector — shown only when wallet holds custom tokens */}
        {otherTokens.length > 0 && (
          <>
            <label className="label">Token</label>
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
          </>
        )}

        <label className="label">Recipient Address</label>
        <input
          className="input mono"
          style={{ marginBottom: 'var(--space-2)' }}
          placeholder="0xMx..."
          value={toAddress}
          onChange={e => { setToAddress(e.target.value); setError(''); }}
        />
        <label className="label">Amount ({tokenLabel(tokenId)})</label>
        <input
          className="input"
          style={{ marginBottom: 'var(--space-2)' }}
          type="number" min="0" step="any" placeholder="0.0"
          value={amount}
          onChange={e => { setAmount(e.target.value); setError(''); }}
        />
        {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}
        <button
          className="btn btn-primary btn-full"
          onClick={() => {
            const e = validateForm();
            if (e) { setError(e); return; }
            setStep('confirm');
          }}
        >
          Review Transaction →
        </button>
      </div>
    </div>
  );
}
