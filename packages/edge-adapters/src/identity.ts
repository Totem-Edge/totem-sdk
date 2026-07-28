import { resolveIdentityGraph, verifyIdentityClaim } from '@totemsdk/identity';
import type { IdentityGraph, SignedIdentityClaim } from '@totemsdk/identity';
import type { EdgeIdentityPort, EdgeOperationResult } from '@totemsdk/edge';

export interface IdentityPortConfig {
  /**
   * The identity graph this adapter can resolve. Callers holding multiple
   * identities should create one adapter per graph.
   */
  graph: IdentityGraph;
}

/**
 * Wraps an IdentityGraph (from @totemsdk/identity) as an EdgeIdentityPort.
 *
 * resolve: returns the resolved identity when identityId matches graph.document.id,
 *          otherwise returns ok:false. For multi-identity setups, compose multiple
 *          adapters or use a router above this layer.
 * verify:  delegates to verifyIdentityClaim() for SignedIdentityClaim values.
 *          Returns ok:false for unrecognised proof shapes.
 */
export function createIdentityPortAdapter(config: IdentityPortConfig): EdgeIdentityPort {
  const { graph } = config;

  return {
    async resolve(identityId: string): Promise<EdgeOperationResult<{ identity: unknown }>> {
      try {
        if (graph.document.id !== identityId) {
          return {
            ok: false,
            error: `Identity "${identityId}" not found in this adapter's graph`,
            errorCode: 'IDENTITY_NOT_FOUND',
          };
        }
        const result = resolveIdentityGraph(graph);
        if (!result.resolved) {
          return {
            ok: false,
            error: result.errors?.join('; ') ?? 'Identity could not be resolved',
            errorCode: 'IDENTITY_UNRESOLVABLE',
          };
        }
        return { ok: true, data: { identity: result.resolved } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async verify(proof: unknown): Promise<EdgeOperationResult<{ valid: boolean; address?: string }>> {
      try {
        const claim = proof as SignedIdentityClaim;
        if (!claim?.proof?.address) {
          return {
            ok: false,
            error: 'Proof is not a recognisable SignedIdentityClaim',
            errorCode: 'UNSUPPORTED_PROOF_TYPE',
          };
        }
        const result = verifyIdentityClaim(claim);
        return {
          ok: true,
          data: { valid: result.valid, address: result.valid ? claim.proof.address : undefined },
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
