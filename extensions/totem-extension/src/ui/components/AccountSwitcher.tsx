/**
 * Account Switcher Component
 * Dropdown for Global view + 64 address management with exclusion toggle
 */

import React, { useState, useEffect } from 'react';

export interface AccountSwitcherProps {
  onViewChange: (mode: 'global' | 'filtered', addressIndex?: number) => void;
}

export function AccountSwitcher({ onViewChange }: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'global' | 'filtered'>('global');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [excludedAddresses, setExcludedAddresses] = useState<number[]>([]);
  const [addressNames, setAddressNames] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    loadAccounts();
    loadSettings();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'wallet:getState'
      });

      if (response.result) {
        setAccounts(response.result.accounts || []);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get(['excludedAddresses', 'addressNames']);
      setExcludedAddresses(result.excludedAddresses || []);
      setAddressNames(result.addressNames || {});
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleViewSelect = (mode: 'global' | 'filtered', index?: number) => {
    setCurrentView(mode);
    setSelectedIndex(index ?? null);
    setIsOpen(false);
    onViewChange(mode, index);
  };

  const toggleExclusion = async (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const newExcluded = excludedAddresses.includes(index)
      ? excludedAddresses.filter(i => i !== index)
      : [...excludedAddresses, index];
    
    setExcludedAddresses(newExcluded);
    await chrome.storage.local.set({ excludedAddresses: newExcluded });
  };

  const getCurrentLabel = () => {
    if (currentView === 'global') {
      return 'All Accounts (Global)';
    }
    
    if (selectedIndex !== null) {
      const customName = addressNames[selectedIndex];
      return customName || `Address ${selectedIndex + 1}`;
    }
    
    return 'Select Account';
  };

  return (
    <div style={{ position: 'relative', marginBottom: '12px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          color: 'var(--text)',
          fontSize: '13px',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}
      >
        <span>{getCurrentLabel()}</span>
        <span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <>
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
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: 'var(--panel)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            <div
              onClick={() => handleViewSelect('global')}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                background: currentView === 'global' ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '500' }}>
                All Accounts (Global)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                Combined view of non-excluded addresses
              </div>
            </div>

            <div style={{ padding: '8px 0' }}>
              <div style={{ 
                padding: '6px 12px', 
                fontSize: '11px', 
                color: 'var(--muted)',
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                Individual Addresses
              </div>

              {accounts.map((account) => {
                const isExcluded = excludedAddresses.includes(account.index);
                const customName = addressNames[account.index];
                const isSelected = currentView === 'filtered' && selectedIndex === account.index;

                return (
                  <div
                    key={account.index}
                    onClick={() => handleViewSelect('filtered', account.index)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                      opacity: isExcluded ? 0.5 : 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px' }}>
                        {customName || `Address ${account.index + 1}`}
                      </div>
                      <div style={{ 
                        fontSize: '10px', 
                        color: 'var(--muted)', 
                        fontFamily: 'monospace',
                        marginTop: '2px'
                      }}>
                        {account.address.slice(0, 12)}...{account.address.slice(-6)}
                      </div>
                    </div>

                    <button
                      onClick={(e) => toggleExclusion(account.index, e)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        background: isExcluded ? 'var(--panel)' : 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        color: isExcluded ? 'var(--muted)' : '#ef4444',
                        cursor: 'pointer'
                      }}
                    >
                      {isExcluded ? 'Include' : 'Exclude'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
