import { useCallback, useState } from 'react';
import { useTotem } from '../totem-context.jsx';
import { useAxiaPortfolio } from '../hooks/useAxiaPortfolio.js';
import { useAxiaWs } from '../hooks/useAxiaWs.js';
import { PortfolioCard } from './PortfolioCard.jsx';
import { SendForm } from './SendForm.jsx';
import { ProveOwnership } from './ProveOwnership.jsx';
import { AnchorProof } from './AnchorProof.jsx';
import { VerifyProof } from './VerifyProof.jsx';
import styles from './Dashboard.module.css';

/**
 * Dashboard — shown when the user is connected and verified.
 *
 * v4.2.0: walletMode is gone — all wallets use the unified hierarchical key
 * derivation scheme and therefore support Root Identity features (ownership
 * proofs, DAO attestation, etc.) without any mode gate.
 *
 * Fetches portfolio from the Axia API (REST + optional WS stream).
 * Balance comes from useAxiaPortfolio, NOT from the wallet.
 */
export function Dashboard() {
  const { verified, address, chainId } = useTotem();
  const { portfolio, loading, error, refresh } = useAxiaPortfolio(address, {
    pollIntervalMs: 60_000,
  });

  const [wsConnected, setWsConnected] = useState(false);

  const handleWsUpdate = useCallback(
    (data) => {
      setWsConnected(true);
      refresh();
    },
    [refresh],
  );

  useAxiaWs(address, handleWsUpdate, verified);

  if (!verified) return null;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.accountRow}>
          <div>
            <p className={styles.accountLabel}>Connected Address</p>
            <p className={styles.accountAddress}>{address}</p>
          </div>
          <span className={styles.chainBadge}>{chainId ?? 'minima-mainnet'}</span>
        </div>

        <div className={styles.grid}>
          <PortfolioCard
            portfolio={portfolio}
            loading={loading}
            error={error}
            onRefresh={refresh}
            wsConnected={wsConnected}
          />
          <SendForm />
        </div>

        <div className={styles.infoBox}>
          <h4 className={styles.infoTitle}>Root Identity</h4>
          <p style={{ margin: '0 0 8px', fontSize: '13px' }}>
            All wallets now use the unified hierarchical key scheme.
            Ownership proofs and DAO attestation are available for every user.
          </p>
          <ProveOwnership />
        </div>

        <div className={styles.infoBox}>
          <h4 className={styles.infoTitle}>On-Chain Anchoring</h4>
          <p style={{ margin: '0 0 8px', fontSize: '13px' }}>
            Stamp any hash permanently on Minima via Integritas.
            The anchoring API key stays server-side — your backend proxies the request.
          </p>
          <AnchorProof />
        </div>

        <div className={styles.infoBox}>
          <h4 className={styles.infoTitle}>Full Proof Verification</h4>
          <p style={{ margin: '0 0 8px', fontSize: '13px' }}>
            Verify a complete <code>SignedProof</code> in one step: local WOTS signature
            check followed by on-chain anchor confirmation via Integritas.
            Paste the proof JSON returned by <code>anchorProof()</code>.
          </p>
          <VerifyProof />
        </div>

        <div className={styles.infoBox}>
          <h4 className={styles.infoTitle}>v4.2 Pattern Notes</h4>
          <ul className={styles.infoList}>
            <li>
              <strong>TotemProvider</strong> holds only wallet connection state — no balance here.
            </li>
            <li>
              <strong>useAxiaPortfolio</strong> fetches balance from the Axia API via your backend
              proxy (<code>/api/portfolio/:address</code>).
            </li>
            <li>
              <strong>useAxiaWs</strong> subscribes to the Axia WebSocket for live balance updates
              without polling.
            </li>
            <li>
              <strong>SendForm</strong> calls <code>TOTEM_SEND_TRANSACTION</code>; the extension
              handles coin selection, signing, and broadcast.
            </li>
            <li>
              <strong>ProveOwnership</strong> is always available — walletMode gates are removed.
              Every connected wallet can produce ownership proofs via the unified key scheme.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
