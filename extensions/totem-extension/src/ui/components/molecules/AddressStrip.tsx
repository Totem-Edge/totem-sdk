/**
 * AXIA ADDRESS STRIP
 * Displays truncated address with copy button
 */

import React, { useState } from 'react';
import { Typography } from '../atoms';
import { Button } from '../atoms';
import '../../theme/axia-tokens.css';

export interface AddressStripProps {
  address: string;
  label?: string;
  showCopy?: boolean;
  truncate?: boolean;
}

export function AddressStrip({ 
  address, 
  label, 
  showCopy = true,
  truncate = true 
}: AddressStripProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const truncatedAddress = truncate && address.length > 16
    ? `${address.slice(0, 8)}...${address.slice(-8)}`
    : address;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-1)',
      padding: 'var(--space-1)',
      background: 'var(--bg-base)',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && (
          <Typography variant="caption" color="muted" uppercase style={{ marginBottom: '2px' }}>
            {label}
          </Typography>
        )}
        <Typography 
          variant="body" 
          color="primary" 
          mono
          style={{ 
            wordBreak: 'break-all',
            fontSize: 'var(--text-sm)' 
          }}
        >
          {truncatedAddress}
        </Typography>
      </div>
      
      {showCopy && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleCopy}
          style={{ flexShrink: 0 }}
        >
          {copied ? '✓' : '📋'}
        </Button>
      )}
    </div>
  );
}
