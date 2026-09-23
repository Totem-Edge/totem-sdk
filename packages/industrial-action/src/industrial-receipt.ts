/**
 * RFC-010 §6.7 — industrial receipts as authority-bound evidence.
 *
 * Emits an `@totemsdk/edge` `EdgeReceipt` (not a parallel `ActionReceipt`) whose
 * payload is self-verifying: an `integrity` hash over the receipt fields plus an
 * `authorityBinding` digest tying the commitment to the mandate proof and
 * authorization decision. Receipts feed the run receipt graph.
 */

import { createEdgeReceipt, verifyEdgeReceipt } from '@totemsdk/edge';
import type { EdgeReceipt, EdgeOperationResult } from '@totemsdk/edge';
import { hashCanonical } from '@totemsdk/core';
import type { StepEffects } from '@totemsdk/agent-policy';

import { computeAuthorityBindingHash } from './ids.js';
import type {
  PreparedDeviceOp,
  IndustrialExecutionResult,
  FailureMode,
  ActionOutcome,
} from './edge-adapter.js';
import type { ActionError } from './types.js';

const RECEIPT_DOMAIN = 'TOTEM_INDUSTRIAL_ACTION_RECEIPT_PAYLOAD_V1';
const RECEIPT_SCHEMA = 'totem:industrial:receipt/v1';

export interface IndustrialReceiptFields {
  kind: string;
  commitmentHash: string;
  operationId: string;
  authorityBinding: string;
  attempts: number;
  failureMode: FailureMode;
  outcome: ActionOutcome;
  proposalId?: string;
  resourceId?: string;
  mandateProofId?: string;
  decisionId?: string;
  effects?: StepEffects;
  error?: ActionError;
  rollback?: boolean;
  startedAt?: number;
  completedAt?: number;
}

export interface IndustrialReceiptPayload extends IndustrialReceiptFields {
  schema: typeof RECEIPT_SCHEMA;
  integrity: string;
}

export interface IndustrialReceiptExtras {
  decisionId?: string;
  effects?: StepEffects;
  error?: ActionError;
  rollback?: boolean;
  startedAt?: number;
  completedAt?: number;
  issuedAt?: number;
}

/** Build an authority-bound `EdgeReceipt` for a governed actuation. */
export function createIndustrialReceipt(
  op: PreparedDeviceOp,
  result: IndustrialExecutionResult,
  extras: IndustrialReceiptExtras = {},
): EdgeReceipt {
  const fields: IndustrialReceiptFields = {
    kind: op.kind,
    commitmentHash: op.commitmentHash,
    operationId: op.operationId,
    authorityBinding: computeAuthorityBindingHash(op.commitmentHash, op.mandateProofId, extras.decisionId),
    attempts: result.attempts,
    failureMode: result.failureMode,
    outcome: result.outcome,
    ...(op.proposalId !== undefined ? { proposalId: op.proposalId } : {}),
    ...(op.resourceId !== undefined ? { resourceId: op.resourceId } : {}),
    ...(op.mandateProofId !== undefined ? { mandateProofId: op.mandateProofId } : {}),
    ...(extras.decisionId !== undefined ? { decisionId: extras.decisionId } : {}),
    ...(extras.effects !== undefined ? { effects: extras.effects } : {}),
    ...(extras.error !== undefined ? { error: extras.error } : {}),
    ...(extras.rollback !== undefined ? { rollback: extras.rollback } : {}),
    ...(extras.startedAt !== undefined ? { startedAt: extras.startedAt } : {}),
    ...(extras.completedAt !== undefined ? { completedAt: extras.completedAt } : {}),
  };

  const payload: IndustrialReceiptPayload = {
    schema: RECEIPT_SCHEMA,
    ...fields,
    integrity: hashCanonical(RECEIPT_DOMAIN, fields),
  };

  return createEdgeReceipt({
    kind: 'industrial:action',
    payload: payload as unknown as Record<string, unknown>,
    ...(extras.issuedAt !== undefined ? { issuedAt: extras.issuedAt } : {}),
  });
}

/**
 * Verify an industrial receipt: structural (`verifyEdgeReceipt`) + payload
 * integrity + authority-binding consistency. Never returns a bare boolean.
 */
export function verifyIndustrialReceipt(receipt: unknown): EdgeOperationResult<{ receipt: EdgeReceipt }> {
  const structural = verifyEdgeReceipt(receipt);
  if (!structural.ok) return structural;

  const payload = (receipt as EdgeReceipt).payload as unknown as Partial<IndustrialReceiptPayload>;
  if (payload.schema !== RECEIPT_SCHEMA) {
    return { ok: false, error: 'not an industrial receipt', errorCode: 'INVALID_RECEIPT' };
  }
  if (typeof payload.integrity !== 'string') {
    return { ok: false, error: 'receipt integrity is missing', errorCode: 'INVALID_RECEIPT' };
  }

  const { integrity, schema: _schema, ...fields } = payload as IndustrialReceiptPayload;
  const expectedIntegrity = hashCanonical(RECEIPT_DOMAIN, fields);
  if (integrity !== expectedIntegrity) {
    return { ok: false, error: 'receipt integrity mismatch', errorCode: 'RECEIPT_TAMPERED' };
  }

  const expectedBinding = computeAuthorityBindingHash(
    fields.commitmentHash,
    fields.mandateProofId,
    fields.decisionId,
  );
  if (fields.authorityBinding !== expectedBinding) {
    return { ok: false, error: 'authority binding mismatch', errorCode: 'RECEIPT_TAMPERED' };
  }

  return { ok: true, data: { receipt: receipt as EdgeReceipt } };
}
