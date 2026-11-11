/**
 * ConnectApproval — popup/redirect page shown when a dApp calls totem.connect()
 * User must unlock wallet and approve the connection.
 *
 * When the request carries `keepOpen=1`, the window stays open after approving
 * the connection so the caller can send the follow-up TOTEM_VERIFY (SIWE) sign
 * request into the same window. That keeps the wallet unlocked: one popup, one
 * password, and no second window that the browser may block.
 *
 * Origin/return handling is shared with SendApproval/VerifyApproval via
 * `approvalContext` (AUD-041).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { WalletManager } from '../core/WalletManager';
import { signVerificationMessage } from '../core/signMessage';
import { parseApprovalContext, sendApprovalResult, type ApprovalContext } from './approvalContext';
import { resolveVerifyTtlMs } from './verifyTtl';

interface FollowUpRequest {
  reqId: string;
  nonce: string;
  message: string;
  /** Caller-requested verification lifetime (`challenge.expiryMs`). */
  expiryMs?: string;
}

export function ConnectApproval() {
  const [step, setStep] = useState<'password' | 'confirm' | 'waiting' | 'sign' | 'done' | 'loading'>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [followUp, setFollowUp] = useState<FollowUpRequest | null>(null);
  const ctx = useMemo(parseApprovalContext, []);
  const keepOpen = useMemo(
    () => new URLSearchParams(window.location.search).get('keepOpen') === '1',
    [],
  );
  const origin = ctx.origin;

  useEffect(() => {
    if (step !== 'waiting') return;
    // If the caller already has a session it never sends the follow-up; do not
    // leave an empty approval window open indefinitely.
    const timer = setTimeout(() => window.close(), 90_000);
    return () => clearTimeout(timer);
  }, [step]);

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

  // Follow-up sign request from the same opener (provider sends this after the
  // connect response when it reuses this window for TOTEM_VERIFY).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.opener) return;
      if (ctx.targetOrigin && event.origin !== ctx.targetOrigin) return;

      const data = event.data as {
        type?: string;
        method?: string;
        reqId?: string;
        nonce?: string;
        params?: Record<string, string>;
      } | null;
      if (!data || data.type !== 'totem_request' || data.method !== 'TOTEM_VERIFY') return;

      const raw = data.params?.message ?? '';
      let message = raw;
      try { message = decodeURIComponent(raw); } catch { /* keep raw */ }

      setFollowUp({
        reqId: String(data.reqId ?? ''),
        nonce: String(data.nonce ?? ''),
        message,
        expiryMs: data.params?.expiryMs,
      });
      setStep(WalletManager.isUnlocked() ? 'sign' : 'password');
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ctx]);

  async function handleUnlock() {
    setLoading(true);
    setError('');
    try {
      await WalletManager.unlock(password);
      setStep(followUp ? 'sign' : 'confirm');
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
    sendApprovalResult(
      ctx,
      {
        connected: true,
        address: account.address,
        addressIndex: account.index,
        publicKey: account.publicKey,
        isReconnect: false,
      },
      undefined,
      { keepOpen },
    );
    if (keepOpen) setStep('waiting');
  }

  function handleReject() {
    sendApprovalResult(ctx, undefined, 'User rejected connection');
  }

  async function handleSignMessage() {
    if (!followUp) return;
    setSigning(true);
    setError('');
    const signCtx: ApprovalContext = { ...ctx, reqId: followUp.reqId, nonce: followUp.nonce };
    try {
      const signature = await signVerificationMessage(followUp.message);
      const account = WalletManager.getActiveAccount();
      sendApprovalResult(signCtx, {
        verified: true,
        verificationId: `verify_${Date.now()}`,
        address: account?.address ?? '',
        publicKey: account?.publicKey ?? '',
        signature,
        message: followUp.message,
        expiresAt: Date.now() + resolveVerifyTtlMs(followUp.expiryMs),
      });
      setStep('done');
    } catch (e) {
      sendApprovalResult(signCtx, undefined, String(e));
      setError(String(e));
      setStep('done');
    } finally {
      setSigning(false);
    }
  }

  function handleRejectSign() {
    if (!followUp) return;
    sendApprovalResult(
      { ...ctx, reqId: followUp.reqId, nonce: followUp.nonce },
      undefined,
      'User rejected signing',
    );
    setStep('done');
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

      {step === 'waiting' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--axia-aqua)', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-1)' }}>
            Connected ✓
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Waiting for the sign-in request…
          </p>
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 'var(--space-2)' }}
            onClick={() => window.close()}
          >
            Close
          </button>
        </div>
      )}

      {step === 'sign' && followUp && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
            Sign in to <strong>{origin}</strong> by signing this message:
          </p>
          <div
            className="card"
            style={{
              marginBottom: 'var(--space-3)',
              maxHeight: 220,
              overflow: 'auto',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {followUp.message}
          </div>
          {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}
          <button className="btn btn-primary btn-full" onClick={handleSignMessage} disabled={signing}>
            {signing ? <span className="spinner" /> : 'Sign in'}
          </button>
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 'var(--space-1)' }}
            onClick={handleRejectSign}
            disabled={signing}
          >
            Reject
          </button>
        </div>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--axia-aqua)', fontWeight: 'var(--weight-bold)' }}>Done ✓</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            You can close this window.
          </p>
        </div>
      )}
    </div>
  );
}
