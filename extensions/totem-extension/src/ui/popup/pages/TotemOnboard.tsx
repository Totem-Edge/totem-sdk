/**
 * AXIA TOTEM ONBOARDING - TOTEM REDESIGN
 * Secure wallet creation and import with flat totem design
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { validateMnemonic, mnemonicToSeed } from '../../../wallet/mnemonic';
import { KeyringInitLoader } from '../../shared/KeyringInitLoader';
import { Card, Typography, Button, BIP39AutocompleteInput, isValidBIP39Word } from '../../components/atoms';
import { TotemNotification } from '../components/TotemNotification';
import { TotemEagleMark } from '../../assets';
import { isDesignerMode } from '../../../config/constants';
import { detectHawkPairing, storeHawkInvitation, type HawkInvitation } from '../../../core/providers/hawkDetection';
import { saveWalletNetworkConfig } from '../../../core/config/selfHosted';
import { activeChainProviderStore } from '../../../core/config/activeChainProvider';
import '../../theme/axia-tokens.css';

type OnboardStep = 'connect' | 'welcome' | 'display-phrase' | 'confirm-phrase' | 'enter-phrase' | 'password' | 'loading';
type OnboardMode = 'create' | 'import';
type ProviderChoice = 'hawk' | 'axia';
type HawkState = 'checking' | 'detected' | 'not-detected' | 'paired';

const HAWK_NODE_DOWNLOAD_URL = 'https://github.com/Totem-Edge/hawk-node';
const HAWK_PAIRING_KEY = 'self_hosted_pairing';
const HAWK_RELATED_STORAGE_KEYS = [
  HAWK_PAIRING_KEY,
  'hawk_pairing_invitation',
  'wallet_network_config',
  'self_hosted_node_consent',
  'p2p_hub_config',
];

function removeLocalStorageKeys(keys: string[]): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.remove(keys, () => resolve());
  });
}

interface TotemOnboardProps {
  onDone: () => void;
}

export function TotemOnboard({ onDone }: TotemOnboardProps) {
  const [step, setStep] = useState<OnboardStep>('connect');
  const [mode, setMode] = useState<OnboardMode>('create');
  const [providerChoice, setProviderChoice] = useState<ProviderChoice>('axia');
  const [mnemonic, setMnemonic] = useState<string>('');
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [baseSeed, setBaseSeed] = useState<number[]>([]);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [verificationWords, setVerificationWords] = useState<Record<number, string>>({});
  const [hawkInvitation, setHawkInvitation] = useState<HawkInvitation | null>(null);
  const [hawkState, setHawkState] = useState<HawkState>('checking');
  const [hawkBusy, setHawkBusy] = useState(false);
  const [hawkPairingOpened, setHawkPairingOpened] = useState(false);
  const [hawkDownloadOpened, setHawkDownloadOpened] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  
  // Random verification indices (generated once when entering confirm step)
  const [verificationIndices, setVerificationIndices] = useState<number[]>([]);

  // Debug mnemonic state changes (security: never log actual content)
  useEffect(() => {
    console.log('[TotemOnboard] Mnemonic changed - wordCount:', mnemonic ? mnemonic.split(' ').length : 0);
  }, [mnemonic]);
  
  // Generate random verification indices when entering confirm-phrase step
  useEffect(() => {
    if (step === 'confirm-phrase' && verificationIndices.length === 0) {
      // Generate 3 unique random positions between 0-23 (24 words)
      const indices: number[] = [];
      while (indices.length < 3) {
        const randomIndex = Math.floor(Math.random() * 24);
        if (!indices.includes(randomIndex)) {
          indices.push(randomIndex);
        }
      }
      indices.sort((a, b) => a - b); // Sort for better UX
      console.log('[TotemOnboard] Generated random verification indices:', indices.map(i => i + 1));
      setVerificationIndices(indices);
    }
  }, [step, verificationIndices]);

  // Generate 24-word mnemonic for CREATE mode
  useEffect(() => {
    if (step === 'display-phrase' && mode === 'create' && !mnemonic) {
      const fetchMnemonic = async () => {
        try {
          // DESIGNER MODE DETECTION: Use centralized check for Designer mode
          if (isDesignerMode()) {
            // DESIGNER MODE: Use local mnemonic generation (no background service available)
            console.log('[TotemOnboard] Designer mode detected - using local mnemonic generation');
            const { generateMnemonic } = await import('../../../wallet/mnemonic');
            const generatedMnemonic = generateMnemonic();
            console.log('[TotemOnboard] Mnemonic generated locally (24 words)');
            setMnemonic(generatedMnemonic);
            return;
          }
          
          // PRODUCTION MODE: Use background service
          const response = await chrome.runtime.sendMessage({
            method: 'wallet:generateMnemonic',
            params: [],
            id: Date.now()
          });
          
          if (response.error) {
            console.error('[TotemOnboard] Failed to generate mnemonic:', response.error);
            setError({
              title: 'Mnemonic Generation Failed',
              message: `Failed to generate recovery phrase:\n${response.error.message}`
            });
            return;
          }
          
          const generatedMnemonic = response.result.mnemonic;
          console.log('[TotemOnboard] Mnemonic generated by background service (24 words)');
          setMnemonic(generatedMnemonic);
        } catch (error) {
          console.error('[TotemOnboard] Error generating mnemonic:', error);
          setError({
            title: 'Mnemonic Generation Error',
            message: 'Failed to generate recovery phrase. Please try again.'
          });
        }
      };
      
      fetchMnemonic();
    }
  }, [step, mode, mnemonic]);

  const words = useMemo(() => mnemonic ? mnemonic.split(' ') : [], [mnemonic]);
  const isValidMnemonic = useMemo(() => validateMnemonic(mnemonic), [mnemonic]);
  const isPasswordValid = password.length >= 8 && password === passwordConfirm;
  
  // Debug validation state (runs after render, not during)
  // Security: Never log mnemonic content - only log validation state
  useEffect(() => {
    console.log('[TotemOnboard] Mnemonic validation - wordCount:', mnemonic ? mnemonic.split(' ').length : 0, 'valid:', isValidMnemonic);
  }, [mnemonic, isValidMnemonic]);

  const runHawkDetection = async () => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      setHawkState('not-detected');
      return;
    }

    setHawkState('checking');
    setHawkInvitation(null);

    try {
      const existing = await chrome.storage.local.get(HAWK_PAIRING_KEY);
      if (existing?.[HAWK_PAIRING_KEY]) {
        setHawkState('paired');
        return;
      }

      const invitation = await detectHawkPairing();
      setHawkInvitation(invitation);
      setHawkState('detected');
    } catch {
      // No local Hawk is a normal first-run path.
      setHawkState('not-detected');
    }
  };

  // First-run detection: offer the local node immediately, but never block
  // the Axia path while the loopback probe is running.
  useEffect(() => {
    void runHawkDetection();
  }, []);

  const handleChooseAxia = async () => {
    setHawkBusy(true);
    setConnectError(null);
    try {
      // Choosing Axia is an explicit provider decision. Remove any stale
      // pairing/config so a previously detected node cannot keep routing
      // traffic after the user selected the hosted path.
      await removeLocalStorageKeys(HAWK_RELATED_STORAGE_KEYS);
      await saveWalletNetworkConfig(activeChainProviderStore(), {
        chain: { mode: 'axia' },
        lease: { mode: 'axia' },
      });
      setProviderChoice('axia');
      setStep('welcome');
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : String(error));
    } finally {
      setHawkBusy(false);
    }
  };

  const handleHawkAction = async () => {
    setConnectError(null);

    if (hawkState === 'paired') {
      setProviderChoice('hawk');
      setStep('welcome');
      return;
    }

    if (hawkState === 'detected' && hawkInvitation) {
      setHawkBusy(true);
      try {
        await storeHawkInvitation(hawkInvitation);
        chrome.tabs.create({ url: chrome.runtime.getURL('approval/pairing.html?detected=1') });
        setHawkPairingOpened(true);
      } catch (error) {
        setConnectError(error instanceof Error ? error.message : String(error));
      } finally {
        setHawkBusy(false);
      }
      return;
    }

    if (!hawkDownloadOpened) {
      setHawkDownloadOpened(true);
      chrome.tabs.create({ url: HAWK_NODE_DOWNLOAD_URL });
      return;
    }

    await runHawkDetection();
  };

  const handleContinueWithHawk = async () => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      setConnectError('Extension storage is unavailable.');
      return;
    }

    const stored = await chrome.storage.local.get(HAWK_PAIRING_KEY);
    if (!stored?.[HAWK_PAIRING_KEY]) {
      setConnectError('Hawk pairing is not complete yet. Finish it in the pairing tab, then try again.');
      return;
    }

    setHawkState('paired');
    setProviderChoice('hawk');
    setStep('welcome');
  };

  // Start CREATE flow
  const handleCreateWallet = () => {
    console.log('[TotemOnboard] CREATE button clicked');
    setMode('create');
    setStep('display-phrase');
    console.log('[TotemOnboard] Mode set to:', 'create', 'Step set to:', 'display-phrase');
  };

  // Start IMPORT flow
  const handleImportWallet = () => {
    setMode('import');
    setStep('enter-phrase');
  };

  // Finish setup and initialize wallet
  const handleFinishSetup = async () => {
    console.log('[TotemOnboard] handleFinishSetup called!');
    console.log('[TotemOnboard] isValidMnemonic:', isValidMnemonic, 'isPasswordValid:', isPasswordValid);
    
    if (!isValidMnemonic || !isPasswordValid) {
      console.error('[TotemOnboard] Validation failed! isValidMnemonic:', isValidMnemonic, 'isPasswordValid:', isPasswordValid);
      return;
    }
    
    console.log('[TotemOnboard] Validation passed, setting busy=true');
    setBusy(true);

    try {
      if (typeof chrome === 'undefined' || !chrome?.runtime?.id) {
        throw new Error('Extension context not available');
      }

      console.log('[TotemOnboard] Preparing wallet setup...');
      const base = mnemonicToSeed(mnemonic); // Minima-compatible: SHA3-256 direct (32 bytes)

      console.log('[TotemOnboard] Base seed derived successfully, length:', base.length);
      setBaseSeed(Array.from(base));
      console.log('[TotemOnboard] Transitioning to loading screen...');
      setStep('loading');
    } catch (error) {
      console.error('[TotemOnboard] Wallet preparation error:', error);
      setError({
        title: 'Wallet Setup Failed',
        message: `Setup failed:\n${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      console.log('[TotemOnboard] Finally block - setting busy=false');
      setBusy(false);
    }
  };

  // LOADING SCREEN
  if (step === 'loading') {
    return (
      <KeyringInitLoader
        password={password}
        baseSeed={baseSeed}
        mnemonic={mnemonic}
        onComplete={onDone}
        onError={(error) => {
          console.error('[TotemOnboard] Keyring initialization failed:', error);
          setError({
            title: 'Wallet Initialization Failed',
            message: `Wallet setup failed:\n${error}`
          });
          setStep('password');
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
        padding: 'var(--space-2)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '380px', paddingBottom: 'var(--space-3)' }}>
        {/* STEP 0: PROVIDER CONNECTION */}
        {step === 'connect' && (
          <ConnectStep
            hawkState={hawkState}
            hawkInvitation={hawkInvitation}
            hawkBusy={hawkBusy}
            hawkPairingOpened={hawkPairingOpened}
            hawkDownloadOpened={hawkDownloadOpened}
            error={connectError}
            onHawkAction={handleHawkAction}
            onContinueWithHawk={handleContinueWithHawk}
            onUseAxia={handleChooseAxia}
          />
        )}

        {/* STEP 1: WALLET SETUP */}
        {step === 'welcome' && (
          <WelcomeStep
            providerChoice={providerChoice}
            hawkState={hawkState}
            onCreateWallet={handleCreateWallet}
            onImportWallet={handleImportWallet}
            onBack={() => setStep('connect')}
          />
        )}

        {/* STEP 2: DISPLAY PHRASE (CREATE MODE) */}
        {step === 'display-phrase' && mode === 'create' && (
          <DisplayPhraseStep words={words} onContinue={() => setStep('password')} />
        )}

        {/* STEP 3: CONFIRM PHRASE (CREATE MODE) - 3-WORD VERIFICATION */}
        {step === 'confirm-phrase' && mode === 'create' && (
          <ConfirmPhraseStep
            mnemonic={mnemonic}
            verificationWords={verificationWords}
            verificationIndices={verificationIndices}
            onVerificationWordsChange={setVerificationWords}
            onContinue={() => {
              const words = mnemonic.split(' ');
              
              for (const index of verificationIndices) {
                if (verificationWords[index]?.toLowerCase().trim() !== words[index].toLowerCase()) {
                  setError({
                    title: 'Verification Failed',
                    message: `Word #${index + 1} is incorrect. Please check your recovery phrase and try again.`
                  });
                  return;
                }
              }
              
              setStep('password');
            }}
          />
        )}

        {/* STEP 2: ENTER PHRASE (IMPORT MODE) */}
        {step === 'enter-phrase' && mode === 'import' && (
          <EnterPhraseStep
            mnemonic={mnemonic}
            onMnemonicChange={setMnemonic}
            isValid={isValidMnemonic}
            onContinue={() => setStep('password')}
          />
        )}

        {/* STEP 4/3: SET PASSWORD */}
        {step === 'password' && (
          <PasswordStep
            password={password}
            passwordConfirm={passwordConfirm}
            onPasswordChange={setPassword}
            onPasswordConfirmChange={setPasswordConfirm}
            isValid={isPasswordValid}
            busy={busy}
            onFinish={handleFinishSetup}
          />
        )}
      </div>

      {/* TOTEM ERROR NOTIFICATION */}
      <TotemNotification
        type="error"
        title={error?.title || ''}
        message={error?.message || ''}
        show={error !== null}
        onClose={() => setError(null)}
      />
    </div>
  );
}

