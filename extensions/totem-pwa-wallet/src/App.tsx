import React from 'react';
import { WalletProvider, useWallet } from './core/WalletContext';
import { Loading } from './components/Loading';
import { BottomNav } from './components/BottomNav';
import { UpdateBanner } from './components/UpdateBanner';
import { Onboard } from './pages/Onboard';
import { Backup } from './pages/Backup';
import { Home } from './pages/Home';
import { Send } from './pages/Send';
import { Receive } from './pages/Receive';
import { Settings } from './pages/Settings';
import { Unlock } from './pages/Unlock';

const AUTHED_ROUTES = new Set(['home', 'send', 'receive', 'settings', 'add-address']);

function SessionExpired() {
  const { unlock, lock } = useWallet();
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleUnlock() {
    setLoading(true); setError('');
    try { await unlock(password); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div className="page" style={{ paddingTop: 'var(--space-6)', maxWidth: 320, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>⏳</div>
        <h2 style={{
          fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase',
          marginBottom: 'var(--space-1)',
        }}>SESSION EXPIRED</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          Your session was cleared. Re-enter your password to continue.
        </p>
      </div>
      <label className="label">Wallet Password</label>
      <input
        type="password" className="input" style={{ marginBottom: 'var(--space-2)' }}
        value={password} onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleUnlock()} autoFocus
      />
      {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}
      <button className="btn btn-primary btn-full" onClick={handleUnlock} disabled={loading || !password}>
        {loading ? <span className="spinner" /> : 'Continue →'}
      </button>
      <button className="btn btn-secondary btn-full" style={{ marginTop: 'var(--space-1)' }} onClick={lock}>
        Lock & Start Over
      </button>
    </div>
  );
}

function AppInner() {
  const { route } = useWallet();

  const showNav = AUTHED_ROUTES.has(route);

  return (
    <>
      <UpdateBanner />

      {route === 'loading'          && <Loading message="Starting Totem Wallet…" />}
      {route === 'onboard'          && <Onboard />}
      {route === 'backup'           && <Backup />}
      {route === 'unlock'           && <Unlock />}
      {route === 'session-expired'  && <SessionExpired />}
      {route === 'home'             && <Home />}
      {route === 'send'             && <Send />}
      {route === 'receive'          && <Receive />}
      {route === 'settings'         && <Settings />}

      {showNav && <BottomNav />}
    </>
  );
}

export function App() {
  return (
    <WalletProvider>
      <AppInner />
    </WalletProvider>
  );
}
