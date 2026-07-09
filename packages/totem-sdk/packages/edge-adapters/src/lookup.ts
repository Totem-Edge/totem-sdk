import { encodeManifest } from '@totemsdk/manifest';
import type { SignedManifest } from '@totemsdk/manifest';
import type { LookupClient } from '@totemsdk/lookup-client';
import type { EdgeLookupPort, EdgeOperationResult } from '@totemsdk/edge';

/**
 * Wraps a LookupClient as an EdgeLookupPort.
 *
 * lookup:  queries coins by address, or a single coin by ID when kind === 'coin'.
 * watch:   registers for real-time coin-update push events.
 * announce: encodes the caller's WOTS-signed manifest to bytes, then hands off
 *           to announceApp() or announceAgent() on the client. The client signs
 *           those bytes with its session Ed25519 keypair — no WOTS key index is
 *           consumed. Fire-and-forget: the lookup node sends no ACK.
 */
export function createLookupPortAdapter(client: LookupClient): EdgeLookupPort {
  return {
    async lookup(params: {
      query: string;
      kind?: string;
    }): Promise<EdgeOperationResult<{ results: unknown[] }>> {
      try {
        if (params.kind === 'coin') {
          const coin = await client.getCoin(params.query);
          return { ok: true, data: { results: coin ? [coin] : [] } };
        }
        const coins = await client.getCoins({ address: params.query });
        return { ok: true, data: { results: coins } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async watch(params: {
      address: string;
      onUpdate: (data: unknown) => void;
    }): Promise<EdgeOperationResult<{ unsubscribe: () => void }>> {
      try {
        const unsubscribe = client.subscribeCoinUpdates(
          params.onUpdate as Parameters<typeof client.subscribeCoinUpdates>[0]
        );
        await client.watchAddress(params.address);
        return { ok: true, data: { unsubscribe } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async announce(params): Promise<EdgeOperationResult> {
      try {
        const manifestBytes = encodeManifest(params.signed as SignedManifest);

        if (params.kind === 'app') {
          await client.announceApp({
            manifest: manifestBytes,
            appId: params.appId,
            expiresAt: params.expiresAt,
            authorAddress: params.authorAddress,
            isFree: params.isFree,
          });
        } else {
          await client.announceAgent({
            manifest: manifestBytes,
            capabilityId: params.capabilityId,
            expiresAt: params.expiresAt,
            tags: params.tags,
            pricePerCall: params.pricePerCall,
            latencyMs: params.latencyMs,
          });
        }

        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
