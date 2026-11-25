import { createAxiaFundingProofProvider } from '../index';

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const config = {
  apiBase: 'https://api.axia.test/',
  apiKey: 'project-key',
  fundingScript: 'RETURN TRUE',
};

describe('Axia funding proof provider', () => {
  test('uses the hardened coinproofs endpoint when a lease token is present', async () => {
    const fetchImpl = jest.fn(async () =>
      response({ proofs: [{ coinId: '0xcoin', coinProofHex: '0x0102' }] }),
    );
    const provider = createAxiaFundingProofProvider({ ...config, fetchImpl: fetchImpl as never });

    const proof = await provider.getCoinProof('0xcoin', 'lease-token');

    expect(Buffer.from(proof).toString('hex')).toBe('0102');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.axia.test/v1/wots-hardened/coinproofs');
    expect(JSON.parse(String(init.body))).toEqual({
      leaseToken: 'lease-token',
      coinIds: ['0xcoin'],
    });
    expect(init.headers).toMatchObject({ 'x-api-key': 'project-key' });
  });

  test('falls back to the project proof endpoint without a lease token', async () => {
    const fetchImpl = jest.fn(async () =>
      response({ proofs: [{ coinId: '0xcoin', coinProofHex: '0xab' }] }),
    );
    const provider = createAxiaFundingProofProvider({ ...config, fetchImpl: fetchImpl as never });

    const proof = await provider.getCoinProof('0xcoin');

    expect(Buffer.from(proof).toString('hex')).toBe('ab');
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe('https://api.axia.test/v1/wallet/sdk/proofs');
  });

  test('explains how to get proof access when the project key is rejected', async () => {
    const fetchImpl = jest.fn(async () =>
      response({ error: 'Invalid or inactive API key' }, false, 403),
    );
    const provider = createAxiaFundingProofProvider({ ...config, fetchImpl: fetchImpl as never });

    await expect(provider.getCoinProof('0xcoin')).rejects.toThrow(
      /OMNIA_AXIA_LEASE=true|project x-api-key/,
    );
  });
});
