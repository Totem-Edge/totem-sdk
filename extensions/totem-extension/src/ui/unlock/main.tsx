import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { bootstrapPopupTheme } from '../theme/popupThemeBootstrap';

bootstrapPopupTheme();

function UnlockPopup() {
  const [reason, setReason] = useState<string>('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);

  useEffect(() => {
    chrome.windows.getCurrent((win) => {
      if (win?.id) {
        setCurrentWindowId(win.id);
      }
    });

    chrome.runtime.sendMessage({ method: 'unlock:getPending' }, (response) => {
      if (response?.ok && response.result) {
        setReason(response.result.reason || 'A dApp requires wallet access');
      } else {
        setLoadError(response?.error || 'No pending unlock request');
      }
    });
  }, []);

  const handleUnlock = async () => {
    if (!password || loading) return;
    setLoading(true);
    setError(null);

    chrome.runtime.sendMessage(
      { method: 'wallet:unlock', params: [password] },
      (response) => {
        if (response?.ok && response.result === true) {
          chrome.runtime.sendMessage({
            type: 'unlock-approval',
            approved: true,
            windowId: currentWindowId
          }, () => {
            window.close();
          });
        } else {
          setLoading(false);
          setError(response?.error || 'Incorrect password');
        }
      }
    );
  };

  const handleCancel = () => {
    chrome.runtime.sendMessage({
      type: 'unlock-approval',
      approved: false,
      windowId: currentWindowId
    }, () => {
      window.close();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  if (loadError) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <div style={styles.errorIcon}>!</div>
          <div style={styles.errorText}>{loadError}</div>
          <button style={styles.closeBtn} onClick={() => window.close()}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.icon}>🔒</div>
        <div style={styles.headerText}>
          <h1 style={styles.title}>UNLOCK WALLET</h1>
          <p style={styles.subtitle}>Your wallet is locked</p>
        </div>
      </div>

      <div style={styles.reasonBox}>
        <div style={styles.label}>REASON</div>
        <div style={styles.reasonValue}>{reason}</div>
      </div>

      <div style={styles.inputGroup}>
        <div style={styles.label}>PASSWORD</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your wallet password"
          style={styles.passwordInput}
          autoFocus
          disabled={loading}
        />
      </div>

      {error && (
        <div style={styles.errorMessage}>
          {error}
        </div>
      )}

      <div style={styles.warning}>
        Enter your password to unlock the wallet and proceed with the dApp request.
      </div>

      <div style={styles.actions}>
        <button
          style={styles.cancelBtn}
          onClick={handleCancel}
          disabled={loading}
        >
          CANCEL
        </button>
        <button
          style={{
            ...styles.unlockBtn,
            opacity: loading || !password ? 0.5 : 1,
            cursor: loading || !password ? 'not-allowed' : 'pointer'
          }}
          onClick={handleUnlock}
          disabled={loading || !password}
        >
          {loading ? 'UNLOCKING...' : 'UNLOCK'}
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
  reasonBox: {
    background: 'var(--accent-muted, rgba(0, 217, 181, 0.1))',
    border: '1px solid var(--accent, #00D9B5)',
    padding: '10px',
    marginBottom: '16px'
  },
  label: {
    color: 'var(--text-muted, #888)',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '4px'
  },
  reasonValue: {
    color: 'var(--accent, #00D9B5)',
    fontSize: '12px'
  },
  inputGroup: {
    marginBottom: '12px'
  },
  passwordInput: {
    width: '100%',
    padding: '12px',
    background: 'var(--bg-elevated, #0a0a0a)',
    border: '2px solid var(--border-default, #333)',
    color: 'var(--text-primary, #fff)',
    fontFamily: 'inherit',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
    outline: 'none'
  },
  errorMessage: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    padding: '8px',
    marginBottom: '12px',
    fontSize: '11px',
    color: '#ef4444'
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
  cancelBtn: {
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
  unlockBtn: {
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
  ReactDOM.createRoot(root).render(<UnlockPopup />);
}
