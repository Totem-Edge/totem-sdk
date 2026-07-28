/**
 * useIntegritasVerify — verify a full SignedProof object (local WOTS check +
 * on-chain anchor) in one step.
 *
 * Calls the backend proxy at POST /api/proof/verify so that the
 * INTEGRITAS_API_KEY never leaves the server.
 *
 * Usage:
 *   const { verify, verifying, result, error, reset } = useIntegritasVerify();
 *
 *   await verify(signedProofObject);
 *   // result.valid       — true if WOTS sig + on-chain anchor both pass
 *   // result.signerAddress — the Minima address that signed the proof
 *   // result.reason      — failure reason when valid is false
 *
 * @returns {{ verify, verifying, result, error, reset }}
 *   verify(proof: SignedProof, opts?: { skipLocalVerification?: boolean }) → Promise<void>
 *   verifying: boolean                — true while the request is in flight
 *   result: { valid, signerAddress?, reason?, error? } | null
 *   error: string | null
 *   reset() → void                   — clear result + error
 */
import { useState, useCallback } from 'react';

export function useIntegritasVerify() {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const verify = useCallback(async (proof, opts = {}) => {
    if (!proof || typeof proof !== 'object') {
      setError('A SignedProof object is required.');
      return;
    }

    setVerifying(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/proof/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof,
          skipLocalVerification: opts.skipLocalVerification === true,
        }),
      });

      const data = await res.json();

      if (res.status >= 500) {
        throw new Error(data.error ?? `Server error (${res.status})`);
      }

      if (res.status === 400) {
        throw new Error(data.error ?? 'Invalid proof format');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { verify, verifying, result, error, reset };
}
