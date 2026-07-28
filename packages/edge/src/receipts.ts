/**
 * Edge receipt creation and verification.
 *
 * EdgeReceipt is an app/runtime-level receipt. It may reference existing
 * receipt IDs from other layers via relatedManifestId, relatedIdentityId,
 * and payload fields. It does NOT represent chain-level settlement finality.
 *
 * verifyEdgeReceipt always returns a structured EdgeOperationResult, never a bare boolean.
 */

import { sha3_256 } from '@totemsdk/core';
import { canonicalJson, toHex } from './canonical.js';
import type { EdgeReceipt, EdgeOperationResult } from './types.js';

export function createEdgeReceipt(opts: {
  kind: string;
  payload: Record<string, unknown>;
  relatedManifestId?: string;
  relatedIdentityId?: string;
  issuedAt?: number;
}): EdgeReceipt {
  const { kind, payload, relatedManifestId, relatedIdentityId } = opts;
  const issuedAt = opts.issuedAt ?? Date.now();

  const canonical = canonicalJson({ kind, payload, relatedManifestId, relatedIdentityId, issuedAt });
  const hash = sha3_256(new TextEncoder().encode(canonical));
  const receiptId = `edge:receipt:${toHex(hash)}`;

  return {
    receiptId,
    kind,
    issuedAt,
    ...(relatedManifestId !== undefined ? { relatedManifestId } : {}),
    ...(relatedIdentityId !== undefined ? { relatedIdentityId } : {}),
    payload,
  };
}

export function verifyEdgeReceipt(receipt: unknown): EdgeOperationResult<{ receipt: EdgeReceipt }> {
  if (!receipt || typeof receipt !== 'object') {
    return { ok: false, error: 'receipt is not an object', errorCode: 'INVALID_RECEIPT' };
  }

  const r = receipt as Record<string, unknown>;

  if (typeof r.receiptId !== 'string') {
    return { ok: false, error: 'receipt.receiptId must be a string', errorCode: 'INVALID_RECEIPT' };
  }
  if (typeof r.kind !== 'string') {
    return { ok: false, error: 'receipt.kind must be a string', errorCode: 'INVALID_RECEIPT' };
  }
  if (typeof r.issuedAt !== 'number') {
    return { ok: false, error: 'receipt.issuedAt must be a number', errorCode: 'INVALID_RECEIPT' };
  }
  if (!r.payload || typeof r.payload !== 'object') {
    return { ok: false, error: 'receipt.payload must be an object', errorCode: 'INVALID_RECEIPT' };
  }

  return { ok: true, data: { receipt: receipt as EdgeReceipt } };
}
