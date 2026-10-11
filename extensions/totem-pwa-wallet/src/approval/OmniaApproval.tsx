/**
 * Omnia operation approval (RFC-037-A2).
 *
 * The injected provider cannot sign, so Omnia mutation methods
 * (`totem_omniaOpenChannel`/`Pay`/`Settle`/`CloseChannel`/`CreateFactory`/
 * `SpliceIn`/`SpliceOut`) open this page on the wallet origin. It unlocks the
 * wallet, builds the channel signing material + root-identity anchor, executes
 * the requested method via `@totemsdk/omnia-relay`, and returns the result to the
 * provider (postMessage / redirect), mirroring the send/verify approvals.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createOmniaRelayClient, type RelayOmniaClient } from '@totemsdk/omnia-relay';
import { WalletManager } from '../core/WalletManager';
import { buildPwaOmniaSigningMaterial } from '../core/omnia';
import { parseApprovalContext, sendApprovalResult } from './approvalContext';

type Step = 'password' | 'confirm' | 'working' | 'done' | 'error';

interface OmniaRequest {
  method: string;
  params: Record<string, unknown>;
}

function readRequest(): OmniaRequest {
  const q = new URLSearchParams(window.location.search);
  const method = q.get('method') ?? '';
  let params: Record<string, unknown> = {};
  const raw = q.get('params');
  if (raw) {
    try {
      params = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* ignore malformed params */
    }
  }
  return { method, params };
}

/** `totem_omniaPay` → `pay`, `totem_omniaCreateFactory` → `createFactory`. */
function clientMethodName(method: string): string {
  const tail = method.replace(/^totem_omnia/, '');
  return tail.charAt(0).toLowerCase() + tail.slice(1);
}

const LABELS: Record<string, string> = {
  openChannel: 'Open channel',
  pay: 'Channel payment',
  settle: 'Settle channel',
  closeChannel: 'Close channel',
  createFactory: 'Create factory',
  spliceIn: 'Splice in',
  spliceOut: 'Splice out',
};

export function OmniaApproval() {
  const ctx = useMemo(() => parseApprovalContext(), []);
  const request = useMemo(() => readRequest(), []);
  const [step, setStep] = useState<Step>(WalletManager.isUnlocked() ? 'confirm' : 'password');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const label = LABELS[clientMethodName(request.method)] ?? request.method;

  useEffect(() => {
    if (step === 'done') {
      const t = setTimeout(() => window.close(), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await WalletManager.unlock(password);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleApprove() {
    setStep('working');
    setError(null);
    let client: RelayOmniaClient | undefined;
    try {
      const material = await buildPwaOmniaSigningMaterial();
      if (!material) {
        throw new Error(
          'Omnia channel operations require self-hosted WOTS key mode (Network Settings → key use).',
        );
      }
      client = createOmniaRelayClient({
        autoAccept: false,
        signer: material.signer,
        leaseProvider: material.leaseProvider,
        chainProvider: material.chainProvider,
        localParticipant: material.participant,
      });
      const name = clientMethodName(request.method);
      const fn = (client as unknown as Record<string, unknown>)[name];
      if (typeof fn !== 'function') {
        throw new Error(`Unsupported Omnia method: ${request.method}`);
      }
      const result = await (fn as (p: Record<string, unknown>) => Promise<unknown>).call(client, request.params);
      sendApprovalResult(ctx, result);
      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep('error');
      sendApprovalResult(ctx, undefined, msg);
    } finally {
      client?.close?.().catch(() => {});
    }
  }

  function handleReject() {
    sendApprovalResult(ctx, undefined, 'User rejected the Omnia operation');
    window.close();
  }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, sans-serif', maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18 }}>{label}</h1>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        {ctx.origin ? `Requested by ${ctx.origin}` : 'Omnia operation request'}
      </p>

      {step === 'password' && (
        <form onSubmit={handleUnlock}>
          <input
            type="password"
            placeholder="Wallet password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 12 }}
          />
          <button type="submit" style={{ width: '100%', padding: 10 }}>Unlock</button>
        </form>
      )}

      {step === 'confirm' && (
        <>
          <pre style={{ background: '#0b1220', color: '#cbd5e1', padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto' }}>
            {JSON.stringify(request.params, null, 2)}
          </pre>
          <button onClick={handleApprove} style={{ width: '100%', padding: 10, marginBottom: 8 }}>Approve</button>
          <button onClick={handleReject} style={{ width: '100%', padding: 10 }}>Reject</button>
        </>
      )}

      {step === 'working' && <p>Executing…</p>}
      {step === 'done' && <p>Done — you can close this window.</p>}
      {step === 'error' && <p style={{ color: '#f87171' }}>{error}</p>}
      {error && step !== 'error' && <p style={{ color: '#f87171' }}>{error}</p>}
    </div>
  );
}
