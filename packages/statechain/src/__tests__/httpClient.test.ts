/**
 * HttpSEClient registration tests (AUD-028).
 *
 * Registration after funding must actually reach the SE server with the record
 * fields the server needs, authenticated by the owner key; it must fail closed
 * when the caller cannot supply them.
 */

import { HttpSEClient, seRequestMessage } from '../httpClient';

describe('HttpSEClient.registerChain (AUD-028)', () => {
  test('posts the locked coin with an owner-signed register message', async () => {
    const calls: Array<{ url: string; init: { body?: string } }> = [];
    const fetchMock = jest.fn(async (url: string, init: { body?: string }) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 201, json: async () => ({ ok: true }) };
    });
    const ownerSign = jest.fn(async () => new Uint8Array([1, 2, 3]));
    const client = new HttpSEClient('https://se.example', ownerSign, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });

    await client.registerChain('sc_1', '0xcoin', '0xpkd', 'RETURN TRUE', {
      ownerPartyId: 'owner-1',
      tokenId: '0x00',
      reclaimTxHex: '0xdead',
    });

    const call = calls.find((c) => c.url.includes('/register'));
    expect(call).toBeDefined();
    const body = JSON.parse(call!.init.body ?? '{}');
    expect(call!.url).toBe('https://se.example/statechain/sc_1/register');
    expect(body).toMatchObject({
      coinId: '0xcoin',
      tokenId: '0x00',
      ownerPartyId: 'owner-1',
      ownerPublicKeyDigest: '0xpkd',
      lockingScript: 'RETURN TRUE',
      reclaimTxHex: '0xdead',
    });
    expect(typeof body.nonce).toBe('string');
    expect(body.ownerSignature).toBe('010203');
    expect(ownerSign).toHaveBeenCalledWith(seRequestMessage('sc_1', 'register', body.nonce, {
      coinId: '0xcoin',
      tokenId: '0x00',
      ownerPartyId: 'owner-1',
      ownerPublicKeyDigest: '0xpkd',
      lockingScript: 'RETURN TRUE',
      reclaimTxHex: '0xdead',
    }));
  });

  test('fails closed when the record details are missing', async () => {
    const client = new HttpSEClient('https://se.example', async () => new Uint8Array(), {
      fetch: jest.fn() as unknown as typeof globalThis.fetch,
    });
    await expect(
      client.registerChain('sc_1', '0xcoin', '0xpkd', 'RETURN TRUE'),
    ).rejects.toThrow(/requires ownerPartyId/);
  });
});
