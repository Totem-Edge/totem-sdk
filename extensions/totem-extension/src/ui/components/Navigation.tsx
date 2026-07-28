import React from 'react';

type Tab = 'home' | 'send' | 'activity' | 'settings';

interface NavigationProps {
  active: Tab;
  onTabChange: (tab: Tab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ active, onTabChange }) => {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'send', label: 'Send', icon: '↗️' },
    { id: 'activity', label: 'Activity', icon: '📊' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];
  
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      justifyContent: 'space-around',
      padding: 'var(--space-2) 0',
      zIndex: 100
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            background: 'none',
            border: 'none',
            color: active === tab.id ? 'var(--minima-green)' : 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: 'var(--space-2)',
            cursor: 'pointer',
            transition: 'color var(--transition-fast)'
          }}
        >
          <span style={{ fontSize: '20px' }}>{tab.icon}</span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)' }}>
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
};