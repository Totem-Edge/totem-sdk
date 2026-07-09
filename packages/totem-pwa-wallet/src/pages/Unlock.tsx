import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '../core/WalletContext';

export function Unlock() {
  const { unlock } = useWallet();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      await unlock(password);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ paddingTop: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
        <div style={{
          fontSize: 48,
          fontWeight: 'var(--weight-bold)',
          color: 'var(--axia-aqua)',
          marginBottom: 'var(--space-1)',
        }}>⬡</div>
        <h1 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
        }}>UNLOCK WALLET</h1>
      </div>
      <form onSubmit={handleUnlock}>
        <label className="label">Password</label>
        <input
          ref={inputRef}
          type="password"
          className="input"
          style={{ marginBottom: 'var(--space-2)' }}
          placeholder="Enter your wallet password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          autoComplete="current-password"
        />
        {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}
        <button type="submit" className="btn btn-primary btn-full" disabled={loading || !password}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" />
              Unlocking…
            </span>
          ) : 'Unlock →'}
        </button>
      </form>
    </div>
  );
}
