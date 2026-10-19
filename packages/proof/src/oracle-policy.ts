/**
 * @totemsdk/proof — Oracle observation policy / quorum / aggregation runtime (OMP-18).
 *
 * RFC-048 §3.1 defines the oracle pipeline: source adapter → canonical observation →
 * `SignedProof(kind='attestation')` → proofgraph → **independent verifier → authorized
 * feed policy/quorum/aggregation → verified condition witness**. This module is the
 * independent verifier + policy step: it turns a set of signed observations into a
 * `VerifiedObservationSetV1` (or fails closed).
 *
 * It reuses the existing evidence stack (`proof`/`proofgraph`); it does **not** define a
 * second signature scheme. The RFC's `OracleObservationV1`/`VerifiedObservationSetV1`
 * shapes are reproduced verbatim. Values use **exact integer atoms** (`valueAtoms`),
 * never floating point.
 *
 * Division of checks (RFC-048 §3.1 "MUST" list):
 *   - **this runtime**: domain separation, feed/schema (unit/scale), authorized publisher,
 *     freshness (max age), max future drift, monotone sequence, evidence-binding presence,
 *     source-independence + quorum, deviation/confidence band, aggregation method, and
 *     freeze-on-disagreement.
 *   - **caller / proofgraph**: proof-ID + WOTS signature verification (`verifyProof`),
 *     publisher authority *at observation time* and identity rotation/revocation
 *     (`proofgraph` lineage), evidence byte binding, override policy, and the
 *     execution-venue witness format (the on-chain side is `buildOracleConditionScript`).
 */

/** Domain-separation tag for an oracle observation (RFC-048 §3.1). */
export const ORACLE_OBSERVATION_DOMAIN = 'totem:oracle:observation:v1';

/** A single canonical oracle observation (RFC-048 §3.1, verbatim). */
export interface OracleObservationV1 {
  domain: 'totem:oracle:observation:v1';
  feedId: string; // e.g. minima/usdt:spot or device/123:kwh
  publisherId: string; // authorized identity, not transport socket
  /** Independent failure domain (e.g. an upstream provider); defaults to publisherId. */
  sourceId?: string;
  subjectId: string;
  valueAtoms: string; // canonical signed integer decimal
  scale: number; // defined in feed manifest
  unit: string;
  observedAtMs: number;
  validUntilMs: number;
  sequence: string; // anti-replay per feed/publisher
  contextHash: string; // domain/market/chain scope
  evidenceHash: string; // raw source evidence commitment
}

export type OracleAggregation = 'median' | 'threshold-agreement' | 'single-trusted';

export interface OraclePolicy {
  feedId: string;
  unit: string;
  scale: number;
  /** Publishers authorized to sign for this feed. */
  authorizedPublishers: string[];
  /** Minimum number of distinct independent sources required. */
  minQuorum: number;
  aggregation: OracleAggregation;
  /** Reject observations older than this at `nowMs`. */
  maxAgeMs: number;
  /** Reject observations dated further than this into the future. */
  maxFutureDriftMs: number;
  /** Max deviation (basis points) from the median for acceptance. */
  maxDeviationBps: number;
  /** threshold-agreement: fraction (bps) of the quorum that must be within the band. */
  agreementBps?: number;
  /**
   * On any source outside the deviation band, `freeze` rejects the whole set (fail
   * closed). Default: freeze. (Override/freeze policy on disagreement, RFC-048 §3.1.)
   */
  freezeOnDisagreement?: boolean;
}

/** Verified observation set (RFC-048 §3.1, verbatim). */
export interface VerifiedObservationSetV1 {
  feedId: string;
  policyId: string;
  sourceProofIds: string[];
  valueAtoms: string;
  scale: number;
  acceptedAtMs: number;
  expiresAtMs: number;
  aggregationMethod: OracleAggregation;
  provenanceGraphId: string;
  status: 'accepted';
}

export type OraclePolicyResult =
  | { accepted: true; set: VerifiedObservationSetV1 }
  | { accepted: false; reason: string };

function bpsOf(deviation: bigint, reference: bigint): bigint {
  if (reference === 0n) return deviation === 0n ? 0n : 10000n;
  return (deviation * 10000n) / reference;
}

