/**
 * Backup — show the seed phrase once and ask the user to confirm they wrote it down.
 * Shows the ACTUAL wallet mnemonic.
 *
 * Recovery path: if the user refreshes the page before completing backup,
 * _pendingMnemonic is lost from memory.  In that case we show a password
 * prompt, decrypt the mnemonic from the vault, and continue the backup flow
 * normally — no redirect loop.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useWallet } from '../core/WalletContext';
import { WalletManager } from '../core/WalletManager';
import { Loading } from '../components/Loading';
import { WalletPasswordInput } from '../components/WalletPasswordInput';

type BackupStep = 'show' | 'done';

export function Backup() {
  const { setRoute } = useWallet();

  // mnemonic may come from in-memory pending state OR vault recovery
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [step, setStep] = useState<BackupStep>('show');

  // vault-recovery state (only shown when _pendingMnemonic was lost on reload)
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    const m = WalletManager.getPendingMnemonic();
    if (m) {
      setMnemonic(m);
    } else {
      // Mnemonic was cleared from memory (page reload before backup confirmed).
      // Show a password prompt so the user can recover it from the encrypted vault.
      setNeedsRecovery(true);
    }
  }, []);

  async function handleVaultRecovery() {
    setRecoveryLoading(true);
    setRecoveryError('');
    try {
      const phrase = await WalletManager.revealMnemonic(recoveryPassword);
      setMnemonic(phrase);
      setNeedsRecovery(false);
    } catch (e) {
      setRecoveryError(String(e));
    } finally {
      setRecoveryLoading(false);
    }
  }

  const words = useMemo(() => mnemonic?.toUpperCase().split(/\s+/) ?? [], [mnemonic]);
  async function handleConfirm() {
    await WalletManager.confirmBackup();
    setStep('done');
  }

  // ── Vault recovery screen ─────────────────────────────────────────────────
  if (needsRecovery) {
    return (
      <div className="page" style={{ paddingTop: 'var(--space-4)' }}>
        <h2 style={{
          fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase',
          marginBottom: 'var(--space-2)',
        }}>CONTINUE BACKUP</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
          Enter your wallet password to view your seed phrase and complete backup.
        </p>
        <WalletPasswordInput
          className="input"
          style={{ marginBottom: 'var(--space-2)' }}
          value={recoveryPassword}
          onChange={e => setRecoveryPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !recoveryLoading && recoveryPassword && handleVaultRecovery()}
          placeholder="Wallet password"
          autoFocus
        />
        {recoveryError && (
          <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{recoveryError}</div>
        )}
        <button
          className="btn btn-primary btn-full"
          onClick={handleVaultRecovery}
          disabled={recoveryLoading || !recoveryPassword}
        >
          {recoveryLoading ? <span className="spinner" /> : 'Continue →'}
        </button>
      </div>
    );
  }

  if (!mnemonic) return <Loading message="Loading backup…" />;

  if (step === 'show') {
    return (
      <div className="page" style={{ paddingTop: 'var(--space-4)', overflowY: 'auto' }}>
        <h2 style={{
          fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase',
          marginBottom: 'var(--space-1)',
        }}>BACK UP YOUR WALLET</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
          Write down all 24 words in order. They are the ONLY way to recover your wallet.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-1)', marginBottom: 'var(--space-3)',
        }}>
          {words.map((word, i) => (
            <div key={i} style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              padding: 'var(--space-1)', display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', minWidth: 20 }}>{i + 1}.</span>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                {word}
              </span>
            </div>
          ))}
        </div>
        <div className="error-msg" style={{ marginBottom: 'var(--space-3)' }}>
          ⚠ Never share these words. Totem will never ask for them.
        </div>
        <button className="btn btn-primary btn-full" onClick={handleConfirm}>
          I've Written It Down →
        </button>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingTop: 'var(--space-6)', textAlign: 'center' }}>
      <div style={{ fontSize: 48, color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>✓</div>
      <h2 style={{
        fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
        letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase',
        color: 'var(--color-success)', marginBottom: 'var(--space-2)',
      }}>BACKUP CONFIRMED</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
        Your seed phrase is safely backed up.
      </p>
      <button className="btn btn-primary btn-full" onClick={() => setRoute('home')}>
        Go to Wallet →
      </button>
    </div>
  );
}
