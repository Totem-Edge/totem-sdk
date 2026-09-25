/**
 * VerifyApproval — sign message popup/redirect (TOTEM_SIGN_DATA)
 * Signs the digestTx or message from the params using the WOTS key.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { WalletManager } from '../core/WalletManager';
import { signAndSerialize } from '../core/signing';
import { fromHex } from '../core/utils';
import { parseApprovalContext, sendApprovalResult } from './approvalContext';

function getParams() {
  const url = new URL(window.location.href);
  return {
    // mode=verify → TOTEM_VERIFY (sign message, return address+pubkey+sig+message)
    // mode=sign   → TOTEM_SIGN_DATA (sign tx hash / message bytes, return sig+digestTx+blobHash)
    mode: url.searchParams.get('mode') ?? 'sign',
    message: decodeURIComponent(url.searchParams.get('message') ?? ''),
    digestTx: url.searchParams.get('digestTx') ?? '',
    blobHash: url.searchParams.get('blobHash') ?? '',
    unsignedHex: url.searchParams.get('unsignedHex') ?? '',
  };
}

export function VerifyApproval() {
  const [step, setStep] = useState<'password' | 'confirm' | 'signing'>('confirm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const ctx = useMemo(parseApprovalContext, []);
  const { mode, message, digestTx, blobHash, unsignedHex } = getParams();
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
      // Reserve a unique WOTS leaf BEFORE signing. Message signing is not driven
      // by a server lease, so without this every popup reused leaf 0 (AUD-001).
      const uses = await WalletManager.reserveNextUse();
      let sigBytes: Uint8Array;

      if (isHexSigning && (digestTx || unsignedHex)) {
        // Sign the raw hex bytes of the digestTx / transaction hash
        const hexStr = (digestTx || unsignedHex).replace(/^0x/, '');
        sigBytes = fromHex(hexStr);
      } else {
        // Sign the UTF-8 message bytes (verify mode or plain message)
        sigBytes = new TextEncoder().encode(message);
      }

      const signature = await signAndSerialize(treeKey, sigBytes, uses);

      if (isVerifyMode) {
        const account = WalletManager.getActiveAccount();
        sendApprovalResult(ctx, {
          verified: true,
          verificationId: `verify_${Date.now()}`,
          address:   account?.address   ?? '',
          publicKey: account?.publicKey ?? '',
          signature,
          message,
          expiresAt: Date.now() + 3600000,
        });
      } else {
        const account = WalletManager.getActiveAccount();
        sendApprovalResult(ctx, {
          success: true,
          signedHex: signature,
          signatures: [{ signature, digestTx, blobHash }],
          signerAddress: account?.address ?? '',
          signerIndex: account?.index ?? 0,
          inputsSigned: [0],
          status: 'signed',
        });
      }
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
        }}>{isHexSigning ? 'SIGN TRANSACTION' : 'SIGN MESSAGE'}</h2>
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
            onClick={() => sendApprovalResult(ctx, undefined, 'User rejected')}>Reject</button>
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
