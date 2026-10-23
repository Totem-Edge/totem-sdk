import { hashCanonical } from '@totemsdk/core';
import {
  announcementTopic,
  createAnnouncement,
  type AnnouncementCustody,
  type AnnouncementEnvelope,
  type AnnouncementLiquidity,
} from '@totemsdk/manifest';
import { computeLiquidityPoolManifestHash } from './pool-manifest.js';
import type { LiquidityPoolManifest } from './types.js';

export interface PoolAnnouncementPayload {
  poolType: string;
  purpose: string;
  capacity?: string;
  minCommitment?: string;
  maxCommitment?: string;
  lockTermsHash: string;
  feePolicyHash: string;
  riskPolicyHash: string;
}

export interface CreatePoolAnnouncementParams {
  manifest: LiquidityPoolManifest;
  publisher: string;
  sequence: number;
  createdAt: number;
  expiresAt: number;
  nonce: string;
  custody?: AnnouncementCustody;
  disclosureHash?: string;
  liquidity?: AnnouncementLiquidity;
  topics?: string[];
}

function hash(value: unknown, domain: string): string {
  return `0x${hashCanonical(domain, value ?? null)}`;
}

function topicHex(filter: Parameters<typeof announcementTopic>[0]): string {
  return `0x${Array.from(announcementTopic(filter), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Project a signed pool manifest into the generic announcement envelope.
 * The announcement references the pool manifest by id + hash; it does not
 * restate pool economics.
 */
export function createPoolAnnouncement(
  params: CreatePoolAnnouncementParams,
): AnnouncementEnvelope<PoolAnnouncementPayload> {
  const { manifest } = params;
  const subjectHash = `0x${computeLiquidityPoolManifestHash(manifest).toLowerCase()}`;

  const topics = params.topics ?? [
    topicHex({ kind: 'liquidity-pool' }),
    topicHex({ kind: 'liquidity-pool', asset: manifest.asset }),
  ];

  return createAnnouncement<PoolAnnouncementPayload>({
    kind: 'liquidity-pool',
    subjectId: manifest.poolId,
    subjectHash,
    publisher: params.publisher,
    sequence: params.sequence,
    createdAt: params.createdAt,
    expiresAt: params.expiresAt,
    custody: params.custody,
    disclosureHash: params.disclosureHash,
    liquidity: params.liquidity,
    topics,
    payload: {
      poolType: manifest.poolType,
      purpose: manifest.purpose,
      capacity: manifest.totalCapacity?.toString(),
      minCommitment: manifest.minCommitment?.toString(),
      maxCommitment: manifest.maxCommitment?.toString(),
      lockTermsHash: hash(manifest.lockTerms, 'totemsdk:liquidity-bond:lock-terms:v1'),
      feePolicyHash: hash(manifest.feePolicy, 'totemsdk:liquidity-bond:fee-policy:v1'),
      riskPolicyHash: hash(manifest.riskPolicy, 'totemsdk:liquidity-bond:risk-policy:v1'),
    },
    nonce: params.nonce,
  });
}
