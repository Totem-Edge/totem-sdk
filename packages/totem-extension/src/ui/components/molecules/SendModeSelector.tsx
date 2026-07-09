/**
 * Send Mode Selector - Global vs Focused Send
 * Brutalist design dropdown for selecting source account mode
 */

import React, { useState, useEffect } from 'react';
import { Card, Typography } from '../atoms';
import { isDesignerMode } from '../../../config/constants';
import '../../theme/axia-tokens.css';

export interface SendModeOption {
  mode: 'global' | 'focused';
  addressIndex?: number;
  label: string;
  description: string;
}

export interface SendModeSelectorProps {
  selectedMode: SendModeOption;
  onModeChange: (mode: SendModeOption) => void;
}

// Mock addresses for Designer mode
const MOCK_ADDRESSES = [
  { index: 0, address: 'MxG0892KJHFGG7834JHFD83JKHF8D73JHF8D37JHF8D3' },
  { index: 1, address: 'MxH1234ABCDEFG5678IJKL90MNOP1234QRST5678UVWX' },
  { index: 2, address: 'MxJ5678PQRSTU1234VWXYZ6789ABCD0123EFGH4567IJ' },
  { index: 3, address: 'MxK9012LMNOPQ3456RSTUV7890WXYZ1234ABCD5678EF' },
];

const MOCK_BALANCES: Record<number, string> = { 0: '12.5', 1: '0.0001', 2: '0', 3: '3.75' };

function formatMinimaPreview(val: string): string {
  const n = parseFloat(val);
  if (!n || isNaN(n)) return '';
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return s;
}

export function SendModeSelector({ selectedMode, onModeChange }: SendModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [excludedAddresses, setExcludedAddresses] = useState<number[]>([]);
  const [addressNames, setAddressNames] = useState<{ [key: number]: string }>({});
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [addressBalances, setAddressBalances] = useState<Record<number, string>>({});
  const [balancesLoading, setBalancesLoading] = useState(false);
  const buttonRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAccounts();
    loadSettings();
  }, []);

  const loadAccounts = async () => {
    try {
      // Designer mode: use mock data
      if (isDesignerMode()) {
        console.log('[SendModeSelector] Designer mode - using mock addresses');
        setAddresses(MOCK_ADDRESSES);
        return;
      }

      const response = await chrome.runtime.sendMessage({
        method: 'wallet:getState'
      });

      if (response.result && response.result.accounts) {
        setAddresses(response.result.accounts);
      }
    } catch (error) {
      console.error('[SendModeSelector] Failed to load accounts:', error);
    }
  };

  const loadSettings = async () => {
    try {
      // Designer mode: use empty settings
      if (isDesignerMode()) {
        console.log('[SendModeSelector] Designer mode - using empty settings');
        setExcludedAddresses([]);
        setAddressNames({
          0: 'Development Wallet',
          1: 'Testing Account',
        });
        return;
      }

      const result = await chrome.storage.local.get(['excludedAddresses', 'addressNames']);
      setExcludedAddresses(result.excludedAddresses || []);
      setAddressNames(result.addressNames || {});
    } catch (error) {
      console.error('[SendModeSelector] Failed to load settings:', error);
    }
  };

  const handleSelect = (option: SendModeOption) => {
    onModeChange(option);
    setIsOpen(false);
  };

  const fetchAddressBalances = async (addrs: any[]) => {
    if (addrs.length === 0) return;

    if (isDesignerMode()) {
      setAddressBalances(MOCK_BALANCES);
      return;
    }

    setBalancesLoading(true);
    try {
      const addressList = addrs.map((a: any) => a.address);
      const response = await chrome.runtime.sendMessage({
        method: 'balances:getBulkSnapshot',
        params: [addressList]
      });
      if (response?.ok && response.balances) {
        const balMap: Record<number, string> = {};
        for (const acc of addrs) {
          const bal = response.balances[acc.address];
          balMap[acc.index] = bal?.sendable || bal?.confirmed || '0';
        }
        setAddressBalances(balMap);
      }
    } catch (e) {
      // silently ignore — balances are informational only
    } finally {
      setBalancesLoading(false);
    }
  };

  const handleToggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
      fetchAddressBalances(addresses);
    }
    setIsOpen(!isOpen);
  };

  // Filter out excluded addresses
  const availableAddresses = addresses.filter(
    acc => !excludedAddresses.includes(acc.index)
  );

  const globalOption: SendModeOption = {
    mode: 'global',
    label: 'Consolidated',
    description: 'Auto send from all'
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Selected Mode Display */}
      <div ref={buttonRef}>
        <button
          onClick={handleToggleDropdown}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            height: '36px',
            boxSizing: 'border-box' as const,
            background: 'var(--bg-elevated)',
            border: `1px solid ${isOpen ? 'var(--axia-aqua)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
            color: 'var(--text-primary)',
            transition: 'border-color 0.2s',
          }}
        >
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedMode.mode === 'global' ? 'Consolidated' : selectedMode.label}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px', transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none', marginLeft: '4px' }}>
            ▾
          </span>
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              zIndex: 100,
              maxHeight: '320px',
              overflowY: 'auto',
              background: 'var(--bg-base)',
              border: '2px solid var(--axia-aqua)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            {/* Global Mode */}
            <div
              onClick={() => handleSelect(globalOption)}
              style={{
                padding: 'var(--space-2)',
                cursor: 'pointer',
                background: selectedMode.mode === 'global' ? 'rgba(0, 217, 181, 0.1)' : 'transparent',
                borderBottom: '1px solid var(--border-subtle)',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (selectedMode.mode !== 'global') {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMode.mode !== 'global') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {globalOption.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {globalOption.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ 
              padding: 'var(--space-1) var(--space-2)', 
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Focused Send
              </div>
            </div>

            {/* Individual Addresses */}
            {availableAddresses.map((account) => {
              const customName = addressNames[account.index];
              const isSelected = selectedMode.mode === 'focused' && selectedMode.addressIndex === account.index;
              
              const focusedOption: SendModeOption = {
                mode: 'focused',
                addressIndex: account.index,
                label: customName || `#${account.index + 1}`,
                description: `${account.address.slice(0, 10)}...${account.address.slice(-8)}`
              };

              return (
                <div
                  key={account.index}
                  onClick={() => handleSelect(focusedOption)}
                  style={{
                    padding: 'var(--space-1-5)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(0, 217, 181, 0.1)' : 'transparent',
                    borderBottom: '1px solid var(--border-accent)',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    {/* Row 1: number + address inline */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, flexShrink: 0 }}>
                        {focusedOption.label}
                      </span>
                      <div style={{ display: 'flex', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flex: 1, minWidth: 0 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          {account.address.slice(0, -4)}
                        </span>
                        <span style={{ flexShrink: 0 }}>
                          {account.address.slice(-4)}
                        </span>
                      </div>
                    </div>
                    {/* Row 2: balance below */}
                    {balancesLoading ? (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px', display: 'block' }}>···</span>
                    ) : (() => {
                      const bal = addressBalances[account.index];
                      const preview = bal ? formatMinimaPreview(bal) : '';
                      return preview ? (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px', display: 'block' }}>
                          {preview} ᴹ
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              );
            })}

            {/* No addresses available */}
            {availableAddresses.length === 0 && (
              <div style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                <Typography variant="caption" color="muted">
                  All addresses are excluded. Enable at least one address in Settings.
                </Typography>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
