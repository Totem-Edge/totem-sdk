/**
 * ConnectApproval — popup/redirect page shown when a dApp calls totem.connect()
 * User must unlock wallet and approve the connection.
 *
 * Origin/return handling is shared with SendApproval/VerifyApproval via
 * `approvalContext` (AUD-041): the displayed origin comes from the
 * browser-set referrer, postMessage uses an explicit targetOrigin, and
 * returnUrl is scheme-validated.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { WalletManager } from '../core/WalletManager';
import { VaultStore } from '../stores/VaultStore';
import { parseApprovalContext, sendApprovalResult } from './approvalContext';

export function ConnectApproval() {
  const [step, setStep] = useState<'password' | 'confirm' | 'loading'>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const ctx = useMemo(parseApprovalContext, []);
  const origin = ctx.origin;

  useEffect(() => {
    async function init() {
      const has = await WalletManager.hasWallet();
      if (!has) {
        sendApprovalResult(ctx, undefined, 'No wallet found. Please set up Totem wallet at wallet.totem.ing');
        return;
      }
      if (WalletManager.isUnlocked()) {
        setStep('confirm');
      } else {
        setStep('password');
      }
    }
    init();
  }, [ctx]);

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

  function handleApprove() {
    const session = WalletManager.getSession();
    const account = session?.accounts.find(a => a.index === session.activeIndex);
    if (!account) { sendApprovalResult(ctx, undefined, 'No active account'); return; }
    sendApprovalResult(ctx, {
      connected: true,
      address: account.address,
      addressIndex: account.index,
      publicKey: account.publicKey,
      isReconnect: false,
    });
  }

  function handleReject() {
    sendApprovalResult(ctx, undefined, 'User rejected connection');
  }

  return (
    <div className="page" style={{ paddingTop: 'var(--space-3)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: 32, color: 'var(--axia-aqua)', marginBottom: 4 }}>⬡</div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase' }}>
          CONNECT REQUEST
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
          {origin}
        </p>
      </div>

      {step === 'loading' && (
        <div style={{ textAlign: 'center' }}><span className="spinner" /></div>
      )}

      {step === 'password' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
            Unlock your wallet to approve this connection.
          </p>
          <label className="label">Wallet Password</label>
          <input
            type="password"
            className="input"
            style={{ marginBottom: 'var(--space-2)' }}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            autoFocus
          />
          {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}
          <button className="btn btn-primary btn-full" onClick={handleUnlock} disabled={loading || !password}>
            {loading ? <span className="spinner" /> : 'Unlock →'}
          </button>
          <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }} onClick={handleReject}>
            Reject
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
              <strong>{origin}</strong> is requesting access to:
            </p>
            <ul style={{ paddingLeft: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: 2 }}>
              <li>Your wallet address</li>
              <li>Your public key</li>
              <li>Sign messages (with your approval each time)</li>
              <li>Request transactions (with your approval each time)</li>
            </ul>
          </div>
          <button className="btn btn-primary btn-full" onClick={handleApprove}>
            Approve Connection
          </button>
          <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }} onClick={handleReject}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
