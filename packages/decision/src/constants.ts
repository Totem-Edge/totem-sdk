/**
 * @module @totemsdk/decision/constants
 *
 * Version, decision-type discriminators, capability strings, digest domains,
 * and default limits for the decision runtime.
 *
 * Decision has its **own** capability namespace. It is deliberately NOT an
 * intelligence domain: see RFC-012 §4. `intelligence:decision` is not a valid
 * capability and is never emitted.
 */

export const DECISION_VERSION = '0.1.0';

/** The four canonical decision semantics. */
export type DecisionType = 'choice' | 'score' | 'probability' | 'action';

/** All canonical decision type literals, in stable order. */
export const DECISION_TYPES: readonly DecisionType[] = [
  'choice',
  'score',
  'probability',
  'action',
] as const;

/**
 * Closed set of canonical decision capabilities (RFC-012 §4.2).
 *
 * v1 keeps this closed — there is no `decision:${string}` extension. The
 * provider vocabulary and the Edge capability vocabulary are identical, so an
 * adapter can never advertise a capability Edge cannot grant. Widen both
 * together when a fifth semantic type genuinely exists.
 */
export type DecisionCapability =
  | 'decision:choice'
  | 'decision:score'
  | 'decision:probability'
  | 'decision:action';

/** Back-compat alias for the canonical (closed) capability union. */
export type KnownDecisionCapability = DecisionCapability;

export const DECISION_CAPABILITIES: readonly DecisionCapability[] = [
  'decision:choice',
  'decision:score',
  'decision:probability',
  'decision:action',
] as const;

/** True when `cap` is any `decision:*` capability. */
export function isDecisionCapability(cap: string): boolean {
  return cap.startsWith('decision:');
}

/** True when the capability list contains `cap`. */
export function hasDecisionCapability(
  capabilities: readonly string[],
  cap: string,
): boolean {
  return capabilities.includes(cap);
}

/** Map a decision type to its canonical capability. */
export function decisionCapabilityForType(type: DecisionType): DecisionCapability {
  return `decision:${type}` as DecisionCapability;
}

/** Edge dispatch verbs. These are verbs, not capabilities. */
export const DECISION_VERBS = {
  decide: 'decision:decide',
  cancel: 'decision:cancel',
} as const;

/**
 * Domain separation prefixes for canonical digests. Never hash ambiguous
 * string concatenations — always go through `hashCanonical(domain, value)`.
 */
export const DECISION_DIGEST_DOMAINS = {
  state: 'TOTEM_DECISION_STATE_V1',
  candidates: 'TOTEM_DECISION_CANDIDATES_V1',
  request: 'TOTEM_DECISION_REQUEST_V1',
  output: 'TOTEM_DECISION_OUTPUT_V1',
  receipt: 'TOTEM_DECISION_RECEIPT_V1',
} as const;

export type DecisionDigestDomain =
  (typeof DECISION_DIGEST_DOMAINS)[keyof typeof DECISION_DIGEST_DOMAINS];

/** Default runtime limits. Missing limits are omitted, never invented. */
export const DECISION_DEFAULTS = {
  /** Maximum canonical state size in bytes. */
  maxStateBytes: 256 * 1024,
  /** Maximum questions in a batched questions request. */
  maxQuestions: 64,
  /** Maximum candidates for any single choice/score question. */
  maxCandidatesPerQuestion: 256,
  /** Maximum operations in an action request. */
  maxOperations: 256,
  /** Maximum targets per operation. */
  maxTargetsPerOperation: 64,
  /** Fractional tolerance when validating a complete distribution sums to 1. */
  distributionTolerance: 1e-6,
} as const;
