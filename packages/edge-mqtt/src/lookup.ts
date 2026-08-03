/**
 * Lookup helpers for @totemsdk/edge-mqtt.
 *
 * Delegates to runtime.ports.lookup if the port is present.
 * Returns structured failures when no lookup port is configured.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';

type AnnounceParams =
  | {
      kind: 'app';
      signed: unknown;
      appId: string;
      expiresAt: number;
      authorAddress?: string;
      isFree?: boolean;
    }
  | {
      kind: 'agent';
      signed: unknown;
      capabilityId: string;
      expiresAt: number;
      tags?: string[];
      pricePerCall?: number;
      latencyMs?: number;
    };

/** Announce to a single runtime's lookup port. */
export async function announceMqttService(
  runtime: EdgeRuntime,
  params: AnnounceParams,
): Promise<EdgeOperationResult> {
  if (!runtime.ports.lookup) {
    return { ok: false, error: 'No lookup port available', errorCode: 'NO_LOOKUP_PORT' };
  }
  if (typeof runtime.ports.lookup.announce !== 'function') {
    return { ok: false, error: 'Lookup port has no announce method', errorCode: 'NO_ANNOUNCE_METHOD' };
  }
  try {
    return await runtime.ports.lookup.announce(params);
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message ?? 'Lookup announce failed',
      errorCode: 'LOOKUP_ANNOUNCE_FAILED',
    };
  }
}

/**
 * Announce to every lookup port in the provided list of runtimes.
 *
 * Each announce is attempted independently — a failure on one runtime does not
 * block the others. Returns an array of results in the same order as `runtimes`.
 *
 * Typical use: a gateway that is connected to multiple lookup nodes and wants
 * to be discoverable on all of them without multiple call sites.
 */
export async function announceToAll(
  runtimes: EdgeRuntime[],
  params: AnnounceParams,
): Promise<EdgeOperationResult[]> {
  return Promise.all(
    runtimes.map(rt => announceMqttService(rt, params)),
  );
}
