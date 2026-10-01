/**
 * RFC-017: Decision Receipt Graph — a compact, canonical reference to a
 * semantic decision, carried into a governed action so the action can be linked
 * back to the decision (and its evidence) without conflating a semantic
 * decision with an Authority decision.
 *
 * A `DecisionRef` is inert metadata: it grants nothing, satisfies no policy and
 * is never an execution token.
 */

import { isDecisionFresh } from './canonical.js';
import type {
  DecisionReceipt,
  DecisionRequest,
  DecisionResult,
  DecisionSuccess,
} from './types.js';

export interface DecisionRef {
  readonly kind: 'decision';
  /** DecisionReceipt.receiptId — the semantic decision. */
  readonly receiptId: string;
  readonly decisionKind: 'questions' | 'action';
  readonly providerId: string;
  readonly issuedAt: number;
  readonly requestDigest: string;
  readonly stateDigest: string;
  readonly candidateSetDigest: string;
  readonly outputDigest: string;
  /** Optional operation/target selection, for at-a-glance correlation only. */
  readonly selected?: {
    readonly operation?: string;
    readonly target?: string;
  };
}

export interface DecisionRefRecord extends DecisionRef {
  /** 'verified' only when checked against the DecisionReceipt. */
  readonly verification: 'verified' | 'unverified';
}

function extractSelected(decision: DecisionResult | unknown): DecisionRef['selected'] | undefined {
  if (!decision || typeof decision !== 'object') return undefined;
  const d = decision as Record<string, unknown>;
  const sel = (d.selection && typeof d.selection === 'object' ? d.selection : {}) as Record<string, unknown>;
  const operation = typeof d.operation === 'string' ? d.operation : typeof sel.operation === 'string' ? sel.operation : undefined;
  const target = typeof d.target === 'string' ? d.target : typeof sel.target === 'string' ? sel.target : undefined;
  if (operation === undefined && target === undefined) return undefined;
  return { ...(operation !== undefined ? { operation } : {}), ...(target !== undefined ? { target } : {}) };
}

/**
 * Build a ref from a runtime-owned `DecisionSuccess`. Never construct a ref from
 * an untrusted provider payload.
 */
export function toDecisionRef(success: DecisionSuccess): DecisionRef {
  const receipt = success.receipt;
  const ref: DecisionRef = {
    kind: 'decision',
    receiptId: receipt.receiptId,
    decisionKind: receipt.decisionKind,
    providerId: receipt.provider.id,
    issuedAt: receipt.issuedAt,
    requestDigest: success.bindings.requestDigest,
    stateDigest: success.bindings.stateDigest,
    candidateSetDigest: success.bindings.candidateSetDigest,
    outputDigest: success.bindings.outputDigest,
  };
  const selected = extractSelected(success.decision);
  return selected ? { ...ref, selected } : ref;
}

/**
 * Verify a ref against the runtime-owned receipt. Returns false on any mismatch
 * (receipt id, kind, provider, issuedAt or any of the four digests).
 */
export function verifyDecisionRef(ref: DecisionRef, receipt: DecisionReceipt): boolean {
  return (
    ref.kind === 'decision'
    && ref.receiptId === receipt.receiptId
    && ref.decisionKind === receipt.decisionKind
    && ref.providerId === receipt.provider.id
    && ref.issuedAt === receipt.issuedAt
    && ref.requestDigest === receipt.requestDigest
    && ref.stateDigest === receipt.stateDigest
    && ref.candidateSetDigest === receipt.candidateSetDigest
    && ref.outputDigest === receipt.outputDigest
  );
}

/** Mark a ref verified/unverified against an optional receipt. */
export function toDecisionRefRecord(ref: DecisionRef, receipt?: DecisionReceipt): DecisionRefRecord {
  return {
    ...ref,
    verification: receipt && verifyDecisionRef(ref, receipt) ? 'verified' : 'unverified',
  };
}

/**
 * RFC-017 §5.5: a thin, typed convenience over `isDecisionFresh` for the
 * application handoff. The governed runtime never calls this automatically.
 */
export function isDecisionRefFreshResult(success: DecisionSuccess, currentRequest: DecisionRequest): boolean {
  return isDecisionFresh(success, currentRequest);
}
