import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

function checkForUpdate() {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.update())
    .catch(() => undefined);
}

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('[PWA] Service worker registered', r);
      // A newly installed app can open straight from the icon. Check
      // immediately, not only after the visibility listener fires.
      if (r) void r.update().catch(() => undefined);
    },
    onRegisterError(error: unknown) {
      console.warn('[PWA] Service worker registration error', error);
    },
  });

  useEffect(() => {
    // Installed PWAs (especially iOS standalone) do not necessarily reload the
    // page when opened. Check on mount, on resume/focus/pageshow, and periodically
    // so a deployment is detected on every new load.
    checkForUpdate();
    const interval = window.setInterval(checkForUpdate, 15 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('pageshow', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', checkForUpdate);
      window.removeEventListener('pageshow', checkForUpdate);
      window.removeEventListener('online', checkForUpdate);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 'var(--pwa-max-width)',
      background: 'var(--axia-aqua)',
      color: 'var(--axia-black)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'var(--space-1) var(--space-2)',
      zIndex: 9999,
      fontWeight: 'var(--weight-bold)',
      fontSize: 'var(--text-sm)',
    }}>
      <span>Update available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: 'var(--axia-black)',
          color: 'var(--axia-aqua)',
          border: 'none',
          padding: '4px 12px',
          fontWeight: 'var(--weight-bold)',
          fontSize: 'var(--text-xs)',
          cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          letterSpacing: 'var(--tracking-wide)',
          textTransform: 'uppercase',
        }}
      >
        Reload
      </button>
    </div>
  );
}
