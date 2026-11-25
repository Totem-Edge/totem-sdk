import { hexToBytes } from '@totemsdk/core';
import type { FundingProofProvider } from './funding-witness.js';

export interface AxiaFundingProofProviderConfig {
  /** Axia API base, e.g. `https://api.axia.to`. */
  apiBase: string;
  /** Project/API key sent as `x-api-key`. */
  apiKey: string;
  /** KISSVM script whose hash is the funding coin's address. */
  fundingScript: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

interface AxiaProofResponse {
  proofs?: Array<{ coinId?: string; coinProofHex?: string; error?: string }>;
  error?: string;
  message?: string;
}

/**
 * Axia funding-proof provider.
 *
 * - With a hardened lease token, use `/v1/wots-hardened/coinproofs` so the
 *   CoinProof is bound to the lease.
 * - With a local lease, fall back to `/v1/wallet/sdk/proofs`, which requires a
 *   real project x-api-key (not the shared `totem-shared` default).
 */
export function createAxiaFundingProofProvider(
  config: AxiaFundingProofProviderConfig,
): FundingProofProvider {
  const base = config.apiBase.replace(/\/+$/, '');
  const fetchImpl = config.fetchImpl ?? fetch;

  async function fetchProof(coinId: string, url: string, body: unknown): Promise<string> {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.apiKey },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as AxiaProofResponse;

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Axia hosted funding proof needs a hardened lease (OMNIA_AXIA_LEASE=true) or a project x-api-key with proof access',
        );
      }
      throw new Error(
        `${url} failed (${response.status}): ${data.error ?? data.message ?? 'unknown error'}`,
      );
    }

    const proof =
      data.proofs?.find((entry) => (entry.coinId ?? '').toLowerCase() === coinId.toLowerCase()) ??
      data.proofs?.[0];
    if (!proof?.coinProofHex) {
      throw new Error(proof?.error ?? `No CoinProof returned for ${coinId}`);
    }
    return proof.coinProofHex;
  }

  return {
    async getCoinProof(coinId, leaseToken) {
      const proofHex = leaseToken
        ? await fetchProof(coinId, `${base}/v1/wots-hardened/coinproofs`, {
            leaseToken,
            coinIds: [coinId],
          })
        : await fetchProof(coinId, `${base}/v1/wallet/sdk/proofs`, { coinIds: [coinId] });
      return hexToBytes(proofHex.replace(/^0x/i, ''));
    },

    async getFundingScript() {
      return config.fundingScript;
    },
  };
}
