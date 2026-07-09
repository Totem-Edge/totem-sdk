import { useState } from 'react';
import { useIntegritasProof } from '../hooks/useIntegritasProof.js';
import { useIntegritasCheck } from '../hooks/useIntegritasCheck.js';

/**
 * AnchorProof — minimal UI for on-chain hash anchoring and verification via Integritas.
 *
 * Flow:
 *   1. User pastes a hex hash (e.g. SHA-256 of a document).
 *   2. Component calls POST /api/proof/stamp via useIntegritasProof.
 *   3. Backend stamps the hash through Integritas and returns the Minima txId.
 *   4. The txId (and optional timestamp) is displayed as confirmation.
 *   5. User can click "Verify anchor" to check whether the hash is anchored
 *      on-chain by calling POST /api/proof/check via useIntegritasCheck.
 *
 * The INTEGRITAS_API_KEY stays on the server — this component only talks
 * to your own backend proxy endpoints (/api/proof/stamp, /api/proof/check).
 */
export function AnchorProof() {
  const [hashInput, setHashInput] = useState('');
  const { stamp, stamping, result, error, reset } = useIntegritasProof();
  const {
    check,
    checking,
    result: checkResult,
    error: checkError,
    reset: resetCheck,
  } = useIntegritasCheck();

  async function handleSubmit(e) {
    e.preventDefault();
    resetCheck();
    await stamp(hashInput);
  }

  async function handleVerify() {
    await check(hashInput);
  }

  function handleChange(e) {
    setHashInput(e.target.value);
    if (result || error) reset();
    if (checkResult || checkError) resetCheck();
  }

  const hasResult = result !== null;
  const succeeded = hasResult && result.ok;

  const hasCheckResult = checkResult !== null;
  const checkStatus = checkResult?.status;

  const checkStatusColor =
    checkStatus === 'anchored'
      ? '#276749'
      : checkStatus === 'not_found'
      ? '#e53e3e'
      : '#b7791f';

  const checkStatusLabel =
    checkStatus === 'anchored'
      ? '✓ Anchored'
      : checkStatus === 'not_found'
      ? '✗ Not found'
      : '⏳ Pending';

  return (
    <div style={styles.card}>
      <h4 style={styles.title}>Integritas — On-Chain Anchoring</h4>
      <p style={styles.desc}>
        Stamp a SHA-256 hash on Minima in one click. Paste any 64-character hex
        hash below — your backend proxies the request to Integritas and returns
        the Minima transaction ID. Use "Verify anchor" to confirm an existing
        anchor is on-chain.
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label} htmlFor="integritas-hash">
          Hash to anchor (hex)
        </label>
        <input
          id="integritas-hash"
          type="text"
          value={hashInput}
          onChange={handleChange}
          style={styles.input}
          placeholder="e.g. a3f1b2c4d5e6…  (64 hex chars)"
          disabled={stamping || checking}
          spellCheck={false}
          autoComplete="off"
        />
        <div style={styles.btnRow}>
          <button
            type="submit"
            style={styles.btn}
            disabled={stamping || checking || !hashInput.trim()}
          >
            {stamping ? 'Anchoring…' : 'Anchor on Minima'}
          </button>
          <button
            type="button"
            style={styles.btnVerify}
            disabled={stamping || checking || !hashInput.trim()}
            onClick={handleVerify}
          >
            {checking ? 'Verifying…' : 'Verify anchor'}
          </button>
        </div>
      </form>

      {error && (
        <p style={{ ...styles.status, color: '#e53e3e' }}>
          Error: {error}
        </p>
      )}

      {succeeded && (
        <div style={styles.result}>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Status</span>
            <span style={{ color: '#276749', fontWeight: '600' }}>✓ Anchored</span>
          </div>
          {result.txId && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Tx ID</span>
              <span style={styles.resultValue}>{result.txId}</span>
            </div>
          )}
          {result.anchorRef && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Anchor ref</span>
              <span style={styles.resultValue}>{result.anchorRef}</span>
            </div>
          )}
          {result.timestamp && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Timestamp</span>
              <span style={styles.resultValue}>
                {new Date(result.timestamp).toISOString()}
              </span>
            </div>
          )}
        </div>
      )}

      {hasResult && !succeeded && (
        <p style={{ ...styles.status, color: '#b7791f' }}>
          Stamp returned ok:false — check INTEGRITAS_API_KEY in your .env
        </p>
      )}

      {checkError && (
        <p style={{ ...styles.status, color: '#e53e3e', marginTop: '12px' }}>
          Verify error: {checkError}
        </p>
      )}

      {hasCheckResult && (
        <div style={{ ...styles.result, marginTop: '12px' }}>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Anchor status</span>
            <span style={{ color: checkStatusColor, fontWeight: '600' }}>
              {checkStatusLabel}
            </span>
          </div>
          {checkResult.txId && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Tx ID</span>
              <span style={styles.resultValue}>{checkResult.txId}</span>
            </div>
          )}
          {checkResult.anchorRef && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Anchor ref</span>
              <span style={styles.resultValue}>{checkResult.anchorRef}</span>
            </div>
          )}
          {checkResult.timestamp && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Timestamp</span>
              <span style={styles.resultValue}>
                {new Date(checkResult.timestamp).toISOString()}
              </span>
            </div>
          )}
          {!checkResult.ok && checkResult.error && checkStatus !== 'not_found' && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Detail</span>
              <span style={{ ...styles.resultValue, color: '#b7791f' }}>
                {checkResult.error}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '20px',
    background: '#f7fafc',
    marginTop: '16px',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '14px',
    fontWeight: '700',
    color: '#1a202c',
  },
  desc: {
    margin: '0 0 16px',
    fontSize: '13px',
    color: '#4a5568',
    lineHeight: '1.6',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    color: '#4a5568',
    fontWeight: '600',
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'monospace',
    background: '#fff',
    color: '#1a202c',
  },
  btnRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  btn: {
    padding: '9px 16px',
    background: '#2b6cb0',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnVerify: {
    padding: '9px 16px',
    background: '#fff',
    color: '#2b6cb0',
    border: '1px solid #2b6cb0',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  status: {
    marginTop: '12px',
    fontSize: '13px',
    fontWeight: '500',
  },
  result: {
    marginTop: '12px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    padding: '12px',
    fontSize: '12px',
  },
  resultRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    marginBottom: '6px',
  },
  resultLabel: {
    color: '#718096',
    minWidth: '90px',
    flexShrink: 0,
    fontWeight: '600',
  },
  resultValue: {
    color: '#1a202c',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    fontSize: '11px',
  },
};
