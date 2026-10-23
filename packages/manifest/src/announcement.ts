import {
  bytesToHex,
  deserializeTreeSignature,
  hashCanonical,
  hexToBytes,
  scriptFromWotsPk,
  scriptToAddress,
  serializeTreeSignature,
  sha3_256,
  verifyTreeSignature,
  type TreeKey,
} from '@totemsdk/core';

export type AnnouncementKind =
  | 'service'
  | 'provider'
  | 'liquidity-pool'
  | 'credit-offer'
  | 'swap-rate'
  | 'router-capacity'
  | 'opportunity';

export type AnnouncementCustodyMode = 'self' | 'trust-minimised' | 'hosted' | 'unknown';

export interface AnnouncementCustody {
  mode: AnnouncementCustodyMode;
  operatorId?: string;
  canMoveFunds?: boolean;
  canFreeze?: boolean;
  disclosureHash?: string;
}

export interface AnnouncementLiquidity {
  mode: 'exact' | 'bucketed' | 'range' | 'hidden';
  advertised?: string;
  verifiedAvailable?: string;
  asOfHeight?: string;
  asOfTime?: number;
  proofRefs?: string[];
}

export interface AnnouncementEnvelope<T = unknown> {
  version: 'totemsdk-announcement/v1';
  announcementId: string;
  kind: AnnouncementKind;
  subjectId: string;
  subjectHash: string;
  publisher: string;
  sequence: number;
  createdAt: number;
  expiresAt: number;
  custody?: AnnouncementCustody;
  disclosureHash?: string;
  liquidity?: AnnouncementLiquidity;
  topics: string[];
  payload?: T;
  payloadHash: string;
  nonce: string;
}

export interface SignedAnnouncement<T = unknown> {
  announcement: AnnouncementEnvelope<T>;
  authorAddress: string;
  signerPublicKey: string;
  signedAt: number;
  signature: string;
}

export interface AnnouncementVerifyResult {
  valid: boolean;
  reason?: string;
  signerAddress: string;
}

export type AnnouncementTopicFilter = {
  index?: boolean;
  kind?: AnnouncementKind;
  asset?: string;
  custody?: AnnouncementCustodyMode;
};

const ANNOUNCEMENT_VERSION = 'totemsdk-announcement/v1';
const ANNOUNCEMENT_ID_DOMAIN = 'totemsdk:announcement:id:v1';
const ANNOUNCEMENT_DIGEST_DOMAIN = 'totemsdk:announcement:digest:v1';
const ANNOUNCEMENT_TOPIC_DOMAIN = 'totemsdk:announcement:v1';

const CUSTODY_RANK: Record<AnnouncementCustodyMode, number> = {
  self: 0,
  'trust-minimised': 1,
  hosted: 2,
  unknown: 3,
};

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) out[key] = stripUndefined(entry);
    }
    return out;
  }
  return value;
}

function hexDigest(domain: string, value: unknown): string {
  return `0x${hashCanonical(domain, stripUndefined(value))}`;
}

export function computeAnnouncementPayloadHash(payload: unknown): string {
  return hexDigest(ANNOUNCEMENT_DIGEST_DOMAIN, { payload: payload ?? null });
}

export function computeAnnouncementId(input: {
  kind: AnnouncementKind;
  subjectId: string;
  publisher: string;
}): string {
  return hexDigest(ANNOUNCEMENT_ID_DOMAIN, input);
}

export function announcementDigest(announcement: AnnouncementEnvelope): Uint8Array {
  return hexToBytes(hexDigest(ANNOUNCEMENT_DIGEST_DOMAIN, announcement));
}

export type CreateAnnouncementInput<T = unknown> = Omit<
  AnnouncementEnvelope<T>,
  'version' | 'announcementId' | 'payloadHash'
>;

export function createAnnouncement<T = unknown>(
  input: CreateAnnouncementInput<T>,
): AnnouncementEnvelope<T> {
  const announcement: AnnouncementEnvelope<T> = {
    version: ANNOUNCEMENT_VERSION,
    announcementId: computeAnnouncementId({
      kind: input.kind,
      subjectId: input.subjectId,
      publisher: input.publisher,
    }),
    kind: input.kind,
    subjectId: input.subjectId,
    subjectHash: input.subjectHash,
    publisher: input.publisher,
    sequence: input.sequence,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    custody: input.custody,
    disclosureHash: input.disclosureHash,
    liquidity: input.liquidity,
    topics: input.topics,
    payload: input.payload,
    payloadHash: computeAnnouncementPayloadHash(input.payload),
    nonce: input.nonce,
  };

  validateAnnouncement(announcement);
  return announcement;
}