// ========== STEP COMPONENTS ==========

function ConnectStep({
  hawkState,
  hawkInvitation,
  hawkBusy,
  hawkPairingOpened,
  hawkDownloadOpened,
  error,
  onHawkAction,
  onContinueWithHawk,
  onUseAxia,
}: {
  hawkState: HawkState;
  hawkInvitation: HawkInvitation | null;
  hawkBusy: boolean;
  hawkPairingOpened: boolean;
  hawkDownloadOpened: boolean;
  error: string | null;
  onHawkAction: () => void;
  onContinueWithHawk: () => void;
  onUseAxia: () => void;
}) {
  const hawkBusyNow = hawkBusy || hawkState === 'checking';

  const hawkStatus = (() => {
    if (hawkState === 'checking') {
      return 'Checking for a local Hawk node on 127.0.0.1:7789…';
    }
    if (hawkState === 'paired') {
      return 'A local Hawk node is already paired.';
    }
    if (hawkState === 'detected' && hawkInvitation) {
      return `Detected at ${hawkInvitation.endpoint}. Pair it to keep chain reads on your node.`;
    }
    if (hawkPairingOpened) {
      return 'Pairing tab opened. Confirm the fingerprint there, then continue below.';
    }
    if (hawkDownloadOpened) {
      return 'Download opened. Start Hawk, then check again.';
    }
    return 'No local Hawk detected. Download and start it, then check again.';
  })();

  const hawkButtonLabel = (() => {
    if (hawkState === 'checking') return 'CHECKING…';
    if (hawkState === 'paired') return 'USE PAIRED HAWK NODE';
    if (hawkState === 'detected') return hawkBusy ? 'OPENING…' : 'PAIR LOCAL HAWK';
    return hawkDownloadOpened ? 'CHECK AGAIN' : 'DOWNLOAD HAWK NOW';
  })();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100%',
      padding: 'var(--space-3) var(--space-2)',
      gap: 'var(--space-2)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-1)' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto var(--space-1-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TotemEagleMark size={64} />
        </div>
        <Typography variant="h2" color="primary">
          TOTEM WALLET
        </Typography>
        <Typography variant="caption" color="muted" style={{ marginTop: 'var(--space-1)' }}>
          Choose how to connect to Minima
        </Typography>
      </div>

      <Card style={{ width: '100%', padding: 'var(--space-2)', borderColor: 'var(--accent-primary)' }}>
        <Typography variant="h3" color="accent" uppercase style={{ marginBottom: '4px' }}>
          LOCAL HAWK NODE
        </Typography>
        <Typography variant="caption" color="muted" style={{ display: 'block', marginBottom: 'var(--space-1)', lineHeight: 1.45 }}>
          Run your own full node and keep chain reads, broadcast and key-use coordination on your own infrastructure.
        </Typography>
        <Typography
          variant="caption"
          color={hawkState === 'detected' || hawkState === 'paired' ? 'accent' : 'muted'}
          bold={hawkState === 'detected' || hawkState === 'paired'}
          style={{ display: 'block', marginBottom: 'var(--space-1-5)', lineHeight: 1.45 }}
        >
          {hawkStatus}
        </Typography>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onHawkAction}
          disabled={hawkBusyNow}
        >
          {hawkButtonLabel}
        </Button>
        {hawkPairingOpened && (
          <Button
            variant="secondary"
            fullWidth
            onClick={onContinueWithHawk}
            style={{ marginTop: 'var(--space-1)' }}
          >
            I'VE PAIRED — CONTINUE
          </Button>
        )}
      </Card>

      <Card style={{ width: '100%', padding: 'var(--space-2)' }}>
        <Typography variant="h3" color="primary" uppercase style={{ marginBottom: '4px' }}>
          <a
            href="https://axia.to"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              event.preventDefault();
              chrome.tabs.create({ url: 'https://axia.to' });
            }}
            style={{
              color: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              cursor: 'pointer',
            }}
          >
            Axia
          </a>{' '}
          (FREE HOSTED NODE)
        </Typography>
        <Typography variant="caption" color="accent" bold style={{ display: 'block', marginBottom: 'var(--space-1)' }}>
          FREE
        </Typography>
        <Typography variant="caption" color="muted" style={{ display: 'block', marginBottom: 'var(--space-1-5)', lineHeight: 1.45 }}>
          Use Axia's shared RPC. No local node or download required. You can switch to a local Hawk node later in Settings.
        </Typography>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={onUseAxia}
          disabled={hawkBusy}
        >
          CONNECT VIA AXIA (FREE)
        </Button>
      </Card>

      {error && (
        <Typography variant="caption" color="danger" style={{ display: 'block', textAlign: 'center', lineHeight: 1.45 }}>
          {error}
        </Typography>
      )}

      <Typography variant="caption" color="muted" style={{ textAlign: 'center', fontSize: '10px' }}>
        Your recovery phrase stays in the extension either way.
      </Typography>
    </div>
  );
}

