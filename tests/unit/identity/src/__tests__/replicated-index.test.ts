import { createUnifiedChildTreeKey, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import { signIdentityClaim } from '../signing.js';
import { ReplicatedIdentityClaimIndex } from '../replicated-index.js';
import type { IdentityClaim } from '../types.js';

const SEED = new Uint8Array(32).fill(0x51);
const TREE = createUnifiedChildTreeKey(SEED, 0);
const ADDRESS = scriptToAddress(scriptFromWotsPk(TREE.getPublicKey()));

function claim(subject: string): IdentityClaim {
  return {
    id: 'claim-1', type: 'service_endpoint', issuer: ADDRESS, subject,
    object: 'https://example.test', issuedAt: 1, payload: { scopes: ['identity'] },
  };
}

describe('replicated identity claim index', () => {
  it('writes only verified claims and re-verifies reads', async () => {
    const data = new Map<string, unknown>();
    const index = {
      get: async (k: string) => data.get(k) ?? null,
      put: async (k: string, v: unknown) => { data.set(k, v); },
      async *list(prefix = '') {
        for (const [key, value] of data) if (key.startsWith(prefix)) yield { key, value };
      },
    };
    const claims = new ReplicatedIdentityClaimIndex(index);
    const signed = await signIdentityClaim(claim('subject-1'), SEED, 0);
    expect(await claims.putClaim(signed)).toBe(true);
    expect(await claims.claimsFor('subject-1')).toHaveLength(1);

    const tampered = { ...signed, claim: { ...signed.claim, object: 'https://evil.test' } };
    expect(await claims.putClaim(tampered)).toBe(false);
  });
});
