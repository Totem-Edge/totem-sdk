/**
 * TokenCreateApproval — dApp-triggered token/NFT mint confirmation.
 *
 * Builds a complete TxnRow whose output[0] is the token-create coin
 * (0xFF marker + Token descriptor) and signs it with a per-address WOTS leaf.
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
  let metadata: Record<string, unknown> = {};
  try { metadata = JSON.parse(url.searchParams.get('metadata') ?? '{}') as Record<string, unknown>; } catch { metadata = {}; }
  return {
    metadata,
    decimals: Number(url.searchParams.get('decimals') ?? '8'),
    totalSupply: url.searchParams.get('totalSupply') ?? '0',
    script: url.searchParams.get('script') ?? 'RETURN TRUE',
  };
}

/**
 * Minima colorminima (the Minima amount coloured into the token), as a decimal
 * string: `totalSupply * 10^(decimals-44)`.
 */
function colorminimaDecimal(totalSupply: string, decimals: number): string {
  const scale = 44 - decimals;
  const unscaled = BigInt(totalSupply || '0');
  const s = unscaled.toString().padStart(scale + 1, '0');
  const whole = s.slice(0, s.length - scale);
  const frac = s.slice(s.length - scale);
  return `${whole}.${frac}`;
}

export function TokenCreateApproval() {
  const [step, setStep] = useState<'password' | 'confirm' | 'sending'>('confirm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const ctx = useMemo(parseApprovalContext, []);
  const { metadata, decimals, totalSupply, script } = getParams();
  const tokenName = String((metadata as { name?: unknown }).name ?? '');
  const isNft = decimals === 0;

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

  async function handleCreate() {
    const session = WalletManager.getSession();
    const account = session?.accounts.find(a => a.index === session.activeIndex);
    if (!session || !account) { sendApprovalResult(ctx, undefined, 'Wallet not ready'); return; }

    setStep('sending');
    try {
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 44) throw new Error('decimals must be 0..44');
      if (!/^\d+$/.test(totalSupply) || BigInt(totalSupply) <= 0n) throw new Error('totalSupply must be a positive integer string');
      if (!tokenName) throw new Error('metadata.name is required');

      const fromHex = normalizeAddressToHex(account.address);
      const colorminima = colorminimaDecimal(totalSupply, decimals);

      setStatusMsg('Syncing watermark…');
      await fetchWatermark(session.rootPublicKey, session.identityHash);

      setStatusMsg('Loading spendable coins…');
      const coins = await fetchCoins(account.address, session.identityHash);
      if (!coins.length) throw new Error('No spendable coins found for this address.');

      const { selected, changeAmount } = selectCoins(coins, colorminima, '0x00');

      setStatusMsg('Requesting signing lease…');
      const txId = `tokencreate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const lease = await prepareLease({
        txId,
        rootPublicKey: session.rootPublicKey,
        addressIndex: session.activeIndex,
        perAddressPublicKey: account.publicKey,
      }, session.identityHash);

      setStatusMsg('Fetching coin proofs…');
      const proofs = await fetchCoinProofs(lease.leaseToken, selected.map(c => c.coinid), session.identityHash);
      const coinProofHexes = proofs.map(p => p.coinProofHex).filter(Boolean) as string[];
      if (coinProofHexes.length !== selected.length) {
        throw new Error('Failed to fetch all CoinProofs. Some coins may be unconfirmed.');
      }

      setStatusMsg('Building and signing token creation…');
      const treeKey = await WalletManager.getActiveTreeKey();
      const { txnRowHex, tokenId } = await buildTxnRowHex({
        txId,
        treeKey,
        inputCoinProofsHex: coinProofHexes,
        toAddressHex: fromHex,
        toAmount: colorminima,
        changeAddressHex: fromHex,
        changeAmount,
        perAddressPublicKey: account.publicKey,
        l1: lease.l1,
        l2: lease.l2,
        sign: true,
        tokenCreate: { name: JSON.stringify(metadata), script, decimals, totalSupply },
      });

      await WalletManager.flushSigCache();

      setStatusMsg('Broadcasting…');
      track('tokencreate:broadcast', { identityHash: session.identityHash });
      const result = await finalizeLease({ leaseToken: lease.leaseToken, signedHex: txnRowHex }, session.identityHash);
      track('tokencreate:success', { identityHash: session.identityHash });
      sendApprovalResult(ctx, {
        success: true,
        tokenId,
        tokenName,
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
        }}>{isNft ? 'CONFIRM NFT MINT' : 'CONFIRM TOKEN MINT'}</h2>
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
              <span className="label" style={{ marginBottom: 0 }}>Name</span>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--axia-aqua)' }}>{tokenName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1-5)' }}>
              <span className="label" style={{ marginBottom: 0 }}>Supply</span>
              <span>{totalSupply}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="label" style={{ marginBottom: 0 }}>Decimals</span>
              <span>{decimals}{isNft ? ' (non-fungible)' : ''}</span>
            </div>
          </div>
          <div className="error-msg" style={{ marginBottom: 'var(--space-3)' }}>
            ⚠ WOTS signatures are one-time-use. Verify before approving.
          </div>
          <button className="btn btn-primary btn-full" onClick={handleCreate}>Approve &amp; Mint →</button>
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
