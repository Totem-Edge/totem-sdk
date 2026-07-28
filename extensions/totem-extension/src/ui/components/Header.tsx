import React from 'react';

interface HeaderProps {
  network?: string;
  onNetworkClick?: () => void;
  onSettingsClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  network = 'Minima Mainnet',
  onNetworkClick,
  onSettingsClick 
}) => {
  return (
    <header style={{
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <img 
          src="/icons/icon-48.png" 
          alt="Totem" 
          style={{ width: '24px', height: '24px', borderRadius: '4px' }}
        />
        <span className="text-sm font-semibold">Totem</span>
      </div>
      
      <button 
        onClick={onNetworkClick}
        style={{
          padding: '4px 8px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-xs)',
          cursor: 'pointer'
        }}
      >
        {network} ▼
      </button>
    </header>
  );
};