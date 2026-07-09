/**
 * AXIA BRUTALIST NAVIGATION
 * Bottom tab navigation with flat brutalist design
 */

import React from 'react';
import { Typography } from '../atoms';
import '../../theme/axia-tokens.css';

export type NavTab = 'home' | 'send' | 'receive' | 'activity' | 'settings' | 'token-detail';

export interface BrutalistNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

interface NavItemProps {
  id: NavTab;
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ id, label, icon, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-half)',
        padding: 'var(--space-1-5)',
        background: active ? 'var(--bg-elevated)' : 'transparent',
        border: 'none',
        borderTop: `2px solid ${active ? 'var(--axia-aqua)' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--bg-subtle)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {/* Icon */}
      <Typography 
        variant="body" 
        color={active ? 'accent' : 'muted'}
        style={{ fontSize: 'var(--text-xl)', lineHeight: 1 }}
      >
        {icon}
      </Typography>

      {/* Label */}
      <Typography 
        variant="caption" 
        color={active ? 'accent' : 'muted'}
        uppercase
        bold={active}
        style={{ fontSize: 'var(--text-2xs)' }}
      >
        {label}
      </Typography>
    </button>
  );
}

export function BrutalistNavigation({ activeTab, onTabChange }: BrutalistNavigationProps) {
  const tabs: Array<{ id: NavTab; label: string; icon: string }> = [
    { id: 'home', label: 'Home', icon: '■' },
    { id: 'send', label: 'Send', icon: '↑' },
    { id: 'receive', label: 'Receive', icon: '↓' },
    { id: 'activity', label: 'Activity', icon: '≡' },
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      background: 'var(--bg-base)',
      borderTop: '2px solid var(--border-default)',
      boxShadow: '0 -4px 0 rgba(0, 0, 0, 0.2)',
      zIndex: 'var(--z-sticky)',
    }}>
      {tabs.map((tab) => (
        <NavItem
          key={tab.id}
          id={tab.id}
          label={tab.label}
          icon={tab.icon}
          active={activeTab === tab.id || (tab.id === 'home' && activeTab === 'token-detail')}
          onClick={() => onTabChange(tab.id)}
        />
      ))}
    </nav>
  );
}