function WelcomeStep({
  providerChoice,
  hawkState,
  onCreateWallet,
  onImportWallet,
  onBack,
}: {
  providerChoice: ProviderChoice;
  hawkState: HawkState;
  onCreateWallet: () => void;
  onImportWallet: () => void;
  onBack: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 'var(--space-4) var(--space-3)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            margin: '0 auto var(--space-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TotemEagleMark size={72} />
        </div>
        <Typography variant="h2" color="primary">
          TOTEM WALLET
        </Typography>
        <Typography variant="caption" color="muted" style={{ marginTop: 'var(--space-1)' }}>
          Quantum-Resistant Self-Custody
        </Typography>
      </div>

      <Card style={{ width: '100%', marginBottom: 'var(--space-2)', padding: 'var(--space-1-5)' }}>
        <Typography variant="caption" color="muted" uppercase style={{ display: 'block', fontSize: '10px' }}>
          Connection
        </Typography>
        <Typography variant="caption" bold color="accent" style={{ display: 'block', marginTop: '2px' }}>
          {providerChoice === 'hawk' && hawkState === 'paired'
            ? 'Local Hawk Node'
            : 'Axia (Free Hosted Node)'}
        </Typography>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}>
        <Button variant="primary" size="lg" fullWidth onClick={onCreateWallet}>
          → CREATE NEW WALLET
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={onImportWallet}>
          ↓ IMPORT EXISTING WALLET
        </Button>
        <Button variant="secondary" fullWidth onClick={onBack}>
          ← CHANGE CONNECTION
        </Button>
      </div>
    </div>
  );
}

