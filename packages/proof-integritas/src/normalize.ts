/**
 * @totemsdk/proof-integritas — Normalization functions.
 *
 * Maps raw Integritas v2 API responses to the canonical
 * ProofOperationResult / ProofVerifyResult types from @totemsdk/proof.
 * Never throws on API errors — always returns a structured result.
 */

import type { ProofOperationResult, ProofVerifyResult } from '@totemsdk/proof';
import type {
  IntegritasStampResponse,
  IntegritasCheckResponse,
  IntegritasVerifyResponse,
} from './types.js';

const SUCCESS_STATUSES = new Set(['ok', 'success', 'stamped', 'found', 'checked']);
const VERIFIED_STATUSES = new Set(['verified', 'valid', 'ok']);

export function normalizeIntegritasStampResponse(
  raw: IntegritasStampResponse,
): ProofOperationResult {
  if (SUCCESS_STATUSES.has(raw.status?.toLowerCase?.() ?? '')) {
    return {
      ok: true,
      data: {
        hash: raw.hash,
        txId: raw.txId,
        timestamp: raw.timestamp,
      },
      providerRef: 'integritas',
    };
  }
  return {
    ok: false,
    error: raw.message ?? `Integritas stamp failed (status: ${raw.status})`,
    providerRef: 'integritas',
  };
}

export function normalizeIntegritasCheckResponse(
  raw: IntegritasCheckResponse,
): ProofOperationResult {
  if (SUCCESS_STATUSES.has(raw.status?.toLowerCase?.() ?? '')) {
    return {
      ok: true,
      data: {
        hash: raw.hash,
        txId: raw.txId,
        timestamp: raw.timestamp,
      },
      providerRef: 'integritas',
    };
  }
  return {
    ok: false,
    error: raw.message ?? `Integritas check failed (status: ${raw.status})`,
    providerRef: 'integritas',
  };
}

export function normalizeIntegritasVerifyResponse(
  raw: IntegritasVerifyResponse,
): ProofVerifyResult {
  if (VERIFIED_STATUSES.has(raw.status?.toLowerCase?.() ?? '')) {
    return {
      valid: true,
    };
  }
  return {
    valid: false,
    reason: raw.message ?? `Integritas verification failed (status: ${raw.status})`,
  };
}
