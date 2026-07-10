/**
 * VerifyApproval — sign message popup/redirect (TOTEM_SIGN_DATA)
 * Signs the digestTx or message from the params using the WOTS key.
 */
import React, { useState, useEffect } from 'react';
import { WalletManager } from '../core/WalletManager';
import { signAndSerialize } from '../core/signing';
import { fromHex } from '../core/utils';

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
  if (source === 'protocol-handler') {
    const fromParam = params.get('origin');
    return fromParam ? decodeURIComponent(fromParam) : 'native-app://unknown';
  }
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
    // mode=verify → TOTEM_VERIFY (sign message, return address+pubkey+sig+message)
    // mode=sign   → TOTEM_SIGN_DATA (sign tx hash / message bytes, return sig+digestTx+blobHash)
    mode: url.searchParams.get('mode') ?? 'sign',
    message: decodeURIComponent(url.searchParams.get('message') ?? ''),
    digestTx: url.searchParams.get('digestTx') ?? '',
    blobHash: url.searchParams.get('blobHash') ?? '',
    unsignedHex: url.searchParams.get('unsignedHex') ?? '',
    reqId: url.searchParams.get('reqId') ?? '',
  };
}

function isPopup(): boolean { return window.opener !== null; }

function isCustomScheme(url: string): boolean {
  try { return !['https:', 'http:'].includes(new URL(url).protocol); } catch { return true; }
}

function sendResult(result: unknown, error?: string, reqId?: string) {
  const payload = { type: 'totem_response', reqId, result, error };
  const url = new URL(window.location.href);
  const returnUrl = url.searchParams.get('returnUrl');

  if (returnUrl && isCustomScheme(returnUrl)) {
    const ret = new URL(returnUrl);
    ret.searchParams.set('totem_result', btoa(JSON.stringify(error ? { error } : result)));
    if (reqId) ret.searchParams.set('totem_reqid', reqId);
    window.location.href = ret.toString();
    return;
  }

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

export function VerifyApproval() {
  const [step, setStep] = useState<'password' | 'confirm' | 'signing'>('confirm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { origin, mode, message, digestTx, blobHash, unsignedHex, reqId } = getParams();
  const isVerifyMode = mode === 'verify';

  const displayContent = digestTx || message || blobHash || '(empty)';
  const isHexSigning = !isVerifyMode && (!!digestTx || !!unsignedHex);

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

  async function handleSign() {
    setStep('signing');
    try {
      const treeKey = await WalletManager.getActiveTreeKey();
      let sigBytes: Uint8Array;

      if (isHexSigning && (digestTx || unsignedHex)) {
        // Sign the raw hex bytes of the digestTx / transaction hash
        const hexStr = (digestTx || unsignedHex).replace(/^0x/, '');
        sigBytes = fromHex(hexStr);
      } else {
        // Sign the UTF-8 message bytes (verify mode or plain message)
        sigBytes = new TextEncoder().encode(message);
      }

      const signature = await signAndSerialize(treeKey, sigBytes);

      if (isVerifyMode) {
        const account = WalletManager.getActiveAccount();
        sendResult({
          verified: true,
          verificationId: `verify_${Date.now()}`,
          address:   account?.address   ?? '',
          publicKey: account?.publicKey ?? '',
          signature,
          message,
          expiresAt: Date.now() + 3600000,
        }, undefined, reqId);
      } else {
        const account = WalletManager.getActiveAccount();
        sendResult({
          success: true,
          signedHex: signature,
          signatures: [{ signature, digestTx, blobHash }],
          signerAddress: account?.address ?? '',
          signerIndex: account?.index ?? 0,
          inputsSigned: [0],
          status: 'signed',
        }, undefined, reqId);
      }
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
        }}>{isHexSigning ? 'SIGN TRANSACTION' : 'SIGN MESSAGE'}</h2>
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
          <p className="label">{isHexSigning ? 'Transaction hash to sign' : 'Message to sign'}</p>
          <div style={{
            background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)',
            padding: 'var(--space-2)', fontFamily: 'var(--font-family-mono)',
            fontSize: 'var(--text-sm)', wordBreak: 'break-all',
            marginBottom: 'var(--space-3)', maxHeight: 200, overflowY: 'auto',
          }}>
            {displayContent}
          </div>
          <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>
            ⚠ Signing uses a WOTS one-time key. Verify this carefully.
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSign}>
            {isHexSigning ? 'Sign Transaction →' : 'Sign Message →'}
          </button>
          <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }}
            onClick={() => sendResult(undefined, 'User rejected', reqId)}>Reject</button>
        </div>
      )}

      {step === 'signing' && (
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-4)' }}>
          <span className="spinner" style={{ width: 32, height: 32, marginBottom: 'var(--space-2)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Signing with WOTS…</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4 }}>
            This may take 10–40 seconds
          </p>
        </div>
      )}
    </div>
  );
}
