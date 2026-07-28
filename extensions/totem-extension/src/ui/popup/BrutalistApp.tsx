/**
 * AXIA TOTEM WALLET - BRUTALIST APP SHELL
 * Complete rebuild with flat brutalist design system
 */

import React, { useEffect, useState, useRef } from 'react';
import { BrutalistHeader, BrutalistNavigation, NavTab, SplashScreen } from '../components/organisms';
import { Typography } from '../components/atoms';
import { BrutalistOnboard } from './pages/BrutalistOnboard';
import { isDesignerMode } from '../../config/constants';
import { CONNECTION_STATUS_KEY, ConnectionState } from '../../core/connectivity';
import '../theme/axia-tokens.css';

// Import brutalist pages
import { BrutalistHome } from './pages/BrutalistHome';
import { BrutalistSend } from './pages/BrutalistSend';
import { BrutalistActivity } from './pages/BrutalistActivity';
import { BrutalistReceive } from './pages/BrutalistReceive';
import { BrutalistSettings } from './pages/BrutalistSettings';
import { BrutalistTokenDetail, TokenDetailData } from './pages/BrutalistTokenDetail';

// Import unlock modal components
import { UnlockProvider, useUnlock } from './contexts/UnlockContext';
import { UnlockModal } from './components/UnlockModal';

// Import dev-only components
import { DebugPanel } from '../components/debug/DebugPanel';

function SessionExpiryDetector() {
  const { openUnlock, isOpen } = useUnlock();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.id) return;

    const checkSession = async () => {
      if (isOpen || hasTriggered.current) return;
      try {
        const response = await chrome.runtime.sendMessage({ method: 'wallet:getState' });
        const state = response?.result;
        if (state && state.locked === true && state.sessionExpired === true) {
          console.log('[SessionExpiryDetector] Session expired - showing unlock prompt');
          hasTriggered.current = true;
          openUnlock('Your wallet session expired. Please enter your password to continue.');
        }
      } catch (e) {
        // background not ready yet
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 5000);

    const handleMessage = (msg: any) => {
      if (msg?.method === 'wallet:sessionExpired' && !isOpen && !hasTriggered.current) {
        console.log('[SessionExpiryDetector] Received session expired broadcast');
        hasTriggered.current = true;
        openUnlock('Your wallet session expired. Please enter your password to continue.');
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      clearInterval(interval);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [openUnlock, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      hasTriggered.current = false;
    }
  }, [isOpen]);

  return null;
}

