import React from 'react';
import { useWallet, type AppRoute } from '../core/WalletContext';

interface NavItem { route: AppRoute; label: string; icon: string }

const ITEMS: NavItem[] = [
  { route: 'home', label: 'Wallet', icon: '⬡' },
  { route: 'send', label: 'Send', icon: '↑' },
  { route: 'receive', label: 'Receive', icon: '↓' },
  { route: 'settings', label: 'Settings', icon: '⚙' },
];

export function BottomNav() {
  const { route, setRoute } = useWallet();

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 'var(--pwa-max-width)',
      height: 'var(--pwa-nav-height)',
      background: 'var(--bg-elevated)',
      borderTop: '2px solid var(--border-subtle)',
      display: 'flex',
      zIndex: 100,
    }}>
      {ITEMS.map(item => (
        <button
          key={item.route}
          onClick={() => setRoute(item.route)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: route === item.route ? 'var(--axia-aqua)' : 'var(--text-muted)',
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-bold)',
            letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase',
            transition: 'color var(--transition-fast)',
            borderTop: route === item.route ? '2px solid var(--axia-aqua)' : '2px solid transparent',
            marginTop: -2,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
