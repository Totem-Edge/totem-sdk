import {
  createLocationClaim,
  createMovementTrail,
  createUnsignedLocationProof,
  scoreLocationClaim,
  signLocationProof,
  signLocationProofWithLease,
  validateLocationClaim,
  verifyLocationProof,
} from '@totemsdk/location-proof';
import type {
  LocationClaim,
  LocationConfidenceOptions,
  LocationSourceType,
  DeviceClass,
} from '@totemsdk/location-proof';
import type { SignedProof } from '@totemsdk/proof';
import type { EdgeLocationPort, EdgeOperationResult } from '@totemsdk/edge';

export interface LocationPortConfig {
  /**
   * Default issuer stamped onto created location proofs. When unset, the
   * claim's subjectId is used.
   */
  issuer?: string;
  /**
   * 32-byte WOTS seed. Required for signing; without it only unsigned
   * location proofs are returned, which MUST NOT be presented as completed
   * proofs.
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

const DEVICE_CLASSES: DeviceClass[] = [
  'drone',
  'vehicle',
  'robot',
  'ship',
  'tractor',
  'phone',
  'sensor',
  'gateway',
  'camera',
  'weather-station',
  'security-device',
  'other',
];

const SOURCE_TYPES: LocationSourceType[] = [
  'gnss',
  'gps',
  'rtk',
  'cell',
  'wifi',
  'ble',
  'lorawan',
  'gateway',
  'network',
  'manual',
  'derived',
  'other',
];

function assertLocationClaim(claim: unknown): asserts claim is LocationClaim {
  if (!claim || typeof claim !== 'object') {
    throw new Error('claim is not a LocationClaim');
  }
  const c = claim as LocationClaim;
  if (typeof c.subjectId !== 'string' || typeof c.deviceId !== 'string' || !c.location) {
    throw new Error('claim is not a valid LocationClaim');
  }
}

function toSourceType(type: string | undefined): LocationSourceType {
  if (type !== undefined && SOURCE_TYPES.includes(type as LocationSourceType)) {
    return type as LocationSourceType;
  }
  return 'other';
}

/**
 * Wraps @totemsdk/location-proof as an EdgeLocationPort.
 *
 * createClaim/createTrail build content-derived Totem-location claims/trails.
 * createProof returns a SignedProof when config.seed is set; otherwise it
 * returns an UnsignedProof that MUST NOT be presented as a completed proof.
 */
export function createLocationPortAdapter(config: LocationPortConfig = {}): EdgeLocationPort {
  return {
    async createClaim(params: {
      subjectId: string;
      deviceId: string;
      deviceClass?: string;
      operatorId?: string;
      observedAt?: number;
      location: { lat: number; lon: number; altitudeM?: number; accuracyM?: number };
      source: {
        type: string;
        fixType?: string;
        satellitesUsed?: number;
        hdop?: number;
        vdop?: number;
        pdop?: number;
        rawPayloadHash?: string;
        nmeaPayloadHash?: string;
        spoofingFlag?: boolean;
        jammingFlag?: boolean;
        metadata?: Record<string, unknown>;
      };
      challenge?: {
        nonce: string;
        issuedAt: number;
        expiresAt?: number;
        verifierId: string;
      };
      corroboration?: {
        beaconsSeen?: string[];
        wifiFingerprints?: string[];
        cellTowers?: string[];
        lorawanGateways?: string[];
        networkProfileId?: string;
        nearbyDeviceProofIds?: string[];
        metadata?: Record<string, unknown>;
      };
      metadata?: Record<string, unknown>;
    }): Promise<EdgeOperationResult<{ claimId: string; claim: unknown }>> {
      try {
        const deviceClass = DEVICE_CLASSES.includes(params.deviceClass as DeviceClass)
          ? (params.deviceClass as DeviceClass)
          : undefined;
        const sourceType = toSourceType(params.source.type);

        const claim = createLocationClaim({
          subjectId: params.subjectId,
          deviceId: params.deviceId,
          ...(deviceClass !== undefined ? { deviceClass } : {}),
          ...(params.operatorId !== undefined ? { operatorId: params.operatorId } : {}),
          observedAt: params.observedAt ?? Date.now(),
          location: {
            lat: params.location.lat,
            lon: params.location.lon,
            ...(params.location.altitudeM !== undefined ? { altitudeM: params.location.altitudeM } : {}),
            ...(params.location.accuracyM !== undefined ? { accuracyM: params.location.accuracyM } : {}),
          },
          source: {
            type: sourceType,
            ...(params.source.fixType !== undefined ? { fixType: params.source.fixType } : {}),
            ...(params.source.satellitesUsed !== undefined ? { satellitesUsed: params.source.satellitesUsed } : {}),
            ...(params.source.hdop !== undefined ? { hdop: params.source.hdop } : {}),
            ...(params.source.vdop !== undefined ? { vdop: params.source.vdop } : {}),
            ...(params.source.pdop !== undefined ? { pdop: params.source.pdop } : {}),
            ...(params.source.rawPayloadHash !== undefined ? { rawPayloadHash: params.source.rawPayloadHash } : {}),
            ...(params.source.nmeaPayloadHash !== undefined ? { nmeaPayloadHash: params.source.nmeaPayloadHash } : {}),
            ...(params.source.spoofingFlag !== undefined ? { spoofingFlag: params.source.spoofingFlag } : {}),
            ...(params.source.jammingFlag !== undefined ? { jammingFlag: params.source.jammingFlag } : {}),
            ...(params.source.metadata !== undefined ? { metadata: params.source.metadata } : {}),
          },
          ...(params.challenge !== undefined ? { challenge: params.challenge } : {}),
          ...(params.corroboration !== undefined ? { corroboration: params.corroboration } : {}),
          ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
        });

        const validation = validateLocationClaim(claim);
        if (!validation.valid) {
          return {
            ok: false,
            error: 'invalid location claim: ' + validation.errors.join('; '),
          };
        }

        return { ok: true, data: { claimId: claim.claimId, claim } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async scoreClaim(params: {
      claim: unknown;
      options?: LocationConfidenceOptions;
    }): Promise<EdgeOperationResult<{ score: number; level: string; positiveSignals: string[]; negativeSignals: string[] }>> {
      try {
        assertLocationClaim(params.claim);
        const result = scoreLocationClaim(params.claim, params.options);
        return {
          ok: true,
          data: {
            score: result.score,
            level: result.level,
            positiveSignals: result.positiveSignals,
            negativeSignals: result.negativeSignals,
          },
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async createTrail(params: {
      subjectId: string;
      deviceId: string;
      samples: Array<{
        observedAt: number;
        location: { lat: number; lon: number; altitudeM?: number; accuracyM?: number };
        headingDeg?: number;
        speedMps?: number;
        accuracyM?: number;
        source?: {
          type: string;
          fixType?: string;
          satellitesUsed?: number;
          hdop?: number;
          rawPayloadHash?: string;
          nmeaPayloadHash?: string;
          spoofingFlag?: boolean;
          jammingFlag?: boolean;
          metadata?: Record<string, unknown>;
        };
      }>;
      metadata?: Record<string, unknown>;
      maxSpeedMps?: number;
    }): Promise<EdgeOperationResult<{ trailId: string; trail: unknown }>> {
      try {
        const trail = createMovementTrail({
          subjectId: params.subjectId,
          deviceId: params.deviceId,
          samples: params.samples.map((sample) => ({
            observedAt: sample.observedAt,
            location: {
              lat: sample.location.lat,
              lon: sample.location.lon,
              ...(sample.location.altitudeM !== undefined ? { altitudeM: sample.location.altitudeM } : {}),
              ...(sample.location.accuracyM !== undefined ? { accuracyM: sample.location.accuracyM } : {}),
            },
            ...(sample.headingDeg !== undefined ? { headingDeg: sample.headingDeg } : {}),
            ...(sample.speedMps !== undefined ? { speedMps: sample.speedMps } : {}),
            ...(sample.accuracyM !== undefined ? { accuracyM: sample.accuracyM } : {}),
            ...(sample.source !== undefined
              ? {
                  source: {
                    ...sample.source,
                    type: toSourceType(sample.source.type),
                  },
                }
              : {}),
          })),
          ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
          ...(params.maxSpeedMps !== undefined ? { maxSpeedMps: params.maxSpeedMps } : {}),
        });

        return { ok: true, data: { trailId: trail.trailId, trail } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async createProof(params: {
      claim: unknown;
      context?: Record<string, unknown>;
    }): Promise<EdgeOperationResult<{ proofId: string; proof: unknown }>> {
      try {
        assertLocationClaim(params.claim);
        const claim = params.claim as LocationClaim;
        const issuer = (params.context?.['issuer'] as string | undefined) ?? config.issuer;

        const unsigned = createUnsignedLocationProof({
          claim,
          ...(issuer !== undefined ? { issuer } : {}),
        });

        let proof: unknown;
        let proofId: string;
        if (config.seed) {
          if (config.leaseProvider) {
            proof = await signLocationProofWithLease(unsigned, config.seed, config.leaseProvider, {
              treeId: config.leaseTreeId,
            });
          } else {
            proof = signLocationProof(unsigned, config.seed, config.keyIndex ?? 0);
          }
          proofId = (proof as SignedProof).proofId;
        } else {
          proof = unsigned;
          proofId = unsigned.proofId;
        }

        return { ok: true, data: { proofId, proof } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async verifyProof(params: {
      proof: unknown;
      now?: number;
    }): Promise<EdgeOperationResult<{ valid: boolean; reason?: string; expired?: boolean; signerAddress?: string; claimId?: string }>> {
      try {
        const result = verifyLocationProof(params.proof as SignedProof, { now: params.now });
        return {
          ok: true,
          data: {
            valid: result.valid,
            ...(result.reason !== undefined ? { reason: result.reason } : {}),
            ...(result.expired !== undefined ? { expired: result.expired } : {}),
            ...(result.signerAddress !== undefined ? { signerAddress: result.signerAddress } : {}),
            ...(result.claimId !== undefined ? { claimId: result.claimId } : {}),
          },
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}