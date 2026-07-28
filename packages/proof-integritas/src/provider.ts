/**
 * @totemsdk/proof-integritas — Integritas v2 ProofProvider implementation.
 *
 * createIntegritasProofProvider(config) returns an object satisfying the
 * ProofProvider interface from @totemsdk/proof. All network calls are routed
 * through config.fetch so tests can inject a mock without patching globals.
 */

import { randomUUID } from 'crypto';
import { verifyProof as localVerifyProof } from '@totemsdk/proof';
import type {
  ProofProvider,
  ProofProviderCapability,
  ProofOperationResult,
  ProofVerifyResult,
  SignedProof,
} from '@totemsdk/proof';
import type {
  IntegritasConfig,
  IntegritasCapability,
  IntegritasStampResponse,
  IntegritasCheckResponse,
  IntegritasVerifyResponse,
} from './types.js';
import {
  normalizeIntegritasStampResponse,
  normalizeIntegritasCheckResponse,
  normalizeIntegritasVerifyResponse,
} from './normalize.js';
import { integritasHashFromProof, integritasAnchorRefFromResponse } from './hash.js';

const DEFAULT_BASE_URL = 'https://integritas.minima.global/core/v2';

const INTEGRITAS_CAPABILITIES: IntegritasCapability[] = [
  'hash:stamp',
  'hash:check',
  'hash:verify',
  'proof:anchor',
  'proof:check',
  'proof:verify',
  'report:pdf',
  'nft:trace',
  'minima:onchain',
];

export function createIntegritasProofProvider(config: IntegritasConfig = {}): ProofProvider {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = config.apiKey ?? '';
  const requestIdFactory = config.requestIdFactory ?? (() => randomUUID());
  const fetchFn = config.fetch ?? globalThis.fetch;

  function buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-request-id': requestIdFactory(),
      ...extra,
    };
  }

  async function stampHash(params: { hash: string }): Promise<ProofOperationResult> {
    try {
      const res = await fetchFn(`${baseUrl}/timestamp/post`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ hash: params.hash }),
      });
      const raw = (await res.json()) as IntegritasStampResponse;
      return normalizeIntegritasStampResponse(raw);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Network error',
        providerRef: 'integritas',
      };
    }
  }

  async function checkHash(params: { hash: string }): Promise<ProofOperationResult> {
    try {
      const res = await fetchFn(`${baseUrl}/file/check`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ hash: params.hash }),
      });
      const raw = (await res.json()) as IntegritasCheckResponse;
      return normalizeIntegritasCheckResponse(raw);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Network error',
        providerRef: 'integritas',
      };
    }
  }

  async function verifyHash(params: {
    hash: string;
    reportRequired?: boolean;
  }): Promise<ProofVerifyResult> {
    try {
      const extra: Record<string, string> = {};
      if (params.reportRequired === true) {
        extra['x-report-required'] = 'true';
      }
      const res = await fetchFn(`${baseUrl}/verify/file`, {
        method: 'POST',
        headers: buildHeaders(extra),
        body: JSON.stringify({ hash: params.hash }),
      });
      const raw = (await res.json()) as IntegritasVerifyResponse;
      return normalizeIntegritasVerifyResponse(raw);
    } catch (err) {
      return {
        valid: false,
        reason: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  async function anchorProof(signedProof: SignedProof): Promise<ProofOperationResult> {
    const hash = integritasHashFromProof(signedProof);
    const result = await stampHash({ hash });
    if (result.ok && result.data != null) {
      const stampData = result.data as IntegritasStampResponse;
      const anchorRef = integritasAnchorRefFromResponse({
        status: 'ok',
        hash: (stampData as { hash?: string }).hash ?? hash,
        txId: (stampData as { txId?: string }).txId,
        timestamp: (stampData as { timestamp?: number }).timestamp,
      });
      return {
        ...result,
        data: {
          ...(result.data as Record<string, unknown>),
          anchorRef,
        },
      };
    }
    return result;
  }

  async function checkProof(signedProof: SignedProof): Promise<ProofOperationResult> {
    const hash = integritasHashFromProof(signedProof);
    return checkHash({ hash });
  }

  async function verifyProof(
    signedProof: SignedProof,
    options?: { skipLocalVerification?: boolean },
  ): Promise<ProofVerifyResult> {
    if (options?.skipLocalVerification !== true) {
      const localResult = localVerifyProof(signedProof);
      if (!localResult.valid) {
        return localResult;
      }
    }

    const hash = integritasHashFromProof(signedProof);
    const integritasResult = await verifyHash({ hash });

    if (!integritasResult.valid) {
      return integritasResult;
    }

    return {
      valid: true,
      signerAddress: signedProof.signature.address,
    };
  }

  return {
    capabilities: INTEGRITAS_CAPABILITIES as unknown as ProofProviderCapability[],
    stampHash,
    checkHash,
    verifyHash,
    anchorProof,
    checkProof,
    verifyProof,
  };
}
