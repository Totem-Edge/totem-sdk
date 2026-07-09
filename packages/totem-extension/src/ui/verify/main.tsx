/**
 * TOTEM VERIFY POPUP
 * Sign-In With Wallet (SIWE) verification confirmation popup
 * Uses theme system for consistent styling
 */

import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { bootstrapPopupTheme } from '../theme/popupThemeBootstrap';

bootstrapPopupTheme();

interface VerifyChallenge {
  domain: string;
  address: string;
  statement?: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  chainId?: string;
}

type CapacityLevel = 'ok' | 'warning' | 'critical' | 'exhausted';

interface SignatureCapacity {
  used: number;
  total: number;
  remaining: number;
  percentage: number;
  level: CapacityLevel;
}

interface PendingVerification {
  challenge: VerifyChallenge;
  rawMessage: string;
  addressIndex: number;
  minimaAddress: string;
  origin: string;
  wotsIndices?: { l1: number; l2: number };
  capacity?: SignatureCapacity;
}

const CAPACITY_COPY: Record<CapacityLevel, { title: string; body: string; color: string } | null> = {
  ok: null,
  warning: {
    title: 'ADDRESS RUNNING LOW ON SIGNATURES',
    body: 'This address has used over 80% of its one-time signatures. Consider rotating to a different address for this dApp.',
    color: '#f59e0b',
  },
  critical: {
    title: 'ADDRESS ALMOST OUT OF SIGNATURES',
    body: 'This address is over 95% used. Switch to another address or generate a new one before signing again.',
    color: '#ef4444',
  },
  exhausted: {
    title: 'ADDRESS HAS NO SIGNATURES LEFT',
    body: 'This address has no remaining one-time signatures. Switch to another address or generate a new one — it can no longer sign.',
    color: '#ef4444',
  },
};

