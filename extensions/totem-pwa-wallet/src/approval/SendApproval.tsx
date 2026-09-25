/**
 * SendApproval — dApp-triggered send confirmation popup/redirect
 *
 * Builds a complete TxnRow so /finalize receives the full serialized
 * transaction (not just signature bytes).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { WalletManager } from '../core/WalletManager';
import {
  prepareLease, finalizeLease, fetchWatermark,
  fetchCoins, fetchCoinProofs,
} from '../core/api';
import { buildTxnRowHex, normalizeAddressToHex, selectCoins } from '../core/buildTxnRow';
import { track } from '../core/observability';
import { parseApprovalContext, sendApprovalResult } from './approvalContext';

function getParams() {
  const url = new URL(window.location.href);
  return {
    to: url.searchParams.get('to') ?? '',
    amount: url.searchParams.get('amount') ?? '0',
    tokenId: url.searchParams.get('tokenId') ?? '0x00',
    mode: url.searchParams.get('mode') ?? 'submit',
  };
}

export function SendApproval() {
  const [step, setStep] = useState<'password' | 'confirm' | 'sending'>('confirm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const ctx = useMemo(parseApprovalContext, []);
  const { to, amount, tokenId, mode } = getParams();
  const isBuildMode = mode === 'build';

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
    if (!session || !account) { sendApprovalResult(ctx, undefined, 'Wallet not ready'); return; }

    setStep('sending');

    try {
      // Validate/normalise both addresses before any network or signing work (AUD-036)
      const fromHex = normalizeAddressToHex(account.address);
      const toHex   = normalizeAddressToHex(to);

      setStatusMsg('Syncing watermark…');
      await fetchWatermark(session.rootPublicKey, session.identityHash);

      setStatusMsg('Loading spendable coins…');
      const coins = await fetchCoins(account.address, session.identityHash);
      if (!coins.length) throw new Error('No spendable coins found for this address.');

      const { selected, changeAmount } = selectCoins(coins, amount, tokenId);

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

      setStatusMsg(isBuildMode ? 'Building transaction…' : 'Building and signing transaction…');
      const treeKey = isBuildMode ? undefined : await WalletManager.getActiveTreeKey();
      const { txnRowHex, digestTx } = await buildTxnRowHex({
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
        sign: !isBuildMode,
      });

      if (isBuildMode) {
        // Build mode — return the UNSIGNED serialized Transaction + plan.
        // No WOTS leaf is consumed and nothing is broadcast (AUD-040).
        sendApprovalResult(ctx, {
          success: true,
          mode: 'build',
          unsignedHex: txnRowHex,
          digestTx,
          signed: false,
          plan: {
            inputs: selected.map(c => ({ coinId: c.coinid, amount: c.amount, tokenId: c.tokenid, address: c.address })),
            outputs: [{ address: to, amount, tokenId }],
            change: { address: account.address, amount: changeAmount, tokenId },
            fee: null,
          },
          inputCoinProofs: coinProofHexes.map((h, i) => ({
            coinId: selected[i].coinid,
            amount: selected[i].amount,
            tokenId: selected[i].tokenid,
            address: selected[i].address,
            proof: null,
          })),
          scriptDescriptors: [],
          chainId: '',
          blobHash: '',
          detectedIntent: 'send',
          scriptTypes: ['signedby'],
        });
        return;
      }

      // Persist parent-child sig proofs so next sign is fast
      await WalletManager.flushSigCache();

      setStatusMsg('Broadcasting…');
      track('send:broadcast', { identityHash: session.identityHash });
      const result = await finalizeLease(
        { leaseToken: lease.leaseToken, signedHex: txnRowHex },
        session.identityHash,
      );
      track('send:success', { identityHash: session.identityHash });
      sendApprovalResult(ctx, {
        success: true,
        txpowid: result.txid ?? txId,
        status: 'submitted',
      });
    } catch (e) {
      sendApprovalResult(ctx, undefined, String(e));
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
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>{ctx.origin}</p>
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
            onClick={() => sendApprovalResult(ctx, undefined, 'User rejected')}>Reject</button>
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
            onClick={() => sendApprovalResult(ctx, undefined, 'User rejected')}>Reject</button>
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
