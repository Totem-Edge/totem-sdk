import React, { useState, useCallback, useEffect } from 'react';
import { useUnlock } from '../contexts/UnlockContext';
import { Typography, Button, Card } from '../../components/atoms';
import '../../theme/axia-tokens.css';

export function UnlockModal() {
  const { isOpen, error, reason, pendingAction, closeUnlock, setError, clearPendingAction } = useUnlock();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setBusy(false);
    }
  }, [isOpen]);

  const handleUnlock = useCallback(async () => {
    if (!password || busy) return;

    console.log('[UnlockModal] Attempting unlock...');
    setBusy(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        method: 'wallet:unlock',
        params: [password]
      });

      console.log('[UnlockModal] Unlock response:', response);

      if (response?.error) {
        setError(response.error.message || response.error || 'Unlock failed');
        setBusy(false);
        return;
      }

      if (response?.ok && response?.result === true) {
        console.log('[UnlockModal] Unlock successful');
        closeUnlock();

        if (pendingAction) {
          console.log('[UnlockModal] Executing pending action...');
          try {
            await pendingAction();
          } catch (e: any) {
            console.error('[UnlockModal] Pending action failed:', e);
          }
          clearPendingAction();
        }
      } else {
        setError('Invalid password');
        setBusy(false);
      }
    } catch (e: any) {
      console.error('[UnlockModal] Unlock error:', e);
      setError(e.message || 'Failed to unlock wallet');
      setBusy(false);
    }
  }, [password, busy, pendingAction, closeUnlock, setError, clearPendingAction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password && !busy) {
      handleUnlock();
    }
  }, [password, busy, handleUnlock]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 'var(--space-2)',
    }}>
      <Card style={{
        width: '100%',
        maxWidth: '320px',
        background: 'var(--bg-surface)',
        border: '2px solid var(--border-default)',
      }}>
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <Typography variant="h3" color="accent">
            UNLOCK WALLET
          </Typography>
          <Typography variant="caption" color="muted" style={{ display: 'block', marginTop: 'var(--space-1)' }}>
            {reason || 'Enter your password to continue'}
          </Typography>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-1)',
            marginBottom: 'var(--space-2)',
            background: 'rgba(255, 107, 107, 0.1)',
            border: '1px solid var(--error)',
            borderRadius: '4px',
          }}>
            <Typography variant="caption" color="danger">
              {error}
            </Typography>
          </div>
        )}

        <div style={{ marginBottom: 'var(--space-2)' }}>
          <Typography variant="caption" color="muted" uppercase style={{ marginBottom: 'var(--space-1)', display: 'block' }}>
            Password
          </Typography>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your wallet password"
            autoFocus
            disabled={busy}
            style={{
              width: '100%',
              padding: 'var(--space-1-5)',
              background: 'var(--bg-base)',
              border: '2px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          <Button
            variant="secondary"
            onClick={() => {
              closeUnlock();
              clearPendingAction();
            }}
            disabled={busy}
            style={{ flex: 1 }}
          >
            CANCEL
          </Button>
          <Button
            variant="primary"
            onClick={handleUnlock}
            disabled={!password || busy}
            style={{ flex: 1 }}
          >
            {busy ? 'UNLOCKING...' : 'UNLOCK'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
