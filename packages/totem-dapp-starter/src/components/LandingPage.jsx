import { useTotem } from '../totem-context.jsx';
import styles from './LandingPage.module.css';

/**
 * LandingPage — shown when the wallet is not yet connected.
 *
 * Presents a single "Connect Wallet" button that triggers the full
 * v4.1 onboarding sequence: CONNECT → VERIFY (spend-address signed) → GET_ACCOUNTS.
 */
export function LandingPage() {
  const { wallets, connectAndVerify, isConnecting, error } = useTotem();
  const hasWallet = wallets.length > 0;

  function handleConnect() {
    connectAndVerify('Sign in to Totem dApp Starter').catch(() => {});
  }

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <div className={styles.logoWrap}>
          <span className={styles.logo}>⬡</span>
        </div>
        <h1 className={styles.heading}>Totem dApp Starter</h1>
        <p className={styles.subheading}>
          A minimal React + Vite template implementing TOTEM_CONNECT v4.1 patterns.
        </p>

        {!hasWallet && (
          <div className={styles.warning}>
            Totem Browser Extension not detected.{' '}
            <a
              href="https://totem.minima.global"
              target="_blank"
              rel="noopener noreferrer"
            >
              Install it
            </a>{' '}
            to continue.
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.connectBtn}
          onClick={handleConnect}
          disabled={isConnecting || !hasWallet}
        >
          {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        </button>

        <div className={styles.sequence}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <span>TOTEM_CONNECT — pick address</span>
          </div>
          <span className={styles.arrow}>→</span>
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <span>TOTEM_VERIFY — prove ownership</span>
          </div>
          <span className={styles.arrow}>→</span>
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <span>Axia API — fetch balance</span>
          </div>
        </div>
      </div>
    </main>
  );
}
