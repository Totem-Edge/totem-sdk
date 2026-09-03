/**
 * purchase-lookup.ts — PurchaseLookupPort adapter over @totemsdk/lookup-client.
 *
 * Maps a machine-commerce `resource` (e.g. "compute", "storage") to a
 * capability query on the Lookup Node, returning signed manifests for the
 * buyer's discovery flow.
 *
 * Discovery is publication, not authority: the buyer MUST still verify each
 * returned manifest's signature, identity binding, expiry, and capabilities
 * before negotiation/payment. This adapter only fetches candidates.
 */

import type { LookupClient } from '@totemsdk/lookup-client';
import type { EdgeOperationResult } from '@totemsdk/edge';

export interface PurchaseLookupAdapterConfig {
  client: LookupClient;
  /** Optional provider address filter (authorAddress for apps). */
  provider?: string;
  /** Optional max price filter (agents). */
  maxPricePerCall?: number;
  /** Optional max latency filter (agents). */
  maxLatencyMs?: number;
  /** Optional result limit. */
  limit?: number;
}

/**
 * Create a PurchaseLookupPort adapter over a LookupClient.
 *
 * `resource` is treated as a capability name for agent manifests (the
 * machine-commerce case). If the resource matches a known app category, it
 * falls back to app queries. Returns `{ id, manifest: Uint8Array, nodeId }`
 * candidates for the buyer's manifest-verification pipeline.
 */
export function createPurchaseLookupAdapter(
  config: PurchaseLookupAdapterConfig,
): {
  query(params: {
    resource: string;
    provider?: string;
  }): Promise<EdgeOperationResult<{ results: Array<{ id: string; manifest: Uint8Array; nodeId: string }> }>>;
} {
  const { client } = config;

  return {
    async query(params) {
      try {
        const provider = params.provider ?? config.provider;
        const limit = config.limit ?? 20;

        // Agent capability query (machine-commerce primary path).
        const agents = await client.queryAgents({
          capabilityName: params.resource,
          maxPricePerCall: config.maxPricePerCall,
          maxLatencyMs: config.maxLatencyMs,
          limit,
        });
        const results = agents.map((a) => ({
          id: a.capabilityId,
          manifest: a.manifest,
          nodeId: a.nodeId,
        }));

        // If no agent results and a provider is specified, also try app query
        // filtered by author address (provider = operator).
        if (results.length === 0 && provider) {
          const apps = await client.queryApps({
            authorAddress: provider,
            limit,
          });
          for (const a of apps) {
            results.push({ id: a.appId, manifest: a.manifest, nodeId: a.nodeId });
          }
        }

        return { ok: true, data: { results } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
