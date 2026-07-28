/**
 * AXIA BRUTALIST HEADER
 * Single-row compact header: Eagle logo (left) | Account switcher + WOTS key (right)
 */

import React, { useState, useEffect, useRef } from 'react';
import { Typography } from '../atoms';
import { TotemEagleMark } from '../../assets';
import { isDesignerMode } from '../../../config/constants';
import { DesignerConfigManager, type DesignerMode } from '../../../config/DesignerConfigManager';
import '../../theme/axia-tokens.css';

export interface BrutalistHeaderProps {
  accountAddress?: string;
  activeAccountIndex?: number;
  accounts?: { address: string; index: number; name?: string }[];
  wotsHealth?: 'healthy' | 'warning' | 'critical';
  networkStatus?: 'online' | 'offline';
  onAccountSwitch?: (index: number) => void;
  onWotsClick?: () => void;
  onSettingsClick?: () => void;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 8) + '…' + addr.slice(-4);
}

function wotsColor(health: 'healthy' | 'warning' | 'critical'): string {
  switch (health) {
    case 'healthy': return '#22C55E';
    case 'warning': return '#F59E0B';
    case 'critical': return '#EF4444';
  }
}

function wotsTooltip(health: 'healthy' | 'warning' | 'critical'): string {
  switch (health) {
    case 'healthy': return 'WOTS keys healthy — plenty of one-time signatures remaining. Click to view details.';
    case 'warning': return 'WOTS keys running low — some addresses are nearing their signature limit. Click to view details.';
    case 'critical': return 'WOTS keys critical — addresses have used most signatures and need rotating. Click to view details.';
  }
}

function WotsKeyIcon({ health, size = 16 }: { health: 'healthy' | 'warning' | 'critical'; size?: number }) {
  const color = wotsColor(health);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: `drop-shadow(0 0 4px ${color}80)`,
        transition: 'filter 0.3s ease',
      }}
    >
      <circle cx="8" cy="10" r="5" stroke={color} strokeWidth="2" fill="none" />
      <line x1="12" y1="10" x2="22" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="10" x2="18" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="10" x2="21" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BrutalistHeader({
  accountAddress,
  activeAccountIndex = 0,
  accounts = [],
  wotsHealth = 'healthy',
  networkStatus = 'online',
  onAccountSwitch,
  onWotsClick,
  onSettingsClick,
}: BrutalistHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [designerMode, setDesignerMode] = useState<DesignerMode>('mock');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const addressButtonRef = useRef<HTMLButtonElement>(null);
  const inDesignerMode = isDesignerMode();

  useEffect(() => {
    if (inDesignerMode) {
      DesignerConfigManager.getConfig().then((config) => {
        setDesignerMode(config.mode);
      });

      const handleChange = (config: { mode: DesignerMode }) => {
        setDesignerMode(config.mode);
      };
      DesignerConfigManager.watch(handleChange);
    }
  }, [inDesignerMode]);

  const handleCopyAddress = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accountAddress) return;
    try {
      await navigator.clipboard.writeText(accountAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[BrutalistHeader] Failed to copy address:', error);
    }
  };

  const handleAddressClick = () => {
    if (accounts.length <= 1) return;
    if (addressButtonRef.current) {
      const rect = addressButtonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setDropdownOpen(true);
  };

  const handleSelect = (index: number) => {
    setDropdownOpen(false);
    onAccountSwitch?.(index);
  };

  const multipleAccounts = accounts.length > 1;
  const accountName = accounts[activeAccountIndex]?.name ?? `#${activeAccountIndex + 1}`;

  return (
    <>
      <header style={{
        background: 'var(--bg-elevated)',
        borderBottom: '2px solid var(--border-accent)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={onSettingsClick}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            title="Settings"
          >
            <TotemEagleMark size={24} />
          </button>

          {inDesignerMode && (
            <span style={{
              fontFamily: 'monospace',
              fontSize: '9px',
              color: designerMode === 'live' ? '#EF4444' : '#22C55E',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {designerMode === 'live' ? '● LIVE' : '● MOCK'}
            </span>
          )}

        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}>
          {/* Account label + address — clickable if multiple accounts */}
          <button
            ref={addressButtonRef}
            onClick={multipleAccounts ? handleAddressClick : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              cursor: multipleAccounts ? 'pointer' : 'default',
              padding: '2px 4px',
              borderRadius: '4px',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { if (multipleAccounts) e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.06))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title={multipleAccounts ? 'Switch account' : accountAddress}
          >
            <Typography
              variant="body"
              mono
              color="secondary"
              style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
            >
              {accountName} {accountAddress ? truncateAddress(accountAddress) : 'No Account'}
            </Typography>
            {multipleAccounts && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: 1 }}>▾</span>
            )}
          </button>

          {accountAddress && (
            <button
              onClick={handleCopyAddress}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.6,
                transition: 'opacity 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
              title={copied ? 'Copied!' : 'Copy full address'}
            >
              <span style={{ color: 'var(--accent)', fontSize: '13px', lineHeight: 1 }}>
                {copied ? '✓' : '⎘'}
              </span>
            </button>
          )}

          <button
            onClick={onWotsClick}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            title={wotsTooltip(wotsHealth)}
          >
            <WotsKeyIcon health={wotsHealth} size={16} />
          </button>
        </div>
      </header>

      {/* Account dropdown overlay */}
      {dropdownOpen && (
        <>
          <div
            onClick={() => setDropdownOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
            }}
          />
          <div style={{
            position: 'fixed',
            top: dropdownPos.top,
            right: dropdownPos.right,
            zIndex: 999,
            background: 'var(--bg-elevated)',
            border: '2px solid var(--border-accent)',
            minWidth: '200px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            {accounts.map((acc, i) => {
              const isActive = i === activeAccountIndex;
              const label = acc.name ?? `#${i + 1}`;
              return (
                <button
                  key={acc.address}
                  onClick={() => handleSelect(i)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    padding: '10px 14px',
                    background: isActive ? 'var(--border-accent)' : 'transparent',
                    border: 'none',
                    borderBottom: i < accounts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.06))'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: isActive ? 'var(--bg-base)' : 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: isActive ? 'rgba(0,0,0,0.55)' : 'var(--text-muted)',
                    marginTop: '2px',
                  }}>
                    {truncateAddress(acc.address)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

    </>
  );
}
