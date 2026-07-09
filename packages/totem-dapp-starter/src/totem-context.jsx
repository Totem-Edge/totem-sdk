/**
 * TotemProvider — v4.3.0 pattern (TOTEM_ANNOUNCE multi-wallet discovery)
 *
 * Manages wallet connection and verification state only.
 * Balance and portfolio data are NOT stored here — use useAxiaPortfolio(address).
 *
 * Key rules (from TOTEM_CONNECT.md §14):
 *  - One <TotemProvider> per app, at the root, wrapping the entire tree.
 *  - connectAndVerify chains CONNECT → (session check) → VERIFY (if needed) → GET_ACCOUNTS.
 *  - TOTEM_VERIFY is skipped when a live server session already exists for the
 *    same address, preserving WOTS signing capacity.
 *  - The accountsChanged event listener handles all disconnect scenarios.
 *  - No balance data lives in this context.
 *
 * Multi-wallet discovery (v4.3.0):
 *  - Wallets announce themselves via the 'totem:announce' CustomEvent — there
 *    is no window.totem global.
 *  - When exactly one wallet is detected, connection proceeds automatically
 *    (no UX change from the user's perspective).
 *  - When multiple wallets are detected, `wallets` is populated so the app
 *    can render a picker and call `selectWallet(walletId)`.
 *
 * Session lifecycle:
 *   1. On connect, call GET /api/auth/session.
 *      - If valid and address matches → skip TOTEM_VERIFY entirely.
 *      - If invalid but refresh cookie may still be alive → POST /api/auth/refresh.
 *      - If refresh also fails → call TOTEM_VERIFY (consumes one WOTS leaf).
 *   2. On successful TOTEM_VERIFY → POST /api/auth/verify → server mints 24-hour
 *      session token. On subsequent connects within that window, step 1 short-circuits.
 *   3. Server session can be refreshed up to 7 days from first issuance without
 *      a new WOTS signature.
 *
 * Living spec — the integration tests that verify these exact patterns:
 *   packages/totem-extension/src/__tests__/dapp-integration/v4-consent-patterns.test.ts
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const TOTEM_ANNOUNCE = 'totem:announce';
const TOTEM_REQUEST_ANNOUNCE = 'totem:requestAnnounce';

const TotemContext = createContext(null);

async function checkExistingSession(address) {
  try {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return false;
    const data = await res.json();
    return data.valid && (!address || data.address === address);
  } catch {
    return false;
  }
}

async function tryRefreshSession(address) {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.valid) return null;
    if (address && data.address !== address) return null;
    return data;
  } catch {
    return null;
  }
}

export function TotemProvider({ children }) {
  const [wallets, setWallets] = useState([]);
  const [activeProvider, setActiveProvider] = useState(null);
  const [connected, setConnected] = useState(false);
  const [verified, setVerified] = useState(false);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const walletsRef = useRef(new Map());

  useEffect(() => {
    function onAnnounce(event) {
      const { info, provider } = event.detail ?? {};
      if (!info?.id || !provider) return;
      walletsRef.current.set(info.id, { info, provider });
      const discovered = [...walletsRef.current.values()];
      setWallets(discovered);
      if (discovered.length === 1) {
        setActiveProvider(discovered[0].provider);
      }
    }

    window.addEventListener(TOTEM_ANNOUNCE, onAnnounce);
    window.dispatchEvent(new CustomEvent(TOTEM_REQUEST_ANNOUNCE));

    return () => {
      window.removeEventListener(TOTEM_ANNOUNCE, onAnnounce);
    };
  }, []);

  useEffect(() => {
    if (!activeProvider) return;

    function handleAccountsChanged(accounts) {
      if (accounts.length === 0) {
        setConnected(false);
        setVerified(false);
        setAddress(null);
        setChainId(null);
      } else {
        setAddress(accounts[0]);
      }
    }

    activeProvider.on('accountsChanged', handleAccountsChanged);
    return () => {
      activeProvider.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [activeProvider]);

  const selectWallet = useCallback((walletId) => {
    const found = walletsRef.current.get(walletId);
    if (found) setActiveProvider(found.provider);
  }, []);

  /**
   * connectAndVerify — the v4.3.0 onboarding sequence.
   *
   * Calls TOTEM_CONNECT on the active wallet provider, then checks for an
   * existing server session before deciding whether to call TOTEM_VERIFY.
   * WOTS signing is only triggered when no valid session exists and a refresh
   * is not possible.
   */
  const connectAndVerify = useCallback(async (statement = 'Sign in to Totem dApp Starter') => {
    if (!activeProvider) {
      throw new Error('No wallet detected. Please install a Totem-compatible wallet.');
    }

    setIsConnecting(true);
    setError(null);

    try {
      const conn = await activeProvider.request({
        method: 'TOTEM_CONNECT',
        params: { origin: location.origin },
      });

      const connectedAddress = conn.address;

      let sessionSkipped = false;

      const sessionValid = await checkExistingSession(connectedAddress);
      if (sessionValid) {
        sessionSkipped = true;
        console.log('[TotemProvider] Live session found — skipping TOTEM_VERIFY');
      }

      if (!sessionSkipped) {
        const refreshed = await tryRefreshSession(connectedAddress);
        if (refreshed) {
          sessionSkipped = true;
          console.log('[TotemProvider] Session refreshed — skipping TOTEM_VERIFY');
        }
      }

      if (!sessionSkipped) {
        console.log('[TotemProvider] No valid session — performing TOTEM_VERIFY (consumes one WOTS leaf)');

        const proof = await activeProvider.request({
          method: 'TOTEM_VERIFY',
          params: {
            origin: location.origin,
            challenge: { statement },
          },
        });

        const verifyRes = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: proof.address,
            signature: proof.signature,
            publicKey: proof.publicKey,
            message: proof.message,
            origin: location.origin,
          }),
        });

        if (!verifyRes.ok) {
          const body = await verifyRes.json().catch(() => ({}));
          throw new Error(body.error ?? `Server verification failed (${verifyRes.status})`);
        }
      }

      const acct = await activeProvider.request({
        method: 'TOTEM_GET_ACCOUNTS',
        params: { origin: location.origin },
      });

      setConnected(true);
      setVerified(true);
      setAddress(acct.accounts[0].address);
      setChainId(acct.accounts[0].chainId);

      return { connection: conn, sessionSkipped };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [activeProvider]);

  const disconnect = useCallback(async () => {
    try {
      await activeProvider?.disconnect();
    } catch {
    }
    setConnected(false);
    setVerified(false);
    setAddress(null);
    setChainId(null);
  }, [activeProvider]);

  return (
    <TotemContext.Provider
      value={{
        wallets,
        activeProvider,
        selectWallet,
        connected,
        verified,
        address,
        chainId,
        isConnecting,
        error,
        connectAndVerify,
        disconnect,
      }}
    >
      {children}
    </TotemContext.Provider>
  );
}

export function useTotem() {
  const ctx = useContext(TotemContext);
  if (!ctx) throw new Error('useTotem must be used inside <TotemProvider>');
  return ctx;
}
