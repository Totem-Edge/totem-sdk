/**
 * UPGRADE PROMPT MODAL - BRUTALIST DESIGN
 * Modal displayed when user exceeds quota limits
 */

import React from 'react';
import { Card, Typography, Button } from '../atoms';
import '../../theme/axia-tokens.css';

export interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
  walletAddress?: string;
}

export function UpgradePrompt({
  isOpen,
  onClose,
  title = 'UPGRADE YOUR QUOTA',
  description = 'You\'ve reached your free tier limit. Upgrade to continue using Axia API with higher quotas and priority access.',
  ctaText = 'UPGRADE NOW',
  ctaUrl = 'https://app.axia.to/billing/upgrade',
  walletAddress
}: UpgradePromptProps) {
  if (!isOpen) return null;

  const handleUpgrade = () => {
    // Build deep link with wallet address if provided
    let upgradeUrl = ctaUrl;
    if (walletAddress) {
      const separator = ctaUrl.includes('?') ? '&' : '?';
      upgradeUrl = `${ctaUrl}${separator}wallet=${encodeURIComponent(walletAddress)}`;
    }
    
    // Open in new tab
    chrome.tabs.create({ url: upgradeUrl });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 9998,
          animation: 'fadeIn 0.2s ease-in-out',
        }}
      />

      {/* Modal Container */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        maxWidth: '320px',
        width: '90%',
        animation: 'slideIn 0.2s ease-in-out',
      }}>
        <Card padding="lg" shadow>
          {/* Close Button */}
          <div style={{
            position: 'absolute',
            top: 'var(--space-1)',
            right: 'var(--space-1)',
          }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '2px solid var(--border-default)',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--axia-aqua)';
                e.currentTarget.style.background = 'var(--bg-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Typography variant="body" bold>×</Typography>
            </button>
          </div>

          {/* Icon */}
          <div style={{
            width: '64px',
            height: '64px',
            background: 'var(--axia-aqua)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px solid var(--axia-white)',
            boxShadow: 'var(--shadow-lg)',
            margin: '0 auto var(--space-3)',
          }}>
            <Typography 
              variant="h1" 
              style={{ 
                fontSize: '36px', 
                lineHeight: 1,
                color: 'var(--axia-white)'
              }}
            >
              ⚡
            </Typography>
          </div>

          {/* Title */}
          <Typography 
            variant="h2" 
            uppercase 
            color="primary"
            style={{ 
              textAlign: 'center',
              marginBottom: 'var(--space-2)',
              letterSpacing: '0.1em'
            }}
          >
            {title}
          </Typography>

          {/* Description */}
          <Typography 
            variant="body" 
            style={{ 
              textAlign: 'center',
              opacity: 0.85,
              marginBottom: 'var(--space-3)',
              lineHeight: 1.5,
            }}
          >
            {description}
          </Typography>

          {/* CTA Button */}
          <Button 
            variant="primary" 
            onClick={handleUpgrade}
            fullWidth
            style={{
              padding: 'var(--space-2)',
              fontSize: 'var(--text-base)',
              letterSpacing: '0.05em',
            }}
          >
            {ctaText}
          </Button>

          {/* Secondary Action */}
          <Button 
            variant="ghost" 
            onClick={onClose}
            fullWidth
            style={{
              marginTop: 'var(--space-1)',
              opacity: 0.7,
            }}
          >
            MAYBE LATER
          </Button>
        </Card>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to { 
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
}
