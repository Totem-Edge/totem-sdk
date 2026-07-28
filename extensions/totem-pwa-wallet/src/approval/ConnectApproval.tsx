/**
 * ConnectApproval — popup/redirect page shown when a dApp calls totem.connect()
 * User must unlock wallet and approve the connection.
 */
import React, { useState, useEffect } from 'react';
import { WalletManager } from '../core/WalletManager';
import { VaultStore } from '../stores/VaultStore';

/**
 * Derive the caller origin from a trusted source.
 * - For protocol-handler (native app) calls: use the ?origin= param directly
 *   (the protocol handler page validates the returnUrl before forwarding)
 * - For web dApps: document.referrer is set by the browser when a popup/tab
 *   is opened from a page and cannot be spoofed via URL query-param manipulation.
 *   The ?origin= param is used only as a fallback for the redirect flow (where
 *   the browser clears the referrer on full-page navigation).
 */
function trustedCallerOrigin(): string {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('source');

  // Native app calls via protocol handler — trust the origin param
  if (source === 'protocol-handler') {
    const fromParam = params.get('origin');
    return fromParam ? decodeURIComponent(fromParam) : 'native-app://unknown';
  }

  // Web dApp calls — prefer document.referrer (browser-set, unspoofable)
  if (document.referrer) {
    try { return new URL(document.referrer).origin; } catch { /* malformed */ }
  }
  const fromParam = params.get('origin');
  return fromParam ? decodeURIComponent(fromParam) : 'Unknown dApp';
}

function getParams() {
  const url = new URL(window.location.href);
  return {
    origin: trustedCallerOrigin(),
    reqId: url.searchParams.get('reqId') ?? '',
  };
}

function isPopup(): boolean {
  return window.opener !== null;
}

function isCustomScheme(url: string): boolean {
  try { return !['https:', 'http:'].includes(new URL(url).protocol); } catch { return true; }
}

function sendResult(result: unknown, error?: string, reqId?: string) {
  const payload = { type: 'totem_response', reqId, result, error };
  const url = new URL(window.location.href);
  const returnUrl = url.searchParams.get('returnUrl');

  // Custom scheme (native app callback) — redirect directly, no postMessage/BC
  if (returnUrl && isCustomScheme(returnUrl)) {
    const ret = new URL(returnUrl);
    ret.searchParams.set('totem_result', btoa(JSON.stringify(error ? { error } : result)));
    if (reqId) ret.searchParams.set('totem_reqid', reqId);
    window.location.href = ret.toString();
    return;
  }

  // BroadcastChannel — delivers result to the dApp page when opened as a new
  // tab on mobile (where window.opener may be null cross-origin).
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
  } else if (returnUrl) {
    const ret = new URL(returnUrl);
    ret.searchParams.set('totem_result', btoa(JSON.stringify(error ? { error } : result)));
    if (reqId) ret.searchParams.set('totem_reqid', reqId);
    window.location.href = ret.toString();
  }
}

export function ConnectApproval() {
  const [step, setStep] = useState<'password' | 'confirm' | 'loading'>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { origin, reqId } = getParams();

  useEffect(() => {
    async function init() {
      const has = await WalletManager.hasWallet();
      if (!has) {
        sendResult(undefined, 'No wallet found. Please set up Totem wallet at wallet.totem.ing', reqId);
        return;
      }
      if (WalletManager.isUnlocked()) {
        setStep('confirm');
      } else {
        setStep('password');
      }
    }
    init();
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

  function handleApprove() {
    const session = WalletManager.getSession();
    const account = session?.accounts.find(a => a.index === session.activeIndex);
    if (!account) { sendResult(undefined, 'No active account', reqId); return; }
    sendResult({
      connected: true,
      address: account.address,
      addressIndex: account.index,
      publicKey: account.publicKey,
      isReconnect: false,
    }, undefined, reqId);
  }

  function handleReject() {
    sendResult(undefined, 'User rejected connection', reqId);
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
