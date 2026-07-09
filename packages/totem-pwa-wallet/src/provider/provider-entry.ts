/**
 * provider.js — Totem PWA cross-origin embed script
 *
 * Required dApp-facing API (TOTEM_CONNECT v4.2):
 *   window.totem.request({ method: 'TOTEM_CONNECT',           params? })
 *   window.totem.request({ method: 'TOTEM_VERIFY',            params: { challenge: { statement } } })
 *   window.totem.request({ method: 'TOTEM_GET_ACCOUNTS',      params? })   // inline, no popup
 *   window.totem.request({ method: 'TOTEM_SEND_TRANSACTION',  params: { to, amount, tokenId? } })
 *   window.totem.request({ method: 'TOTEM_DISCONNECT' })                   // inline, no popup
 *
 * Extension-era aliases (backwards compat):
 *   window.totem.request({ method: 'TOTEM_SIGN_DATA',         params })   → verify page
 *   window.totem.request({ method: 'TOTEM_SEND_COMPLEX',      params })   → send page
 *   window.totem.request({ method: 'TOTEM_GET_COINS',         params })
 *   window.totem.request({ method: 'TOTEM_BROADCAST_HEX',     params })
 *   window.totem.request({ method: 'TOTEM_PROVE_OWNERSHIP',   params })
 *
 * Convenience shortcuts:
 *   window.totem.enable()          → TOTEM_CONNECT
 *   window.totem.signData(params)  → TOTEM_SIGN_DATA
 *   window.totem.sendComplex(...)  → TOTEM_SEND_COMPLEX
 *   window.totem.disconnect()      → TOTEM_DISCONNECT
 *
 * Events (MetaMask-style):
 *   window.totem.on('accountsChanged', cb)
 *   window.totem.removeListener('accountsChanged', cb)
 *
 * Transport — popup on desktop, new tab on mobile:
 *   Desktop: constrained popup (400×640).
 *   Mobile:  window.open(url, '_blank') — new tab keeps window.opener so
 *            the approval page can postMessage result back without page reload.
 *            Promise semantics are preserved on both platforms.
 *   Fallback (popup/tab blocked): full-page redirect; result delivered via
 *            'totem#result' CustomEvent on return. Promise stays pending.
 *
 * NOTE: /approval/* pages must NOT set Cross-Origin-Opener-Policy: same-origin
 * (handled in public/_headers) so window.opener survives cross-origin openers.
 */

