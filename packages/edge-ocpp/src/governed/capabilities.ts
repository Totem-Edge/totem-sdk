/**
 * RFC-024 §5.8 — explicit, versioned OCPP capability negotiation.
 *
 * A capability change is a new profile version, never a silent upgrade. A
 * definition that needs a feature which was not negotiated is not selectable.
 */

import { ActionDefinitionError } from '@totemsdk/act-core';

export type OcppVersion = '1.6J' | '2.0.1' | '2.1';

/** Highest first; negotiation picks the newest mutually supported version. */
export const OCPP_VERSION_PREFERENCE: readonly OcppVersion[] = ['2.1', '2.0.1', '1.6J'];

export interface OcppCapabilitySet {
  readonly version: OcppVersion;
  /** Negotiated profile/feature names. */
  readonly profiles: readonly string[];
}

/** Definition kinds provided by this package. */
export const OCPP_CORE_PROFILES = [
  'charging:startSession',
  'charging:stopSession',
  'charging:setLimit',
  'charging:reserveConnector',
  'charging:clearProfile',
  'charging:readMeter',
] as const;

export type OcppProfileName = (typeof OCPP_CORE_PROFILES)[number];

/** Version-gated features. */
const VERSION_FEATURES: Record<OcppVersion, readonly string[]> = {
  // 1.6J and 2.0.1 expose the same governed operations under different action
  // names; the adapter binds them through the transport port.
  '1.6J': [...OCPP_CORE_PROFILES],
  '2.0.1': [...OCPP_CORE_PROFILES],
  '2.1': [...OCPP_CORE_PROFILES, 'charging:bidirectional'],
};

export interface NegotiateOptions {
  /** Versions the deployment can offer (CSMS/charger). */
  offered: readonly OcppVersion[];
  /** Versions this adapter supports. Defaults to 1.6J and 2.0.1. */
  supported?: readonly OcppVersion[];
  /** Profiles the deployment requires; absent features fail closed. */
  requiredProfiles?: readonly string[];
}

/**
 * Select the newest mutually supported version and assert the required profiles
 * are available. Throws `ActionDefinitionError` (registration-time failure)
 * rather than silently degrading.
 */
export function negotiateOcppCapabilities(options: NegotiateOptions): OcppCapabilitySet {
  const supported = options.supported ?? ['2.0.1', '1.6J'];
  const version = OCPP_VERSION_PREFERENCE.find(
    (candidate) => options.offered.includes(candidate) && supported.includes(candidate),
  );
  if (!version) {
    throw new ActionDefinitionError(
      `no mutually supported OCPP version (offered: ${options.offered.join(', ') || 'none'}; supported: ${supported.join(', ')})`,
    );
  }
  const profiles = VERSION_FEATURES[version];
  for (const required of options.requiredProfiles ?? []) {
    if (!profiles.includes(required)) {
      throw new ActionDefinitionError(
        `OCPP ${version} does not provide required profile '${required}'`,
      );
    }
  }
  return { version, profiles };
}

export function supportsOcppProfile(
  capabilities: OcppCapabilitySet,
  profile: string,
): boolean {
  return capabilities.profiles.includes(profile);
}
