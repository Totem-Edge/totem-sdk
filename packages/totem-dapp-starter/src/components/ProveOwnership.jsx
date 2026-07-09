import { useState } from 'react';
import { useTotem } from '../totem-context.jsx';

/**
 * ProveOwnership — demonstrates the full TOTEM_PROVE_OWNERSHIP round-trip.
 *
 * Flow:
 *   1. Check walletMode === 'RootTree' (gated by parent RootIdGate).
 *   2. Call provider.request({ method: 'TOTEM_PROVE_OWNERSHIP', ... }) to
 *      request an OwnershipProof from the extension (shows consent popup).
 *   3. POST the proof to /api/auth/verify-ownership on this dApp's backend.
 *   4. Display the { valid, rootAddress, childAddresses } result.
 *
 * Parent component must ensure walletMode === 'RootTree' before rendering.
 */
export function ProveOwnership() {
  const { activeProvider } = useTotem();
  const [indicesInput, setIndicesInput] = useState('0, 1');
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleProve(e) {
    e.preventDefault();
    setStatus(null);
    setResult(null);
    setLoading(true);

    try {
      const childIndices = indicesInput
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      if (childIndices.length === 0) {
        throw new Error('Enter at least one child index (e.g. 0, 1)');
      }

      setStatus('Requesting ownership proof from wallet…');
      const proof = await activeProvider.request({
        method: 'TOTEM_PROVE_OWNERSHIP',
        params: { childIndices },
      });

      setStatus('Verifying proof on server…');
      const res = await fetch('/api/auth/verify-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Server error (${res.status})`);
      }

      setResult(data);
      setStatus(data.valid ? 'Proof verified!' : 'Proof invalid.');
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <h4 style={styles.title}>Root Identity — Prove Ownership</h4>
      <p style={styles.desc}>
        Generate a cross-address ownership proof and verify it server-side via{' '}
        <code>POST /api/auth/verify-ownership</code>.
      </p>

      <form onSubmit={handleProve} style={styles.form}>
        <label style={styles.label}>
          Child address indices (comma-separated)
        </label>
        <input
          type="text"
          value={indicesInput}
          onChange={(e) => setIndicesInput(e.target.value)}
          style={styles.input}
          placeholder="e.g. 0, 1, 2"
          disabled={loading}
        />
        <button type="submit" style={styles.btn} disabled={loading}>
          {loading ? 'Working…' : 'Prove Ownership'}
        </button>
      </form>

      {status && (
        <p style={{
          ...styles.status,
          color: status.startsWith('Error') ? '#e53e3e'
            : result?.valid ? '#276749'
            : '#b7791f',
        }}>
          {status}
        </p>
      )}

      {result && (
        <div style={styles.result}>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Valid</span>
            <span style={{ color: result.valid ? '#276749' : '#e53e3e', fontWeight: 'bold' }}>
              {result.valid ? '✓ true' : '✗ false'}
            </span>
          </div>
          {result.rootAddress && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Root address</span>
              <span style={styles.resultValue}>{result.rootAddress}</span>
            </div>
          )}
          {result.childAddresses && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Child addresses</span>
              <div>
                {result.childAddresses.map((addr, i) => (
                  <div key={i} style={styles.resultValue}>{addr}</div>
                ))}
              </div>
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
    lineHeight: '1.5',
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
  btn: {
    padding: '9px 16px',
    background: '#2b6cb0',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    alignSelf: 'flex-start',
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
    minWidth: '100px',
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