export function validateAnnouncement(announcement: AnnouncementEnvelope): void {
  if (!announcement || typeof announcement !== 'object') {
    throw new Error('announcement must be an object');
  }
  if (announcement.version !== ANNOUNCEMENT_VERSION) {
    throw new Error(`unsupported announcement version: ${String(announcement.version)}`);
  }
  if (!announcement.kind) throw new Error('announcement.kind is required');
  if (!announcement.subjectId) throw new Error('announcement.subjectId is required');
  if (!announcement.subjectHash) throw new Error('announcement.subjectHash is required');
  if (!announcement.publisher) throw new Error('announcement.publisher is required');
  if (!Number.isInteger(announcement.sequence) || announcement.sequence < 0) {
    throw new Error('announcement.sequence must be a non-negative integer');
  }
  if (!Number.isFinite(announcement.createdAt) || !Number.isFinite(announcement.expiresAt)) {
    throw new Error('announcement timestamps must be finite numbers');
  }
  if (!Array.isArray(announcement.topics)) {
    throw new Error('announcement.topics must be an array');
  }
  if (announcement.custody && !(announcement.custody.mode in CUSTODY_RANK)) {
    throw new Error(`unsupported custody mode: ${String(announcement.custody.mode)}`);
  }
  if (announcement.liquidity && !['exact', 'bucketed', 'range', 'hidden'].includes(announcement.liquidity.mode)) {
    throw new Error(`unsupported liquidity mode: ${String(announcement.liquidity.mode)}`);
  }

  const expectedId = computeAnnouncementId({
    kind: announcement.kind,
    subjectId: announcement.subjectId,
    publisher: announcement.publisher,
  });
  if (announcement.announcementId !== expectedId) {
    throw new Error('announcementId does not match the canonical subject identity');
  }

  const expectedPayloadHash = computeAnnouncementPayloadHash(announcement.payload);
  if (announcement.payloadHash !== expectedPayloadHash) {
    throw new Error('payloadHash does not match the canonical payload');
  }
}

export async function signAnnouncement<T>(
  announcement: AnnouncementEnvelope<T>,
  treeKey: TreeKey,
  useIndex: number,
): Promise<SignedAnnouncement<T>> {
  validateAnnouncement(announcement);

  const digest = announcementDigest(announcement);
  const publicKey = treeKey.getPublicKey();
  treeKey.setUses(useIndex);
  const signature = serializeTreeSignature(treeKey.sign(digest)) as Uint8Array;

  return {
    announcement,
    authorAddress: scriptToAddress(scriptFromWotsPk(publicKey)),
    signerPublicKey: bytesToHex(publicKey),
    signedAt: Date.now(),
    signature: bytesToHex(signature),
  };
}

export function verifyAnnouncement(
  signed: SignedAnnouncement,
  options: { now?: number } = {},
): AnnouncementVerifyResult {
  const { announcement, signature, signerPublicKey, authorAddress } = signed;

  try {
    validateAnnouncement(announcement);
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'invalid announcement',
      signerAddress: authorAddress,
    };
  }

  if (announcement.publisher !== authorAddress) {
    return {
      valid: false,
      reason: 'authorAddress does not match announcement.publisher',
      signerAddress: authorAddress,
    };
  }

  if (options.now !== undefined && announcement.expiresAt <= options.now) {
    return {
      valid: false,
      reason: 'announcement has expired',
      signerAddress: authorAddress,
    };
  }

  try {
    const digest = announcementDigest(announcement);
    const pk = hexToBytes(signerPublicKey);
    const sig = deserializeTreeSignature(hexToBytes(signature));
    const valid = verifyTreeSignature(pk, digest, sig);
    return valid
      ? { valid: true, signerAddress: authorAddress }
      : { valid: false, reason: 'WOTS signature invalid', signerAddress: authorAddress };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'signature verification failed',
      signerAddress: authorAddress,
    };
  }
}

export function announcementTopic(filter: AnnouncementTopicFilter = {}): Uint8Array {
  const key = filter.index
    ? 'index'
    : [filter.kind, filter.asset, filter.custody].filter(Boolean).join(':') || 'index';

  return sha3_256(new TextEncoder().encode(`${ANNOUNCEMENT_TOPIC_DOMAIN}:${key}`));
}

function liquidityValue(announcement: AnnouncementEnvelope): bigint {
  const value = announcement.liquidity?.verifiedAvailable;
  if (!value) return -1n;
  try {
    return BigInt(value);
  } catch {
    return -1n;
  }
}

export function rankAnnouncements(
  announcements: readonly AnnouncementEnvelope[],
): AnnouncementEnvelope[] {
  return [...announcements].sort((a, b) => {
    const aRank = CUSTODY_RANK[a.custody?.mode ?? 'unknown'];
    const bRank = CUSTODY_RANK[b.custody?.mode ?? 'unknown'];
    if (aRank !== bRank) return aRank - bRank;

    const aLiquidity = liquidityValue(a);
    const bLiquidity = liquidityValue(b);
    if (aLiquidity !== bLiquidity) return aLiquidity > bLiquidity ? -1 : 1;

    return b.sequence - a.sequence;
  });
}
