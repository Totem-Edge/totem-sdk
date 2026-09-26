import React, { useEffect, useState } from 'react';
import { useWallet } from '../core/WalletContext';
import { WalletManager } from '../core/WalletManager';
import type { AccountRecord } from '../stores/VaultStore';
import type { ChainProviderMode } from '@totemsdk/chain-provider';
import {
  DEFAULT_WALLET_NETWORK_CONFIG,
  createLocalStorageStore,
  loadWalletNetworkConfig,
  saveWalletNetworkConfig,
  recordSelfHostedConsent,
  buildWalletChainProvider,
  type LeaseProviderMode,
  type WalletNetworkConfig,
} from '../core/config/selfHosted';

const AXIA_BASE = import.meta.env.VITE_AXIA_API_BASE ?? 'https://api.axia.to';
const AXIA_PROJECT_ID = import.meta.env.VITE_AXIA_PROJECT_ID ?? 'totem-shared';

export function Settings() {
  const { session, activeAccount, lock, setRoute, addNextAddress } = useWallet();
  const [showReset, setShowReset] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAccount, setNewAccount] = useState<AccountRecord | null>(null);
  const [error, setError] = useState('');

  // ── Network & key-use selection (RFC-013) ───────────────────────────────────
  const [netConfig, setNetConfig] = useState<WalletNetworkConfig>(DEFAULT_WALLET_NETWORK_CONFIG);
  const [nodeUrl, setNodeUrl] = useState('');
  const [nodeUser, setNodeUser] = useState('');
  const [nodePass, setNodePass] = useState('');
  const [netStatus, setNetStatus] = useState('');
  const [netBusy, setNetBusy] = useState(false);

  useEffect(() => {
    loadWalletNetworkConfig(createLocalStorageStore())
      .then(cfg => {
        setNetConfig(cfg);
        if (cfg.chain.minimaRpcUrl) setNodeUrl(cfg.chain.minimaRpcUrl);
      })
      .catch(() => undefined);
  }, []);

  function chainConfig() {
    return {
      ...netConfig.chain,
      ...(nodeUrl ? { minimaRpcUrl: nodeUrl } : {}),
      ...(nodeUser ? { minimaRpcUser: nodeUser } : {}),
      ...(nodePass ? { minimaRpcPass: nodePass } : {}),
    };
  }

  async function handleTestConnection() {
    setNetBusy(true);
    setNetStatus('');
    try {
      const provider = buildWalletChainProvider(chainConfig(), {
        hosted: { baseUrl: AXIA_BASE, apiKey: AXIA_PROJECT_ID },
      });
      const tip = await provider.getTip();
      setNetStatus(`Connected — block ${tip.block}`);
    } catch (e) {
      setNetStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setNetBusy(false);
    }
  }

  async function handleSaveNetwork() {
    setNetBusy(true);
    setNetStatus('');
    try {
      const store = createLocalStorageStore();
      const chain = chainConfig();
      if (chain.minimaRpcUrl) await recordSelfHostedConsent(store, chain.minimaRpcUrl);
      const next: WalletNetworkConfig = { chain, lease: netConfig.lease };
      await saveWalletNetworkConfig(store, next);
      setNetConfig(next);
      setNetStatus('Saved. Reversible at any time.');
    } catch (e) {
      setNetStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setNetBusy(false);
    }
  }

  // ── Show Seed Phrase flow ──────────────────────────────────────────────────
  const [phraseStep, setPhraseStep] = useState<'idle' | 'password' | 'revealed'>('idle');
  const [phrasePassword, setPhrasePassword] = useState('');
  const [phraseLoading, setPhraseLoading] = useState(false);
  const [phraseError, setPhraseError] = useState('');
  const [revealedPhrase, setRevealedPhrase] = useState('');

  async function handleRevealPhrase() {
    setPhraseLoading(true);
    setPhraseError('');
    try {
      const phrase = await WalletManager.revealMnemonic(phrasePassword);
      setRevealedPhrase(phrase);
      setPhraseStep('revealed');
    } catch (e) {
      setPhraseError(String(e));
    } finally {
      setPhraseLoading(false);
    }
  }

  function closePhraseReveal() {
    setPhraseStep('idle');
    setPhrasePassword('');
    setPhraseError('');
    setRevealedPhrase('');
  }

  async function handleAddAddress() {
    setAddingAddress(true);
    setError('');
    try {
      const account = await addNextAddress();
      setNewAccount(account);
    } catch (e) {
      setError(String(e));
    } finally {
      setAddingAddress(false);
    }
  }

  async function handleReset() {
    if (resetConfirm !== 'RESET') return;
    await WalletManager.resetWallet();
    window.location.reload();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
      </div>

      <div style={{ paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div className="card">
          <p className="label">Wallet Identity</p>
          {session && (
            <>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
                Root Public Key
              </p>
              <p style={{
                fontFamily: 'var(--font-family-mono)',
                fontSize: 'var(--text-xs)',
                wordBreak: 'break-all',
                color: 'var(--text-secondary)',
              }}>
                {session.rootPublicKey.slice(0, 32)}…
              </p>
            </>
          )}
        </div>

        <div className="card">
          <p className="label" style={{ marginBottom: 'var(--space-2)' }}>Accounts ({session?.accounts.length ?? 0})</p>
          {session?.accounts.map(a => (
            <div key={a.index} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: 'var(--space-1) 0',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <span style={{ fontWeight: a.index === session.activeIndex ? 'var(--weight-bold)' : 'var(--weight-normal)' }}>
                {a.name} {a.index === session.activeIndex ? '●' : ''}
              </span>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {a.address.slice(0, 12)}…
              </span>
            </div>
          ))}
          {newAccount && (
            <div className="success-msg" style={{ marginTop: 'var(--space-1)' }}>
              Added: {newAccount.name} ({newAccount.address.slice(0, 16)}…)
            </div>
          )}
          {error && <div className="error-msg" style={{ marginTop: 'var(--space-1)' }}>{error}</div>}
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 'var(--space-2)' }}
            onClick={handleAddAddress}
            disabled={addingAddress}
          >
            {addingAddress ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" /> Deriving…
              </span>
            ) : '+ Add Next Address'}
          </button>
        </div>

        <div className="card">
          <p className="label" style={{ marginBottom: 'var(--space-2)' }}>Network & Key Use</p>

          <label className="label">Chain provider</label>
          <select
            className="input"
            style={{ marginBottom: 'var(--space-2)' }}
            value={netConfig.chain.mode}
            onChange={e => setNetConfig(c => ({ ...c, chain: { ...c.chain, mode: e.target.value as ChainProviderMode } }))}
          >
            <option value="axia">Axia (recommended)</option>
            <option value="minima-rpc">My own node</option>
            <option value="composite">Advanced (node + Axia fallback)</option>
          </select>

          {netConfig.chain.mode !== 'axia' && (
            <>
              <input
                className="input"
                style={{ marginBottom: 'var(--space-1)' }}
                value={nodeUrl}
                onChange={e => setNodeUrl(e.target.value)}
                placeholder="https://node.example.com:9005"
              />
              <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
                <input className="input" value={nodeUser} onChange={e => setNodeUser(e.target.value)} placeholder="RPC user (optional)" />
                <input className="input" type="password" value={nodePass} onChange={e => setNodePass(e.target.value)} placeholder="RPC password" />
              </div>
            </>
          )}

          <label className="label">WOTS key use</label>
          <select
            className="input"
            style={{ marginBottom: 'var(--space-2)' }}
            value={netConfig.lease.mode}
            onChange={e => setNetConfig(c => ({ ...c, lease: { ...c.lease, mode: e.target.value as LeaseProviderMode } }))}
          >
            <option value="axia">Managed by Axia</option>
            <option value="local">On this device (self-hosted)</option>
            <option value="hybrid">Hybrid (device + on-chain anchor)</option>
          </select>

          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-2)' }}>
            Statechain SE co-signatures still require an SE (Axia-hosted or a self-hosted se-server).
          </p>

          {netStatus && (
            <div style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
              {netStatus}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleTestConnection} disabled={netBusy}>
              Test connection
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveNetwork} disabled={netBusy}>
              Save
            </button>
          </div>
        </div>

        <button className="btn btn-secondary btn-full" onClick={lock}>
          Lock Wallet
        </button>

        {phraseStep === 'idle' && (
          <button className="btn btn-secondary btn-full" onClick={() => setPhraseStep('password')}>
            Show Seed Phrase Backup
          </button>
        )}

        {phraseStep === 'password' && (
          <div className="card">
            <p className="label" style={{ marginBottom: 'var(--space-2)' }}>Confirm Password to View Phrase</p>
            <input
              type="password"
              className="input"
              style={{ marginBottom: 'var(--space-2)' }}
              value={phrasePassword}
              onChange={e => setPhrasePassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !phraseLoading && phrasePassword && handleRevealPhrase()}
              placeholder="Wallet password"
              autoFocus
            />
            {phraseError && (
              <div className="error-msg" style={{ marginBottom: 'var(--space-2)' }}>{phraseError}</div>
            )}
            <button
              className="btn btn-primary btn-full"
              onClick={handleRevealPhrase}
              disabled={phraseLoading || !phrasePassword}
            >
              {phraseLoading ? <span className="spinner" /> : 'Reveal Seed Phrase →'}
            </button>
            <button
              className="btn btn-secondary btn-full"
              style={{ marginTop: 'var(--space-1)' }}
              onClick={closePhraseReveal}
            >
              Cancel
            </button>
          </div>
        )}

        {phraseStep === 'revealed' && (
          <div className="card" style={{ border: '1px solid var(--axia-aqua)' }}>
            <p className="label" style={{ marginBottom: 'var(--space-2)', color: 'var(--axia-aqua)' }}>
              Your Seed Phrase
            </p>
            <div className="error-msg" style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
              ⚠ Keep these words secret. Anyone with this phrase controls your wallet.
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-1)',
              marginBottom: 'var(--space-2)',
            }}>
              {revealedPhrase.trim().split(/\s+/).map((word, i) => (
                <div key={i} style={{
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-subtle)',
                  padding: '4px 8px',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-family-mono)',
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{i + 1}. </span>
                  {word}
                </div>
              ))}
            </div>
            <button
              className="btn btn-secondary btn-full"
              onClick={closePhraseReveal}
            >
              Hide Phrase
            </button>
          </div>
        )}

        <div className="card" style={{ border: '1px solid var(--color-danger)' }}>
          <p className="label" style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
            Danger Zone
          </p>
          {!showReset ? (
            <button className="btn btn-danger btn-full" onClick={() => setShowReset(true)}>
              Reset Wallet
            </button>
          ) : (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                This will permanently delete your wallet from this device. Make sure your seed phrase is backed up.
              </p>
              <label className="label">Type RESET to confirm</label>
              <input
                className="input"
                style={{ marginBottom: 'var(--space-2)' }}
                value={resetConfirm}
                onChange={e => setResetConfirm(e.target.value)}
                placeholder="RESET"
              />
              <button
                className="btn btn-danger btn-full"
                onClick={handleReset}
                disabled={resetConfirm !== 'RESET'}
              >
                Permanently Delete Wallet
              </button>
              <button
                className="btn btn-secondary btn-full"
                style={{ marginTop: 'var(--space-1)' }}
                onClick={() => { setShowReset(false); setResetConfirm(''); }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <p style={{ color: 'var(--text-disabled)', fontSize: 'var(--text-xs)', textAlign: 'center' }}>
          Totem PWA Wallet v1.0.0 · wallet.totem.ing
        </p>
      </div>
    </div>
  );
}