export function BrutalistApp() {
  const [inited, setInited] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedToken, setSelectedToken] = useState<TokenDetailData | null>(null);
  const [sendToken, setSendToken] = useState<TokenDetailData | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [accountAddress, setAccountAddress] = useState<string | undefined>();
  const [activeAccountIndex, setActiveAccountIndex] = useState<number>(0);
  const [walletAccounts, setWalletAccounts] = useState<{ address: string; index: number; name?: string }[]>([]);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('offline');
  const [wotsHealth, setWotsHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy');

  useEffect(() => {
    console.log('[BrutalistApp] Initializing...');

    // Check if we're in extension context
    if (typeof chrome === 'undefined' || !chrome?.runtime?.id) {
      console.error('[BrutalistApp] Not in Chrome extension context!');
      setInited(false);
      setShowSplash(false);
      return;
    }

    // Extended timeout for MV3 service worker cold-start delays
    // Increased to 45s to handle case where service worker is busy with TreeKey generation
    // from an interrupted wallet setup (TreeKey takes ~40s)
    const timeout = setTimeout(async () => {
      console.warn('[BrutalistApp] Background communication timeout - checking storage directly');
      
      // Fallback: check storage directly instead of giving up
      try {
        const stored = await chrome.storage.local.get('encryptedSeed');
        const hasWallet = !!(stored.encryptedSeed?.iv && stored.encryptedSeed?.ct);
        console.log(`[BrutalistApp] Storage fallback check: hasWallet=${hasWallet}`);
        setInited(hasWallet);
      } catch (e) {
        console.error('[BrutalistApp] Storage fallback failed:', e);
        setInited(false);
      }
      setShowSplash(false);
    }, 5000); // 5s timeout with storage fallback

    // Hide splash after delay for smooth UX
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    try {
      chrome.runtime.sendMessage(
        { method: 'ui:isInitialized', id: 'brutalist-popup-init' },
        (response) => {
          clearTimeout(timeout);
          console.log('[BrutalistApp] Background response:', response);

          if (chrome.runtime.lastError) {
            console.error('[BrutalistApp] Chrome runtime error:', chrome.runtime.lastError);
            // Fresh install or service worker not responding - show onboarding
            setInited(false);
          } else {
            const hasEncryptedSeed = !!response?.result?.ok;
            console.log(`[BrutalistApp] Encrypted seed exists: ${hasEncryptedSeed}`);
            setInited(hasEncryptedSeed);
            // NOTE: Address loading happens in the post-init effect (lines 92-99)
            // to ensure wallet is unlocked before calling wallet:getState
          }
        }
      );
    } catch (error) {
      clearTimeout(timeout);
      console.error('[BrutalistApp] Error sending message to background:', error);
      setInited(false);
    }

    return () => {
      clearTimeout(timeout);
      clearTimeout(splashTimer);
    };
  }, []);

  // Load wallet data when initialized (e.g., after onboarding completes)
  useEffect(() => {
    if (inited !== true || accountAddress) return;

    console.log('[BrutalistApp] Wallet initialized - loading active account and WOTS health...');
    let cancelled = false;

    const tryLoadActiveAccount = async () => {
      // Fast path: read from storage directly
      try {
        const stored = await chrome.storage.local.get(['walletAddresses', 'selectedAccountIndex']);
        const accounts: { address: string; index: number; name?: string }[] = stored.walletAddresses || [];
        if (!cancelled && accounts.length > 0) {
          const idx = (stored.selectedAccountIndex as number) ?? 0;
          const safeIdx = Math.min(idx, accounts.length - 1);
          setWalletAccounts(accounts);
          setActiveAccountIndex(safeIdx);
          setAccountAddress(accounts[safeIdx].address);
          console.log(`[BrutalistApp] Active account #${safeIdx + 1}:`, accounts[safeIdx].address);
          return;
        }
      } catch (e) {
        console.warn('[BrutalistApp] Fast path storage read failed:', e);
      }

      // Fallback: background script with retries
      let retries = 0;
      const maxRetries = 8;
      const attemptBackground = async () => {
        if (cancelled) return;
        try {
          const response = await chrome.runtime.sendMessage({ method: 'wallet:getActiveAccount' });
          if (response?.account) {
            const idx = response.index ?? 0;
            // Also load full account list
            const stored2 = await chrome.storage.local.get('walletAddresses');
            const accounts2: { address: string; index: number; name?: string }[] = stored2.walletAddresses || [];
            if (!cancelled) {
              setWalletAccounts(accounts2.length > 0 ? accounts2 : [response.account]);
              setActiveAccountIndex(idx);
              setAccountAddress(response.account.address);
              console.log(`[BrutalistApp] Background: active account #${idx + 1}:`, response.account.address);
            }
            return;
          }
        } catch (e) {
          console.warn('[BrutalistApp] Background getActiveAccount failed:', e);
        }
        retries++;
        if (retries < maxRetries && !cancelled) {
          setTimeout(attemptBackground, 500);
        }
      };
      attemptBackground();
    };

    tryLoadActiveAccount();
    loadWotsHealth();

    return () => { cancelled = true; };
  }, [inited, accountAddress]);

  useEffect(() => {
    console.log('[BrutalistApp] Setting up connection status monitoring...');

    chrome.storage.local.get([CONNECTION_STATUS_KEY], (result) => {
      const connectionState = result[CONNECTION_STATUS_KEY] as ConnectionState | undefined;
      if (connectionState) {
        updateNetworkStatus(connectionState);
      }
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[CONNECTION_STATUS_KEY]) {
        const newState = changes[CONNECTION_STATUS_KEY].newValue as ConnectionState;
        console.log('[BrutalistApp] Connection status changed:', newState.status);
        updateNetworkStatus(newState);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    const handleConnectionMessage = (msg: any) => {
      if (msg?.method === 'connection:statusChanged' && msg?.status) {
        console.log('[BrutalistApp] Connection status message:', msg.status.status);
        updateNetworkStatus(msg.status);
      }
    };

    chrome.runtime.onMessage.addListener(handleConnectionMessage);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleConnectionMessage);
    };
  }, []);

  const updateNetworkStatus = (connectionState: ConnectionState) => {
    const isOnline = connectionState.status === 'online';
    setNetworkStatus(isOnline ? 'online' : 'offline');
    console.log(`[BrutalistApp] Network status updated: ${isOnline ? 'online' : 'offline'} (reason: ${connectionState.reason || 'none'})`);
  };

  // Switch active account — called by header account switcher
  const handleAccountSwitch = async (index: number) => {
    try {
      await chrome.runtime.sendMessage({ method: 'wallet:setActiveAccount', index });
      const stored = await chrome.storage.local.get(['walletAddresses', 'selectedAccountIndex']);
      const accounts: { address: string; index: number; name?: string }[] = stored.walletAddresses || [];
      const safeIdx = Math.min(index, accounts.length - 1);
      setActiveAccountIndex(safeIdx);
      setAccountAddress(accounts[safeIdx]?.address ?? '');
    } catch (error) {
      console.error('[BrutalistApp] Failed to switch account:', error);
    }
  };

  // Called from Settings when a new address is added
  const handleAccountsUpdated = async () => {
    try {
      const stored = await chrome.storage.local.get(['walletAddresses', 'selectedAccountIndex']);
      const accounts: { address: string; index: number; name?: string }[] = stored.walletAddresses || [];
      setWalletAccounts(accounts);
    } catch (e) {
      console.warn('[BrutalistApp] Failed to refresh accounts after add:', e);
    }
  };

  // Load WOTS health status from blockchain
  const loadWotsHealth = async () => {
    try {
      console.log('[BrutalistApp] Loading WOTS health...');
      
      const response = await chrome.runtime.sendMessage({
        method: 'wallet:getWotsHealth'
      });

      console.log('[BrutalistApp] WOTS health response:', response);

      if (response?.result?.health) {
        const health = response.result.health;
        console.log(`[BrutalistApp] ✓ WOTS health: ${health}`);
        setWotsHealth(health);
      } else {
        console.warn('[BrutalistApp] ⚠️ Invalid WOTS health response:', response);
      }
    } catch (error) {
      console.error('[BrutalistApp] ❌ Failed to load WOTS health:', error);
    }
  };

  // Splash Screen - shows before wallet init with full branding
  if (inited === null || showSplash) {
    return <SplashScreen isLoading={true} />;
  }

  // Onboarding
  if (!inited) {
    return <BrutalistOnboard onDone={() => setInited(true)} />;
  }

  // Main App
  return (
    <UnlockProvider>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <BrutalistHeader
          accountAddress={accountAddress}
          activeAccountIndex={activeAccountIndex}
          accounts={walletAccounts}
          wotsHealth={wotsHealth}
          networkStatus={networkStatus}
          onAccountSwitch={handleAccountSwitch}
          onWotsClick={() => setActiveTab('settings')}
          onSettingsClick={() => setActiveTab('settings')}
        />

        {/* Content Area */}
        <main style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: '72px',
        }}>
          {activeTab === 'home' && <BrutalistHome activeAccountAddress={accountAddress} onNavigate={setActiveTab} onSelectToken={(token) => { setSelectedToken(token); setActiveTab('token-detail'); }} />}
          {activeTab === 'send' && <BrutalistSend activeAccountIndex={activeAccountIndex} initialToken={sendToken} onTokenConsumed={() => setSendToken(null)} />}
          {activeTab === 'receive' && <BrutalistReceive accountAddress={accountAddress} accounts={walletAccounts} />}
          {activeTab === 'activity' && <BrutalistActivity activeAccountAddress={accountAddress} />}
          {activeTab === 'settings' && <BrutalistSettings onAccountsUpdated={handleAccountsUpdated} />}
          {activeTab === 'token-detail' && selectedToken && <BrutalistTokenDetail token={selectedToken} onNavigate={setActiveTab} onSendToken={(token) => { setSendToken(token); setActiveTab('send'); }} onBack={() => setActiveTab('home')} />}
        </main>

        {/* Bottom Navigation */}
        <BrutalistNavigation
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'send') setSendToken(null);
            setActiveTab(tab);
          }}
        />

        {/* Unlock Modal - appears when wallet needs password */}
        <UnlockModal />

        {/* Detects session expiry and auto-triggers unlock modal */}
        <SessionExpiryDetector />

      </div>

      {/* Development-only tools */}
      {isDesignerMode() && (
        <>
          <DebugPanel />
        </>
      )}
    </UnlockProvider>
  );
}

