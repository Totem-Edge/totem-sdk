import type { SEClient } from './types.js';

export interface HttpSEClientOptions {
  /** Custom fetch implementation. Defaults to global fetch (Node 18+). */
  fetch?: typeof globalThis.fetch;
  /** Request timeout in milliseconds. Default 30 000. */
  timeoutMs?: number;
}

/**
 * HTTP implementation of SEClient that talks to any compatible SE server.
 *
 * `ownerSign(nonce)` must sign sha3_256(nonce) with the current owner's WOTS key.
 * It is called automatically inside `blindSign` and `revokeKey` after the SE
 * issues a challenge nonce — callers do not need to manage the challenge protocol.
 */
export class HttpSEClient implements SEClient {
  private readonly fetch: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly baseUrl: string,
    private readonly ownerSign: (nonce: string) => Promise<Uint8Array>,
    opts: HttpSEClientOptions = {},
  ) {
    this.fetch = opts.fetch ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    if (!this.fetch) {
      throw new Error('HttpSEClient requires a fetch implementation. Pass one via opts.fetch or use Node 18+.');
    }
  }

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}/statechain${path}`;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(this.url(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = await res.json() as any;
      if (!res.ok) throw new Error(json?.error ?? `SE request failed: ${res.status}`);
      return json as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(this.url(path), { signal: controller.signal });
      const json = await res.json() as any;
      if (!res.ok) throw new Error(json?.error ?? `SE request failed: ${res.status}`);
      return json as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async getChallenge(chainId: string): Promise<string> {
    const { nonce } = await this.get<{ nonce: string }>(`/${chainId}/challenge`);
    return nonce;
  }

  async blindSign(chainId: string, blindedCommitmentHex: string): Promise<string> {
    const nonce = await this.getChallenge(chainId);
    const sig = await this.ownerSign(nonce);
    const ownerSignature = Buffer.from(sig).toString('hex');
    const { blindSignature } = await this.post<{ blindSignature: string }>(`/${chainId}/blind-sign`, {
      blindedCommitment: blindedCommitmentHex,
      nonce,
      ownerSignature,
    });
    return blindSignature;
  }

  async revokeKey(
    chainId: string,
    opts: {
      previousOwnerPartyId: string;
      previousOwnerPkd: string;
      newOwnerPartyId: string;
      newOwnerPkd: string;
      newReclaimTxHex: string;
    },
  ): Promise<void> {
    const nonce = await this.getChallenge(chainId);
    const sig = await this.ownerSign(nonce);
    const ownerSignature = Buffer.from(sig).toString('hex');
    await this.post(`/${chainId}/revoke-key`, { ...opts, nonce, ownerSignature });
  }

  async isRevoked(_ownerPartyId: string): Promise<boolean> {
    // The server enforces revocation internally — clients don't need to pre-check.
    return false;
  }

  async registerChain(
    chainId: string,
    _coinId: string,
    _ownerPublicKeyDigest: string,
    _lockingScript: string,
  ): Promise<void> {
    // Registration happens server-side during create; no separate call needed for HttpSEClient.
    void chainId;
  }
}
