/**
 * Onboard — new wallet creation / import flow
 * New wallet: choose → set password, then Backup shows the phrase once + quiz.
 * Import: choose → enter phrase → set password (backup already confirmed).
 */
import React, { useState } from 'react';
import { WalletManager } from '../core/WalletManager';
import { useWallet } from '../core/WalletContext';
import { WalletPasswordInput } from '../components/WalletPasswordInput';
import { TotemEagleMark } from '../components/TotemEagleMark';

type Step = 'choose' | 'import' | 'password';

export function Onboard() {
  const { createWallet, importWallet, setRoute } = useWallet();
  const [step, setStep] = useState<Step>('choose');
  const [mnemonic, setMnemonic] = useState('');
  const [importWords, setImportWords] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fromImport, setFromImport] = useState(false);

  function handleGenerate() {
    // Show the phrase once, in Backup (with the quiz), after the password is set.
    setMnemonic(WalletManager.generateMnemonic());
    setStep('password');
  }

  function handleImportNext() {
    const words = importWords.trim();
    if (!WalletManager.validateMnemonic(words)) {
      setError('Invalid seed phrase. Must be exactly 24 BIP39 words.');
      return;
    }
    setMnemonic(words.toUpperCase());
    setError('');
    setFromImport(true);
    setStep('password');
  }

  async function handleCreate() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (fromImport) {
        await importWallet(mnemonic, password);
      } else {
        await createWallet(mnemonic, password);
      }
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ paddingTop: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        <TotemEagleMark
          size={56}
          color="var(--axia-aqua)"
          style={{ display: 'block', margin: '0 auto var(--space-1)' }}
        />
        <h1 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
        }}>TOTEM WALLET</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
          Self-Custodial Minima Wallet
        </p>
      </div>

      {step === 'choose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <button className="btn btn-primary btn-full" onClick={handleGenerate}>
            Create New Wallet
          </button>
          <button className="btn btn-secondary btn-full" onClick={() => setStep('import')}>
            Import Existing Wallet
          </button>
        </div>
      )}

      {step === 'import' && (
        <div>
          <label className="label">Enter 24-word seed phrase</label>
          <textarea
            className="input"
            style={{ height: 120, resize: 'none', fontFamily: 'var(--font-family-mono)', marginBottom: 'var(--space-2)' }}
            placeholder="word1 word2 word3 ... word24"
            value={importWords}
            onChange={e => { setImportWords(e.target.value); setError(''); }}
          />
          {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}
          <button className="btn btn-primary btn-full" onClick={handleImportNext}>
            Verify Phrase →
          </button>
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 'var(--space-1)' }}
            onClick={() => setStep('choose')}
          >
            Back
          </button>
        </div>
      )}

      {step === 'password' && (
        <div>
          <label className="label">Set wallet password</label>
          <WalletPasswordInput
            className="input"
            style={{ marginBottom: 'var(--space-2)' }}
            placeholder="Minimum 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <label className="label">Confirm password</label>
          <WalletPasswordInput
            className="input"
            style={{ marginBottom: 'var(--space-2)' }}
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{error}</div>}
          <button
            className="btn btn-primary btn-full"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" />
                Deriving address…
              </span>
            ) : 'Create Wallet →'}
          </button>
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 'var(--space-1)' }}
            onClick={() => setStep(fromImport ? 'import' : 'choose')}
            disabled={loading}
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
