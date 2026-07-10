/**
 * provider.js — Totem PWA cross-origin embed script
 *
 * Conforms to @totemsdk/connect v2.1.0 TotemProvider interface.
 * Supports WalletDiscovery via totem:announce / totem:requestAnnounce events.
 *
 * Transport — popup on desktop, new tab on mobile:
 *   Desktop: constrained popup (400×640).
 *   Mobile:  window.open(url, '_blank') — new tab keeps window.opener so
 *            the approval page can postMessage result back without page reload.
 *   Fallback (popup/tab blocked): full-page redirect; result delivered via
 *            'totem#result' CustomEvent on return. Promise stays pending.
 *
 * NOTE: /approval/* pages must NOT set Cross-Origin-Opener-Policy: same-origin
 * (handled in public/_headers) so window.opener survives cross-origin openers.
 */

(function () {
  'use strict';

  const WALLET_ORIGIN: string = __WALLET_ORIGIN__;
  const POPUP_W = 400;
  const POPUP_H = 640;

  const TOTEM_ANNOUNCE = 'totem:announce';
  const TOTEM_REQUEST_ANNOUNCE = 'totem:requestAnnounce';

  type EventCallback = (...args: unknown[]) => void;

  const pendingRequests = new Map<string, {
    method: string;
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
  }>();
  const eventListeners = new Map<string, Set<EventCallback>>();
  const completedIdempotencyKeys = new Set<string>();
  let reqCounter = 0;

  let connectedAccounts: Array<{ address: string; index: number }> = [];
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

  function methodToPath(method: string): string | null | undefined {
    switch (method) {
      case 'TOTEM_CONNECT':           return '/approval/connect.html';
      case 'TOTEM_VERIFY':            return '/approval/verify.html';
      case 'TOTEM_SEND_TRANSACTION':  return '/approval/send.html';
      case 'TOTEM_GET_ACCOUNTS':      return null;
      case 'TOTEM_DISCONNECT':        return null;
      case 'TOTEM_SIGN_DATA':         return '/approval/verify.html';
      case 'TOTEM_SEND_COMPLEX':      return '/approval/send.html';
      case 'TOTEM_PROVE_OWNERSHIP':   return '/approval/verify.html';
      case 'TOTEM_BROADCAST_HEX':     return '/approval/send.html';
      case 'TOTEM_GET_COINS':         return '/approval/connect.html';
      case 'totem_signTransaction':   return '/approval/verify.html';
      case 'totem_broadcastTxPoW':    return '/approval/send.html';
      case 'totem_reserveWotsLease':  return null;
      case 'totem_getCapabilities':   return null;
      case 'totem_getProviderStatus': return null;
      case 'totem_getWotsStatus':     return null;
      case 'TOTEM_GRANT_TX_PERMISSION': return null;
      case 'TOTEM_REVOKE_TX_PERMISSION': return null;
      case 'TOTEM_GET_TX_PERMISSIONS': return null;
      case 'totem_setChainProvider':  return null;
      case 'totem_releaseWotsLease':  return null;
      case 'totem_getTransactionStatus': return null;
      case 'totem_getReceipt':        return null;
      case 'totem_createPaymentRequest': return null;
      case 'totem_payPaymentRequest': return null;
      case 'totem_mineTxPoW':         return null;
      case 'totem_omniaGetChannels':  return null;
      case 'totem_omniaOpenChannel':  return null;
      case 'totem_omniaPay':          return null;
      case 'totem_omniaSettle':       return null;
      case 'totem_omniaCloseChannel': return null;
      case 'totem_omniaGetRoute':     return null;
      case 'totem_omniaPayMultiHop':  return null;
      case 'totem_omniaGetSwapRate':  return null;
      case 'totem_omniaCreateFactory': return null;
      case 'totem_omniaOpenVirtualChannel': return null;
      case 'totem_omniaCloseFactory': return null;
      case 'totem_omniaSpliceIn':     return null;
      case 'totem_omniaSpliceOut':    return null;
      case 'totem_statechainCreate':  return null;
      case 'totem_statechainTransfer': return null;
      case 'totem_statechainClaim':   return null;
      case 'totem_statechainVerify':  return null;
      case 'totem_kissvmSimulate':    return null;
      case 'totem_kissvmValidate':    return null;
      case 'totem_agentProposePayment': return null;
      case 'totem_agentExplainTransaction': return null;
      case 'totem_agentCreateReceipt': return null;
      default: return undefined;
    }
  }

  function paramsToQs(method: string, params?: Record<string, unknown>): Record<string, string> {
    if (!params) return {};
    const out: Record<string, string> = {};

    if (method === 'TOTEM_VERIFY') {
      const challenge = params.challenge as Record<string, unknown> | undefined;
      if (challenge?.statement) out.message = encodeURIComponent(String(challenge.statement));
      out.mode = 'verify';
    }

    if (method === 'TOTEM_SEND_TRANSACTION') {
      const request = params.request as Record<string, unknown> | undefined;
      if (request?.outputs) {
        const outputs = request.outputs as Array<Record<string, unknown>>;
        if (outputs.length > 0) {
          out.to = String(outputs[0].address ?? '');
          out.amount = String(outputs[0].amount ?? '0');
          if (outputs[0].tokenId) out.tokenId = String(outputs[0].tokenId);
        }
      }
      if (params.to) out.to = String(params.to);
      if (params.amount) out.amount = String(params.amount);
      if (params.tokenId) out.tokenId = String(params.tokenId);
    }

    if (method === 'TOTEM_SIGN_DATA') {
      if (params.unsignedHex) out.unsignedHex = String(params.unsignedHex);
      if (params.inputAddresses) {
        const addrs = params.inputAddresses as string[];
        if (addrs.length > 0) out.inputAddresses = addrs.join(',');
      }
      if (params.inputIndices) {
        const indices = params.inputIndices as number[];
        if (indices.length > 0) out.inputIndices = indices.join(',');
      }
      if (params.returnFormat) out.returnFormat = String(params.returnFormat);
    }

    if (method === 'TOTEM_SEND_COMPLEX' && params.buildParams) {
      const bp = params.buildParams as Record<string, unknown>;
      if (bp.to) out.to = String(bp.to);
      if (bp.amount) out.amount = String(bp.amount);
      if (bp.tokenId) out.tokenId = String(bp.tokenId);
      if (params.mode) out.mode = String(params.mode);
    }

    if (method === 'totem_signTransaction') {
      if (params.unsignedHex) out.unsignedHex = String(params.unsignedHex);
      if (params.inputAddresses) {
        const addrs = params.inputAddresses as string[];
        if (addrs.length > 0) out.inputAddresses = addrs.join(',');
      }
      if (params.inputIndices) {
        const indices = params.inputIndices as number[];
        if (indices.length > 0) out.inputIndices = indices.join(',');
      }
      if (params.returnFormat) out.returnFormat = String(params.returnFormat);
    }

    if (method === 'totem_broadcastTxPoW') {
      if (params.minedHex) out.minedHex = String(params.minedHex);
      if (params.expectedTxpowId) out.expectedTxpowId = String(params.expectedTxpowId);
    }

    return out;
  }

  function isCustomScheme(url: string): boolean {
    try { return !['https:', 'http:'].includes(new URL(url).protocol); } catch { return true; }
  }

  function openWalletWindow(id: string, method: string, path: string, qs: Record<string, string>, callerOrigin: string, returnUrlOverride?: string): void {
    const returnUrl = returnUrlOverride || window.location.href.split('?')[0];
    const query = new URLSearchParams({
      ...qs,
      origin: callerOrigin,
      reqId: id,
      returnUrl,
    }).toString();
    const url = `${WALLET_ORIGIN}${path}?${query}`;

    if (isMobile() || isCustomScheme(returnUrl)) {
      // For native app callers with custom scheme returnUrl, skip sessionStorage
      // caching — the approval page will redirect directly to the custom scheme.
      if (!isCustomScheme(returnUrl)) {
        sessionStorage.setItem('totem_redirect_id', id);
        sessionStorage.setItem('totem_redirect_method', method);
      }
      window.location.href = url;
      return;
    }

    const walletWin = window.open(
      url, `totem_${id}`,
      `width=${POPUP_W},height=${POPUP_H},` +
      `top=${Math.max(0, Math.round(window.screenY + (window.outerHeight - POPUP_H) / 2))},` +
      `left=${Math.max(0, Math.round(window.screenX + (window.outerWidth  - POPUP_W) / 2))},` +
      'resizable=no,scrollbars=no,status=no,toolbar=no,menubar=no',
    );

    if (!walletWin) {
      if (!isCustomScheme(returnUrl)) {
        sessionStorage.setItem('totem_redirect_id', id);
        sessionStorage.setItem('totem_redirect_method', method);
      }
      window.location.href = url;
      return;
    }

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
          const r = msg.result as { address?: string; addressIndex?: number } | null;
          if (r?.address) {
            connectedAccounts = [{ address: r.address, index: r.addressIndex ?? 0 }];
            emitEvent('accountsChanged', [r.address]);
          }
        }
        p.resolve(msg.result);
        if (!walletWin.closed) walletWin.close();
      };
    } catch { /* BroadcastChannel not supported */ }

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

  (function checkRedirectReturn() {
    const params = new URLSearchParams(window.location.search);
    const b64    = params.get('totem_result');
    const rid    = params.get('totem_reqid') ?? sessionStorage.getItem('totem_redirect_id') ?? '';
    if (!b64 || !rid) return;

    try {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('totem_result');
      clean.searchParams.delete('totem_reqid');
      window.history.replaceState({}, '', clean.toString());
    } catch { /* ignore */ }

    const method = sessionStorage.getItem('totem_redirect_method') ?? '';
    sessionStorage.removeItem('totem_redirect_id');
    sessionStorage.removeItem('totem_redirect_method');

    try {
      const parsed = JSON.parse(atob(b64)) as { error?: string; [k: string]: unknown };
      if (method) {
        _redirectReturn = { method, result: parsed, error: parsed.error };
        if (method === 'TOTEM_CONNECT' && !parsed.error) {
          const r = parsed as { address?: string; addressIndex?: number };
          if (r.address && !connectedAccounts.some(a => a.address === r.address)) {
            connectedAccounts = [{ address: r.address, index: r.addressIndex ?? 0 }];
          }
        }
      }
      window.dispatchEvent(new CustomEvent('totem#result', { detail: { reqId: rid, result: parsed, method } }));
      const p = pendingRequests.get(rid);
      if (p) {
        pendingRequests.delete(rid);
        parsed.error ? p.reject(new Error(parsed.error)) : p.resolve(parsed);
      }
    } catch { /* ignore parse errors */ }
  })();

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== WALLET_ORIGIN) return;
    const data = event.data as { type?: string; reqId?: string; id?: string; result?: unknown; error?: string };
    if (!data || data.type !== 'totem_response') return;
    const id = data.reqId ?? data.id ?? '';
    if (!id) return;
    const pending = pendingRequests.get(id);
    if (!pending) return;
    pendingRequests.delete(id);
    if (data.error) {
      pending.reject(new Error(data.error));
    } else {
      if (pending.method === 'TOTEM_CONNECT') {
        const r = data.result as { address?: string; addressIndex?: number } | null;
        if (r?.address && !connectedAccounts.some(a => a.address === r.address)) {
          connectedAccounts = [{ address: r.address, index: r.addressIndex ?? 0 }];
          emitEvent('accountsChanged', [r.address]);
        }
      }
      pending.resolve(data.result);
    }
  });

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== WALLET_ORIGIN) return;
    const data = event.data as { type?: string; eventName?: string; data?: unknown };
    if (!data || data.type !== 'TOTEM_EVENT') return;
    emitEvent(data.eventName ?? '', data.data);
  });

  // ── Permission handlers (inline, no popup) ──────────────────────────────

  function openPermissionDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('totem-pwa-wallet', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('connected-sites')) {
          db.createObjectStore('connected-sites', { keyPath: 'origin' });
        }
        if (!db.objectStoreNames.contains('tx-permissions')) {
          db.createObjectStore('tx-permissions', { keyPath: 'origin' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function handleGrantTxPermission(origin: string, params?: Record<string, unknown>): Promise<unknown> {
    const config = params?.config as Record<string, unknown> | undefined;
    if (!config) return { success: false, error: 'Missing config', errorCode: 'INVALID_PARAMS' };
    const db = await openPermissionDb();
    const perm = {
      origin,
      allowedIntents: (config.allowedIntents as string[]) ?? ['send'],
      tokenLimits: (config.tokenLimits as Array<Record<string, unknown>>) ?? [],
      dailyUsage: [],
      grantedAt: Date.now(),
      expiresAt: Date.now() + ((config.expiresInDays as number ?? 30) * 86400000),
    };
    await db.put('tx-permissions', perm);
    db.close();
    return { success: true };
  }

  async function handleRevokeTxPermission(origin: string): Promise<unknown> {
    const db = await openPermissionDb();
    await db.delete('tx-permissions', origin);
    db.close();
    return { success: true };
  }

  async function handleGetTxPermissions(): Promise<unknown> {
    const db = await openPermissionDb();
    const perms = await db.getAll('tx-permissions');
    db.close();
    return perms.map((p: Record<string, unknown>) => ({
      origin: p.origin,
      address: '',
      permissions: {
        grantedAt: p.grantedAt,
        expiresAt: p.expiresAt,
        allowedIntents: p.allowedIntents,
        tokenLimits: p.tokenLimits,
        totalTransactions: (p.dailyUsage as Array<unknown>)?.length ?? 0,
      },
    }));
  }

  async function handleReserveWotsLease(origin: string, params?: Record<string, unknown>): Promise<unknown> {
    const addressIndex = (params?.addressIndex as number) ?? connectedAccounts[0]?.index ?? 0;
    const purpose = (params?.purpose as string) ?? 'signing';
    const ttlMs = (params?.ttlMs as number) ?? 120000;
    return {
      reservationId: `lease_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      addressIndex,
      l1: 0,
      l2: 0,
      expiresAt: Date.now() + ttlMs,
    };
  }

  async function handleReleaseWotsLease(params?: Record<string, unknown>): Promise<unknown> {
    return { success: true, reservationId: params?.reservationId as string ?? '' };
  }

  const totemProvider = {
    isTotem: true as const,
    version: '1.0.0' as const,

    request(args: { method: string; params?: Record<string, unknown> }): Promise<unknown> {
      const { method, params } = args;
      const origin = (params?.origin as string) || window.location.origin;

      if (method === 'TOTEM_DISCONNECT') {
        connectedAccounts = [];
        emitEvent('accountsChanged', []);
        window.dispatchEvent(new CustomEvent('totem#disconnected'));
        return Promise.resolve(null);
      }

      if (method === 'TOTEM_GET_ACCOUNTS') {
        const accounts = connectedAccounts.map(a => ({
          index: a.index,
          address: a.address,
          balance: '0',
        }));
        return Promise.resolve({ accounts });
      }

      if (method === 'TOTEM_GRANT_TX_PERMISSION') {
        return handleGrantTxPermission(origin, params);
      }

      if (method === 'TOTEM_REVOKE_TX_PERMISSION') {
        return handleRevokeTxPermission(origin);
      }

      if (method === 'TOTEM_GET_TX_PERMISSIONS') {
        return handleGetTxPermissions();
      }

      if (method === 'totem_reserveWotsLease') {
        return handleReserveWotsLease(origin, params);
      }

      if (method === 'totem_releaseWotsLease') {
        return handleReleaseWotsLease(params);
      }

      if (method === 'totem_setChainProvider') {
        return Promise.resolve({ success: true, providerType: 'hosted' });
      }

      if (method === 'totem_getCapabilities') {
        return Promise.resolve({
          version: '1.0.0',
          wallet: {
            selfCustody: true,
            wotsTreeKey: true,
            rootIdentity: true,
            treeKeyDepth: 3,
            maxAddresses: null,
            seedExport: true,
            custodyType: 'self',
          },
          account: { multiAddress: true, accountSwitcher: true },
          chain: {
            hostedProvider: true,
            pureMinimaRpc: false,
            lookupNode: false,
            localProofVerify: false,
            pearRuntime: false,
            hyperswarm: false,
          },
          txpow: { localMining: false, progressEvents: false },
          omnia: {
            channels: false, routing: false, multiHop: false,
            crossTokenSwap: false, factory: false, virtualChannels: false, splicing: false,
            hyperswarm: false,
          },
          statechain: { supported: false, blindSE: false },
          scripting: { kissvm: false },
          qvac: { paymentIntents: false, explanations: false },
        });
      }

      if (method === 'totem_getProviderStatus') {
        return Promise.resolve({
          providerType: 'hosted',
          network: 'minima',
          relayAvailable: true,
          localMiningAvailable: false,
          pearRuntime: false,
          lookupLatencyMs: null,
        });
      }

      if (method === 'totem_getWotsStatus') {
        return Promise.resolve({
          address: connectedAccounts[0]?.address ?? '',
          addressIndex: connectedAccounts[0]?.index ?? 0,
          totalSlots: 262144,
          usedSlots: 0,
          availableSlots: 262144,
          nearExhaustion: false,
        });
      }

      const unsupportedMethods = new Set([
        'totem_setChainProvider',
        'totem_mineTxPoW', 'totem_createPaymentRequest', 'totem_payPaymentRequest',
        'totem_getTransactionStatus', 'totem_getReceipt',
        'totem_omniaGetChannels', 'totem_omniaOpenChannel', 'totem_omniaPay',
        'totem_omniaSettle', 'totem_omniaCloseChannel', 'totem_omniaGetRoute',
        'totem_omniaPayMultiHop', 'totem_omniaGetSwapRate', 'totem_omniaCreateFactory',
        'totem_omniaOpenVirtualChannel', 'totem_omniaCloseFactory', 'totem_omniaSpliceIn',
        'totem_omniaSpliceOut', 'totem_statechainCreate', 'totem_statechainTransfer',
        'totem_statechainClaim', 'totem_statechainVerify', 'totem_kissvmSimulate',
        'totem_kissvmValidate', 'totem_agentProposePayment', 'totem_agentExplainTransaction',
        'totem_agentCreateReceipt',
      ]);
      if (unsupportedMethods.has(method)) {
        return Promise.resolve({ success: false, error: `Method ${method} not supported by this wallet`, errorCode: 'UNSUPPORTED' });
      }

      // Idempotency key — prevents double-execution on retry
      const idempotencyKey = params?.idempotencyKey as string | undefined;
      if (idempotencyKey && completedIdempotencyKeys.has(idempotencyKey)) {
        return Promise.reject(new Error(`Request with idempotencyKey '${idempotencyKey}' already completed`));
      }

      if (_redirectReturn && _redirectReturn.method === method) {
        const ret = _redirectReturn;
        _redirectReturn = null;
        if (ret.error) return Promise.reject(new Error(ret.error));
        if (method === 'TOTEM_CONNECT') {
          const r = ret.result as { address?: string; addressIndex?: number } | null;
          if (r?.address) emitEvent('accountsChanged', [r.address]);
        }
        return Promise.resolve(ret.result);
      }

      const path = methodToPath(method);
      if (path === undefined) {
        return Promise.reject(new Error(`Unsupported method: ${method}`));
      }
      if (path === null) {
        return Promise.reject(new Error(`Method ${method} should have been handled inline`));
      }

      const id  = genId();
      const qs  = paramsToQs(method, params);
      const returnUrlOverride = (params?.returnUrl as string) || undefined;

      window.dispatchEvent(new CustomEvent('totem#connect-requested', {
        detail: { callerOrigin: origin, method, mode: isMobile() ? 'redirect' : 'popup' },
      }));

      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (pendingRequests.delete(id)) reject(new Error('Request timeout'));
        }, 90_000);

        pendingRequests.set(id, {
          method,
          resolve: (v) => {
            clearTimeout(timer);
            if (idempotencyKey) completedIdempotencyKeys.add(idempotencyKey);
            resolve(v);
          },
          reject:  (e) => { clearTimeout(timer); reject(e); },
        });

        openWalletWindow(id, method, path!, qs, origin, returnUrlOverride);
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
      Object.defineProperty(window, 'minima', {
        value: Object.freeze(totemProvider),
        writable: false,
        configurable: false,
      });
    }

    window.addEventListener(TOTEM_REQUEST_ANNOUNCE, () => {
      window.dispatchEvent(new CustomEvent(TOTEM_ANNOUNCE, {
        detail: {
          info: {
            id: 'totem-pwa',
            name: 'Totem Wallet',
            icon: `${WALLET_ORIGIN}/icons/totem.svg`,
            version: '1.0.0',
          },
          provider: totemProvider,
        },
      }));
    });

    window.dispatchEvent(new CustomEvent(TOTEM_ANNOUNCE, {
      detail: {
        info: {
          id: 'totem-pwa',
          name: 'Totem Wallet',
          icon: `${WALLET_ORIGIN}/icons/totem.svg`,
          version: '1.0.0',
        },
        provider: totemProvider,
      },
    }));

    window.dispatchEvent(new Event('totem#ready'));
  }
})();
