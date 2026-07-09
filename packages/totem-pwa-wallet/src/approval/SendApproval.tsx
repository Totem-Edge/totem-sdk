/**
 * SendApproval — dApp-triggered send confirmation popup/redirect
 *
 * Builds a complete TxnRow so /finalize receives the full serialized
 * transaction (not just signature bytes).
 */
import React, { useState, useEffect } from 'react';
import { WalletManager } from '../core/WalletManager';
import {
  prepareLease, finalizeLease, fetchWatermark,
  fetchCoins, fetchCoinProofs,
} from '../core/api';
import { buildTxnRowHex, selectCoins } from '../core/buildTxnRow';
import { track } from '../core/observability';

/**
 * Derive the caller origin from a trusted source.
 * document.referrer is set by the browser when a popup/tab is opened from a
 * page and cannot be spoofed via URL query-param manipulation.  The ?origin=
 * param is used only as a fallback for the redirect flow (where the browser
 * clears the referrer on full-page navigation).
 */
function trustedCallerOrigin(): string {
  if (document.referrer) {
    try { return new URL(document.referrer).origin; } catch { /* malformed */ }
  }
  const fromParam = new URL(window.location.href).searchParams.get('origin');
  return fromParam ? decodeURIComponent(fromParam) : 'Unknown dApp';
}

function getParams() {
  const url = new URL(window.location.href);
  return {
    origin: trustedCallerOrigin(),
    to: url.searchParams.get('to') ?? '',
    amount: url.searchParams.get('amount') ?? '0',
    tokenId: url.searchParams.get('tokenId') ?? '0x00',
    reqId: url.searchParams.get('reqId') ?? '',
  };
}

function isPopup(): boolean { return window.opener !== null; }

function sendResult(result: unknown, error?: string, reqId?: string) {
  const payload = { type: 'totem_response', reqId, result, error };

  if (reqId) {
    try {
      const bc = new BroadcastChannel(`totem_response_${reqId}`);
      bc.postMessage(payload);
      setTimeout(() => bc.close(), 200);
    } catch { /* BroadcastChannel not supported */ }
  }

  if (isPopup()) {
    window.opener?.postMessage(payload, '*');
    setTimeout(() => window.close(), 100);
  } else {
    const url = new URL(window.location.href);
    const returnUrl = url.searchParams.get('returnUrl');
    if (returnUrl) {
      const ret = new URL(returnUrl);
      ret.searchParams.set('totem_result', btoa(JSON.stringify(error ? { error } : result)));
      if (reqId) ret.searchParams.set('totem_reqid', reqId);
      window.location.href = ret.toString();
    }
  }
}

export function SendApproval() {
  const [step, setStep] = useState<'password' | 'confirm' | 'sending'>('confirm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const { origin, to, amount, tokenId, reqId } = getParams();

  useEffect(() => {
    if (!WalletManager.isUnlocked()) setStep('password');
  }, []);

  async function handleUnlock() {
    setLoading(true);
    setError('');
    try {
      await WalletManager.unlock(password);
      setStep('confirm');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const session = WalletManager.getSession();
    const account = session?.accounts.find(a => a.index === session.activeIndex);
    if (!session || !account) { sendResult(undefined, 'Wallet not ready', reqId); return; }

    setStep('sending');

    try {
      setStatusMsg('Syncing watermark…');
      await fetchWatermark(session.rootPublicKey, session.identityHash);

      setStatusMsg('Loading spendable coins…');
      const coins = await fetchCoins(account.address, session.identityHash);
      if (!coins.length) throw new Error('No spendable coins found for this address.');

      const { selected, changeAmount } = selectCoins(coins, amount, tokenId);
      const fromHex = account.address.replace(/^0x/i, '').padStart(64, '0');
      const toHex   = to.replace(/^0x/i, '').padStart(64, '0');

      setStatusMsg('Requesting signing lease…');
      const txId = `dapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const lease = await prepareLease({
        txId,
        rootPublicKey: session.rootPublicKey,
        addressIndex: session.activeIndex,
        perAddressPublicKey: account.publicKey,
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
        txId,
        treeKey,
        inputCoinProofsHex: coinProofHexes,
        toAddressHex: toHex,
        toAmount: amount,
        changeAddressHex: fromHex,
        changeAmount,
        perAddressPublicKey: account.publicKey,
        l1: lease.l1,
        l2: lease.l2,
      });

      // Persist parent-child sig proofs so next sign is fast
      await WalletManager.flushSigCache();

      setStatusMsg('Broadcasting…');
      track('send:broadcast', { identityHash: session.identityHash });
      const result = await finalizeLease(
        { leaseToken: lease.leaseToken, signedHex: txnRowHex },
        session.identityHash,
      );
      track('send:success', { identityHash: session.identityHash });
      sendResult({ txid: result.txid ?? txId, ok: true }, undefined, reqId);
    } catch (e) {
      sendResult(undefined, String(e), reqId);
    }
  }

  return (
    <div className="page" style={{ paddingTop: 'var(--space-3)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: 32, color: 'var(--axia-aqua)', marginBottom: 4 }}>⬡</div>
        <h2 style={{
          fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase',
        }}>CONFIRM TRANSACTION</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>{origin}</p>
      </div>

      {step === 'password' && (
        <div>
          <label className="label">Wallet Password</label>
          <input type="password" className="input" style={{ marginBottom: 'var(--space-2)' }}
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()} autoFocus />
          {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}
          <button className="btn btn-primary btn-full" onClick={handleUnlock} disabled={loading || !password}>
            {loading ? <span className="spinner" /> : 'Unlock →'}
          </button>
          <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }}
            onClick={() => sendResult(undefined, 'User rejected', reqId)}>Reject</button>
        </div>
      )}

      {step === 'confirm' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1-5)' }}>
              <span className="label" style={{ marginBottom: 0 }}>Amount</span>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--axia-aqua)' }}>
                {amount} {tokenId === '0x00' ? 'MINIMA' : tokenId.slice(0, 8)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="label" style={{ marginBottom: 0 }}>To</span>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)' }}>
                {to.slice(0, 20)}…
              </span>
            </div>
          </div>
          <div className="error-msg" style={{ marginBottom: 'var(--space-3)' }}>
            ⚠ WOTS signatures are one-time-use. Verify before approving.
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSend}>Approve & Send →</button>
          <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }}
            onClick={() => sendResult(undefined, 'User rejected', reqId)}>Reject</button>
        </div>
      )}

      {step === 'sending' && (
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-4)' }}>
          <span className="spinner" style={{ width: 32, height: 32, marginBottom: 'var(--space-2)' }} />
          <p style={{ color: 'var(--text-muted)' }}>{statusMsg}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4 }}>
            WOTS signing may take 10–40 seconds
          </p>
        </div>
      )}
    </div>
  );
}
