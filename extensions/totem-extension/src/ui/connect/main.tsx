/**
 * TOTEM CONNECT POPUP
 * Address picker popup for TOTEM_CONNECT first-time connections
 * Uses theme system for consistent styling
 */

import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { bootstrapPopupTheme } from '../theme/popupThemeBootstrap';

bootstrapPopupTheme();

interface Account {
  index: number;
  address: string;
  balance: string;
  name?: string;
}

interface PendingConnection {
  origin: string;
  accounts: Account[];
}

function ConnectPopup() {
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);

  useEffect(() => {
    chrome.windows.getCurrent((win) => {
      if (win?.id) {
        setCurrentWindowId(win.id);
      }
    });

    chrome.runtime.sendMessage({ method: 'connect:getPending' }, (response) => {
      if (response?.ok && response.result) {
        setPending(response.result);
        if (response.result.accounts.length === 1) {
          setSelectedIndex(response.result.accounts[0].index);
        }
      } else {
        setError(response?.error || 'No pending connection request');
      }
    });
  }, []);

  const filteredAccounts = useMemo(() => {
    if (!pending?.accounts) return [];
    if (!searchTerm) return pending.accounts;
    const term = searchTerm.toLowerCase();
    return pending.accounts.filter(account =>
      account.address.toLowerCase().includes(term) ||
      (account.name?.toLowerCase().includes(term)) ||
      account.index.toString().includes(term)
    );
  }, [pending?.accounts, searchTerm]);

  const formatBalance = (balance: string): string => {
    const num = parseFloat(balance);
    if (isNaN(num) || num === 0) return '0';
    if (num < 0.0001) return '<0.0001';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(4);
  };

  const truncateAddress = (address: string): string => {
    if (address.length <= 20) return address;
    return `${address.slice(0, 12)}...${address.slice(-8)}`;
  };

  const getDomainFromOrigin = (origin: string): string => {
    try {
      return new URL(origin).hostname;
    } catch {
      return origin;
    }
  };

  const handleApprove = () => {
    if (selectedIndex === null || loading) return;
    setLoading(true);

    chrome.runtime.sendMessage({
      type: 'connect-approval',
      approved: true,
      addressIndex: selectedIndex,
      windowId: currentWindowId
    }, () => {
      window.close();
    });
  };

  const handleReject = () => {
    chrome.runtime.sendMessage({
      type: 'connect-approval',
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
        <div style={styles.loading}>Loading connection request...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.icon}>🔗</div>
        <div style={styles.headerText}>
          <h1 style={styles.title}>CONNECTION REQUEST</h1>
          <p style={styles.subtitle}>Select an address to connect</p>
        </div>
      </div>

      <div style={styles.domainBox}>
        <div style={styles.label}>REQUESTING SITE</div>
        <div style={styles.domainValue}>{getDomainFromOrigin(pending.origin)}</div>
        <div style={styles.originFull}>{pending.origin}</div>
      </div>

      <div style={styles.permissionsBox}>
        <div style={styles.label}>PERMISSIONS GRANTED</div>
        <div style={styles.permissionItem}>
          <span style={styles.permissionIcon}>👁</span>
          <span>View selected address</span>
        </div>
        <div style={styles.permissionItem}>
          <span style={styles.permissionIcon}>📊</span>
          <span>View balance</span>
        </div>
        <div style={styles.permissionItem}>
          <span style={styles.permissionIcon}>✍️</span>
          <span>Request signatures (requires approval)</span>
        </div>
      </div>

      {pending.accounts.length > 3 && (
        <div style={styles.searchBox}>
          <input
            type="text"
            placeholder="Search addresses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      )}

      <div style={styles.accountsLabel}>SELECT ADDRESS</div>
      <div style={styles.accountsList}>
        {filteredAccounts.map((account) => (
          <div
            key={account.index}
            style={{
              ...styles.accountItem,
              borderColor: selectedIndex === account.index
                ? 'var(--accent, #00D9B5)'
                : 'var(--border-default, #333)',
              background: selectedIndex === account.index
                ? 'var(--accent-muted, rgba(0, 217, 181, 0.1))'
                : 'var(--bg-elevated, #0a0a0a)'
            }}
            onClick={() => setSelectedIndex(account.index)}
          >
            <div style={styles.accountIndex}>#{account.index}</div>
            <div style={styles.accountDetails}>
              <div style={styles.accountAddress}>{truncateAddress(account.address)}</div>
              <div style={styles.accountBalance}>{formatBalance(account.balance)} MIN</div>
            </div>
            {selectedIndex === account.index && (
              <div style={styles.checkmark}>✓</div>
            )}
          </div>
        ))}
      </div>

      <div style={styles.warning}>
        Only connect to sites you trust. This site will be able to see your address and request transaction approvals.
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
            opacity: loading || selectedIndex === null ? 0.5 : 1,
            cursor: loading || selectedIndex === null ? 'not-allowed' : 'pointer'
          }}
          onClick={handleApprove}
          disabled={loading || selectedIndex === null}
        >
          {loading ? 'CONNECTING...' : 'CONNECT'}
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
    fontSize: '14px',
    fontWeight: 'bold'
  },
  originFull: {
    color: 'var(--text-muted, #888)',
    fontSize: '10px',
    wordBreak: 'break-all' as const,
    marginTop: '4px'
  },
  permissionsBox: {
    background: 'var(--bg-elevated, #0a0a0a)',
    border: '1px solid var(--border-default, #333)',
    padding: '10px',
    marginBottom: '12px'
  },
  permissionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    fontSize: '11px',
    color: 'var(--text-secondary, #ccc)'
  },
  permissionIcon: {
    fontSize: '12px'
  },
  searchBox: {
    marginBottom: '8px'
  },
  searchInput: {
    width: '100%',
    padding: '8px',
    background: 'var(--bg-elevated, #0a0a0a)',
    border: '1px solid var(--border-default, #333)',
    color: 'var(--text-primary, #fff)',
    fontFamily: 'inherit',
    fontSize: '11px',
    boxSizing: 'border-box' as const
  },
  accountsLabel: {
    color: 'var(--text-muted, #888)',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '8px'
  },
  accountsList: {
    maxHeight: '180px',
    overflowY: 'auto' as const,
    marginBottom: '12px'
  },
  accountItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    marginBottom: '6px',
    border: '2px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  accountIndex: {
    color: 'var(--accent, #00D9B5)',
    fontSize: '10px',
    fontWeight: 'bold',
    minWidth: '24px'
  },
  accountDetails: {
    flex: 1
  },
  accountAddress: {
    fontSize: '11px',
    color: 'var(--text-primary, #fff)',
    fontFamily: 'monospace'
  },
  accountBalance: {
    fontSize: '10px',
    color: 'var(--text-muted, #888)',
    marginTop: '2px'
  },
  checkmark: {
    color: 'var(--accent, #00D9B5)',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  warning: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid #f59e0b',
    padding: '8px',
    marginBottom: '60px',
    fontSize: '10px',
    color: '#f59e0b'
  },
  actions: {
    display: 'flex',
    gap: '8px',
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
  ReactDOM.createRoot(root).render(<ConnectPopup />);
}