function DisplayPhraseStep({ words, onContinue }: { words: string[]; onContinue: () => void }) {
  console.log('[TotemOnboard] DisplayPhraseStep rendering. Words count:', words.length, 'First 3 words:', words.slice(0, 3));

  return (
    <Card style={{ padding: 'var(--space-2)' }}>
      <Typography variant="h3" color="accent" style={{ marginBottom: 'var(--space-half)', fontSize: 'var(--text-lg)' }}>
        STEP 1/2: YOUR RECOVERY PHRASE
      </Typography>
      <Typography variant="caption" color="muted" style={{ marginBottom: 'var(--space-1-5)', display: 'block', fontSize: 'var(--text-xs)' }}>
        Write down these 24 words in order.
      </Typography>

      {/* Seed phrase as plain selectable text block */}
      <div
        style={{
          padding: '12px',
          background: 'var(--bg-elevated)',
          border: '2px solid var(--border-default)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 700,
          lineHeight: '1.8',
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          cursor: 'text',
          marginBottom: 'var(--space-1-5)',
        }}
      >
        {words.join(' ')}
      </div>

      <Card style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'var(--color-danger)', marginBottom: 'var(--space-1)', padding: 'var(--space-1)' }}>
        <Typography variant="caption" color="danger" bold uppercase style={{ marginBottom: '2px', display: 'block', fontSize: 'var(--text-2xs)' }}>
          ⚠ NEVER SHARE
        </Typography>
        <Typography variant="caption" color="muted" style={{ fontSize: 'var(--text-2xs)', lineHeight: '1.3' }}>
          Anyone with this phrase controls your funds.
        </Typography>
      </Card>

      <Card style={{ background: 'rgba(245, 158, 11, 0.05)', borderColor: 'var(--color-warning)', marginBottom: 'var(--space-1-5)', padding: 'var(--space-1)' }}>
        <Typography variant="caption" color="warning" bold uppercase style={{ marginBottom: '2px', display: 'block', fontSize: 'var(--text-2xs)' }}>
          ✍️ PEN & PAPER
        </Typography>
        <Typography variant="caption" color="muted" style={{ fontSize: 'var(--text-2xs)', lineHeight: '1.3' }}>
          No screenshots, no digital storage.
        </Typography>
      </Card>

      <Button variant="primary" size="lg" fullWidth onClick={onContinue}>
        I'VE WRITTEN IT DOWN →
      </Button>
    </Card>
  );
}

