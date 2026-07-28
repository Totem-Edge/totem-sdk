/**
 * Receive Modal Component
 * 
 * Displays receiving address with QR code, copy functionality,
 * and new address generation for the Totem wallet.
 */

import React, { useState } from 'react';
import { Card, Typography, Button } from '../atoms';
import { QRCodeSVG as _QRCodeSVG } from 'qrcode.react';
// qrcode.react types compiled against @types/react@18 but root workspace resolves @types/react@19;
// `any` cast avoids the JSXElementConstructor constraint check that triggers TS2786.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QRCodeSVG = _QRCodeSVG as any;

interface ReceiveModalProps {
  address: string;
  onClose: () => void;
  onGenerateNewAddress?: () => Promise<void>;
}

export function ReceiveModal({ address, onClose, onGenerateNewAddress }: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[ReceiveModal] Failed to copy address:', error);
    }
  };

  const handleGenerateNew = async () => {
    if (!onGenerateNewAddress) return;
    
    try {
      setGenerating(true);
      await onGenerateNewAddress();
    } catch (error) {
      console.error('[ReceiveModal] Failed to generate new address:', error);
    } finally {
      setGenerating(false);
    }
  };

  const isValidAddress = address && address.length > 0 && address !== 'Loading...' && !address.includes('0x00...');
  
  console.log('[ReceiveModal] Rendering with address:', address, 'isValid:', isValidAddress);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 'var(--space-2)',
    }}>
      <Card 
        padding="lg" 
        style={{ 
          maxWidth: '400px', 
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 'var(--space-2)',
        }}>
          <Typography variant="h2" uppercase>
            Receive MINIMA
          </Typography>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-2xl)',
              cursor: 'pointer',
              padding: '0',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <Typography variant="body" color="muted" style={{ marginBottom: 'var(--space-2)' }}>
          Share this address to receive MINIMA payments
        </Typography>

        {/* QR Code */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 'var(--space-2)',
          padding: 'var(--space-2)',
          backgroundColor: 'white',
          borderRadius: 'var(--radius-md)',
          minHeight: '232px',
        }}>
          {!isValidAddress ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
              <Typography variant="body" color="muted">
                {address === 'Loading...' ? 'Loading address...' : 'Invalid or missing address'}
              </Typography>
            </div>
          ) : (
            <QRCodeSVG 
              value={address} 
              size={200}
              level="M"
              includeMargin={true}
            />
          )}
        </div>

        {/* Address */}
        <Card 
          padding="md" 
          style={{ 
            marginBottom: 'var(--space-2)',
            backgroundColor: 'rgba(0, 217, 181, 0.05)',
            borderColor: 'var(--axia-aqua)',
          }}
        >
          <Typography 
            variant="body" 
            mono 
            style={{ 
              wordBreak: 'break-all',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-1)',
            }}
          >
            {address}
          </Typography>
        </Card>

        {/* Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-1-5)',
          marginBottom: onGenerateNewAddress ? 'var(--space-2)' : 0,
        }}>
          <Button
            variant="primary"
            size="md"
            onClick={handleCopy}
            fullWidth
          >
            {copied ? '✓ Copied!' : 'Copy Address'}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            fullWidth
          >
            Close
          </Button>
        </div>

        {/* Generate New Address */}
        {onGenerateNewAddress && (
          <div style={{ 
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--space-2)',
          }}>
            <Typography variant="caption" color="muted" style={{ marginBottom: 'var(--space-1)' }}>
              Need a fresh address? Generate a new one for enhanced privacy.
            </Typography>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateNew}
              disabled={generating}
              fullWidth
            >
              {generating ? 'Generating...' : '+ Generate New Address'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
