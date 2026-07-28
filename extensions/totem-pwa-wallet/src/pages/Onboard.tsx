/**
 * Onboard — new wallet creation / import flow
 * Implements 3-step wizard: choose → generate/import → set password
 */
import React, { useState } from 'react';
import { WalletManager } from '../core/WalletManager';
import { useWallet } from '../core/WalletContext';

type Step = 'choose' | 'create' | 'import' | 'password';

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
    const m = WalletManager.generateMnemonic();
    setMnemonic(m);
    setStep('create');
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
    if (step === 'create') {
      setStep('password');
      return;
    }
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
        <div style={{
          fontSize: 48,
          fontWeight: 'var(--weight-bold)',
          color: 'var(--axia-aqua)',
          letterSpacing: 'var(--tracking-wider)',
          marginBottom: 'var(--space-1)',
        }}>⬡</div>
        <h1 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
        }}>TOTEM WALLET</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
          Self-custodial. Quantum-resistant.
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

      {step === 'create' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
            <p className="label">Your 24-word seed phrase</p>
            <p style={{
              fontFamily: 'var(--font-family-mono)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.8,
              color: 'var(--axia-aqua)',
              wordSpacing: 8,
            }}>
              {mnemonic}
            </p>
          </div>
          <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>
            ⚠ Write these 24 words down before continuing. They cannot be recovered.
          </div>
          <button className="btn btn-primary btn-full" onClick={() => setStep('password')}>
            I've Written It Down →
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
          <input
            type="password"
            className="input"
            style={{ marginBottom: 'var(--space-2)' }}
            placeholder="Minimum 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <label className="label">Confirm password</label>
          <input
            type="password"
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
            onClick={() => setStep(fromImport ? 'import' : 'create')}
            disabled={loading}
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
