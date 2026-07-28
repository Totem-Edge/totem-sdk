import { useState } from 'react';
import { useIntegritasVerify } from '../hooks/useIntegritasVerify.js';

/**
 * VerifyProof — UI for full SignedProof verification via Integritas.
 *
 * Flow:
 *   1. User pastes a JSON SignedProof object (produced by anchorProof()).
 *   2. Component calls POST /api/proof/verify via useIntegritasVerify.
 *   3. Backend runs a local WOTS signature check then checks the on-chain anchor.
 *   4. Result (valid/invalid, signer address) is displayed.
 *
 * The INTEGRITAS_API_KEY stays on the server — this component only talks
 * to your own backend proxy endpoint (/api/proof/verify).
 */
export function VerifyProof() {
  const [jsonInput, setJsonInput] = useState('');
  const [parseError, setParseError] = useState(null);
  const { verify, verifying, result, error, reset } = useIntegritasVerify();

  function handleChange(e) {
    setJsonInput(e.target.value);
    setParseError(null);
    if (result || error) reset();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setParseError(null);

    let proof;
    try {
      proof = JSON.parse(jsonInput.trim());
    } catch {
      setParseError('Invalid JSON — paste the full SignedProof object.');
      return;
    }

    await verify(proof);
  }

  const isValid = result?.valid === true;
  const isInvalid = result !== null && result.valid === false;

  const statusColor = isValid ? '#276749' : isInvalid ? '#e53e3e' : '#b7791f';
  const statusLabel = isValid ? '✓ Verified' : '✗ Invalid';

  return (
    <div style={styles.card}>
      <h4 style={styles.title}>Integritas — Full Proof Verification</h4>
      <p style={styles.desc}>
        Paste a <code style={styles.code}>SignedProof</code> JSON object below to run a full
        verification: local WOTS signature check followed by on-chain anchor confirmation.
        Your backend proxies the request to Integritas — the API key never leaves the server.
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label} htmlFor="proof-json-input">
          SignedProof (JSON)
        </label>
        <textarea
          id="proof-json-input"
          value={jsonInput}
          onChange={handleChange}
          style={styles.textarea}
          placeholder={'{\n  "signature": { "address": "Mx…", … },\n  "payload": { … }\n}'}
          disabled={verifying}
          spellCheck={false}
          autoComplete="off"
          rows={8}
        />
        {parseError && (
          <p style={styles.parseError}>{parseError}</p>
        )}
        <div style={styles.btnRow}>
          <button
            type="submit"
            style={styles.btn}
            disabled={verifying || !jsonInput.trim()}
          >
            {verifying ? 'Verifying…' : 'Verify proof'}
          </button>
          {(result || error) && (
            <button
              type="button"
              style={styles.btnReset}
              onClick={() => { reset(); setParseError(null); }}
              disabled={verifying}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && (
        <p style={{ ...styles.status, color: '#e53e3e' }}>
          Error: {error}
        </p>
      )}

      {result !== null && (
        <div style={styles.result}>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Result</span>
            <span style={{ color: statusColor, fontWeight: '600' }}>
              {statusLabel}
            </span>
          </div>

          {isValid && result.signerAddress && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Signer</span>
              <span style={styles.resultValue}>{result.signerAddress}</span>
            </div>
          )}

          {isInvalid && result.reason && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Reason</span>
              <span style={{ ...styles.resultValue, color: '#e53e3e' }}>
                {result.reason}
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
  code: {
    fontFamily: 'monospace',
    background: '#edf2f7',
    padding: '1px 4px',
    borderRadius: '3px',
    fontSize: '12px',
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
  textarea: {
    padding: '8px 10px',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    background: '#fff',
    color: '#1a202c',
    resize: 'vertical',
    lineHeight: '1.5',
  },
  parseError: {
    margin: '0',
    fontSize: '12px',
    color: '#e53e3e',
    fontWeight: '500',
  },
  btnRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  btn: {
    padding: '9px 16px',
    background: '#553c9a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnReset: {
    padding: '9px 16px',
    background: '#fff',
    color: '#718096',
    border: '1px solid #cbd5e0',
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
