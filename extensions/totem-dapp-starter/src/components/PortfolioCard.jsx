import styles from './PortfolioCard.module.css';

/**
 * PortfolioCard — displays balance fetched from the Axia API.
 *
 * Balance data comes from useAxiaPortfolio(address) — not from the wallet.
 * This is the v4.1 pattern: Totem is a signing standard, not a data oracle.
 */
export function PortfolioCard({ portfolio, loading, error, onRefresh, wsConnected }) {
  if (error) {
    return (
      <div className={`${styles.card} ${styles.errorCard}`}>
        <p className={styles.errorMsg}>Could not load portfolio: {error}</p>
        <button className={styles.refreshBtn} onClick={onRefresh}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.label}>Minima Balance</span>
        <div className={styles.indicators}>
          {wsConnected && (
            <span className={styles.liveIndicator} title="Live updates via Axia WS">
              <span className={styles.liveDot} />
              Live
            </span>
          )}
          <button className={styles.refreshBtn} onClick={onRefresh} title="Refresh portfolio">
            ↻
          </button>
        </div>
      </div>

      {loading && !portfolio ? (
        <div className={styles.skeleton} />
      ) : (
        <div className={styles.balance}>
          <span className={styles.amount}>
            {portfolio?.minimaBalance ?? '—'}
          </span>
          <span className={styles.unit}>MINIMA</span>
        </div>
      )}

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>UTXOs</span>
          <span className={styles.metaValue}>{portfolio?.utxoCount ?? '—'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Network Share</span>
          <span className={styles.metaValue}>
            {portfolio?.supplyShare ? `${(parseFloat(portfolio.supplyShare) * 100).toFixed(4)}%` : '—'}
          </span>
        </div>
      </div>

      {portfolio?.tokens?.length > 0 && (
        <div className={styles.tokens}>
          <p className={styles.tokensLabel}>Token Holdings</p>
          {portfolio.tokens.map((tok) => (
            <div key={tok.tokenId} className={styles.tokenRow}>
              <span className={styles.tokenName}>{tok.name ?? tok.tokenId.slice(0, 10) + '…'}</span>
              <span className={styles.tokenBalance}>{tok.balance}</span>
            </div>
          ))}
        </div>
      )}

      <p className={styles.source}>
        Data source: Axia API · not wallet events
      </p>
    </div>
  );
}
