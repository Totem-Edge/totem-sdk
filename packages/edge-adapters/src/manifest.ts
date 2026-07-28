import { signManifest, verifyManifest } from '@totemsdk/manifest';
import type { Manifest, SignedManifest } from '@totemsdk/manifest';
import type { EdgeManifestPort, EdgeOperationResult } from '@totemsdk/edge';

/**
 * Wraps @totemsdk/manifest's signManifest / verifyManifest as an EdgeManifestPort.
 *
 * The port interface already carries seed and keyIndex at call time, so this
 * adapter has no constructor config — it is purely a thin type bridge.
 *
 * Callers are responsible for key-lease reservation before calling sign().
 * This adapter does not interact with @totemsdk/wots-lease.
 */
export function createManifestPortAdapter(): EdgeManifestPort {
  return {
    async sign(
      manifest: unknown,
      seed: Uint8Array,
      keyIndex: number
    ): Promise<EdgeOperationResult<{ signed: unknown }>> {
      try {
        const signed = await signManifest(manifest as Manifest, seed, keyIndex);
        return { ok: true, data: { signed } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async verify(signed: unknown): Promise<EdgeOperationResult<{ valid: boolean; reason?: string }>> {
      try {
        const result = verifyManifest(signed as SignedManifest);
        return { ok: true, data: { valid: result.valid, reason: result.reason } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
