import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('[PWA] Service worker registered', r);
    },
    onRegisterError(error: unknown) {
      console.warn('[PWA] Service worker registration error', error);
    },
  });

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
