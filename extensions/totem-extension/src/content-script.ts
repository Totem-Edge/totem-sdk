/**
 * Totem Content Script - Message bridge between page and background
 * 
 * Runs in ISOLATED world with access to chrome.runtime APIs.
 * Injects provider.js into MAIN world and relays messages.
 * 
 * Security: Only allowlisted TOTEM_* methods are forwarded to background.
 * Responses are scoped to the requesting page's origin.
 */

const ALLOWED_DAPP_METHODS = new Set([
  'TOTEM_CONNECT',
  // TOTEM_CONNECT_APPROVE is intentionally excluded — it is internal extension-only
  // and must never be forwarded from dApp pages.
  'TOTEM_DISCONNECT',
  'TOTEM_VERIFY',
  'TOTEM_GET_ACCOUNTS',
  'TOTEM_SEND_TRANSACTION',
  'TOTEM_GRANT_TX_PERMISSION',
  'TOTEM_REVOKE_TX_PERMISSION',
  'TOTEM_GET_TX_PERMISSIONS',
  'TOTEM_GET_COINS',
  'TOTEM_SEND_COMPLEX',
  'TOTEM_SIGN_DATA',
  'TOTEM_BROADCAST_HEX',
  'TOTEM_PROVE_OWNERSHIP',
  // TOTEM_GET_WALLET_MODE is intentionally removed — walletMode no longer exists.
  // All wallets use the unified hierarchical key scheme (v4.2.0+).
]);

(function init() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/provider.js');
  // provider.js is a self-contained webpack IIFE — injecting it as type="module"
  // queues it in Chrome's async module evaluation pipeline and causes a timing
  // race where announceWallet() fires before WalletDiscovery is listening (or
  // vice-versa). Classic dynamic scripts execute as soon as fetched, bypassing
  // that queue and eliminating the race.
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
})();

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'TOTEM_REQUEST') return;

  const { id, method, params } = event.data;

  if (!method || typeof method !== 'string') {
    window.postMessage({
      type: 'TOTEM_RESPONSE',
      id,
      ok: false,
      error: 'Invalid method'
    }, window.location.origin);
    return;
  }

  if (!ALLOWED_DAPP_METHODS.has(method)) {
    window.postMessage({
      type: 'TOTEM_RESPONSE',
      id,
      ok: false,
      error: `Method not allowed: ${method}`
    }, window.location.origin);
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      method,
      params,
      origin: window.location.origin
    });

    if (chrome.runtime.lastError) {
      window.postMessage({
        type: 'TOTEM_RESPONSE',
        id,
        ok: false,
        error: chrome.runtime.lastError.message
      }, window.location.origin);
      return;
    }

    if (response?.ok) {
      window.postMessage({
        type: 'TOTEM_RESPONSE',
        id,
        ok: true,
        result: response.result
      }, window.location.origin);
    } else {
      window.postMessage({
        type: 'TOTEM_RESPONSE',
        id,
        ok: false,
        error: response?.error || 'Unknown error'
      }, window.location.origin);
    }
  } catch (error: any) {
    window.postMessage({
      type: 'TOTEM_RESPONSE',
      id,
      ok: false,
      error: error.message || 'Request failed'
    }, window.location.origin);
  }
});

// v4.0.0: Only allowlisted events are forwarded to dApp pages.
// `balanceChanged` is an internal wallet-UI event and must never reach dApp pages.
// Totem is a consent/signing provider — dApps must use the Axia API for balance data.
const ALLOWED_DAPP_EVENTS = new Set([
  'accountsChanged',
  'disconnect',
  'connect',
  // walletModeChanged intentionally removed — walletMode no longer exists (v4.2.0+).
  // All wallets use the unified hierarchical key scheme; dApps need no mode re-gating.
]);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TOTEM_EVENT') {
    if (!ALLOWED_DAPP_EVENTS.has(message.eventName)) {
      return;
    }
    window.postMessage({
      type: 'TOTEM_EVENT',
      eventName: message.eventName,
      data: message.data
    }, window.location.origin);
  }
});
