import type { OmniaLspManifest } from './manifest.js';

export type OmniaLspDirection = 'send' | 'receive' | 'both';

export interface OmniaLspCandidate {
  manifest: OmniaLspManifest;
  /** Deterministic provider-bond score, 0..100. */
  score: number;
  /** Claimed capacity in decimal units for the requested asset. */
  inboundCapacity: string;
  outboundCapacity: string;
  /** Uptime in basis points, 0..10000. */
  uptimeBps?: number;
  bonded?: boolean;
}

export interface OmniaLspRankingRequest {
  tokenId: string;
  amount: string;
  direction: OmniaLspDirection;
  requireLease?: boolean;
  requireJit?: boolean;
  maxOpenFeeBps?: number;
  now?: number;
}

export interface OmniaLspRankingPolicy {
  minScore?: number;
  requireBond?: boolean;
  allowHosted?: boolean;
  minUptimeBps?: number;
}

export interface OmniaLspRankedProvider {
  candidate: OmniaLspCandidate;
  score: number;
  /** Capacity relevant to the requested direction. */
  capacity: string;
  reasons: string[];
}

const DECIMAL_SCALE = 18n;
const DECIMAL_FACTOR = 10n ** DECIMAL_SCALE;

function decimalKey(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * DECIMAL_FACTOR + BigInt(fraction.padEnd(Number(DECIMAL_SCALE), '0').slice(0, Number(DECIMAL_SCALE)));
}

function gte(a: string, b: string): boolean {
  return decimalKey(a) >= decimalKey(b);
}

function capacityFor(
  candidate: OmniaLspCandidate,
  direction: OmniaLspDirection,
): string {
  if (direction === 'send') return candidate.outboundCapacity;
  if (direction === 'receive') return candidate.inboundCapacity;
  return gte(candidate.inboundCapacity, candidate.outboundCapacity)
    ? candidate.outboundCapacity
    : candidate.inboundCapacity;
}

function hasCapacity(candidate: OmniaLspCandidate, direction: OmniaLspDirection, amount: string): boolean {
  if (direction === 'send') return gte(candidate.outboundCapacity, amount);
  if (direction === 'receive') return gte(candidate.inboundCapacity, amount);
  return gte(candidate.inboundCapacity, amount) && gte(candidate.outboundCapacity, amount);
}

function openFeeBps(manifest: OmniaLspManifest): number {
  return manifest.fees.openBps ?? 0;
}

function uptimeBps(candidate: OmniaLspCandidate): number {
  return candidate.uptimeBps ?? 0;
}

function compareCandidates(
  a: OmniaLspRankedProvider,
  b: OmniaLspRankedProvider,
  direction: OmniaLspDirection,
): number {
  if (a.score !== b.score) return b.score - a.score;

  const feeA = openFeeBps(a.candidate.manifest);
  const feeB = openFeeBps(b.candidate.manifest);
  if (feeA !== feeB) return feeA - feeB;

  const capA = decimalKey(capacityFor(a.candidate, direction));
  const capB = decimalKey(capacityFor(b.candidate, direction));
  if (capA !== capB) return capB > capA ? 1 : -1;

  const uptimeA = uptimeBps(a.candidate);
  const uptimeBpsB = uptimeBps(b.candidate);
  if (uptimeA !== uptimeBpsB) return uptimeBpsB - uptimeA;

  return a.candidate.manifest.providerId.localeCompare(b.candidate.manifest.providerId);
}

/**
 * Rank providers deterministically for a request.
 *
 * This is a policy filter plus a stable sort. It does not verify manifests or
 * reserve capacity; callers MUST verify the manifest signature, identity
 * binding and freshness before ranking, and MUST treat capacity as a hint.
 */
export function rankProviders(
  candidates: readonly OmniaLspCandidate[],
  request: OmniaLspRankingRequest,
  policy: OmniaLspRankingPolicy = {},
): OmniaLspRankedProvider[] {
  const now = request.now ?? Date.now();
  const minScore = policy.minScore ?? 0;
  const minUptime = policy.minUptimeBps ?? 0;
  const allowHosted = policy.allowHosted ?? false;

  const ranked: OmniaLspRankedProvider[] = [];

  for (const candidate of candidates) {
    const manifest = candidate.manifest;
    const reasons: string[] = [];

    if (manifest.expiresAt <= now) {
      reasons.push('manifest expired');
    }

    const asset = manifest.assets.find((entry) => entry.tokenId === request.tokenId);
    if (!asset) reasons.push('asset not offered');
    if (asset) {
      if (!gte(request.amount, asset.minChannel)) reasons.push('amount below provider minimum');
      if (!gte(asset.maxChannel, request.amount)) reasons.push('amount above provider maximum');
    }

    if (!hasCapacity(candidate, request.direction, request.amount)) {
      reasons.push('insufficient capacity for direction');
    }
    if (request.requireLease === true && !manifest.terms.lease) {
      reasons.push('lease not offered');
    }
    if (request.requireJit === true && !manifest.terms.jit) {
      reasons.push('JIT not offered');
    }
    if (!allowHosted && (manifest.custody.mode === 'hosted' || manifest.custody.canMoveFunds)) {
      reasons.push('hosted custody not allowed');
    }
    if (candidate.score < minScore) {
      reasons.push('provider score below policy minimum');
    }
    if (policy.requireBond === true && candidate.bonded !== true) {
      reasons.push('provider bond required');
    }
    if (uptimeBps(candidate) < minUptime) {
      reasons.push('uptime below policy minimum');
    }
    if (request.maxOpenFeeBps !== undefined && openFeeBps(manifest) > request.maxOpenFeeBps) {
      reasons.push('open fee above request maximum');
    }

    if (reasons.length === 0) {
      ranked.push({
        candidate,
        score: candidate.score,
        capacity: capacityFor(candidate, request.direction),
        reasons,
      });
    }
  }

  return ranked.sort((a, b) => compareCandidates(a, b, request.direction));
}
