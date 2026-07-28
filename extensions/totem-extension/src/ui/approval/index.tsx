import React from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { bootstrapPopupTheme } from '../theme/popupThemeBootstrap';
import '../../styles/design-tokens.css';

bootstrapPopupTheme();

const formatAmount = (amount: string): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  if (num === 0) return '0';
  if (num < 0.0001) return num.toExponential(4);
  if (num >= 1000000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return num.toLocaleString(undefined, { maximumFractionDigits: 8 });
};

const truncateAddress = (address: string): string => {
  if (address.length <= 20) return address;
  return `${address.slice(0, 12)}...${address.slice(-8)}`;
};

const getTokenName = (tokenId: string): string => {
  if (tokenId === '0x00' || !tokenId) return 'MINIMA';
  return truncateAddress(tokenId);
};

const ApprovalDialog: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type') || 'tx';
  const origin = urlParams.get('origin') || 'Unknown site';
  const to = urlParams.get('to') || '';
  const amount = urlParams.get('amount') || '0';
  const tokenId = urlParams.get('tokenId') || '0x00';
  const intent = urlParams.get('intent') || 'send';
  
  const handleApprove = () => {
    chrome.runtime.sendMessage({ method: 'approval:approve' });
    window.close();
  };
  
  const handleReject = () => {
    chrome.runtime.sendMessage({ method: 'approval:reject' });
    window.close();
  };

  const isTransaction = type === 'tx' || to;
  const tokenName = getTokenName(tokenId);
  const isNativeToken = tokenId === '0x00' || !tokenId;
  
  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'var(--bg-base, #000)',
      padding: '16px',
      boxSizing: 'border-box',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-default, #333)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: 'var(--bg-subtle, #1a1a1a)',
          border: '2px solid var(--text-primary, #fff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px'
        }}>
          {isTransaction ? '💸' : '🔗'}
        </div>
        <div>
          <h1 style={{
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            margin: '0 0 4px 0',
            color: 'var(--text-primary, #fff)'
          }}>
            {isTransaction ? 'SEND TRANSACTION' : 'CONNECTION REQUEST'}
          </h1>
          <p style={{
            color: 'var(--text-muted, #888)',
            fontSize: '11px',
            margin: 0
          }}>
            {isTransaction ? 'Review and approve this transaction' : 'Approve site connection'}
          </p>
        </div>
      </div>

      <div style={{
        background: 'var(--accent-muted, rgba(0, 217, 181, 0.1))',
        border: '1px solid var(--accent, #00D9B5)',
        padding: '10px',
        marginBottom: '16px'
      }}>
        <div style={{
          color: 'var(--text-muted, #888)',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '4px'
        }}>
          REQUESTING SITE
        </div>
        <div style={{
          color: 'var(--accent, #00D9B5)',
          fontSize: '12px',
          wordBreak: 'break-all'
        }}>
          {origin}
        </div>
      </div>

      {isTransaction && (
        <>
          <div style={{
            background: 'var(--bg-elevated, #111)',
            border: '2px solid var(--text-primary, #fff)',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{
              color: 'var(--text-muted, #888)',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '8px'
            }}>
              AMOUNT
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'var(--text-primary, #fff)',
              marginBottom: '4px'
            }}>
              {formatAmount(amount)} <span style={{ fontSize: '14px', color: 'var(--accent, #00D9B5)' }}>{tokenName}</span>
            </div>
            {!isNativeToken && (
              <div style={{
                color: 'var(--text-muted, #666)',
                fontSize: '10px',
                wordBreak: 'break-all'
              }}>
                Token ID: {tokenId}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle, #222)'
          }}>
            <span style={{ color: 'var(--text-muted, #888)', fontSize: '11px' }}>Intent</span>
            <span style={{ 
              color: 'var(--text-primary, #fff)', 
              fontSize: '11px',
              textTransform: 'uppercase',
              background: 'var(--bg-subtle, #222)',
              padding: '2px 8px',
              border: '1px solid var(--border-default, #333)'
            }}>
              {intent}
            </span>
          </div>

          <div style={{
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle, #222)'
          }}>
            <div style={{ 
              color: 'var(--text-muted, #888)', 
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '6px'
            }}>
              RECIPIENT ADDRESS
            </div>
            <div style={{
              fontFamily: 'monospace',
              color: 'var(--text-primary, #fff)',
              fontSize: '11px',
              wordBreak: 'break-all',
              background: 'var(--bg-elevated, #111)',
              padding: '8px',
              border: '1px solid var(--border-default, #333)'
            }}>
              {to || 'Not specified'}
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle, #222)'
          }}>
            <span style={{ color: 'var(--text-muted, #888)', fontSize: '11px' }}>Network Fee</span>
            <span style={{ color: 'var(--text-muted, #666)', fontSize: '11px', fontStyle: 'italic' }}>
              Estimated at broadcast
            </span>
          </div>

          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid #f59e0b',
            padding: '10px',
            marginTop: '16px',
            marginBottom: '16px',
            fontSize: '10px',
            color: '#f59e0b'
          }}>
            ⚠️ This transaction will consume a one-time WOTS signature from your wallet
          </div>
        </>
      )}

      {!isTransaction && (
        <p style={{ 
          color: 'var(--text-secondary, #aaa)', 
          fontSize: '12px', 
          marginBottom: '16px',
          lineHeight: 1.5
        }}>
          This site is requesting access to view your account addresses and suggest transactions to approve.
        </p>
      )}
      
      <div style={{ 
        display: 'flex', 
        gap: '8px',
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px'
      }}>
        <button 
          onClick={handleReject}
          style={{
            flex: 1,
            padding: '12px',
            fontFamily: 'inherit',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            cursor: 'pointer',
            border: '2px solid var(--text-primary, #fff)',
            background: 'transparent',
            color: 'var(--text-primary, #fff)'
          }}
        >
          REJECT
        </button>
        <button 
          onClick={handleApprove}
          style={{
            flex: 1,
            padding: '12px',
            fontFamily: 'inherit',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            cursor: 'pointer',
            border: '2px solid var(--accent, #00D9B5)',
            background: 'var(--accent, #00D9B5)',
            color: '#000'
          }}
        >
          APPROVE
        </button>
      </div>
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<ApprovalDialog />);
}
