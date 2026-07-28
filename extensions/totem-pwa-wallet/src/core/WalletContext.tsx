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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [route, setRoute]   = useState<AppRoute>('loading');
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError]   = useState<string | null>(null);

  // The route the user was on before the session expired — used to restore after re-unlock
  const preExpiredRoute = useRef<AppRoute | null>(null);

  // ── Initial boot ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const has = await WalletManager.hasWallet();
      if (!has) {
        setRoute('onboard');
      } else if (WalletManager.isUnlocked()) {
        const s = WalletManager.getSession();
        setSession(s);
        const confirmed = await WalletManager.isBackupConfirmed();
        setRoute(confirmed ? 'home' : 'backup');
      } else {
        setRoute('unlock');
      }
    }
    init().catch(e => setError(String(e)));
  }, []);

  // ── Session-expired detection via visibilitychange ────────────────────────
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible') return;
      // Wallet was unlocked before — check if it's still unlocked after tab resumed
      if (session !== null && !WalletManager.isUnlocked()) {
        track('session.expired', { identityHash: session.identityHash });
        preExpiredRoute.current = route as AppRoute;
        setSession(null);
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
    track('session.unlocked', { identityHash: s?.identityHash });
    const confirmed = await WalletManager.isBackupConfirmed();

    if (route === 'session-expired' && preExpiredRoute.current) {
      // Restore previous screen after re-unlock
      const restored = preExpiredRoute.current;
      preExpiredRoute.current = null;
      setRoute(confirmed ? restored : 'backup');
    } else {
      setRoute(confirmed ? 'home' : 'backup');
    }
  }, [route]);

  const lock = useCallback(() => {
    track('session.locked');
    WalletManager.stopWatermarkSync();
    WalletManager.lock();
    setSession(null);
    preExpiredRoute.current = null;
    setRoute('unlock');
  }, []);

  const createWallet = useCallback(async (mnemonic: string, password: string) => {
    await WalletManager.createWallet(mnemonic, password);
    const s = WalletManager.getSession();
    setSession(s);
    track('wallet.created', { identityHash: s?.identityHash });
    setRoute('backup');
  }, []);

  const importWallet = useCallback(async (mnemonic: string, password: string) => {
    await WalletManager.importWallet(mnemonic, password);
    const s = WalletManager.getSession();
    setSession(s);
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