/** Median of a non-empty list of integers (lower-middle for even counts). */
export function medianAtoms(values: bigint[]): bigint {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export interface ApplyOraclePolicyOptions {
  policyId?: string;
  /** proofgraph id linking the accepted source proofs (RFC-048 §3.1). */
  provenanceGraphId?: string;
}

/**
 * Apply an oracle policy to a candidate observation set. Returns the verified set, or
 * fails closed with a reason. `nowMs` is supplied by the caller (pure code — no
 * wall-clock). Signature/revocation/evidence-byte checks are the caller's (see header).
 */
export function applyOraclePolicy(
  observations: OracleObservationV1[],
  policy: OraclePolicy,
  nowMs: number,
  opts: ApplyOraclePolicyOptions = {},
): OraclePolicyResult {
  const forFeed = observations.filter((o) => o.feedId === policy.feedId);
  if (forFeed.length === 0) return { accepted: false, reason: `no observations for feed ${policy.feedId}` };

  const authorized = new Set(policy.authorizedPublishers);
  const freeze = policy.freezeOnDisagreement ?? true;
  const accepted: OracleObservationV1[] = [];
  const lastSeq = new Map<string, bigint>();

  for (const o of forFeed) {
    if (o.domain !== ORACLE_OBSERVATION_DOMAIN) {
      return { accepted: false, reason: `domain separation failed for ${o.publisherId}` };
    }
    if (!o.contextHash) {
      return { accepted: false, reason: `missing contextHash (scope) from ${o.publisherId}` };
    }
    if (!o.evidenceHash) {
      return { accepted: false, reason: `missing evidenceHash (evidence binding) from ${o.publisherId}` };
    }
    if (o.unit !== policy.unit || o.scale !== policy.scale) {
      return { accepted: false, reason: `schema mismatch (unit/scale) from ${o.publisherId}` };
    }
    if (!authorized.has(o.publisherId)) {
      return { accepted: false, reason: `untrusted publisher ${o.publisherId}` };
    }
    if (o.observedAtMs > nowMs + policy.maxFutureDriftMs) {
      return { accepted: false, reason: `future-dated observation from ${o.publisherId}` };
    }
    if (nowMs - o.observedAtMs > policy.maxAgeMs) {
      return { accepted: false, reason: `stale observation from ${o.publisherId}` };
    }
    if (o.validUntilMs <= nowMs) {
      return { accepted: false, reason: `expired observation from ${o.publisherId}` };
    }
    // Monotone sequence within the batch (cross-batch replay is the storage watermark's job).
    const seq = BigInt(o.sequence);
    const prev = lastSeq.get(o.publisherId);
    if (prev !== undefined && seq <= prev) {
      return { accepted: false, reason: `non-monotone sequence from ${o.publisherId}` };
    }
    lastSeq.set(o.publisherId, seq);
    accepted.push(o);
  }

  // Quorum over independent sources (distinct failure domains).
  const sources = new Set(accepted.map((o) => o.sourceId ?? o.publisherId));
  if (sources.size < policy.minQuorum) {
    return { accepted: false, reason: `quorum not met: ${sources.size} independent source(s) < ${policy.minQuorum}` };
  }
  if (policy.aggregation === 'single-trusted' && sources.size !== 1) {
    return { accepted: false, reason: 'single-trusted requires exactly one source' };
  }

  const median = medianAtoms(accepted.map((o) => BigInt(o.valueAtoms)));

  const within = accepted.filter((o) => {
    const v = BigInt(o.valueAtoms);
    const dev = v >= median ? v - median : median - v;
    return bpsOf(dev, median) <= BigInt(policy.maxDeviationBps);
  });

  if (policy.aggregation === 'threshold-agreement') {
    const needBps = BigInt(policy.agreementBps ?? 10000);
    const gotBps = (BigInt(within.length) * 10000n) / BigInt(accepted.length);
    if (gotBps < needBps) {
      return { accepted: false, reason: `agreement ${gotBps}bps < required ${needBps}bps` };
    }
  } else if (within.length < accepted.length && freeze) {
    return { accepted: false, reason: `deviation exceeds ${policy.maxDeviationBps}bps (frozen)` };
  }

  const expiresAtMs = Math.min(...accepted.map((o) => o.validUntilMs));
  return {
    accepted: true,
    set: {
      feedId: policy.feedId,
      policyId: opts.policyId ?? 'oracle-policy/v1',
      sourceProofIds: accepted.map((o) => `${o.publisherId}:${o.sequence}`),
      valueAtoms: median.toString(),
      scale: policy.scale,
      acceptedAtMs: nowMs,
      expiresAtMs,
      aggregationMethod: policy.aggregation,
      provenanceGraphId: opts.provenanceGraphId ?? '',
      status: 'accepted',
    },
  };
}
