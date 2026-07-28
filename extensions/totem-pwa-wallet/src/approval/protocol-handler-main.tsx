/**
 * protocol-handler-main.tsx — Entry point for web+totem:// protocol invocations.
 *
 * When a native app (or any OS handler) opens a web+totem:// URL, the PWA's
 * manifest protocol_handlers entry routes it here.  This page parses the
 * encoded request, validates the returnUrl, and redirects to the appropriate
 * approval page.
 *
 * Expected URL format:
 *   web+totem://approval/<page>?method=TOTEM_CONNECT&origin=...&returnUrl=...&...
 *
 * The native app constructs this URL and the OS delivers it to the installed
 * PWA via the protocol handler registration.
 */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../theme/axia-tokens.css';

const ALLOWED_RETURN_SCHEMES = ['https', 'http', 'myapp', 'totem'];

function parseRequest(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('request') ?? '';
  // raw is the full web+totem:// URL — extract query params from it
  try {
    const parsed = new URL(raw);
    const qs: Record<string, string> = {};
    parsed.searchParams.forEach((v, k) => { qs[k] = v; });
    return qs;
  } catch {
    // If the URL is malformed, try treating raw as a query string directly
    const qs: Record<string, string> = {};
    const inner = new URLSearchParams(raw);
    inner.forEach((v, k) => { qs[k] = v; });
    return qs;
  }
}

function validateReturnUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (ALLOWED_RETURN_SCHEMES.includes(u.protocol.replace(':', ''))) {
      return url;
    }
  } catch { /* invalid */ }
  return null;
}

function ProtocolHandler() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = parseRequest();
    const method = qs.method ?? 'TOTEM_CONNECT';
    const origin = qs.origin ?? 'native-app://unknown';
    const returnUrl = qs.returnUrl ?? '';
    const reqId = qs.reqId ?? `native_${Date.now()}`;

    const validatedReturn = validateReturnUrl(returnUrl);
    if (returnUrl && !validatedReturn) {
      setError(`Return URL scheme not allowed: ${returnUrl}`);
      return;
    }

    // Map method to approval page path
    const methodToPath: Record<string, string> = {
      TOTEM_CONNECT: '/approval/connect.html',
      TOTEM_VERIFY: '/approval/verify.html',
      TOTEM_SEND_TRANSACTION: '/approval/send.html',
      TOTEM_SIGN_DATA: '/approval/verify.html',
      TOTEM_SEND_COMPLEX: '/approval/send.html',
      TOTEM_PROVE_OWNERSHIP: '/approval/verify.html',
      TOTEM_BROADCAST_HEX: '/approval/send.html',
      TOTEM_GET_COINS: '/approval/connect.html',
    };

    const path = methodToPath[method] ?? '/approval/connect.html';

    // Build the redirect URL — pass all original params plus the validated returnUrl
    const target = new URL(path, window.location.origin);
    target.searchParams.set('origin', origin);
    target.searchParams.set('reqId', reqId);
    target.searchParams.set('returnUrl', validatedReturn ?? returnUrl);
    target.searchParams.set('source', 'protocol-handler');

    // Forward any method-specific params
    for (const [k, v] of Object.entries(qs)) {
      if (!['method', 'origin', 'returnUrl', 'reqId'].includes(k)) {
        target.searchParams.set(k, v);
      }
    }

    window.location.href = target.toString();
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2>Invalid Request</h2>
        <p style={{ color: 'var(--axia-red)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <p>Opening Totem Wallet…</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ProtocolHandler /></React.StrictMode>
);
