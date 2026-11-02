/**
 * GNSS Edge Gateway — wires a GnssTransportPort into an EdgeRuntime.
 *
 * Valid fixes become `gnss:<source>` proofs with position, altitude, speed,
 * heading, DOP and satellite claims. Invalid, absent or "none" fixes are never
 * signed.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { GnssFix, GnssTransportPort } from './transport.js';

export interface GnssGatewayConfig {
  runtime: EdgeRuntime;
  transport: GnssTransportPort;
}

export interface GnssGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  /** Latest valid fix, or a failure when none is available. */
  getFix(): Promise<EdgeOperationResult<{ fix: GnssFix }>>;
}

export function createGnssGateway(config: GnssGatewayConfig): GnssGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let unsubFix: (() => void) | undefined;
  let unsubError: (() => void) | undefined;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.start();
      unsubFix = config.transport.onFix((fix) => {
        if (!isValidFix(fix)) return;
        if (status === 'error') status = 'running';
        const proof = config.runtime.ports.proof;
        if (!proof) return;
        proof.createProof({
          subject: `gnss:${fix.source}`,
          claims: [claimFor(fix)],
        }).catch(() => {});
      });
      unsubError = config.transport.onError(() => { status = 'error'; });
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubFix?.(); unsubError?.();
      unsubFix = undefined;
      unsubError = undefined;
      await config.transport.stop();
      status = 'stopped';
    },

    async getFix() {
      try {
        const fix = await config.transport.getFix();
        if (!fix) return { ok: false, error: 'no GNSS fix' };
        const fixType = fix.fixType;
        if (!isValidFix(fix)) return { ok: false, error: `invalid GNSS fix (${fixType})` };
        return { ok: true, data: { fix } };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

export function isValidFix(fix: GnssFix | null | undefined): fix is GnssFix {
  if (!fix) return false;
  return fix.fixType !== 'none' &&
    Number.isFinite(fix.lat) && fix.lat >= -90 && fix.lat <= 90 &&
    Number.isFinite(fix.lon) && fix.lon >= -180 && fix.lon <= 180 &&
    Number.isFinite(fix.observedAt);
}

export function claimFor(fix: GnssFix): Record<string, unknown> {
  return {
    lat: fix.lat,
    lon: fix.lon,
    fixType: fix.fixType,
    source: fix.source,
    timestamp: fix.observedAt,
    ...(fix.altitudeM !== undefined ? { altitudeM: fix.altitudeM } : {}),
    ...(fix.speedMps !== undefined ? { speedMps: fix.speedMps } : {}),
    ...(fix.headingDeg !== undefined ? { headingDeg: fix.headingDeg } : {}),
    ...(fix.accuracyM !== undefined ? { accuracyM: fix.accuracyM } : {}),
    ...(fix.hdop !== undefined ? { hdop: fix.hdop } : {}),
    ...(fix.vdop !== undefined ? { vdop: fix.vdop } : {}),
    ...(fix.pdop !== undefined ? { pdop: fix.pdop } : {}),
    ...(fix.satellitesUsed !== undefined ? { satellitesUsed: fix.satellitesUsed } : {}),
  };
}
