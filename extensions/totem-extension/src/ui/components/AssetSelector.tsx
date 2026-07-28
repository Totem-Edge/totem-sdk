/**
 * Asset Selector Component
 * Dropdown to pick token by tokenId with name/symbol/balance display
 */

import React, { useState } from 'react';

export interface AssetSelectorProps {
  tokens: any[];
  selectedTokenId: string;
  onSelect: (tokenId: string) => void;
}

export function AssetSelector({ tokens, selectedTokenId, onSelect }: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedToken = tokens.find(t => t.tokenid === selectedTokenId);

  const getTokenLabel = (token: any) => {
    const name = token.name || token.ticker || 'Unknown';
    const balance = token.sendable || token.confirmed || '0';
    return `${name} (${balance})`;
  };

  const getTokenIcon = (token: any) => {
    if (!token) return '🪙';
    if (token.icon) return token.icon;
    if (token.tokenid === '0x00') return '◎';
    return '🪙';
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '10px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{getTokenIcon(selectedToken)}</span>
          <span>{selectedToken ? getTokenLabel(selectedToken) : 'Select Asset'}</span>
        </div>
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
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            {tokens.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                No tokens available
              </div>
            ) : (
              tokens.map((token) => (
                <div
                  key={token.tokenid}
                  onClick={() => {
                    onSelect(token.tokenid);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '10px',
                    cursor: 'pointer',
                    background: token.tokenid === selectedTokenId ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>{getTokenIcon(token)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px' }}>
                      {token.name || token.ticker || 'Unknown Token'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                      {token.tokenid.slice(0, 12)}...{token.tokenid.slice(-6)}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {token.sendable || token.confirmed || '0'}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