function ConfirmPhraseStep({
  mnemonic,
  verificationWords,
  verificationIndices,
  onVerificationWordsChange,
  onContinue,
}: {
  mnemonic: string;
  verificationWords: Record<number, string>;
  verificationIndices: number[];
  onVerificationWordsChange: (value: Record<number, string>) => void;
  onContinue: () => void;
}) {
  const words = mnemonic.split(' ');
  
  const allWordsFilled = verificationIndices.every(index => verificationWords[index]?.trim().length > 0);

  return (
    <Card>
      <Typography variant="h3" color="accent" style={{ marginBottom: 'var(--space-1)' }}>
        STEP 2/3: VERIFY PHRASE
      </Typography>
      <Typography variant="caption" color="muted" style={{ marginBottom: 'var(--space-3)', display: 'block' }}>
        Enter the requested words from your recovery phrase to confirm you wrote it down correctly.
      </Typography>

      {verificationIndices.map((index) => (
        <div key={index} style={{ marginBottom: 'var(--space-2)' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            Word #{index + 1}
          </label>
          <input
            type="text"
            placeholder={`${index + 1}`}
            value={verificationWords[index] || ''}
            onChange={(e) =>
              onVerificationWordsChange({
                ...verificationWords,
                [index]: e.target.value.toLowerCase().trim(),
              })
            }
            style={{
              width: '100%',
              padding: 'var(--space-1-5)',
              background: 'var(--bg-base)',
              border: '2px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-md)',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent-primary)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-default)';
            }}
          />
        </div>
      ))}

      <Card style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)', background: 'rgba(59, 130, 246, 0.05)', borderColor: '#3B82F6' }}>
        <Typography variant="caption" color="primary" bold uppercase style={{ marginBottom: '4px', display: 'block' }}>
          ℹ Security Note
        </Typography>
        <Typography variant="caption" color="muted">
          We only ask for 3 random words to reduce exposure risk. This still proves you saved your phrase.
        </Typography>
      </Card>

      <Button variant="primary" size="lg" fullWidth disabled={!allWordsFilled} onClick={onContinue}>
        {allWordsFilled ? 'VERIFY & CONTINUE →' : 'ENTER ALL 3 WORDS'}
      </Button>
    </Card>
  );
}

