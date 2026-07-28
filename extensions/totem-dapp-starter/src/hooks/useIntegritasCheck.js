/**
 * useIntegritasCheck — verify that a previously stamped hash is anchored on-chain.
 *
 * Calls the backend proxy at POST /api/proof/check so that the
 * INTEGRITAS_API_KEY never leaves the server.
 *
 * Usage:
 *   const { check, checking, result, error, reset } = useIntegritasCheck();
 *
 *   await check('a3f1...');
 *   // result.status — "anchored" | "pending" | "not_found"
 *   // result.txId   — the Minima transaction ID (when anchored)
 *
 * @returns {{ check, checking, result, error, reset }}
 *   check(hash: string) → Promise<void>   — verify a previously stamped hash
 *   checking: boolean                      — true while the request is in flight
 *   result: { ok, status, txId?, anchorRef?, timestamp?, error? } | null
 *   error: string | null
 *   reset() → void                         — clear result + error
 */
import { useState, useCallback } from 'react';

export function useIntegritasCheck() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const check = useCallback(async (hash) => {
    if (!hash || typeof hash !== 'string') {
      setError('A hash string is required.');
      return;
    }

    setChecking(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/proof/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hash.trim() }),
      });

      const data = await res.json();

      if (res.status >= 500) {
        throw new Error(data.error ?? `Server error (${res.status})`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { check, checking, result, error, reset };
}
