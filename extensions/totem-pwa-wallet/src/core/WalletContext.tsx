/**
 * WalletContext — React state machine for the wallet.
 *
 * Session-expired detection:
 * - On visibilitychange (tab re-focus) the context re-checks WalletManager.isUnlocked().
 * - If the wallet was locked in the background (e.g. tab was suspended, memory cleared,
 *   or explicit lock() call), the route is set to 'session-expired' so the user is
 *   prompted to re-unlock without losing their navigation position.
 */
import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import { WalletManager, type SessionState } from './WalletManager';
import { startPwaOmniaHost, stopPwaOmniaHost } from './omniaHost';
import type { AccountRecord } from '../stores/VaultStore';
import { track } from './observability';

export type AppRoute =
  | 'loading'
  | 'onboard'
  | 'backup'
  | 'unlock'
  | 'home'
  | 'send'
  | 'receive'
  | 'settings'
  | 'add-address'
  | 'session-expired';

interface WalletCtx {
  route: AppRoute;
  setRoute: (r: AppRoute) => void;
  session: SessionState | null;
  activeAccount: AccountRecord | null;
  isUnlocked: boolean;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  createWallet: (mnemonic: string, password: string) => Promise<void>;
  importWallet: (mnemonic: string, password: string) => Promise<void>;
  addNextAddress: () => Promise<AccountRecord>;
  switchAccount: (index: number) => void;
  refreshSession: () => void;
  error: string | null;
  clearError: () => void;
}

const WalletContext = createContext<WalletCtx | null>(null);

/**
 * Wallet screens that can be deep-linked, e.g. the portfolio's Send/Receive
 * buttons open `/web/#send`. The wallet has no URL router, so the hash is the
 * only way another app (or a bookmark) can land on a specific screen.
 */
const DEEP_LINK_ROUTES: AppRoute[] = ['home', 'send', 'receive', 'settings'];

function readHashRoute(): AppRoute | null {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  return (DEEP_LINK_ROUTES as string[]).includes(raw) ? (raw as AppRoute) : null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [route, setRoute]   = useState<AppRoute>('loading');
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError]   = useState<string | null>(null);

  // The route the user was on before the session expired — used to restore after re-unlock
  const preExpiredRoute = useRef<AppRoute | null>(null);
  // Requested screen from the URL hash, applied once the wallet is unlocked
  const requestedRoute = useRef<AppRoute | null>(readHashRoute());

  const takeRequestedRoute = useCallback((): AppRoute | null => {
    const requested = requestedRoute.current;
    requestedRoute.current = null;
    return requested;
  }, []);

  // ── Initial boot ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const has = await WalletManager.hasWallet();
      if (!has) {
        setRoute('onboard');
      } else if (WalletManager.isUnlocked()) {
        const s = WalletManager.getSession();
        setSession(s);
        void startPwaOmniaHost();
        const confirmed = await WalletManager.isBackupConfirmed();
        setRoute(confirmed ? (takeRequestedRoute() ?? 'home') : 'backup');
      } else {
        setRoute('unlock');
      }
    }
    init().catch(e => setError(String(e)));
  }, [takeRequestedRoute]);

  // ── Keep the URL hash in step with the visible screen ─────────────────────
  // Lets `#send` / `#receive` links (portfolio buttons, home-screen shortcuts)
  // land on the right page, and keeps the address bar honest afterwards.
  useEffect(() => {
    if (!DEEP_LINK_ROUTES.includes(route)) return;
    const desired = `#${route}`;
    if (window.location.hash === desired) return;
    history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${desired}`,
    );
  }, [route]);

  // ── Session-expired detection via visibilitychange ────────────────────────
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible') return;
      // Wallet was unlocked before — check if it's still unlocked after tab resumed
      if (session !== null && !WalletManager.isUnlocked()) {
        track('session.expired', { identityHash: session.identityHash });
        preExpiredRoute.current = route as AppRoute;
        setSession(null);
        stopPwaOmniaHost();
        setRoute('session-expired');
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session, route]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const refreshSession = useCallback(() => {
    setSession(WalletManager.getSession());
  }, []);

  const unlock = useCallback(async (password: string) => {
    await WalletManager.unlock(password);
    const s = WalletManager.getSession();
    setSession(s);
    WalletManager.startWatermarkSync();
    void startPwaOmniaHost();
    track('session.unlocked', { identityHash: s?.identityHash });
    const confirmed = await WalletManager.isBackupConfirmed();

    if (route === 'session-expired' && preExpiredRoute.current) {
      // Restore previous screen after re-unlock
      const restored = preExpiredRoute.current;
      preExpiredRoute.current = null;
      setRoute(confirmed ? restored : 'backup');
    } else {
      setRoute(confirmed ? (takeRequestedRoute() ?? 'home') : 'backup');
    }
  }, [route, takeRequestedRoute]);

  const lock = useCallback(() => {
    track('session.locked');
    WalletManager.stopWatermarkSync();
    stopPwaOmniaHost();
    WalletManager.lock();
    setSession(null);
    preExpiredRoute.current = null;
    setRoute('unlock');
  }, []);

  const createWallet = useCallback(async (mnemonic: string, password: string) => {
    await WalletManager.createWallet(mnemonic, password);
    const s = WalletManager.getSession();
    setSession(s);
    void startPwaOmniaHost();
    track('wallet.created', { identityHash: s?.identityHash });
    setRoute('backup');
  }, []);

  const importWallet = useCallback(async (mnemonic: string, password: string) => {
    await WalletManager.importWallet(mnemonic, password);
    const s = WalletManager.getSession();
    setSession(s);
    void startPwaOmniaHost();
    track('wallet.imported', { identityHash: s?.identityHash });
    setRoute('home'); // skip backup — user already has the phrase
  }, []);

  const addNextAddress = useCallback(async () => {
    const account = await WalletManager.addNextAddress();
    setSession(WalletManager.getSession());
    return account;
  }, []);

  const switchAccount = useCallback((index: number) => {
    WalletManager.setActiveAccount(index);
    setSession({ ...WalletManager.getSession()! });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const activeAccount = session
    ? (session.accounts.find(a => a.index === session.activeIndex) ?? null)
    : null;

  return (
    <WalletContext.Provider value={{
      route,
      setRoute,
      session,
      activeAccount,
      isUnlocked: session !== null,
      unlock,
      lock,
      createWallet,
      importWallet,
      addNextAddress,
      switchAccount,
      refreshSession,
      error,
      clearError,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletCtx {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
