import { useTotem } from '../totem-context.jsx';
import styles from './NavBar.module.css';

export function NavBar() {
  const { wallets, verified, address, connectAndVerify, disconnect, isConnecting, error } = useTotem();
  const hasWallet = wallets.length > 0;

  function handleConnect() {
    if (!hasWallet) {
      window.open('https://totem.minima.global', '_blank', 'noopener,noreferrer');
      return;
    }
    connectAndVerify('Sign in to Totem dApp Starter').catch(() => {});
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <span className={styles.logo}>⬡</span>
        <span className={styles.title}>Totem dApp Starter</span>
        <span className={styles.version}>v4.1</span>
      </div>

      <div className={styles.right}>
        {error && <span className={styles.error}>{error}</span>}
        {verified ? (
          <>
            <span className={styles.address} title={address}>
              {address ? `${address.slice(0, 8)}…${address.slice(-6)}` : ''}
            </span>
            <button className={styles.btnSecondary} onClick={disconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <button
            className={styles.btnPrimary}
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting…' : hasWallet ? 'Connect Wallet' : 'Install Totem'}
          </button>
        )}
      </div>
    </nav>
  );
}
