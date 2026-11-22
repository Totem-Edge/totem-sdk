/**
 * RFC-024 §5.5 — physical effects derived from the PREPARED charging command.
 *
 * These are the facts the authority layer commits to and RFC-023 enforces. They
 * are computed from the prepared command only, never from caller-supplied
 * hints, so a tampered or replayed command cannot widen the envelope.
 */

import type { StepEffects } from '@totemsdk/agent-policy';

export interface ChargingLimits {
  /** Target connector (ResourceId key). */
  resource: string;
  /** Instantaneous power ceiling implied by the command, in W. */
  maxPowerWatts: string;
  /** Total energy ceiling for the session/limit, in Wh. */
  maxEnergyWattHours?: string;
  /** Maximum wall-clock duration, in seconds. */
  maxSessionSeconds?: string;
  /** Charging profile id and schedule digest, when a profile is applied. */
  profileId?: string;
  profileDigest?: string;
}

export function deriveChargingEffects(limits: ChargingLimits): StepEffects {
  const physical: NonNullable<StepEffects['physical']> = {
    power: [{ resource: limits.resource, watts: limits.maxPowerWatts }],
  };
  if (limits.maxEnergyWattHours !== undefined) {
    physical.energy = [{ resource: limits.resource, wattHours: limits.maxEnergyWattHours }];
  }
  if (limits.maxSessionSeconds !== undefined) {
    physical.duration = [{ resource: limits.resource, seconds: limits.maxSessionSeconds }];
  }
  if (limits.profileId !== undefined && limits.profileDigest !== undefined) {
    physical.envelopes = [
      { envelopeId: limits.profileId, envelopeDigest: limits.profileDigest },
    ];
  }
  return { spends: [], physical };
}
