/**
 * Backup — seed phrase display + mandatory 3-word quiz.
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

type BackupStep = 'show' | 'quiz' | 'done';

function pickQuizWords(words: string[]): Array<{ index: number; word: string }> {
  const positions = new Set<number>();
  while (positions.size < 3) {
    positions.add(Math.floor(Math.random() * 24));
  }
  return Array.from(positions)
    .sort((a, b) => a - b)
    .map(i => ({ index: i, word: words[i] }));
}

function getDistractors(correct: string, words: string[]): string[] {
  const pool = words.filter(w => w !== correct);
  const picks: string[] = [];
  while (picks.length < 3) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    if (!picks.includes(p)) picks.push(p);
  }
  return [correct, ...picks].sort(() => Math.random() - 0.5);
}

export function Backup() {
  const { setRoute } = useWallet();

  // mnemonic may come from in-memory pending state OR vault recovery
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [step, setStep] = useState<BackupStep>('show');
  const [quizIdx, setQuizIdx] = useState(0);
  const [error, setError] = useState('');

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
  const quizWords = useMemo(() => (words.length === 24 ? pickQuizWords(words) : []), [words]);
  const currentQuiz = quizWords[quizIdx];
  const options = useMemo(
    () => (currentQuiz ? getDistractors(currentQuiz.word, words) : []),
    [currentQuiz, words]
  );

  async function handleAnswer(chosen: string) {
    if (chosen !== currentQuiz?.word) {
      setError(`Incorrect. Word #${(currentQuiz?.index ?? 0) + 1} is "${currentQuiz?.word}". Check your backup.`);
      return;
    }
    setError('');
    if (quizIdx < 2) {
      setQuizIdx(q => q + 1);
    } else {
      await WalletManager.confirmBackup();
      setStep('done');
    }
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
        <input
          type="password"
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
        <button className="btn btn-primary btn-full" onClick={() => setStep('quiz')}>
          I've Written Them Down — Quiz Me →
        </button>
      </div>
    );
  }

  if (step === 'quiz') {
    return (
      <div className="page" style={{ paddingTop: 'var(--space-4)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Quiz {quizIdx + 1} / 3</p>
        <h3 style={{
          fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wide)', marginBottom: 'var(--space-3)',
        }}>
          What is word #{(currentQuiz?.index ?? 0) + 1}?
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
          {options.map(opt => (
            <button key={opt} className="btn btn-secondary btn-full" onClick={() => handleAnswer(opt)}>
              {opt}
            </button>
          ))}
        </div>
        {error && <div className="error-msg">{error}</div>}
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
