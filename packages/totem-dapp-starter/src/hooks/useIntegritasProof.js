/**
 * useIntegritasProof — one-line on-chain hash anchoring via Integritas.
 *
 * Calls the backend proxy at POST /api/proof/stamp so that the
 * INTEGRITAS_API_KEY never leaves the server. Returns the Minima txId
 * once the hash has been anchored on-chain.
 *
 * Usage:
 *   const { stamp, stamping, result, error, reset } = useIntegritasProof();
 *
 *   // stamp any hex-encoded SHA-256 hash (or arbitrary 64-char hex string)
 *   await stamp('a3f1...');
 *   // result.txId — the Minima transaction ID for the on-chain anchor
 *
 * @returns {{ stamp, stamping, result, error, reset }}
 *   stamp(hash: string) → Promise<void>   — submit a hash for anchoring
 *   stamping: boolean                      — true while the request is in flight
 *   result: { ok, txId?, timestamp?, anchorRef?, raw? } | null
 *   error: string | null
 *   reset() → void                         — clear result + error
 */
import { useState, useCallback } from 'react';

export function useIntegritasProof() {
  const [stamping, setStamping] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const stamp = useCallback(async (hash) => {
    if (!hash || typeof hash !== 'string') {
      setError('A hash string is required.');
      return;
    }

    setStamping(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/proof/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hash.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Server error (${res.status})`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setStamping(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { stamp, stamping, result, error, reset };
}
