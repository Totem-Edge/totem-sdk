/**
 * TOTEM PROVE OWNERSHIP POPUP
 * Root Identity ownership proof confirmation popup
 * Uses theme system for consistent styling
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { bootstrapPopupTheme } from '../theme/popupThemeBootstrap';

bootstrapPopupTheme();

interface PendingProveOwnership {
  origin: string;
  rootAddress: string;
  childAddresses: string[];
  childIndices: number[];
}

function ProveOwnershipPopup() {
  const [pending, setPending] = useState<PendingProveOwnership | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);

  useEffect(() => {
    chrome.windows.getCurrent((win) => {
      if (win?.id) {
        setCurrentWindowId(win.id);
      }
    });

    chrome.runtime.sendMessage({ method: 'proveOwnership:getPending' }, (response) => {
      if (response?.ok && response.result) {
        setPending(response.result);
      } else {
        setError(response?.error || 'No pending prove-ownership request');
      }
    });
  }, []);

  const handleApprove = () => {
    if (loading) return;
    setLoading(true);
    chrome.runtime.sendMessage({
      type: 'prove-ownership-approval',
      approved: true,
      windowId: currentWindowId,
    }, () => {
      window.close();
    });
  };

  const handleReject = () => {
    chrome.runtime.sendMessage({
      type: 'prove-ownership-approval',
      approved: false,
      windowId: currentWindowId,
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
        <div style={styles.loading}>Loading ownership proof request...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.icon}>🔗</div>
        <div style={styles.headerText}>
          <h1 style={styles.title}>PROVE OWNERSHIP</h1>
          <p style={styles.subtitle}>Root Identity cross-address proof</p>
        </div>
      </div>

      <div style={styles.domainBox}>
        <div style={styles.label}>REQUESTING SITE</div>
        <div style={styles.domainValue}>{pending.origin}</div>
      </div>

      <div style={styles.infoBox}>
        <div style={styles.label}>ROOT ADDRESS</div>
        <div style={styles.addressValue}>{pending.rootAddress}</div>
      </div>

      <div style={styles.sectionLabel}>CHILD ADDRESSES TO LINK ({pending.childAddresses.length})</div>
      <div style={styles.childList}>
        {pending.childAddresses.map((addr, i) => (
          <div key={i} style={styles.childRow}>
            <span style={styles.childIndex}>#{pending.childIndices[i]}</span>
            <span style={styles.childAddr}>{addr}</span>
          </div>
        ))}
      </div>

      <div style={styles.warning}>
        ⚠️ This generates a cryptographic proof linking the root address to the child addresses listed above. The proof can be verified by anyone with the public data.
      </div>

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
            opacity: loading ? 0.5 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          onClick={handleApprove}
          disabled={loading}
        >
          {loading ? 'PROVING...' : 'APPROVE'}
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
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-default, #333)',
  },
  icon: {
    width: '40px',
    height: '40px',
    background: 'var(--bg-subtle, #1a1a1a)',
    border: '2px solid var(--text-primary, #fff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    margin: '0 0 4px 0',
    color: 'var(--text-primary, #fff)',
  },
  subtitle: {
    color: 'var(--text-muted, #888)',
    fontSize: '11px',
    margin: 0,
  },
  domainBox: {
    background: 'var(--accent-muted, rgba(0, 217, 181, 0.1))',
    border: '1px solid var(--accent, #00D9B5)',
    padding: '10px',
    marginBottom: '12px',
  },
  label: {
    color: 'var(--text-muted, #888)',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '4px',
  },
  domainValue: {
    color: 'var(--accent, #00D9B5)',
    fontSize: '12px',
    wordBreak: 'break-all' as const,
  },
  infoBox: {
    background: 'var(--bg-elevated, #111)',
    border: '1px solid var(--border-default, #333)',
    padding: '10px',
    marginBottom: '12px',
  },
  addressValue: {
    color: 'var(--text-primary, #fff)',
    fontSize: '11px',
    wordBreak: 'break-all' as const,
    fontFamily: 'monospace',
  },
  sectionLabel: {
    color: 'var(--text-muted, #888)',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '6px',
  },
  childList: {
    background: 'var(--bg-elevated, #111)',
    border: '1px solid var(--border-default, #333)',
    padding: '8px',
    marginBottom: '12px',
    maxHeight: '150px',
    overflowY: 'auto' as const,
  },
  childRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    padding: '4px 0',
    borderBottom: '1px solid var(--border-subtle, #222)',
  },
  childIndex: {
    color: 'var(--accent, #00D9B5)',
    fontSize: '10px',
    minWidth: '28px',
    flexShrink: 0,
  },
  childAddr: {
    color: 'var(--text-primary, #fff)',
    fontSize: '10px',
    wordBreak: 'break-all' as const,
    fontFamily: 'monospace',
  },
  warning: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid #f59e0b',
    padding: '10px',
    marginBottom: '70px',
    fontSize: '10px',
    color: '#f59e0b',
    lineHeight: '1.5',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
    position: 'fixed' as const,
    bottom: '16px',
    left: '16px',
    right: '16px',
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
    color: 'var(--text-primary, #fff)',
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
    color: '#000',
  },
  loading: {
    textAlign: 'center' as const,
    color: 'var(--text-muted, #888)',
    padding: '40px',
  },
  errorBox: {
    textAlign: 'center' as const,
    padding: '40px 20px',
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
    margin: '0 auto 16px',
  },
  errorText: {
    color: '#ef4444',
    fontSize: '12px',
    marginBottom: '20px',
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
    cursor: 'pointer',
  },
};

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<ProveOwnershipPopup />);
}