(function () {
  'use strict';

  // __WALLET_ORIGIN__ is injected at build time by vite.provider.config.ts → define.
  // The globals.d.ts declaration silences TypeScript; esbuild replaces the identifier.
  const WALLET_ORIGIN: string = __WALLET_ORIGIN__;
  const POPUP_W = 400;
  const POPUP_H = 640;

  type EventCallback = (...args: unknown[]) => void;

  const pendingRequests = new Map<string, {
    method: string;
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
  }>();
  const eventListeners = new Map<string, Set<EventCallback>>();
  let reqCounter = 0;

  // Track connected accounts so TOTEM_GET_ACCOUNTS can resolve inline
  let connectedAccounts: string[] = [];

  /**
   * On mobile, window.totem.request() redirects to the wallet.  The page
   * unloads, so the original Promise is abandoned.  When the wallet redirects
   * back with ?totem_reqid=&totem_result=, checkRedirectReturn() parses the
   * result and stores it here.
   *
   * The NEXT call to window.totem.request() with the same method automatically
   * resolves from this cache without re-opening the wallet, preserving the
   * "await window.totem.request()" contract for dApps with no code changes.
   */
  let _redirectReturn: { method: string; result: unknown; error?: string } | null = null;

  function emitEvent(name: string, ...args: unknown[]): void {
    const cbs = eventListeners.get(name);
    if (cbs) cbs.forEach(cb => { try { cb(...args); } catch { /* ignored */ } });
  }

  function genId(): string {
    return `totem_${Date.now()}_${++reqCounter}`;
  }

  function isMobile(): boolean {
    return navigator.maxTouchPoints > 1 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  /**
   * Returns the approval-page path for methods that need a popup/tab.
   * Returns null for methods handled inline (TOTEM_DISCONNECT, TOTEM_GET_ACCOUNTS).
   * Returns undefined for unknown methods.
   */
  function methodToPath(method: string): string | null | undefined {
    switch (method) {
      // ── Required v4.2 methods ──────────────────────────────────────────────
      case 'TOTEM_CONNECT':           return '/approval/connect.html';
      case 'TOTEM_VERIFY':            return '/approval/verify.html';
      case 'TOTEM_SEND_TRANSACTION':  return '/approval/send.html';
      case 'TOTEM_GET_ACCOUNTS':      return null;  // inline
      case 'TOTEM_DISCONNECT':        return null;  // inline
      // ── Extension-era aliases (backwards compat) ──────────────────────────
      case 'TOTEM_SIGN_DATA':         return '/approval/verify.html';
      case 'TOTEM_SEND_COMPLEX':      return '/approval/send.html';
      case 'TOTEM_PROVE_OWNERSHIP':   return '/approval/verify.html';
      case 'TOTEM_BROADCAST_HEX':     return '/approval/send.html';
      case 'TOTEM_GET_COINS':         return '/approval/connect.html';
      default: return undefined; // unsupported
    }
  }

  function paramsToQs(method: string, params?: Record<string, unknown>): Record<string, string> {
    if (!params) return {};
    const out: Record<string, string> = {};

    // TOTEM_VERIFY: { challenge: { statement } } → message=statement, mode=verify
    if (method === 'TOTEM_VERIFY') {
      const challenge = params.challenge as Record<string, unknown> | undefined;
      if (challenge?.statement) out.message = encodeURIComponent(String(challenge.statement));
      out.mode = 'verify';
    }

    // TOTEM_SEND_TRANSACTION: { to, amount, tokenId? } → direct params
    if (method === 'TOTEM_SEND_TRANSACTION') {
      if (params.to)      out.to      = String(params.to);
      if (params.amount)  out.amount  = String(params.amount);
      if (params.tokenId) out.tokenId = String(params.tokenId);
    }

    // TOTEM_SIGN_DATA (extension-era): { signingManifest, unsignedHex }
    if (method === 'TOTEM_SIGN_DATA' && params.signingManifest) {
      const m = params.signingManifest as Record<string, unknown>;
      if (m.digestTx) out.digestTx = String(m.digestTx);
      if (m.blobHash) out.blobHash = String(m.blobHash);
      if (params.unsignedHex) out.unsignedHex = String(params.unsignedHex);
    }

    // TOTEM_SEND_COMPLEX (extension-era): { buildParams: { to, amount, tokenId } }
    if (method === 'TOTEM_SEND_COMPLEX' && params.buildParams) {
      const bp = params.buildParams as Record<string, unknown>;
      if (bp.to)      out.to      = String(bp.to);
      if (bp.amount)  out.amount  = String(bp.amount);
      if (bp.tokenId) out.tokenId = String(bp.tokenId);
    }

    return out;
  }

  /**
   * Open the wallet for an approval request.
   *
   * Transport strategy:
   *   Desktop — constrained popup window (400×640).  The approval page calls
   *   window.opener.postMessage(result) then window.close() so the Promise in
   *   the dApp resolves without any page navigation.
   *
   *   Mobile (iOS/Android) — open as a new tab (_blank, no dimensions) so
   *   window.opener is preserved.  The approval tab calls
   *   window.opener.postMessage(result) + window.close() exactly like desktop,
   *   keeping window.totem.request() Promise semantics intact.
   *
   *   Fallback (popup/tab blocked) — full-page redirect with ?totem_result= return.
   *   dApps can listen to the 'totem#result' CustomEvent dispatched on reload.
   */
  function openWalletWindow(id: string, method: string, path: string, qs: Record<string, string>): void {
    const returnUrl = window.location.href.split('?')[0];
    const query = new URLSearchParams({
      ...qs,
      origin: window.location.origin,
      reqId: id,
      returnUrl,
    }).toString();
    const url = `${WALLET_ORIGIN}${path}?${query}`;

    if (isMobile()) {
      // Mobile: full-page redirect (required transport on mobile).
      // Store reqId + method so checkRedirectReturn() can cache the result on
      // return.  The NEXT request() call with the same method auto-resolves from
      // _redirectReturn without re-opening the wallet.
      sessionStorage.setItem('totem_redirect_id', id);
      sessionStorage.setItem('totem_redirect_method', method);
      window.location.href = url;
      return;
    }

    // Desktop: constrained popup (400×640).
    const walletWin = window.open(
      url, `totem_${id}`,
      `width=${POPUP_W},height=${POPUP_H},` +
      `top=${Math.max(0, Math.round(window.screenY + (window.outerHeight - POPUP_H) / 2))},` +
      `left=${Math.max(0, Math.round(window.screenX + (window.outerWidth  - POPUP_W) / 2))},` +
      'resizable=no,scrollbars=no,status=no,toolbar=no,menubar=no',
    );

    if (!walletWin) {
      // Popup blocked on desktop — fall back to redirect.
      sessionStorage.setItem('totem_redirect_id', id);
      sessionStorage.setItem('totem_redirect_method', method);
      window.location.href = url;
      return;
    }

    // BroadcastChannel listener — resolves the Promise when the approval page
    // broadcasts the result (used when window.opener is null cross-origin, e.g.
    // mobile browsers that null opener on cross-origin new-tab navigation).
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`totem_response_${id}`);
      bc.onmessage = (e: MessageEvent) => {
        bc?.close(); bc = null;
        clearInterval(closedCheck);
        const msg = e.data as { type?: string; reqId?: string; result?: unknown; error?: string };
        if (msg.type !== 'totem_response') return;
        const p = pendingRequests.get(id);
        if (!p) return;
        pendingRequests.delete(id);
        if (msg.error) { p.reject(new Error(msg.error)); return; }
        if (p.method === 'TOTEM_CONNECT') {
          const r = msg.result as { address?: string } | null;
          if (r?.address) { connectedAccounts = [r.address]; emitEvent('accountsChanged', [r.address]); }
        }
        p.resolve(msg.result);
        if (!walletWin.closed) walletWin.close();
      };
    } catch { /* BroadcastChannel not supported in this browser */ }

    // Poll for closed-without-response (user manually closes popup/tab)
    const closedCheck = setInterval(() => {
      if (walletWin.closed) {
        clearInterval(closedCheck);
        bc?.close(); bc = null;
        const p = pendingRequests.get(id);
        if (p) {
          pendingRequests.delete(id);
          p.reject(new Error('User closed wallet'));
        }
      }
    }, 500);
  }

  // On load: check whether we returned from a redirect-based approval.
  // If so, cache the result in _redirectReturn so that the NEXT call to
  // window.totem.request() with the same method auto-resolves immediately,
  // preserving Promise semantics across the page reload.
  (function checkRedirectReturn() {
    const params = new URLSearchParams(window.location.search);
    const b64    = params.get('totem_result');
    const rid    = params.get('totem_reqid') ?? sessionStorage.getItem('totem_redirect_id') ?? '';
    if (!b64 || !rid) return;

    // Clean params from the URL so the app sees a clean address.
    try {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('totem_result');
      clean.searchParams.delete('totem_reqid');
      window.history.replaceState({}, '', clean.toString());
    } catch { /* ignore */ }

    // Retrieve the method that triggered the redirect.
    const method = sessionStorage.getItem('totem_redirect_method') ?? '';
    sessionStorage.removeItem('totem_redirect_id');
    sessionStorage.removeItem('totem_redirect_method');

    try {
      const parsed = JSON.parse(atob(b64)) as { error?: string; [k: string]: unknown };

      // Cache result keyed by method.  request() checks this before opening
      // the wallet, so `await window.totem.request({method})` resolves on the
      // very next call — the standard dApp pattern after a mobile redirect.
      if (method) {
        _redirectReturn = { method, result: parsed, error: parsed.error };
        // For TOTEM_CONNECT, also update connectedAccounts eagerly.
        if (method === 'TOTEM_CONNECT' && !parsed.error) {
          const r = parsed as { address?: string };
          if (r.address && !connectedAccounts.includes(r.address)) {
            connectedAccounts = [r.address];
          }
        }
      }

      // Dispatch event for dApps that prefer event-driven patterns.
      window.dispatchEvent(new CustomEvent('totem#result', { detail: { reqId: rid, result: parsed, method } }));

      // Also resolve any pending in-memory request (same-tab redirect with no reload).
      const p = pendingRequests.get(rid);
      if (p) {
        pendingRequests.delete(rid);
        parsed.error ? p.reject(new Error(parsed.error)) : p.resolve(parsed);
      }
    } catch { /* ignore parse errors */ }
  })();

  // Listen for responses from the approval pages (postMessage from wallet origin)
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== WALLET_ORIGIN) return;
    const data = event.data as {
      type?: string;
      reqId?: string;
      id?: string;
      result?: unknown;
      error?: string;
    };
    if (!data || data.type !== 'totem_response') return;
    const id = data.reqId ?? data.id ?? '';
    if (!id) return;
    const pending = pendingRequests.get(id);
    if (!pending) return;
    pendingRequests.delete(id);
    if (data.error) {
      pending.reject(new Error(data.error));
    } else {
      // After TOTEM_CONNECT resolves, store the address and emit accountsChanged
      if (pending.method === 'TOTEM_CONNECT') {
        const r = data.result as { address?: string } | null;
        if (r?.address && !connectedAccounts.includes(r.address)) {
          connectedAccounts = [r.address];
          emitEvent('accountsChanged', connectedAccounts);
        }
      }
      pending.resolve(data.result);
    }
  });

  // Listen for TOTEM_EVENT broadcasts from wallet (balance updates, etc.)
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== WALLET_ORIGIN) return;
    const data = event.data as { type?: string; eventName?: string; data?: unknown };
    if (!data || data.type !== 'TOTEM_EVENT') return;
    emitEvent(data.eventName ?? '', data.data);
  });

  // ── Public API ─────────────────────────────────────────────────────────────

  const totemProvider = {
    isTotem: true as const,
    version: '1.0.0' as const,

    /**
     * Main entry point — mirrors extension's window.totem.request() exactly.
     * Resolves with the approval result or rejects on user-cancel / timeout.
     */
    request(args: { method: string; params?: Record<string, unknown> }): Promise<unknown> {
      const { method, params } = args;

      // ── Inline methods — no popup required ────────────────────────────────
      if (method === 'TOTEM_DISCONNECT') {
        connectedAccounts = [];
        emitEvent('accountsChanged', []);
        window.dispatchEvent(new CustomEvent('totem#disconnected'));
        return Promise.resolve(null);
      }

      if (method === 'TOTEM_GET_ACCOUNTS') {
        // Return snapshot of accounts connected in this session.
        // Result shape: { accounts: [{ address, chainId }] }
        const accounts = connectedAccounts.map(addr => ({ address: addr, chainId: 'minima' }));
        return Promise.resolve({ accounts });
      }

      // Auto-resolve from redirect-return cache (mobile redirect flow).
      // After a full-page redirect the page reloads; the dApp calls request()
      // again with the same method and we resolve immediately from the cached
      // result — preserving `await window.totem.request()` with no dApp changes.
      if (_redirectReturn && _redirectReturn.method === method) {
        const ret = _redirectReturn;
        _redirectReturn = null; // consume once
        if (ret.error) return Promise.reject(new Error(ret.error));
        // Side-effect: emit accountsChanged for TOTEM_CONNECT
        if (method === 'TOTEM_CONNECT') {
          const r = ret.result as { address?: string } | null;
          if (r?.address) emitEvent('accountsChanged', [r.address]);
        }
        return Promise.resolve(ret.result);
      }

      const path = methodToPath(method);

      // Unknown / unsupported method
      if (path === undefined) {
        return Promise.reject(new Error(`Unsupported method: ${method}`));
      }

      const id  = genId();
      const qs  = paramsToQs(method, params);

      // Notify wallet app so telemetry can record provider events with context fields.
      window.dispatchEvent(new CustomEvent('totem#connect-requested', {
        detail: {
          callerOrigin: window.location.origin,
          method,
          mode: isMobile() ? 'redirect' : 'popup',
        },
      }));

      return new Promise<unknown>((resolve, reject) => {
        // 90-second hard timeout — WOTS signing can take ~40 s
        const timer = setTimeout(() => {
          if (pendingRequests.delete(id)) reject(new Error('Request timeout'));
        }, 90_000);

        pendingRequests.set(id, {
          method,
          resolve: (v) => { clearTimeout(timer); resolve(v); },
          reject:  (e) => { clearTimeout(timer); reject(e); },
        });

        openWalletWindow(id, method, path!, qs);
      });
    },

    on(eventName: string, callback: EventCallback): void {
      if (!eventListeners.has(eventName)) eventListeners.set(eventName, new Set());
      eventListeners.get(eventName)!.add(callback);
    },

    removeListener(eventName: string, callback: EventCallback): void {
      eventListeners.get(eventName)?.delete(callback);
    },

    enable(): Promise<unknown> {
      return totemProvider.request({ method: 'TOTEM_CONNECT' });
    },

    getCoins(params?: Record<string, unknown>): Promise<unknown> {
      return totemProvider.request({ method: 'TOTEM_GET_COINS', params: params ?? {} });
    },

    sendComplex(buildParams: Record<string, unknown>, mode?: 'build' | 'submit'): Promise<unknown> {
      return totemProvider.request({
        method: 'TOTEM_SEND_COMPLEX',
        params: { buildParams, mode: mode ?? 'submit' },
      });
    },

    signData(params: Record<string, unknown>): Promise<unknown> {
      return totemProvider.request({ method: 'TOTEM_SIGN_DATA', params });
    },

    broadcastHex(params: Record<string, unknown>): Promise<unknown> {
      return totemProvider.request({ method: 'TOTEM_BROADCAST_HEX', params });
    },

    disconnect(): Promise<unknown> {
      return totemProvider.request({ method: 'TOTEM_DISCONNECT' });
    },

    proveOwnership(childIndices: number[]): Promise<unknown> {
      return totemProvider.request({ method: 'TOTEM_PROVE_OWNERSHIP', params: { childIndices } });
    },

    /** Legacy compat */
    send(method: string, params?: unknown[]): Promise<unknown> {
      return totemProvider.request({ method, params: { args: params } });
    },
  };

  if (typeof window !== 'undefined') {
    if (!(window as unknown as Record<string, unknown>).totem) {
      Object.defineProperty(window, 'totem', {
        value: Object.freeze(totemProvider),
        writable: false,
        configurable: false,
      });
      // MetaMask-style alias
      Object.defineProperty(window, 'minima', {
        value: Object.freeze(totemProvider),
        writable: false,
        configurable: false,
      });
    }
    window.dispatchEvent(new Event('totem#ready'));
  }
})();