function VerifyApprovalPopup() {
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    chrome.windows.getCurrent((win) => {
      if (win?.id) {
        setCurrentWindowId(win.id);
      }
    });

    chrome.runtime.sendMessage({ method: 'verify:getChallenge' }, (response) => {
      if (response?.ok && response.result) {
        setPending(response.result);
      } else {
        setError(response?.error || 'No pending verification request');
      }
    });
  }, []);

  useEffect(() => {
    if (!pending) return;

    const updateTimer = () => {
      const remaining = pending.challenge.expiresAt - Date.now();
      if (remaining <= 0) {
        setTimeRemaining('EXPIRED');
        return;
      }
      const seconds = Math.floor(remaining / 1000);
      const minutes = Math.floor(seconds / 60);
      if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds % 60}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pending]);

  const isExpired = useMemo(() => {
    if (!pending) return false;
    return pending.challenge.expiresAt <= Date.now();
  }, [pending, timeRemaining]);

  const riskLevel = useMemo(() => {
    if (!pending) return 'low';
    if (isExpired) return 'high';
    if (!pending.challenge.domain.startsWith('https://')) return 'medium';
    return 'low';
  }, [pending, isExpired]);

  const riskColor = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#ef4444'
  }[riskLevel];

  const handleApprove = () => {
    if (isExpired || loading) return;
    setLoading(true);

    chrome.runtime.sendMessage({
      type: 'verify-approval',
      approved: true,
      windowId: currentWindowId
    }, () => {
      window.close();
    });
  };

  const handleReject = () => {
    chrome.runtime.sendMessage({
      type: 'verify-approval',
      approved: false,
      windowId: currentWindowId
    }, () => {
      window.close();
    });
  };

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <div style={styles.errorIcon}>!</div>
          <div style={styles.errorText}>{error}</div>
          <button style={styles.closeBtn} onClick={() => window.close()}>Close</button>
        </div>
      </div>
    );
  }

  if (!pending) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading verification request...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.icon}>🔐</div>
        <div style={styles.headerText}>
          <h1 style={styles.title}>SIGN MESSAGE</h1>
          <p style={styles.subtitle}>Verify your wallet ownership</p>
        </div>
      </div>

      <div style={styles.domainBox}>
        <div style={styles.label}>REQUESTING SITE</div>
        <div style={styles.domainValue}>{pending.challenge.domain}</div>
      </div>

      <div style={{
        ...styles.expiryBox,
        background: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
        borderColor: isExpired ? '#ef4444' : '#22c55e'
      }}>
        <span style={styles.expiryIcon}>{isExpired ? '⚠️' : '⏱️'}</span>
        <span style={{ color: isExpired ? '#ef4444' : '#22c55e', fontSize: '11px' }}>
          {isExpired ? 'Challenge expired - request a new one' : `Expires in ${timeRemaining}`}
        </span>
      </div>

      {riskLevel !== 'low' && (
        <div style={{
          ...styles.riskBox,
          background: `rgba(${riskLevel === 'medium' ? '245, 158, 11' : '239, 68, 68'}, 0.1)`,
          borderColor: riskColor
        }}>
          <span style={{ color: riskColor, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {riskLevel} risk
          </span>
          <span style={{ color: 'var(--text-muted, #888)', fontSize: '10px', flex: 1 }}>
            {riskLevel === 'high' 
              ? 'Challenge has expired or is invalid'
              : 'Non-HTTPS site - verify the URL carefully'}
          </span>
        </div>
      )}

      <div style={styles.addressBox}>
        <div style={styles.label}>SIGNING ADDRESS</div>
        <div style={styles.addressValue}>{pending.minimaAddress}</div>
        <div style={styles.addressIndex}>Index #{pending.addressIndex}</div>
      </div>

      {pending.capacity && CAPACITY_COPY[pending.capacity.level] && (
        <div
          data-testid="capacity-warning"
          style={{
            background: `rgba(${pending.capacity.level === 'warning' ? '245, 158, 11' : '239, 68, 68'}, 0.1)`,
            border: `1px solid ${CAPACITY_COPY[pending.capacity.level]!.color}`,
            padding: '10px',
            marginBottom: '12px',
          }}
        >
          <div style={{
            color: CAPACITY_COPY[pending.capacity.level]!.color,
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '4px',
            fontWeight: 'bold',
          }}>
            ⚠️ {CAPACITY_COPY[pending.capacity.level]!.title}
          </div>
          <div style={{
            color: 'var(--text-muted, #aaa)',
            fontSize: '10px',
            lineHeight: 1.4,
            marginBottom: '6px',
          }}>
            {CAPACITY_COPY[pending.capacity.level]!.body}
          </div>
          <div style={{
            color: CAPACITY_COPY[pending.capacity.level]!.color,
            fontSize: '10px',
            fontFamily: 'monospace',
          }}>
            {pending.capacity.used.toLocaleString()} / {pending.capacity.total.toLocaleString()} used
            {' '}({pending.capacity.percentage.toFixed(1)}%) — {pending.capacity.remaining.toLocaleString()} remaining
          </div>
        </div>
      )}

      {pending.challenge.statement && (
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Statement</span>
          <span style={styles.infoValue}>{pending.challenge.statement}</span>
        </div>
      )}

      <div style={styles.infoRow}>
        <span style={styles.infoLabel}>Nonce</span>
        <span style={styles.infoValue}>{pending.challenge.nonce.slice(0, 16)}...</span>
      </div>

      <div style={styles.infoRow}>
        <span style={styles.infoLabel}>Issued</span>
        <span style={styles.infoValue}>
          {new Date(pending.challenge.issuedAt).toLocaleTimeString()}
        </span>
      </div>

      <div style={styles.leafWarning}>
        ⚠️ This action consumes one WOTS signature leaf from your wallet
        {pending.wotsIndices && (
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.85 }}>
            Leaf index: l1={pending.wotsIndices.l1}, l2={pending.wotsIndices.l2}
          </div>
        )}
      </div>

      <div 
        style={styles.rawToggle}
        onClick={() => setShowRaw(!showRaw)}
      >
        {showRaw ? 'Hide' : 'Show'} raw message
      </div>

      {showRaw && (
        <div style={styles.rawMessage}>
          {pending.rawMessage}
        </div>
      )}

      <div style={styles.actions}>
        <button 
          style={styles.rejectBtn}
          onClick={handleReject}
          disabled={loading}
        >
          REJECT
        </button>
        <button 
          style={{
            ...styles.confirmBtn,
            opacity: loading || isExpired ? 0.5 : 1,
            cursor: loading || isExpired ? 'not-allowed' : 'pointer'
          }}
          onClick={handleApprove}
          disabled={loading || isExpired}
        >
          {loading ? 'SIGNING...' : 'SIGN'}
        </button>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    background: 'var(--bg-base, #000)',
    color: 'var(--text-primary, #fff)',
    minHeight: '100vh',
    padding: '16px',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-default, #333)'
  },
  icon: {
    width: '40px',
    height: '40px',
    background: 'var(--bg-subtle, #1a1a1a)',
    border: '2px solid var(--text-primary, #fff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px'
  },
  headerText: {
    flex: 1
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    margin: '0 0 4px 0',
    color: 'var(--text-primary, #fff)'
  },
  subtitle: {
    color: 'var(--text-muted, #888)',
    fontSize: '11px',
    margin: 0
  },
  domainBox: {
    background: 'var(--accent-muted, rgba(0, 217, 181, 0.1))',
    border: '1px solid var(--accent, #00D9B5)',
    padding: '10px',
    marginBottom: '12px'
  },
  label: {
    color: 'var(--text-muted, #888)',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '4px'
  },
  domainValue: {
    color: 'var(--accent, #00D9B5)',
    fontSize: '12px',
    wordBreak: 'break-all' as const
  },
  expiryBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    border: '1px solid',
    marginBottom: '12px'
  },
  expiryIcon: {
    fontSize: '14px'
  },
  riskBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    border: '1px solid',
    marginBottom: '12px'
  },
  addressBox: {
    fontFamily: 'monospace',
    background: 'var(--bg-elevated, #111)',
    padding: '10px',
    margin: '12px 0',
    border: '1px solid var(--border-default, #333)'
  },
  addressValue: {
    color: 'var(--text-primary, #fff)',
    fontSize: '11px',
    wordBreak: 'break-all' as const
  },
  addressIndex: {
    color: 'var(--accent, #00D9B5)',
    fontSize: '10px',
    marginTop: '4px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--border-subtle, #222)'
  },
  infoLabel: {
    color: 'var(--text-muted, #888)',
    fontSize: '11px'
  },
  infoValue: {
    color: 'var(--text-primary, #fff)',
    fontSize: '11px',
    textAlign: 'right' as const,
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  leafWarning: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid #f59e0b',
    padding: '8px',
    marginTop: '12px',
    marginBottom: '12px',
    fontSize: '10px',
    color: '#f59e0b'
  },
  rawToggle: {
    color: 'var(--text-muted, #666)',
    fontSize: '10px',
    cursor: 'pointer',
    textDecoration: 'underline',
    marginBottom: '8px'
  },
  rawMessage: {
    background: 'var(--bg-elevated, #111)',
    border: '1px solid var(--border-default, #333)',
    padding: '8px',
    fontSize: '10px',
    color: 'var(--text-muted, #888)',
    maxHeight: '100px',
    overflowY: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    marginBottom: '12px'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
    position: 'fixed' as const,
    bottom: '16px',
    left: '16px',
    right: '16px'
  },
  rejectBtn: {
    flex: 1,
    padding: '12px',
    fontFamily: 'inherit',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    cursor: 'pointer',
    border: '2px solid var(--text-primary, #fff)',
    background: 'transparent',
    color: 'var(--text-primary, #fff)'
  },
  confirmBtn: {
    flex: 1,
    padding: '12px',
    fontFamily: 'inherit',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    cursor: 'pointer',
    border: '2px solid var(--accent, #00D9B5)',
    background: 'var(--accent, #00D9B5)',
    color: '#000'
  },
  loading: {
    textAlign: 'center' as const,
    color: 'var(--text-muted, #888)',
    padding: '40px'
  },
  errorBox: {
    textAlign: 'center' as const,
    padding: '40px 20px'
  },
  errorIcon: {
    width: '48px',
    height: '48px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '2px solid #ef4444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#ef4444',
    margin: '0 auto 16px'
  },
  errorText: {
    color: '#ef4444',
    fontSize: '12px',
    marginBottom: '20px'
  },
  closeBtn: {
    padding: '10px 24px',
    background: 'var(--bg-subtle, #333)',
    border: '2px solid var(--text-primary, #fff)',
    color: 'var(--text-primary, #fff)',
    fontFamily: 'inherit',
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    cursor: 'pointer'
  }
};

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<VerifyApprovalPopup />);
}
