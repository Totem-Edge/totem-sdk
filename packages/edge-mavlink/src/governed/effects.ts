/**
 * RFC-025 §5.5 — physical effects derived from the PREPARED mission command.
 *
 * Speed and duration are ceilings; the envelope reference binds the receipt to
 * the exact plan that was authorized.
 */

import type { StepEffects } from '@totemsdk/agent-policy';

export interface FlightLimits {
  /** Vehicle ResourceId key. */
  resource: string;
  maxSpeedMetresPerSecond: string;
  maxDurationSeconds: string;
  envelopeId: string;
  envelopeDigest: string;
}

export function deriveFlightEffects(limits: FlightLimits): StepEffects {
  return {
    spends: [],
    physical: {
      speed: [{ resource: limits.resource, metresPerSecond: limits.maxSpeedMetresPerSecond }],
      duration: [{ resource: limits.resource, seconds: limits.maxDurationSeconds }],
      envelopes: [{ envelopeId: limits.envelopeId, envelopeDigest: limits.envelopeDigest }],
    },
  };
}
