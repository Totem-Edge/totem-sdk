/**
 * Add Custom Token Dialog
 * Allows users to manually add tokens by tokenId with custom metadata
 */

import React, { useState } from 'react';

export interface AddTokenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (tokenData: any) => void;
}

export function AddTokenDialog({ isOpen, onClose, onAdd }: AddTokenDialogProps) {
  const [tokenId, setTokenId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!tokenId.trim()) {
      setError('Token ID is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fetch token metadata from chain
      const response = await chrome.runtime.sendMessage({
        method: 'token:getMetadata',
        params: { tokenId: tokenId.trim() }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const tokenData = {
        tokenId: tokenId.trim(),
        name: customName || response.result?.name || 'Unknown Token',
        symbol: customSymbol || response.result?.symbol || '???',
        icon: customIcon || response.result?.icon,
        custom: true
      };

      // Save to storage
      const stored = await chrome.storage.local.get('customTokens');
      const customTokens = stored.customTokens || [];
      customTokens.push(tokenData);
      await chrome.storage.local.set({ customTokens });

      onAdd(tokenData);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add token');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTokenId('');
    setCustomName('');
    setCustomSymbol('');
    setCustomIcon('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="quota-modal-overlay" style={{ zIndex: 1000 }}>
      <div className="quota-modal" style={{ maxWidth: '400px' }}>
        <div className="quota-modal-header">
          <h2 style={{ fontSize: '16px' }}>Add Custom Token</h2>
        </div>

        <div className="quota-modal-body">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              Token ID *
            </label>
            <input
              type="text"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="0x..."
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--panel)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontSize: '13px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              Custom Name (optional)
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="My Token"
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--panel)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontSize: '13px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              Custom Symbol (optional)
            </label>
            <input
              type="text"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              placeholder="MTK"
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--panel)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontSize: '13px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              Custom Icon URL (optional)
            </label>
            <input
              type="text"
              value={customIcon}
              onChange={(e) => setCustomIcon(e.target.value)}
              placeholder="https://..."
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--panel)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontSize: '13px'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '12px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
                background: 'var(--panel)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'var(--text)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={loading}
              className="quota-upgrade-button"
              style={{ flex: 1 }}
            >
              {loading ? 'Adding...' : 'Add Token'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
