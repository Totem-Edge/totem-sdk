/**
 * Totem Provider - Injected into page context (MAIN world)
 * Provides the TOTEM_CONNECT v4.3+ wallet API for dApps.
 *
 * Multi-wallet discovery: Instead of writing to window.totem, the provider
 * announces itself via the 'totem:announce' CustomEvent and re-announces
 * on 'totem:requestAnnounce'. DApps use WalletDiscovery from @totemsdk/connect
 * to receive the announcement.
 *
 * Communication: Uses postMessage bridge to content script since
 * MAIN world cannot access chrome.runtime APIs directly.
 */

interface TotemRequest {
  method: string;
  params?: Record<string, unknown>;
}

interface TotemResponse {
  type: 'TOTEM_RESPONSE';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface TotemConnectResponse {
  connected: boolean;
  address: string;
  addressIndex: number;
  publicKey: string | null;
  isReconnect?: boolean;
}

type EventCallback = (...args: unknown[]) => void;

const TOTEM_ANNOUNCE = 'totem:announce';
const TOTEM_REQUEST_ANNOUNCE = 'totem:requestAnnounce';

const WALLET_INFO = {
  id: 'totem-extension',
  name: 'Totem Wallet',
  version: '1.0.0',
} as const;

const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}>();

const eventListeners = new Map<string, Set<EventCallback>>();

let requestIdCounter = 0;

function generateRequestId(): string {
  return `totem_${Date.now()}_${++requestIdCounter}`;
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'TOTEM_RESPONSE') return;

  const response = event.data as TotemResponse;
  const pending = pendingRequests.get(response.id);

  if (pending) {
    pendingRequests.delete(response.id);
    if (response.ok) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error || 'Unknown error'));
    }
  }
});

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'TOTEM_EVENT') return;

  const { eventName, data } = event.data;
  const listeners = eventListeners.get(eventName);
  if (listeners) {
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('[Totem] Event listener error:', e);
      }
    });
  }
});

const totemProvider = {
  isTotem: true,

  request: async (args: TotemRequest): Promise<unknown> => {
    const id = generateRequestId();
    const pageOrigin = window.location.origin;

    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });

      const targetOrigin = pageOrigin === 'null' ? '*' : pageOrigin;
      // SECURITY: pageOrigin MUST win — dApp-supplied args.params.origin must not override it.
      const paramsWithOrigin = { ...(args.params || {}), origin: pageOrigin };
      window.postMessage({
        type: 'TOTEM_REQUEST',
        id,
        method: args.method,
        params: paramsWithOrigin,
      }, targetOrigin);

      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 60000);
    });
  },

  on: (eventName: string, callback: EventCallback): void => {
    if (!eventListeners.has(eventName)) {
      eventListeners.set(eventName, new Set());
    }
    eventListeners.get(eventName)!.add(callback);
  },

  removeListener: (eventName: string, callback: EventCallback): void => {
    const listeners = eventListeners.get(eventName);
    if (listeners) {
      listeners.delete(callback);
    }
  },

  enable: async (): Promise<unknown> => {
    return totemProvider.request({ method: 'TOTEM_CONNECT' });
  },

  send: async (method: string, params?: unknown[]): Promise<unknown> => {
    return totemProvider.request({ method, params: { args: params } });
  },

  getCoins: async (params?: { tokenId?: string; address?: string; minAmount?: string }): Promise<unknown> => {
    return totemProvider.request({ method: 'TOTEM_GET_COINS', params: params || {} });
  },

  sendComplex: async (buildParams: Record<string, unknown>, mode?: 'build' | 'submit'): Promise<unknown> => {
    return totemProvider.request({ method: 'TOTEM_SEND_COMPLEX', params: { buildParams, mode: mode || 'submit' } });
  },

  signData: async (params: {
    unsignedHex: string;
    signingManifest: {
      blobHash: string;
      digestTx: string;
      inputs: Array<{
        inputIndex: number;
        coinId: string;
        address: string;
        amount: string;
        tokenId: string;
      }>;
    };
    inputIndices?: number[];
    returnFormat?: string;
  }): Promise<unknown> => {
    return totemProvider.request({ method: 'TOTEM_SIGN_DATA', params });
  },

  broadcastHex: async (params: { signedHex: string; expectedDigestTx?: string }): Promise<unknown> => {
    return totemProvider.request({ method: 'TOTEM_BROADCAST_HEX', params });
  },

  disconnect: async (): Promise<unknown> => {
    return totemProvider.request({ method: 'TOTEM_DISCONNECT' });
  },

  /**
   * proveOwnership — requests a cross-address Root Identity ownership proof.
   */
  proveOwnership: async (childIndices: number[]): Promise<unknown> => {
    return totemProvider.request({ method: 'TOTEM_PROVE_OWNERSHIP', params: { childIndices } });
  },
};

function announceWallet(): void {
  window.dispatchEvent(new CustomEvent(TOTEM_ANNOUNCE, {
    detail: { info: WALLET_INFO, provider: totemProvider },
  }));
}

window.addEventListener(TOTEM_REQUEST_ANNOUNCE, announceWallet);
announceWallet();

console.log('[Totem] Provider announced via totem:announce');
