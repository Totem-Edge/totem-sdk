import { createProof, canonicalJson, toHex } from '@totemsdk/proof';
import type { ProofProvider, SignedProof, ProofKind } from '@totemsdk/proof';
import type { EdgeProofPort, EdgeOperationResult } from '@totemsdk/edge';

export interface ProofPortConfig {
  provider: ProofProvider;
  /** Issuer address or identifier stamped onto created proofs. */
  issuer: string;
  /** Default proof kind when callers don't specify one via context. */
  defaultKind?: ProofKind;
}

/**
 * Wraps a ProofProvider (e.g. proof-integritas) as an EdgeProofPort.
 *
 * createProof: builds an unsigned proof from the EdgeProofPort params, then
 *   stamps its canonical hash via provider.stampHash if available.
 * verifyProof: delegates to provider.verifyProof for SignedProof values,
 *   or provider.checkProof for lightweight existence checks.
 */
export function createProofPortAdapter(config: ProofPortConfig): EdgeProofPort {
  const { provider, issuer, defaultKind = 'attestation' } = config;

  return {
    async createProof(params: {
      subject: string;
      claims: unknown[];
      context?: Record<string, unknown>;
    }): Promise<EdgeOperationResult<{ proofId: string; proof: unknown }>> {
      try {
        const kind = (params.context?.['kind'] as ProofKind | undefined) ?? defaultKind;
        const unsigned = createProof({
          kind,
          subject: { id: params.subject, kind: 'edge-subject' },
          issuer,
          payload: { claims: params.claims, ...(params.context ?? {}) },
        });

        // Stamp the proof's canonical hash if the provider supports it.
        if (provider.stampHash) {
          const hash = toHex(
            new Uint8Array(
              await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(unsigned)))
            )
          );
          await provider.stampHash({ hash });
        }

        return { ok: true, data: { proofId: unsigned.proofId, proof: unsigned } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async verifyProof(params: {
      proof: unknown;
      subject?: string;
    }): Promise<EdgeOperationResult<{ valid: boolean; reason?: string }>> {
      try {
        const proof = params.proof as SignedProof;
        if (provider.verifyProof) {
          const result = await provider.verifyProof(proof);
          return { ok: true, data: { valid: result.valid, reason: result.reason } };
        }
        if (provider.checkProof) {
          const result = await provider.checkProof(proof);
          const valid = result.ok && !result.error;
          return { ok: true, data: { valid, reason: result.error } };
        }
        return {
          ok: false,
          error: 'Provider does not support proof verification',
          errorCode: 'NO_VERIFY_CAPABILITY',
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
