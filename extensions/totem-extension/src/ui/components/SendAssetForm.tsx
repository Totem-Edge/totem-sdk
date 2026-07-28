/**
 * Send Asset Form
 * Enhanced send flow with recipient, amount, asset selector, and optional burn field
 */

import React, { useState, useEffect } from 'react';
import { AssetSelector } from './AssetSelector';
import { parseMinimaAmount, formatMinimaAmount } from '../../constants';

export interface SendAssetFormProps {
  onSend: (data: SendData) => void;
}

export interface SendData {
  to: string;
  amount: string;
  tokenId: string;
  burn?: string;
}

export function SendAssetForm({ onSend }: SendAssetFormProps) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenId, setTokenId] = useState('0x00');
  const [burn, setBurn] = useState('0');
  const [tokens, setTokens] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'wallet:getState'
      });

      if (response.result) {
        setTokens(response.result.tokens || []);
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!to.trim()) {
      setError('Recipient address is required');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    // Convert display amount to base units (44-decimal precision)
    const baseUnitsAmount = parseMinimaAmount(amount);
    const baseUnitsBurn = burn ? parseMinimaAmount(burn) : '0';

    onSend({
      to: to.trim(),
      amount: baseUnitsAmount,  // Send as base units string
      tokenId,
      burn: baseUnitsBurn  // Send as base units string
    });
  };

  const selectedToken = tokens.find(t => t.tokenid === tokenId);
  const maxAmountBaseUnits = selectedToken?.sendable || selectedToken?.confirmed || '0';
  const maxAmount = formatMinimaAmount(maxAmountBaseUnits, 8); // Format for display

  return (
    <form onSubmit={handleSubmit} style={{ padding: '12px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
          Asset
        </label>
        <AssetSelector
          tokens={tokens}
          selectedTokenId={tokenId}
          onSelect={setTokenId}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
          Recipient Address
        </label>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Mx..."
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
          Amount
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: '100%',
              padding: '8px',
              paddingRight: '50px',
              background: 'var(--panel)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '13px'
            }}
          />
          <button
            type="button"
            onClick={() => setAmount(maxAmount)}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '4px 8px',
              background: 'rgba(79, 70, 229, 0.2)',
              border: '1px solid rgba(79, 70, 229, 0.4)',
              borderRadius: '4px',
              color: '#6366f1',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            MAX
          </button>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
          Available: {maxAmount} {selectedToken?.ticker || selectedToken?.name || 'tokens'}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
          Burn Amount (optional)
        </label>
        <input
          type="text"
          value={burn}
          onChange={(e) => setBurn(e.target.value)}
          placeholder="0"
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
        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
          Optional: Amount to burn (defaults to 0)
        </div>
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

      <button
        type="submit"
        className="quota-upgrade-button"
        style={{ width: '100%' }}
      >
        Review Transaction
      </button>
    </form>
  );
}