function EnterPhraseStep({
  mnemonic,
  onMnemonicChange,
  isValid,
  onContinue,
}: {
  mnemonic: string;
  onMnemonicChange: (value: string) => void;
  isValid: boolean;
  onContinue: () => void;
}) {
  const [words, setWords] = useState<string[]>(() => {
    if (!isDesignerMode()) return Array(24).fill('');
    try {
      const saved = sessionStorage.getItem('totem_import_words_dev');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 24) {
          return parsed;
        }
      }
    } catch (err) {
    }
    return Array(24).fill('');
  });
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // SECURITY: Auto-save to sessionStorage (dev mode only)
  // sessionStorage is cleared when tab closes, reducing exposure time
  useEffect(() => {
    try {
      if (isDesignerMode()) {
        sessionStorage.setItem('totem_import_words_dev', JSON.stringify(words));
      }
    } catch (err) {
      console.warn('[TotemOnboard] Failed to save words:', err);
    }
  }, [words]);

  // Initialize words from mnemonic on mount
  useEffect(() => {
    if (mnemonic) {
      const mnemonicWords = mnemonic.trim().split(/\s+/);
      if (mnemonicWords.length === 24) {
        setWords(mnemonicWords);
      }
    }
  }, []);

  // Update mnemonic when words change
  useEffect(() => {
    const newMnemonic = words.join(' ').trim();
    if (newMnemonic !== mnemonic) {
      onMnemonicChange(newMnemonic);
    }
  }, [words]);

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value;
    setWords(newWords);
  };

  const handleSelectSuggestion = (index: number, word: string) => {
    const newWords = [...words];
    newWords[index] = word;
    setWords(newWords);

    // Auto-focus next empty field
    const nextIndex = index + 1;
    if (nextIndex < 24) {
      setTimeout(() => {
        inputRefs.current[nextIndex]?.focus();
      }, 50);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const pastedWords = text.trim().toLowerCase().split(/\s+/);

    if (pastedWords.length === 24) {
      setWords(pastedWords);
      // Focus first empty/invalid field
      const firstInvalid = pastedWords.findIndex(w => !isValidBIP39Word(w));
      if (firstInvalid >= 0) {
        setTimeout(() => inputRefs.current[firstInvalid]?.focus(), 50);
      }
      
      // Clear clipboard for security
      try {
        await navigator.clipboard.writeText('');
      } catch (err) {
        console.warn('Failed to clear clipboard:', err);
      }
    }
  };

  const handleClear = () => {
    setWords(Array(24).fill(''));
    onMnemonicChange('');
    sessionStorage.removeItem('totem_import_words_dev');
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const validWordCount = words.filter(w => isValidBIP39Word(w)).length;
  const allWordsValid = validWordCount === 24;

  return (
    <div onPaste={handlePaste} style={{ width: '100%', maxHeight: '100%', overflowY: 'auto' }}>
      <Card>
        <Typography variant="h3" color="accent" style={{ marginBottom: 'var(--space-1)' }}>
          IMPORT EXISTING WALLET
        </Typography>
        <Typography variant="caption" color="muted" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
          Enter your 24-word recovery phrase.
        </Typography>

      {/* 24-field grid with scrolling */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
          marginBottom: 'var(--space-1)',
        }}
      >
        {words.map((word, index) => (
          <div key={index}>
            <BIP39AutocompleteInput
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              value={word}
              onChange={(value) => handleWordChange(index, value)}
              onSelectSuggestion={(selectedWord) => handleSelectSuggestion(index, selectedWord)}
              index={index}
              autoFocus={index === 0}
            />
          </div>
        ))}
      </div>

      {/* Status indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <Typography variant="caption" color={allWordsValid ? 'success' : 'muted'}>
          Valid words: {validWordCount} / 24
        </Typography>
        {allWordsValid && isValid && (
          <Typography variant="caption" color="success">
            ✓ Valid phrase
          </Typography>
        )}
        {validWordCount === 24 && !isValid && (
          <Typography variant="caption" color="danger">
            ✗ Invalid phrase checksum
          </Typography>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
        <Button variant="secondary" size="md" onClick={async () => {
          try {
            const text = await navigator.clipboard.readText();
            const pastedWords = text.trim().toLowerCase().split(/\s+/);

            if (pastedWords.length === 24) {
              setWords(pastedWords);
              // Focus first empty/invalid field
              const firstInvalid = pastedWords.findIndex(w => !isValidBIP39Word(w));
              if (firstInvalid >= 0) {
                setTimeout(() => inputRefs.current[firstInvalid]?.focus(), 50);
              }
              
              // Clear clipboard for security
              try {
                await navigator.clipboard.writeText('');
              } catch (err) {
                console.warn('Failed to clear clipboard:', err);
              }
            }
          } catch (err) {
            console.error('Failed to paste:', err);
          }
        }}>
          📋 PASTE
        </Button>
        <Button variant="secondary" size="md" onClick={handleClear}>
          ✕ CLEAR
        </Button>
      </div>

      <Button variant="primary" size="lg" fullWidth disabled={!isValid} onClick={onContinue}>
        {allWordsValid ? 'CONTINUE →' : `ENTER ALL 24 WORDS (${validWordCount}/24)`}
      </Button>
      </Card>
    </div>
  );
}

function PasswordStep({
  password,
  passwordConfirm,
  onPasswordChange,
  onPasswordConfirmChange,
  isValid,
  busy,
  onFinish,
}: {
  password: string;
  passwordConfirm: string;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  isValid: boolean;
  busy: boolean;
  onFinish: () => void;
}) {
  const hasMinLength = password.length >= 8;
  const hasMatch = password === passwordConfirm && password.length > 0;

  // Security: Don't log password details - only log final validation state on submit

  return (
    <Card>
      <Typography variant="h3" color="accent" style={{ marginBottom: 'var(--space-1)' }}>
        STEP 2/2: SET PASSWORD
      </Typography>
      <Typography variant="caption" color="muted" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
        Create a strong password to encrypt your wallet locally.
      </Typography>

      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Typography variant="caption" color="muted" uppercase style={{ marginBottom: 'var(--space-1)', display: 'block' }}>
          Password
        </Typography>
        <input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="At least 8 characters"
          style={{
            width: '100%',
            padding: 'var(--space-1-5)',
            background: 'var(--bg-base)',
            border: '2px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-md)',
          }}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Typography variant="caption" color="muted" uppercase style={{ marginBottom: 'var(--space-1)', display: 'block' }}>
          Confirm Password
        </Typography>
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => onPasswordConfirmChange(e.target.value)}
          placeholder="Re-enter password"
          style={{
            width: '100%',
            padding: 'var(--space-1-5)',
            background: 'var(--bg-base)',
            border: '2px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-md)',
          }}
        />
      </div>

      {/* Password Requirements */}
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Typography variant="caption" color="muted" style={{ marginBottom: 'var(--space-1)', display: 'block' }}>
          Requirements:
        </Typography>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Typography variant="caption" color={hasMinLength ? 'success' : 'muted'}>
            {hasMinLength ? '✓' : '○'} Minimum 8 characters
          </Typography>
          <Typography variant="caption" color={hasMatch ? 'success' : 'muted'}>
            {hasMatch ? '✓' : '○'} Passwords match
          </Typography>
        </div>
      </div>

      <Button 
        variant="primary" 
        size="lg" 
        fullWidth 
        disabled={!isValid || busy} 
        onClick={() => {
          console.log('[PasswordStep] Finish button clicked! isValid:', isValid, 'busy:', busy);
          if (isValid && !busy) {
            onFinish();
          } else {
            console.warn('[PasswordStep] Button disabled - isValid:', isValid, 'busy:', busy);
          }
        }}
      >
        {busy ? 'SETTING UP WALLET...' : '→ FINISH SETUP'}
      </Button>

      <Card style={{ marginTop: 'var(--space-2)', background: 'rgba(245, 158, 11, 0.05)', borderColor: 'var(--color-warning)' }}>
        <Typography variant="caption" color="warning" bold uppercase style={{ marginBottom: '4px', display: 'block' }}>
          ⚠ Important
        </Typography>
        <Typography variant="caption" color="muted">
          This password encrypts your wallet locally. You'll need it every time you open Totem.
        </Typography>
      </Card>
    </Card>
  );
}
