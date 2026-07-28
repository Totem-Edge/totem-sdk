import { createProof, signProof, signWithLease, toHex, sha3_256 } from '@totemsdk/proof';
import type {
  ProofProvider,
  SignedProof,
  ProofKind,
  UnsignedProof,
} from '@totemsdk/proof';
import type { EdgeProofPort, EdgeOperationResult } from '@totemsdk/edge';

export interface ProofPortConfig {
  provider: ProofProvider;
  /** Issuer address or identifier stamped onto created proofs. */
  issuer: string;
  /** Default proof kind when callers don't specify one via context. */
  defaultKind?: ProofKind;
  /**
   * 32-byte WOTS seed. Required for signing; without it only unsigned
   * proofs are returned, which MUST NOT be presented as completed proofs.
   */
  seed?: Uint8Array;
  /**
   * TreeKey index for direct signing (used when no leaseProvider is given).
   * Ignored when leaseProvider is set.
   */
  keyIndex?: number;
  /**
   * WOTS lease provider for coordinated key-index reservation.
   * When set, keyIndex is ignored and the index is reserved via the provider.
   */
  leaseProvider?: {
    reserveKeyUse(params: {
      treeId: string;
      ttlMs?: number;
      payloadHash?: string;
    }): Promise<{ reservationId: string; indices: { addressIndex: number; l1: number; l2: number } }>;
    commitKeyUse(reservationId: string, txId: string): Promise<void>;
    burnReservation(reservationId: string, reason: string): Promise<void>;
  };
  leaseTreeId?: string;
}

function rawPayloadEvidence(rawPayload?: Uint8Array): { id: string; kind: string; hash: string } | undefined {
  if (!rawPayload || rawPayload.length === 0) return undefined;
  const hash = toHex(sha3_256(rawPayload));
  return { id: 'payload:' + hash, kind: 'raw-payload', hash };
}

/**
 * Wraps a ProofProvider (e.g. proof-integritas) as an EdgeProofPort.
 *
 * When config.seed is provided the returned proof is a SignedProof;
 * without seed only an UnsignedProof is returned and MUST NOT be
 * presented as a completed proof.
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
        const rawPayload: Uint8Array | undefined = params.context?.['rawPayload'] as Uint8Array | undefined;

        const evidence = rawPayloadEvidence(rawPayload);
        const unsigned: UnsignedProof = createProof({
          kind,
          subject: { id: params.subject, kind: 'edge-subject' },
          issuer,
          payload: {
            claims: params.claims,
            ...(rawPayload !== undefined ? { rawPayloadHash: toHex(sha3_256(rawPayload)) } : {}),
            ...(params.context ?? {}),
          },
          ...(evidence !== undefined ? { evidence: [evidence] } : {}),
        });

        // Sign if seed is available
        let proof: unknown;
        let proofId: string;
        if (config.seed) {
          if (config.leaseProvider) {
            proof = await signWithLease(unsigned, config.seed, config.leaseProvider, {
              treeId: config.leaseTreeId,
            });
          } else {
            proof = signProof(unsigned, config.seed, config.keyIndex ?? 0);
          }
          proofId = (proof as SignedProof).proofId;
        } else {
          proof = unsigned;
          proofId = unsigned.proofId;
        }

        // Stamp the proof's canonical hash if the provider supports it.
        if (provider.stampHash) {
          await provider.stampHash({ hash: proofId });
        }

        return { ok: true, data: { proofId, proof } };
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
